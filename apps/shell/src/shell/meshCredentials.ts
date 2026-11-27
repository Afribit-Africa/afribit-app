import * as SecureStore from 'expo-secure-store';

/**
 * The Mesh session and device key the router hands back after an in-app join. They are the
 * credentials later mesh calls present, so they live in the shell's own keychain service and
 * never leave the keychain while the phone is locked or in another process.
 */
export interface MeshCredentials {
  readonly session: string;
  readonly deviceKey: string;
}

const SHELL_SERVICE = 'afribit.shell';
const STORE_KEY = 'meshCredentials';
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: SHELL_SERVICE,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const SESSION = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/i;
const DEVICE_KEY = /^[A-Za-z0-9_-]{43}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parse(raw: string): MeshCredentials | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  const { session, deviceKey } = value;
  if (typeof session !== 'string' || !SESSION.test(session)) return null;
  if (typeof deviceKey !== 'string' || !DEVICE_KEY.test(deviceKey)) return null;
  return { session, deviceKey };
}

/** Reads the stored credentials, deleting a value that no longer matches the expected format. */
export async function loadMeshCredentials(): Promise<MeshCredentials | null> {
  const raw = await SecureStore.getItemAsync(STORE_KEY, OPTIONS);
  if (raw === null) return null;
  const parsed = parse(raw);
  if (!parsed) {
    await SecureStore.deleteItemAsync(STORE_KEY, OPTIONS);
    return null;
  }
  return parsed;
}

export async function saveMeshCredentials(c: MeshCredentials): Promise<void> {
  if (!SESSION.test(c.session) || !DEVICE_KEY.test(c.deviceKey)) throw new Error('invalid mesh credentials');
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify({ session: c.session, deviceKey: c.deviceKey }), OPTIONS);
}

export async function clearMeshCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(STORE_KEY, OPTIONS);
}
