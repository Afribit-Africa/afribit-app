import { vaultKey } from '@afribit/kernel';
import * as SecureStore from 'expo-secure-store';

/** 4 KB ceiling for one vault secret. */
const MAX_SECRET = 4096;
/** Shell-only key listing every vault key the shell wrote, so a wipe can find them all. */
const INDEX_KEY = 'vault.index';

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: 'afribit.vault',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export interface FeatureVault {
  get(name: string): Promise<string | null>;
  put(name: string, secret: string): Promise<void>;
}

let queue: Promise<void> = Promise.resolve();

/** Vault writes share one index, so run them one at a time to avoid losing an entry. */
function serialized<T>(op: () => Promise<T>): Promise<T> {
  const run = queue.then(op, op);
  queue = run.then(() => undefined, () => undefined);
  return run;
}

/**
 * A missing index means nothing was written yet. Anything else that won't parse is
 * corruption: reading it as empty would let the next write overwrite the index and
 * orphan every key already in it, leaving those secrets behind on identity reset.
 */
async function readIndex(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(INDEX_KEY, OPTIONS);
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new Error('vault index is corrupt: not valid JSON', { cause });
  }
  if (!Array.isArray(parsed) || !parsed.every((k): k is string => typeof k === 'string')) {
    throw new Error('vault index is corrupt: expected an array of strings');
  }
  return parsed;
}

async function rememberKey(key: string): Promise<void> {
  const index = await readIndex();
  if (index.includes(key)) return;
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify([...index, key]), OPTIONS);
}

/** A feature's secrets, namespaced to that feature. Values are never logged. */
export function featureVault(featureId: string): FeatureVault {
  return {
    async get(name) {
      return SecureStore.getItemAsync(vaultKey(featureId, name), OPTIONS);
    },
    async put(name, secret) {
      const key = vaultKey(featureId, name);
      if (typeof secret !== 'string' || secret.length === 0) throw new Error('vault secret must be a non-empty string');
      if (secret.length > MAX_SECRET) throw new Error('vault secret exceeds 4 KB');
      await serialized(async () => {
        // Index the key first. An index entry with no secret is harmless (the wipe
        // no-ops on a missing key), but a secret with no index entry is unreachable
        // and survives an identity reset.
        await rememberKey(key);
        await SecureStore.setItemAsync(key, secret, OPTIONS);
      });
    },
  };
}

/** The identity is ending: forget every secret the shell wrote to a feature vault. */
export async function wipeAllVaults(): Promise<void> {
  await serialized(async () => {
    const index = await readIndex();
    await Promise.all(index.map((key) => SecureStore.deleteItemAsync(key, OPTIONS)));
    await SecureStore.deleteItemAsync(INDEX_KEY, OPTIONS);
  });
}
