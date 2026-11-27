import { describe, expect, it, vi } from 'vitest';
import { createConnectivityDrainTrigger, createIdentityLifecycle, createRevocationQueue, type RevocationQueueStore } from '../src';

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

class MemoryStore implements RevocationQueueStore {
  value: string | null = null;
  async load(): Promise<string | null> { return this.value; }
  async save(value: string): Promise<void> { this.value = value; }
}

describe('identity lifecycle', () => {
  it('isolates throwing, rejecting and hanging listeners', async () => {
    const lifecycle = createIdentityLifecycle();
    const ran = vi.fn();
    lifecycle.onIdentityEnding({ label: 'chat', run: async () => { ran(); } });
    lifecycle.onIdentityEnding({ label: 'wallet', run: () => { throw new Error('boom'); } });
    lifecycle.onIdentityEnding({ label: 'mesh', run: async () => { throw new Error('offline'); } });
    lifecycle.onIdentityEnding({ label: 'slow', run: () => new Promise<void>(() => undefined) });

    const result = await lifecycle.end({ timeoutMs: 20 });

    expect(ran).toHaveBeenCalledOnce();
    expect(result.completed).toEqual(['chat']);
    expect(result.failed).toEqual(['wallet', 'mesh', 'slow']);
  });

  it('runs every listener in parallel', async () => {
    const lifecycle = createIdentityLifecycle();
    const started: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    lifecycle.onIdentityEnding({ label: 'a', run: async () => { started.push('a'); await gate; } });
    lifecycle.onIdentityEnding({ label: 'b', run: async () => { started.push('b'); release(); } });

    const result = await lifecycle.end({ timeoutMs: 100 });

    expect(started).toEqual(['a', 'b']);
    expect(result).toEqual({ completed: ['a', 'b'], failed: [] });
  });

  it('stops calling a listener after unsubscribe', async () => {
    const lifecycle = createIdentityLifecycle();
    const run = vi.fn(async () => undefined);
    const unsubscribe = lifecycle.onIdentityEnding({ label: 'chat', run });
    unsubscribe();

    const result = await lifecycle.end({ timeoutMs: 20 });

    expect(run).not.toHaveBeenCalled();
    expect(result).toEqual({ completed: [], failed: [] });
  });
});

describe('connectivity drain trigger', () => {
  it('drains on entry to an online state, and again after a drop offline', () => {
    const trigger = createConnectivityDrainTrigger();
    expect(trigger('INTERNET')).toBe(true);
    expect(trigger('INTERNET')).toBe(false);
    expect(trigger('OFFLINE')).toBe(false);
    expect(trigger('INTERNET')).toBe(true);
  });

  it('drains for LOCAL_ONLY and re-arms across any non-online state', () => {
    const trigger = createConnectivityDrainTrigger();
    expect(trigger('LOCAL_ONLY')).toBe(true);
    expect(trigger('LOCAL_ONLY')).toBe(false);
    expect(trigger('DEGRADED')).toBe(false);
    expect(trigger('INTERNET')).toBe(true);
  });
});

describe('revocation queue', () => {
  it('persists an item before enqueue resolves', async () => {
    const store = new MemoryStore();
    const queue = createRevocationQueue(store, async () => undefined, () => 0);

    await queue.enqueue('device-a');

    expect(store.value).toContain('device-a');
  });

  it('survives a new queue instance and sends oldest first', async () => {
    const store = new MemoryStore();
    let at = 0;
    const first = createRevocationQueue(store, async () => undefined, () => at);
    await first.enqueue('first');
    at = 1_000;
    await first.enqueue('second');
    at = 2_000;
    await first.enqueue('third');

    const send = vi.fn(async (_item: string) => undefined);
    const second = createRevocationQueue(store, send, () => 3_000);
    const result = await second.drain();

    expect(send.mock.calls.map(([item]) => item)).toEqual(['first', 'second', 'third']);
    expect(result).toMatchObject({ sent: 3, pending: 0, corrupt: false, storeFailed: false });
    expect(JSON.parse(store.value ?? 'null')).toEqual({ v: 1, items: [] });
  });

  it('sends two identical items as two revocations', async () => {
    const store = new MemoryStore();
    const first = createRevocationQueue(store, async () => undefined, () => 0);
    await first.enqueue('same-device');
    await first.enqueue('same-device');

    const send = vi.fn(async (_item: string) => undefined);
    const second = createRevocationQueue(store, send, () => 0);
    const result = await second.drain();

    expect(send).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ sent: 2, pending: 0 });
  });

  it('removes an item only after send resolves', async () => {
    const store = new MemoryStore();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let duringSend: string | null = null;
    const queue = createRevocationQueue(store, async () => {
      duringSend = store.value;
      await gate;
    }, () => 0);
    await queue.enqueue('device-a');

    const draining = queue.drain();
    await vi.waitFor(() => expect(duringSend).not.toBeNull());

    expect(duringSend).toContain('device-a');
    release();
    await draining;
    expect(JSON.parse(store.value ?? 'null')).toEqual({ v: 1, items: [] });
  });

  it('keeps sending later items when one fails', async () => {
    const store = new MemoryStore();
    const queue = createRevocationQueue(store, async (item) => {
      if (item === 'a') throw new Error('offline');
    }, () => 0);
    await queue.enqueue('a');
    await queue.enqueue('b');

    const result = await queue.drain();

    expect(result).toMatchObject({ sent: 1, pending: 1, corrupt: false, storeFailed: false });
  });

  it('backs off for 1 minute, doubling, capped at 6 hours', async () => {
    const store = new MemoryStore();
    let at = 0;
    const send = vi.fn(async (_item: string) => { throw new Error('offline'); });
    const queue = createRevocationQueue(store, send, () => at);
    await queue.enqueue('device-a');

    const waits = [
      1 * MINUTE_MS, 2 * MINUTE_MS, 4 * MINUTE_MS, 8 * MINUTE_MS, 16 * MINUTE_MS,
      32 * MINUTE_MS, 64 * MINUTE_MS, 128 * MINUTE_MS, 256 * MINUTE_MS,
      6 * 60 * MINUTE_MS, 6 * 60 * MINUTE_MS,
    ];
    for (let attempt = 0; attempt <= waits.length; attempt += 1) {
      await queue.drain();
      expect(send).toHaveBeenCalledTimes(attempt + 1);
      const wait = waits[attempt];
      if (wait === undefined) break;
      at += wait - 1;
      await queue.drain();
      expect(send).toHaveBeenCalledTimes(attempt + 1);
      at += 1;
    }
  });

  it('drops an item after 14 days even when sending never succeeds', async () => {
    const store = new MemoryStore();
    let at = 0;
    const send = vi.fn(async (_item: string) => { throw new Error('offline'); });
    const queue = createRevocationQueue(store, send, () => at);
    await queue.enqueue('device-a');

    at = 14 * DAY_MS + 1;
    const result = await queue.drain();

    expect(send).not.toHaveBeenCalled();
    expect(result).toMatchObject({ sent: 0, pending: 0, dropped: 1, corrupt: false });
    expect(JSON.parse(store.value ?? 'null')).toEqual({ v: 1, items: [] });
  });

  it.each([
    'not json',
    '{"v":1,"items":"nope"}',
    '{"v":1,"items":[{"item":42,"createdAt":0,"attempts":0,"nextAt":0}]}',
  ])('reports and replaces corrupt stored data: %s', async (stored) => {
    const store = new MemoryStore();
    store.value = stored;
    const send = vi.fn(async (_item: string) => undefined);
    const queue = createRevocationQueue(store, send, () => 0);

    const result = await queue.drain();

    expect(result).toMatchObject({ corrupt: true, storeFailed: false });
    expect(send).not.toHaveBeenCalled();
    expect(JSON.parse(store.value ?? 'null')).toEqual({ v: 1, items: [] });

    await queue.enqueue('device-a');
    await queue.drain();
    expect(send).toHaveBeenCalledWith('device-a');
  });
});