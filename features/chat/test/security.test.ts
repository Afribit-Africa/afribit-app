import { describe, expect, it } from 'vitest';
import { encryptedFixture } from './helpers';
import { EncryptedOutbox } from '../src/core/outbox';
import { canReachMesh, parseContact, paymentRequest, requireEncryptedRoom } from '../src/core/security';
import { CHAT_POLICY } from '../src/core/policy';
import type { ChatRoom } from '../src/core/types';

describe('mesh and content boundaries', () => {
  it.each(['INTERNET', 'LOCAL_ONLY', 'DEGRADED'] as const)('allows %s with an independently verified mesh', state => {
    expect(canReachMesh({ state, meshTrust: 'local-verified', uplink: 'none', checkedAt: 1 })).toBe(true);
    expect(canReachMesh({ state, meshTrust: 'none', uplink: 'none', checkedAt: 1 })).toBe(false);
  });
  it.each(['UNTRUSTED_PORTAL', 'OFFLINE'] as const)('never sends on %s', state => expect(canReachMesh({ state, meshTrust: 'attested', uplink: 'none', checkedAt: 1 })).toBe(false));
  it('blocks plaintext rooms and changed devices', () => {
    expect(() => requireEncryptedRoom({ encrypted: false } as ChatRoom)).toThrow('encryption-required');
    expect(() => requireEncryptedRoom({ encrypted: true, verification: 'changed' } as ChatRoom)).toThrow('verification-changed');
  });
  it('parses a contact without treating it as verified or permitting federation', () => {
    const q = { v: 1, type: 'afribit.chat.contact', userId: '@amina:mesh.test', verification: 'untrusted-qr-payload' };
    expect(parseContact(JSON.stringify(q), 'mesh.test')).toEqual({ userId: q.userId, verification: q.verification });
    expect(() => parseContact(JSON.stringify(q), 'other.test')).toThrow('invalid-contact');
    expect(() => parseContact('https://evil.test', 'mesh.test')).toThrow();
  });
  it('opens payment candidates only for explicit Wallet review', () => {
    expect(paymentRequest('https://evil.test/pay')).toBeNull();
    expect(paymentRequest('lightning:lnbc1qqqqqqqqqqqqqqqqqqqqqqqqqq')).toBe('lnbc1qqqqqqqqqqqqqqqqqqqqqqqqqq');
    expect(paymentRequest('lnbc1qqqqqqqq\nqqqqqqqqqqqq')).toBeNull();
  });
});
describe('encrypted outbox', () => {
  it('never writes plaintext and binds ciphertext to the Afribit identity', async () => {
    const f = encryptedFixture(); const queue = new EncryptedOutbox(f.store, f.crypto, 'identity-one');
    await queue.enqueue('!private:mesh.test', 'secret conversation');
    expect([...f.values.values()].join()).not.toContain('secret conversation');
    expect([...f.values.values()].join()).not.toContain('private');
    const other = new EncryptedOutbox(f.store, f.crypto, 'identity-two');
    await expect(other.pending()).rejects.toThrow('outbox-unreadable');
    expect((await queue.pending())[0]!.text).toBe('secret conversation');
  });
  it('recovers a failed send after restart using the same idempotency key', async () => {
    const f = encryptedFixture(); const queue = new EncryptedOutbox(f.store, f.crypto, 'identity');
    const entry = await queue.enqueue('!room:mesh.test', 'hello');
    await expect(queue.flush(async () => { throw Error('network'); })).rejects.toThrow();
    const restarted = new EncryptedOutbox(f.store, f.crypto, 'identity'); const sent: string[] = [];
    await restarted.flush(async e => { sent.push(e.transactionId); });
    expect(sent).toEqual([entry.transactionId]); expect(f.values.size).toBe(0);
  });
  it('serializes concurrent enqueue operations instead of dropping a message', async () => {
    const f = encryptedFixture(); const queue = new EncryptedOutbox(f.store, f.crypto, 'identity');
    await Promise.all([queue.enqueue('r', 'one'), queue.enqueue('r', 'two'), queue.enqueue('r', 'three')]);
    expect((await queue.pending()).map(e => e.text)).toEqual(['one', 'two', 'three']);
    await queue.wipe(); expect(f.values.size).toBe(0); await expect(queue.enqueue('r', 'after wipe')).rejects.toThrow('signed-out');
  });
  it('rejects corrupt ciphertext without clearing it or sending garbage', async () => {
    const f = encryptedFixture(); f.values.set('outbox.v1', 'corrupt');
    await expect(new EncryptedOutbox(f.store, f.crypto, 'i').pending()).rejects.toThrow('outbox-unreadable');
    expect(f.values.get('outbox.v1')).toBe('corrupt');
  });
  it('keeps provisional directory and media policy restrictive', () => {
    expect(CHAT_POLICY.directoryDefault).toBe(false);
    expect(CHAT_POLICY.allowedMedia.every(v => v.startsWith('image/'))).toBe(true);
    expect(CHAT_POLICY.reportRoomId).toBeNull();
  });
});
