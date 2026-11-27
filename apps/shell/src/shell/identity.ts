import { assertAllowedRequest, hexToBytes, nip98Event, nip98EventId, nip98Header, npubFromPublicKey } from '@afribit/kernel';
import { schnorr } from '@noble/curves/secp256k1.js';
import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { CHAT_GATE_ORIGINS } from './chatOrigins';

/**
 * The shell owns the device Nostr key (S-09). It is created once, kept in the
 * OS keychain under a shell-only service, and never leaves the shell: features
 * only ever receive the npub through the broker's profile.read.
 *
 * The secret is never logged, never put in React state, never sent through the
 * broker, and no function here returns it.
 */
const SECRET_KEY = 'nostr.secret.v1';
const HEX32 = /^[0-9a-f]{64}$/;
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: 'afribit.shell.identity',
  requireAuthentication: false,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** Why the device key could not be produced. */
export type IdentityFailure = 'unavailable' | 'corrupt';

export type IdentityResult =
  | { readonly ok: true; readonly npub: string }
  | { readonly ok: false; readonly reason: IdentityFailure };

const toHex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** BIP-340 x-only public key (hex). Throws if the secret is not a valid secp256k1 scalar. */
function publicKeyHex(secret: Uint8Array): string {
  return toHex(schnorr.getPublicKey(secret));
}

function createSecret(): Uint8Array | null {
  // A random 32-byte draw is a valid scalar except with negligible probability;
  // redraw rather than let a bad draw abort setup.
  for (let attempt = 0; attempt < 16; attempt++) {
    const secret = getRandomBytes(32);
    try {
      schnorr.getPublicKey(secret);
      return secret;
    } catch {
      // Not a valid scalar; draw fresh randomness.
    }
  }
  return null;
}

/** npub for a stored secret, or null when it is not 32 bytes of valid hex / a valid scalar. */
function npubFromStoredSecret(hex: string): string | null {
  if (!HEX32.test(hex)) return null;
  try {
    return npubFromPublicKey(publicKeyHex(hexToBytes(hex)));
  } catch {
    return null;
  }
}

async function createIdentity(): Promise<IdentityResult> {
  let stored: string | null;
  try {
    stored = await SecureStore.getItemAsync(SECRET_KEY, OPTIONS);
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  if (stored !== null) {
    const npub = npubFromStoredSecret(stored);
    return npub ? { ok: true, npub } : { ok: false, reason: 'corrupt' };
  }
  const secret = createSecret();
  if (!secret) return { ok: false, reason: 'unavailable' };
  const npub = npubFromPublicKey(publicKeyHex(secret));
  try {
    await SecureStore.setItemAsync(SECRET_KEY, toHex(secret), OPTIONS);
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  return { ok: true, npub };
}

let inFlight: Promise<IdentityResult> | null = null;

/**
 * Creates the device key once (idempotent) and returns the npub, or a typed
 * failure: 'unavailable' when the keychain could not be read or written,
 * 'corrupt' when the stored secret is not a valid secp256k1 scalar.
 *
 * Overlapping callers (a double tap on Finish, the boot effect racing
 * onboarding) share one run. Without that, both read an empty keychain, each
 * generates a different secret and the later write orphans the earlier npub.
 * The promise is cleared once it settles so a later call re-reads storage.
 */
export function ensureIdentity(): Promise<IdentityResult> {
  if (inFlight === null) {
    inFlight = createIdentity().finally(() => { inFlight = null; });
  }
  return inFlight;
}

/** Deletes the device key ("Reset setup"). */
export async function resetIdentity(): Promise<void> {
  await SecureStore.deleteItemAsync(SECRET_KEY, OPTIONS);
}

/** Short display form: `npub1abcd…wxyz`. */
export function shortNpub(npub: string): string {
  return `${npub.slice(0, 9)}…${npub.slice(-4)}`;
}

/** The allow-list each feature may sign against. A feature outside this map gets no signature. */
const SIGNING_ORIGINS: Readonly<Record<string, readonly string[]>> = { chat: CHAT_GATE_ORIGINS };

/** A request to sign. `bodySha256` is the lowercase-hex SHA-256 of the JSON body. */
export interface AuthorizeRequest {
  readonly method: 'POST';
  readonly url: string;
  readonly bodySha256: string;
  /** Exact origins the caller allows. The feature's registered policy caps them. */
  readonly allowedOrigins: readonly string[];
}

/**
 * Signs one request as this identity and returns only the `Authorization` header (CR-3).
 * The key is read and used here and is never returned, logged or put in state, so the caller
 * only ever sees the header. The origin is checked against the caller's allow-list, capped by
 * the feature's own policy, before any signing happens.
 *
 * Throws when the feature has no policy, the origin is not allowed, or the key is missing or
 * corrupt: the caller must fail the request rather than send it unsigned.
 */
export async function authorizeRequest(featureId: string, request: AuthorizeRequest): Promise<string> {
  const policy = SIGNING_ORIGINS[featureId];
  if (!policy) throw new Error(`identity signing is not enabled for feature ${featureId}`);
  assertAllowedRequest(request.url, request.allowedOrigins.filter((origin) => policy.includes(origin)));

  const stored = await SecureStore.getItemAsync(SECRET_KEY, OPTIONS);
  if (stored === null) throw new Error('identity is not set up');
  if (!HEX32.test(stored)) throw new Error('identity key is corrupt');
  const secret = hexToBytes(stored);

  const pubkey = publicKeyHex(secret);
  const event = nip98Event({ url: request.url, method: request.method, bodySha256: request.bodySha256, createdAt: Math.floor(Date.now() / 1000) });
  const id = nip98EventId(event, pubkey);
  const sig = toHex(schnorr.sign(hexToBytes(id), secret));
  return nip98Header({ ...event, id, pubkey, sig });
}
