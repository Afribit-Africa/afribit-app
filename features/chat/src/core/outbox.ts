import type { ScopedStorage } from '@afribit/feature-sdk';
import { CHAT_POLICY } from './policy';
import { ChatError, validateMessage } from './security';
import type { MatrixPort } from './types';

export interface OutboxEntry { transactionId: string; roomId: string; text: string; createdAt: number }
type Entry = OutboxEntry;
const KEY = 'outbox.v1';

/** Crash-safe queue. Persist only SDK-sealed ciphertext in the feature's secure scope. */
export class EncryptedOutbox {
  private readonly store: ScopedStorage;
  private readonly crypto: Pick<MatrixPort, 'seal' | 'unseal' | 'randomId'>;
  private readonly owner: string;
  private serial: Promise<unknown> = Promise.resolve();
  private stopped = false;
  constructor(store: ScopedStorage, crypto: Pick<MatrixPort, 'seal' | 'unseal' | 'randomId'>, owner: string) { this.store = store; this.crypto = crypto; this.owner = owner; }
  private async read(): Promise<Entry[]> {
    const ciphertext = await this.store.getItem(KEY);
    if (!ciphertext) return [];
    let entries: unknown;
    try { entries = JSON.parse(await this.crypto.unseal(ciphertext, 'chat.outbox.v1:' + this.owner)); }
    catch { throw new ChatError('outbox-unreadable'); }
    if (!Array.isArray(entries) || entries.length > CHAT_POLICY.maxOutboxEntries || entries.some(e => !e || typeof e.transactionId !== 'string' || typeof e.roomId !== 'string' || typeof e.text !== 'string' || !Number.isSafeInteger(e.createdAt))) throw new ChatError('outbox-unreadable');
    return entries as Entry[];
  }
  private async write(entries: Entry[]): Promise<void> {
    if (this.stopped) throw new ChatError('signed-out');
    if (!entries.length) { await this.store.removeItem(KEY); return; }
    const sealed = await this.crypto.seal(JSON.stringify(entries), 'chat.outbox.v1:' + this.owner);
    if (this.stopped) throw new ChatError('signed-out');
    await this.store.setItem(KEY, sealed);
  }
  private exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.serial.then(() => { if (this.stopped) throw new ChatError('signed-out'); return operation(); });
    this.serial = next.catch(() => undefined);
    return next;
  }
  enqueue(roomId: string, text: string): Promise<Entry> {
    return this.exclusive(async () => {
      const entries = await this.read();
      if (entries.length >= CHAT_POLICY.maxOutboxEntries) throw new ChatError('outbox-full');
      const entry = { transactionId: this.crypto.randomId(), roomId, text: validateMessage(text), createdAt: Date.now() };
      entries.push(entry); await this.write(entries); return entry;
    });
  }
  pending(): Promise<readonly Entry[]> { return this.exclusive(() => this.read()); }
  flush(send: (entry: Entry) => Promise<void>): Promise<void> {
    return this.exclusive(async () => {
      const entries = await this.read();
      while (entries.length) {
        if (this.stopped) throw new ChatError('signed-out');
        await send(entries[0]!);
        entries.shift();
        // A crash here reuses the same Matrix transaction ID; no duplicate message.
        await this.write(entries);
      }
    });
  }
  async wipe(): Promise<void> {
    this.stopped = true;
    await this.serial.catch(() => undefined);
    await this.store.removeItem(KEY);
  }
}
