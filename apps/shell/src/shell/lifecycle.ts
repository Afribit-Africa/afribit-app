import type { ScopedStorage } from '@afribit/feature-sdk';
import { createIdentityLifecycle, createRevocationQueue, type RevocationQueue, type RevocationQueueStore } from '@afribit/kernel';
import { secureStorage } from './storage';

/** The Chat session fields needed to revoke a device. The access token is a secret. */
export interface DeviceSession {
  readonly homeserver: string;
  readonly userId: string;
  readonly deviceId: string;
  readonly accessToken: string;
}

// expo-secure-store values are small; keep each chunk comfortably below its 2 KB limit.
const CHUNK_CHARS = 1800;
const MAX_CHUNKS = 256;
const LOGOUT_TIMEOUT_MS = 10_000;
const REVOCATIONS_KEY = 'device_revocations_v1';

function chunkedSecureStore(storage: ScopedStorage, baseKey: string): RevocationQueueStore {
  const countKey = `${baseKey}_count`;
  const chunkKey = (index: number) => `${baseKey}_${index}`;

  return {
    async load() {
      const rawCount = await storage.getItem(countKey);
      if (rawCount === null) return null;
      const count = Number(rawCount);
      if (!Number.isInteger(count) || count < 0 || count > MAX_CHUNKS) return '';
      const chunks = await Promise.all(Array.from({ length: count }, (_, index) => storage.getItem(chunkKey(index))));
      if (chunks.some((chunk) => chunk === null)) return '';
      return chunks.join('');
    },
    async save(value) {
      const chunks: string[] = [];
      for (let offset = 0; offset < value.length; offset += CHUNK_CHARS) chunks.push(value.slice(offset, offset + CHUNK_CHARS));
      if (chunks.length > MAX_CHUNKS) throw new Error('revocation queue is too large');
      const rawCount = await storage.getItem(countKey);
      const previous = rawCount === null ? 0 : Number(rawCount);
      await Promise.all(chunks.map((chunk, index) => storage.setItem(chunkKey(index), chunk)));
      await storage.setItem(countKey, String(chunks.length));
      if (Number.isInteger(previous) && previous > chunks.length) {
        await Promise.all(Array.from({ length: previous - chunks.length }, (_, offset) => storage.removeItem(chunkKey(chunks.length + offset))));
      }
    },
  };
}

/**
 * Revokes the Matrix device that owns the access token. The token is the proof:
 * a 401 means it is already invalid, so there is nothing left to revoke.
 */
async function revokeDevice(item: string): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(item);
  } catch {
    return;
  }
  if (!parsed || typeof parsed !== 'object') return;
  const session = parsed as Partial<DeviceSession>;
  if (typeof session.homeserver !== 'string' || typeof session.accessToken !== 'string' || session.accessToken.length === 0) return;

  let url: URL;
  try {
    url = new URL(`${session.homeserver.replace(/\/+$/, '')}/_matrix/client/v3/logout`);
  } catch {
    return;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOGOUT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      redirect: 'error',
      headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' },
      body: '{}',
      signal: controller.signal,
    });
    if (!response.ok && response.status !== 401) throw new Error(`device revocation failed: ${response.status}`);
  } finally {
    clearTimeout(timeout);
  }
}

export const identityLifecycle = createIdentityLifecycle();

/** Items hold access tokens: the store is secure and nothing here is logged. */
export const deviceRevocations: RevocationQueue = createRevocationQueue(
  chunkedSecureStore(secureStorage('shell'), REVOCATIONS_KEY),
  revokeDevice,
  Date.now,
);

/** Called by the Chat host when the identity ends. Returns after the item is persisted. */
export function deferDeviceRevocation(session: DeviceSession): Promise<void> {
  return deviceRevocations.enqueue(JSON.stringify(session));
}
