import { createHash, createHmac, createPublicKey, verify } from 'node:crypto';
import { verifyEvent } from 'nostr-tools/pure';

export class GateError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) { super(code); this.status = status; this.code = code; }
}

export interface MeshProof {
  v: 1; meshId: string; nodeId: string; featureId: 'chat'; subjectPubkey: string;
  issuedAt: number; expiresAt: number; nonce: string; keyId: string; sig: string;
}
export interface AuthConfig {
  publicOrigin: string;
  identityPepper: string;
  meshKeys: Readonly<Record<string, { meshId: string; nodeId: string; publicKeyPem: string }>>;
  allowedMeshes: readonly string[];
}
export interface Principal { identityHash: string; localpart: string; meshId: string; nodeId: string; replayKeys: readonly string[]; expiresAt: number }
export const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new GateError(400, 'invalid_request');
  return value as Record<string, unknown>;
}

/** Gateway signature format is fixed and domain separated; field order is normative. */
export function meshSigningBytes(p: Omit<MeshProof, 'sig'>): Buffer {
  return Buffer.from(JSON.stringify(['afribit.chat.mesh.v1', p.v, p.meshId, p.nodeId, p.featureId, p.subjectPubkey, p.issuedAt, p.expiresAt, p.nonce, p.keyId]));
}

export function authenticate(config: AuthConfig, authorization: string | undefined, method: string, path: string, rawBody: Buffer, now: number): Principal {
  if (!authorization?.startsWith('Nostr ') || authorization.length > 16384) throw new GateError(401, 'invalid_authorization');
  let event: ReturnType<typeof object>;
  try {
    const encoded = authorization.slice(6);
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error();
    event = object(JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')));
  } catch { throw new GateError(401, 'invalid_authorization'); }
  if (event.kind !== 27235 || event.content !== '' || typeof event.pubkey !== 'string' || !/^[a-f0-9]{64}$/.test(event.pubkey)
    || typeof event.created_at !== 'number' || !Number.isSafeInteger(event.created_at)
    || event.created_at > now + 5 || event.created_at < now - 60 || !Array.isArray(event.tags)) throw new GateError(401, 'invalid_authorization');
  try { if (!verifyEvent(event as never)) throw new Error(); } catch { throw new GateError(401, 'invalid_signature'); }
  const tag = (name: string): string => {
    const tags = (event.tags as unknown[]).filter((t): t is string[] => Array.isArray(t) && t[0] === name);
    if (tags.length !== 1 || tags[0]!.length !== 2 || typeof tags[0]![1] !== 'string') throw new GateError(401, 'invalid_authorization');
    return tags[0]![1]!;
  };
  if (method !== 'POST' || tag('method') !== method || tag('u') !== config.publicOrigin + path || tag('payload') !== sha256(rawBody)) throw new GateError(401, 'request_binding_failed');
  let p: Record<string, unknown>;
  try { p = object(JSON.parse(tag('afribit.mesh'))); }
  catch { throw new GateError(403, 'invalid_mesh_proof'); }
  if (p.v !== 1 || p.featureId !== 'chat' || p.subjectPubkey !== event.pubkey || typeof p.meshId !== 'string' || typeof p.nodeId !== 'string'
    || typeof p.keyId !== 'string' || typeof p.nonce !== 'string' || !/^[A-Za-z0-9_-]{22,128}$/.test(p.nonce)
    || typeof p.sig !== 'string' || !/^[A-Za-z0-9_-]{86}$/.test(p.sig)
    || !Number.isSafeInteger(p.issuedAt) || !Number.isSafeInteger(p.expiresAt)) throw new GateError(403, 'invalid_mesh_proof');
  const proof = p as unknown as MeshProof;
  if (proof.issuedAt > now + 5 || proof.issuedAt < now - 60 || proof.expiresAt <= now || proof.expiresAt > proof.issuedAt + 60) throw new GateError(403, 'mesh_proof_expired');
  const key = config.meshKeys[proof.keyId];
  if (!config.allowedMeshes.includes(proof.meshId) || !key || key.meshId !== proof.meshId || key.nodeId !== proof.nodeId) throw new GateError(403, 'untrusted_mesh');
  try {
    const publicKey = createPublicKey(key.publicKeyPem);
    if (publicKey.asymmetricKeyType !== 'ed25519' || !verify(null, meshSigningBytes(proof), publicKey, Buffer.from(proof.sig, 'base64url'))) throw new Error();
  } catch { throw new GateError(403, 'invalid_mesh_signature'); }
  const identityHash = createHmac('sha256', config.identityPepper).update('identity\0' + event.pubkey).digest('hex');
  const localpart = 'a_' + createHmac('sha256', config.identityPepper).update('matrix\0' + event.pubkey).digest('hex');
  return { identityHash, localpart, meshId: proof.meshId, nodeId: proof.nodeId, replayKeys: ['event:' + event.id, 'mesh:' + proof.keyId + ':' + proof.nonce], expiresAt: now + 120 };
}
