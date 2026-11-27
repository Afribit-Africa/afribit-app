import { chmodSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { createGate } from './app.ts';
import type { AuthConfig } from './auth.ts';
import { TuwunelProvider } from './matrix.ts';
import { GateStore } from './store.ts';

process.umask(0o077);
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error('Missing configuration: ' + name);
  return value;
}
const publicOrigin = required('CHAT_GATE_ORIGIN');
if (new URL(publicOrigin).protocol !== 'https:' || new URL(publicOrigin).origin !== publicOrigin) throw new Error('CHAT_GATE_ORIGIN must be an exact HTTPS origin');
function secretFile(name: string): string {
  const path = required(name);
  if ((statSync(path).mode & 0o077) !== 0) throw new Error('Secret file permissions must exclude group and other: ' + name);
  return readFileSync(path, 'utf8').trim();
}
const identityPepper = secretFile('CHAT_IDENTITY_PEPPER_FILE');
const jwtSecret = secretFile('CHAT_JWT_SECRET_FILE');
if (Buffer.byteLength(identityPepper) < 32 || Buffer.byteLength(jwtSecret) < 32) throw new Error('Secrets must contain at least 32 bytes');
const config: AuthConfig = { publicOrigin, identityPepper, meshKeys: JSON.parse(readFileSync(required('CHAT_MESH_KEYS_FILE'), 'utf8')), allowedMeshes: required('CHAT_ALLOWED_MESHES').split(',') };
const stateFile = required('CHAT_STATE_FILE');
mkdirSync(dirname(stateFile), { recursive: true, mode: 0o700 });
if ((statSync(dirname(stateFile)).mode & 0o077) !== 0) throw new Error('Chat state directory must be private (0700)');
const store = new GateStore(stateFile);
chmodSync(stateFile, 0o600);
const internalUrl = required('CHAT_MATRIX_INTERNAL_URL');
const internal = new URL(internalUrl);
if (!['127.0.0.1', '[::1]'].includes(internal.hostname) || internal.username || internal.password || internal.search || internal.hash || internal.pathname !== '/') throw new Error('Matrix internal URL must be loopback origin');
const publicUrl = required('CHAT_MATRIX_PUBLIC_URL');
if (new URL(publicUrl).protocol !== 'https:' || new URL(publicUrl).origin !== publicUrl) throw new Error('Matrix public URL must be an exact HTTPS origin');
const matrix = new TuwunelProvider({ internalUrl, publicUrl, serverName: required('CHAT_MATRIX_SERVER_NAME'), jwtSecret, jwtIssuer: publicOrigin, adminToken: secretFile('CHAT_MATRIX_ADMIN_TOKEN_FILE') });
const server = createGate({ config, store, matrix, log: record => process.stdout.write(JSON.stringify(record) + '\n') });
const port = Number(process.env.CHAT_GATE_PORT ?? 8789);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid listen port');
server.listen(port, '127.0.0.1', () => process.stdout.write('{"event":"chat_gate_ready"}\n'));
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => server.close(() => { store.close(); process.exit(0); }));
