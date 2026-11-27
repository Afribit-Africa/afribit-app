import type { ScopedStorage } from '@afribit/feature-sdk';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

/**
 * Storage isolation (I-1):
 * - Every namespace (the shell, each feature) gets its OWN SQLite database file,
 *   so there is no shared table a bug could read across.
 * - Secure values use a keychain service unique to the namespace.
 * - Keys are validated so a feature cannot smuggle a path or another prefix.
 */
const KEY = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_VALUE = 256 * 1024;

function checkKey(key: string): void {
  if (!KEY.test(key)) throw new Error('invalid key');
}

const databases = new Map<string, Promise<SQLite.SQLiteDatabase>>();

function database(namespace: string): Promise<SQLite.SQLiteDatabase> {
  let db = databases.get(namespace);
  if (!db) {
    db = (async () => {
      const d = await SQLite.openDatabaseAsync(`${namespace}.db`);
      await d.execAsync('PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY NOT NULL, v TEXT NOT NULL);');
      return d;
    })();
    databases.set(namespace, db);
  }
  return db;
}

export function kvStorage(namespace: string): ScopedStorage {
  return {
    async getItem(key) {
      checkKey(key);
      const row = await (await database(namespace)).getFirstAsync<{ v: string }>('SELECT v FROM kv WHERE k = ?', key);
      return row?.v ?? null;
    },
    async setItem(key, value) {
      checkKey(key);
      if (typeof value !== 'string' || value.length > MAX_VALUE) throw new Error('invalid value');
      await (await database(namespace)).runAsync('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', key, value);
    },
    async removeItem(key) {
      checkKey(key);
      await (await database(namespace)).runAsync('DELETE FROM kv WHERE k = ?', key);
    },
  };
}

export function secureStorage(namespace: string): ScopedStorage {
  const options: SecureStore.SecureStoreOptions = { keychainService: `afribit.${namespace}` };
  return {
    async getItem(key) {
      checkKey(key);
      return SecureStore.getItemAsync(key, options);
    },
    async setItem(key, value) {
      checkKey(key);
      if (value.length > 2048) throw new Error('secure values are limited to 2 KB');
      await SecureStore.setItemAsync(key, value, options);
    },
    async removeItem(key) {
      checkKey(key);
      await SecureStore.deleteItemAsync(key, options);
    },
  };
}

/** Removes a namespace's database (used by "Reset setup"). */
export async function wipeNamespace(namespace: string): Promise<void> {
  const db = databases.get(namespace);
  databases.delete(namespace);
  if (db) await (await db).closeAsync();
  await SQLite.deleteDatabaseAsync(`${namespace}.db`).catch(() => undefined);
}
