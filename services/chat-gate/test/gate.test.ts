import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { authenticate, GateError, meshSigningBytes, sha256, type AuthConfig, type MeshProof } from '../src/auth.ts';
import { GateStore } from '../src/store.ts';
import { createGate } from '../src/app.ts';
import type { MatrixProvider } from '../src/matrix.ts';

const now = 1795500000;
function fixture(sharedRouter?: { publicKey: KeyObject; privateKey: KeyObject }) {
  const nostr = generateSecretKey();
  const router = sharedRouter ?? generateKeyPairSync('ed25519');
  const publicKeyPem = router.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const config: AuthConfig = { publicOrigin: 'https://chat-gate.mesh.test', identityPepper: randomBytes(32).toString('hex'), meshKeys: { k1: { meshId: 'm1', nodeId: 'n1', publicKeyPem } }, allowedMeshes: ['m1'] };
  function authorization(options: { path?: string; method?: string; body?: string; payload?: string; createdAt?: number; proof?: Partial<MeshProof>; duplicate?: string; badSignature?: boolean } = {}) {
    const proof: MeshProof = { v: 1, meshId: 'm1', nodeId: 'n1', featureId: 'chat', subjectPubkey: getPublicKey(nostr), issuedAt: now, expiresAt: now + 60, nonce: randomBytes(24).toString('base64url'), keyId: 'k1', sig: '', ...options.proof };
    proof.sig = sign(null, meshSigningBytes(proof), router.privateKey).toString('base64url');
    const tags = [['u', config.publicOrigin + (options.path ?? '/v1/session')], ['method', options.method ?? 'POST'], ['payload', options.payload ?? sha256(options.body ?? '{}')], ['afribit.mesh', JSON.stringify(proof)]];
    if (options.duplicate) tags.push(tags.find(t => t[0] === options.duplicate)!);
    const event = finalizeEvent({ kind: 27235, content: '', created_at: options.createdAt ?? now, tags }, nostr);
    if (options.badSignature) event.sig = '0'.repeat(128);
    return 'Nostr ' + Buffer.from(JSON.stringify(event)).toString('base64');
  }
  return { config, authorization, router };
}
function fails(code: string, fn: () => unknown) {
  assert.throws(fn, (error: unknown) => error instanceof GateError && error.code === code);
}
test('valid NIP-98 and independently signed mesh proof bind to one opaque identity', () => {
  const f = fixture();
  const p = authenticate(f.config, f.authorization(), 'POST', '/v1/session', Buffer.from('{}'), now);
  const q = authenticate(f.config, f.authorization(), 'POST', '/v1/session', Buffer.from('{}'), now);
  assert.match(p.localpart, /^a_[a-f0-9]{64}$/);
  assert.equal(p.localpart, q.localpart);
  assert.notEqual(p.localpart.slice(2), p.identityHash);
});
for (const [name, options, code] of [
  ['bad signature', { badSignature: true }, 'invalid_signature'],
  ['wrong method', { method: 'GET' }, 'request_binding_failed'],
  ['wrong URL', { path: '/v1/session?evil=1' }, 'request_binding_failed'],
  ['wrong body hash', { payload: '0'.repeat(64) }, 'request_binding_failed'],
  ['expired event', { createdAt: now - 61 }, 'invalid_authorization'],
  ['future event', { createdAt: now + 6 }, 'invalid_authorization'],
  ['duplicate URL tag', { duplicate: 'u' }, 'invalid_authorization'],
  ['wrong feature', { proof: { featureId: 'wallet' } }, 'invalid_mesh_proof'],
  ['wrong mesh', { proof: { meshId: 'other' } }, 'untrusted_mesh'],
  ['wrong node', { proof: { nodeId: 'other' } }, 'untrusted_mesh'],
  ['wrong subject', { proof: { subjectPubkey: '0'.repeat(64) } }, 'invalid_mesh_proof'],
  ['expired proof', { proof: { expiresAt: now } }, 'mesh_proof_expired'],
  ['overlong proof', { proof: { expiresAt: now + 61 } }, 'mesh_proof_expired'],
] as const) test('rejects ' + name, () => {
  const f = fixture();
  fails(code, () => authenticate(f.config, f.authorization(options as never), 'POST', '/v1/session', Buffer.from('{}'), now));
});
test('user cannot sign their own mesh proof with their Nostr key', () => {
  const f = fixture();
  const header = f.authorization();
  const other = fixture();
  fails('invalid_mesh_signature', () => authenticate({ ...f.config, meshKeys: other.config.meshKeys }, header, 'POST', '/v1/session', Buffer.from('{}'), now));
});
test('replay survives restart, proof nonce cannot be reused, bans are enforced', () => {
  const directory = mkdtempSync(join(tmpdir(), 'afribit-gate-'));
  const file = join(directory, 'test.sqlite');
  const f = fixture();
  const principal = authenticate(f.config, f.authorization(), 'POST', '/v1/session', Buffer.from('{}'), now);
  let store = new GateStore(file);
  store.claim(principal, now);
  store.close();
  store = new GateStore(file);
  fails('authorization_replayed', () => store.claim(principal, now));
  fails('authorization_replayed', () => store.claim({ ...principal, replayKeys: ['different', principal.replayKeys[1]!] }, now));
  store.ban(principal.identityHash);
  fails('identity_unavailable', () => store.claim({ ...principal, replayKeys: ['new1', 'new2'] }, now));
  store.close();
  rmSync(directory, { recursive: true });
});
test('rate limits survive reconnect and roll back failed claims', () => {
  const f = fixture(); const store = new GateStore(':memory:');
  for (let n = 0; n < 6; n++) store.claim(authenticate(f.config, f.authorization(), 'POST', '/v1/session', Buffer.from('{}'), now), now);
  const p = authenticate(f.config, f.authorization(), 'POST', '/v1/session', Buffer.from('{}'), now);
  fails('rate_limited', () => store.claim(p, now));
  store.claim(p, now + 60);
  store.close();
});
test('HTTP sessions, ownership enforcement, revocation and redacted logs', async () => {
  const f = fixture(); const store = new GateStore(':memory:'); const logs: unknown[] = [];
  const deviceId = 'AFRIBIT_' + randomBytes(18).toString('hex');
  let revoked = false;
  const matrix: MatrixProvider = { async login(localpart) { return { homeserver: 'https://matrix.mesh.test', userId: '@' + localpart + ':mesh.test', deviceId, accessToken: 'sensitive-token' }; }, async revoke() { revoked = true; } };
  const server = createGate({ config: f.config, store, matrix, now: () => now, log: log => logs.push(log) });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  async function post(auth: string, path = '/v1/session', body = '{}') {
    return fetch('http://127.0.0.1:' + port + path, { method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, body });
  }
  try {
    const auth = f.authorization(); const response = await post(auth);
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json() as { accessToken: string }).accessToken, 'sensitive-token');
    assert.equal((await post(auth)).status, 409);
    const other = fixture(f.router);
    const body = JSON.stringify({ deviceId });
    const strangerAuth = other.authorization({ path: '/v1/device/revoke', body });
    assert.equal((await post(strangerAuth, '/v1/device/revoke', body)).status, 404);
    assert.equal(revoked, false);
    const ownerAuth = f.authorization({ path: '/v1/device/revoke', body });
    assert.equal((await post(ownerAuth, '/v1/device/revoke', body)).status, 200);
    assert.equal(revoked, true);
    const text = JSON.stringify(logs);
    assert.equal(text.includes('sensitive-token'), false);
    assert.equal(text.includes('Nostr '), false);
    assert.equal(text.includes('pubkey'), false);
    assert.equal(text.includes(deviceId), false);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); store.close(); }
});
