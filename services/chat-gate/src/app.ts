import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { performance } from 'node:perf_hooks';
import { authenticate, GateError, object, type AuthConfig } from './auth.ts';
import type { MatrixProvider } from './matrix.ts';
import type { GateStore } from './store.ts';

export interface GateDependencies { config: AuthConfig; store: GateStore; matrix: MatrixProvider; now?: () => number; log?: (record: Record<string, string | number>) => void }

function reply(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  response.end(JSON.stringify(body));
}
async function readBody(request: IncomingMessage): Promise<Buffer> {
  if (request.headers['content-type'] !== 'application/json') throw new GateError(415, 'json_required');
  if (request.headers['content-encoding']) throw new GateError(415, 'encoding_not_supported');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 8192) throw new GateError(413, 'request_too_large');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export function createGate(deps: GateDependencies) {
  let credits = 20; let refillAt = performance.now(); let active = 0;
  const server = createServer({ maxHeaderSize: 16384 }, async (req, res) => {
    const requestId = randomUUID();
    const now = deps.now?.() ?? Math.floor(Date.now() / 1000);
    let status = 500;
    let admitted = false;
    try {
      if (req.method === 'GET' && req.url === '/health') { status = 200; reply(res, status, { status: 'ok' }); return; }
      if (req.method !== 'POST' || !['/v1/session', '/v1/device/revoke'].includes(req.url ?? '')) throw new GateError(404, 'not_found');
      const tick = performance.now(); credits = Math.min(20, credits + (tick - refillAt) / 100); refillAt = tick;
      if (credits < 1 || active >= 8) { req.resume(); throw new GateError(429, 'service_busy'); }
      credits--; active++; admitted = true;
      const raw = await readBody(req);
      const principal = authenticate(deps.config, req.headers.authorization, req.method, req.url!, raw, now);
      const body = object(JSON.parse(raw.toString('utf8')));
      const fields = Object.keys(body).sort().join(',');
      if (req.url === '/v1/session' && fields !== '') throw new GateError(400, 'invalid_request');
      if (req.url === '/v1/device/revoke' && (fields !== 'deviceId' || typeof body.deviceId !== 'string' || !/^AFRIBIT_[a-f0-9]{36}$/.test(body.deviceId))) throw new GateError(400, 'invalid_request');
      deps.store.claim(principal, now);
      if (req.url === '/v1/session') {
        const session = await deps.matrix.login(principal.localpart);
        deps.store.remember(principal.identityHash, session.userId, session.deviceId);
        if (res.destroyed) {
          await deps.matrix.revoke(session);
          deps.store.forget(principal.identityHash, session.deviceId);
          return;
        }
        status = 200;
        reply(res, status, session);
      } else {
        const deviceId = body.deviceId as string;
        const userId = deps.store.owns(principal.identityHash, deviceId);
        if (!userId) throw new GateError(404, 'device_not_found');
        await deps.matrix.revoke({ userId, deviceId });
        deps.store.forget(principal.identityHash, deviceId);
        status = 200;
        reply(res, status, { status: 'revoked' });
      }
      deps.log?.({ event: 'chat_gate_request', requestId, identity: principal.identityHash, status });
    } catch (error) {
      const safe = error instanceof GateError ? error : new GateError(503, 'chat_service_unavailable');
      status = safe.status;
      reply(res, status, { error: safe.code, requestId });
      deps.log?.({ event: 'chat_gate_rejected', requestId, status, code: safe.code });
    } finally { if (admitted) active--; }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.maxRequestsPerSocket = 100;
  server.maxHeadersCount = 32;
  return server;
}
