/**
 * Identity-ending lifecycle and the durable device-revocation queue (CR-8a).
 *
 * When the person resets or signs out, every feature gets a chance to wipe its
 * local state. One feature that throws, rejects or hangs must not stop another,
 * so `end` waits for each listener only up to the caller's timeout.
 *
 * Chat's server-side device cannot be revoked while the phone is off the mesh,
 * so the request is written to a small queue instead. The shell drains it when
 * connectivity returns. Items carry device tokens: callers must keep the store
 * secure and must never log items or queue contents.
 */

import type { ConnectivityState } from '@afribit/feature-sdk';

const MINUTE_MS = 60_000;
const MAX_BACKOFF_MS = 6 * 60 * MINUTE_MS;
const EXPIRY_MS = 14 * 24 * 60 * MINUTE_MS;

export interface IdentityEndingListener {
  /** Short label for the result, usually the feature id. Never a secret. */
  readonly label: string;
  readonly run: () => void | Promise<void>;
}

export interface IdentityEndResult {
  readonly completed: readonly string[];
  readonly failed: readonly string[];
}

export interface IdentityLifecycle {
  onIdentityEnding(listener: IdentityEndingListener): () => void;
  /** Runs the listeners registered at call time, in parallel, bounded by timeoutMs. */
  end(options: { timeoutMs: number }): Promise<IdentityEndResult>;
}

function settle(listener: IdentityEndingListener, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (completed: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(completed);
    };
    const timer = setTimeout(() => finish(false), Math.max(0, timeoutMs));
    Promise.resolve()
      .then(() => listener.run())
      .then(() => finish(true), () => finish(false));
  });
}

export function createIdentityLifecycle(): IdentityLifecycle {
  const listeners = new Set<IdentityEndingListener>();
  return {
    onIdentityEnding(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    async end({ timeoutMs }) {
      const snapshot = [...listeners];
      const results = await Promise.all(snapshot.map(async (listener) => ({
        label: listener.label,
        completed: await settle(listener, timeoutMs),
      })));
      return {
        completed: results.filter((r) => r.completed).map((r) => r.label),
        failed: results.filter((r) => !r.completed).map((r) => r.label),
      };
    },
  };
}

export interface RevocationQueueStore {
  load(): Promise<string | null>;
  save(value: string): Promise<void>;
}

export interface RevocationDrainResult {
  readonly sent: number;
  readonly pending: number;
  readonly dropped: number;
  /** The persisted data was unreadable and has been replaced with an empty queue. */
  readonly corrupt: boolean;
  /** The store itself failed; nothing was lost from the caller's point of view. */
  readonly storeFailed: boolean;
}

export interface RevocationQueue {
  /** Persists the opaque item before resolving. */
  enqueue(item: string): Promise<void>;
  drain(): Promise<RevocationDrainResult>;
}

/** States in which the queue can reach the homeserver to revoke a device. */
function isOnline(state: ConnectivityState): boolean {
  return state === 'INTERNET' || state === 'LOCAL_ONLY';
}

/**
 * Gates revocation-queue drains on connectivity transitions. It fires on entry
 * into an online state and again after any drop offline, so INTERNET → OFFLINE →
 * INTERNET retries without an app restart. Without the re-arm, an item whose
 * backoff had not elapsed at start-up would wait for the next launch.
 */
export function createConnectivityDrainTrigger(): (state: ConnectivityState) => boolean {
  let drained: ConnectivityState | null = null;
  return (state) => {
    if (!isOnline(state)) {
      drained = null;
      return false;
    }
    if (drained === state) return false;
    drained = state;
    return true;
  };
}

interface StoredItem {
  readonly item: string;
  readonly createdAt: number;
  readonly attempts: number;
  readonly nextAt: number;
}

interface StoredState {
  readonly v: 1;
  readonly items: readonly StoredItem[];
}

const EMPTY: StoredState = { v: 1, items: [] };

const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function parseStored(raw: string | null): StoredState | null {
  if (raw === null) return EMPTY;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (record.v !== 1 || !Array.isArray(record.items)) return null;
  const items: StoredItem[] = [];
  for (const entry of record.items) {
    if (!entry || typeof entry !== 'object') return null;
    const item = entry as Record<string, unknown>;
    if (typeof item.item !== 'string' || item.item.length === 0) return null;
    if (!isTime(item.createdAt) || !isTime(item.attempts) || !isTime(item.nextAt)) return null;
    items.push({ item: item.item, createdAt: item.createdAt, attempts: item.attempts, nextAt: item.nextAt });
  }
  return { v: 1, items };
}

function backoffMs(attempts: number): number {
  const doublings = Math.min(Math.max(attempts - 1, 0), 30);
  return Math.min(MINUTE_MS * 2 ** doublings, MAX_BACKOFF_MS);
}

export function createRevocationQueue(
  store: RevocationQueueStore,
  send: (item: string) => Promise<void>,
  now: () => number,
): RevocationQueue {
  // Only load/save are serialised. Sends happen outside the lock, so a sign-out
  // can persist its revocation while a slow drain is still in flight.
  let serial: Promise<unknown> = Promise.resolve();
  let active: Promise<RevocationDrainResult> | undefined;

  function exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const run = serial.then(operation, operation);
    serial = run.then(() => undefined, () => undefined);
    return run;
  }

  async function readState(): Promise<{ state: StoredState; corrupt: boolean }> {
    const state = parseStored(await store.load());
    return state ? { state, corrupt: false } : { state: EMPTY, corrupt: true };
  }

  return {
    enqueue(item) {
      if (typeof item !== 'string' || item.length === 0) {
        return Promise.reject(new TypeError('item must be a non-empty string'));
      }
      return exclusive(async () => {
        const { state } = await readState();
        const at = now();
        await store.save(JSON.stringify({ v: 1, items: [...state.items, { item, createdAt: at, attempts: 0, nextAt: at }] }));
      });
    },

    drain() {
      if (active) return active;
      const run = drainOnce();
      active = run;
      run.then(() => { if (active === run) active = undefined; }, () => { if (active === run) active = undefined; });
      return run;
    },
  };

  async function drainOnce(): Promise<RevocationDrainResult> {
    const at = now();
    let corrupt = false;
    let storeFailed = false;
    let dropped = 0;
    let due: readonly StoredItem[];

    try {
      due = await exclusive(async () => {
        const loaded = await readState();
        if (loaded.corrupt) {
          corrupt = true;
          await store.save(JSON.stringify(EMPTY));
          return [];
        }
        const kept: StoredItem[] = [];
        for (const item of loaded.state.items) {
          if (at - item.createdAt >= EXPIRY_MS) dropped += 1;
          else kept.push(item);
        }
        if (dropped > 0) await store.save(JSON.stringify({ v: 1, items: kept }));
        return kept.filter((item) => item.nextAt <= at).sort((a, b) => a.createdAt - b.createdAt);
      });
    } catch {
      return { sent: 0, pending: 0, dropped: 0, corrupt: false, storeFailed: true };
    }

    let sent = 0;
    for (const item of due) {
      let ok = false;
      try {
        await send(item.item);
        ok = true;
      } catch {
        ok = false;
      }
      try {
        await exclusive(async () => {
          const loaded = await readState();
          if (loaded.corrupt) {
            corrupt = true;
            await store.save(JSON.stringify(EMPTY));
            return;
          }
          // Touch only the first match so two identical enqueues stay two sends.
          const index = loaded.state.items.findIndex((x) => x.item === item.item && x.createdAt === item.createdAt);
          const items = [...loaded.state.items];
          const current = index >= 0 ? items[index] : undefined;
          if (current) {
            if (ok) items.splice(index, 1);
            else items[index] = { ...current, attempts: current.attempts + 1, nextAt: now() + backoffMs(current.attempts + 1) };
          }
          await store.save(JSON.stringify({ v: 1, items }));
        });
        if (ok) sent += 1;
      } catch {
        storeFailed = true;
      }
    }

    let pending = 0;
    try {
      pending = await exclusive(async () => {
        const loaded = await readState();
        if (loaded.corrupt) {
          corrupt = true;
          await store.save(JSON.stringify(EMPTY));
          return 0;
        }
        const kept: StoredItem[] = [];
        for (const item of loaded.state.items) {
          if (now() - item.createdAt >= EXPIRY_MS) dropped += 1;
          else kept.push(item);
        }
        if (kept.length !== loaded.state.items.length) await store.save(JSON.stringify({ v: 1, items: kept }));
        return kept.length;
      });
    } catch {
      storeFailed = true;
    }

    return { sent, pending, dropped, corrupt, storeFailed };
  }
}