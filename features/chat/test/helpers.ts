import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';

export function encryptedFixture() {
  const values = new Map<string, string>(); const key = randomBytes(32);
  const store = { async getItem(k: string) { return values.get(k) ?? null; }, async setItem(k: string, v: string) { values.set(k, v); }, async removeItem(k: string) { values.delete(k); } };
  const crypto = {
    randomId: randomUUID,
    async seal(value: string, aad: string) { const nonce = randomBytes(12); const c = createCipheriv('aes-256-gcm', key, nonce); c.setAAD(Buffer.from(aad)); return Buffer.concat([nonce, c.update(value), c.final(), c.getAuthTag()]).toString('base64'); },
    async unseal(value: string, aad: string) { const b = Buffer.from(value, 'base64'); const c = createDecipheriv('aes-256-gcm', key, b.subarray(0, 12)); c.setAAD(Buffer.from(aad)); c.setAuthTag(b.subarray(-16)); return Buffer.concat([c.update(b.subarray(12, -16)), c.final()]).toString(); },
  };
  return { values, store, crypto };
}
