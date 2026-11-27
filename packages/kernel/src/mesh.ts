import { ed25519 } from '@noble/curves/ed25519.js';

/**
 * Afribit Mesh trust primitives.
 *
 * 1. Local beacon: a gateway on mesh Wi-Fi serves an Ed25519-signed statement.
 *    The app checks it against public keys pinned in the signed release, plus a
 *    fresh nonce and validity window. This works with the internet down.
 * 2. Join link: the captive welcome hands the router-minted one-time ticket to
 *    the app (`afribit://connect/join`) instead of the browser. Formats match
 *    the mesh service (Afribit Wi-Fi repository, lib/mesh-access/service.ts).
 */

export interface MeshBeacon {
  readonly v: 1;
  readonly keyId: string;
  readonly meshId: string;
  readonly nodeId: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly nonce: string;
  readonly clientIp: string;
  readonly sig: string;
}

export type PinnedMeshKeys = Readonly<Record<string, string>>; // keyId -> 32-byte public key, hex

export type BeaconResult =
  | { readonly ok: true; readonly beacon: MeshBeacon }
  | { readonly ok: false; readonly reason: 'malformed' | 'unknown-key' | 'bad-signature' | 'nonce-mismatch' | 'not-yet-valid' | 'expired' | 'window-too-long' | 'client-ip-unknown' | 'client-ip-mismatch' };

export type BeaconFailure = Extract<BeaconResult, { ok: false }>['reason'];

/**
 * What a failed beacon means for the person holding the phone.
 *
 * - 'impersonation': the network answered as an Afribit Mesh gateway but could not prove it
 *   (unpinned key, bad signature, replayed nonce, relayed from another address, malformed).
 * - 'clock': the beacon is authentic and fresh for this request but its times do not match
 *   this phone's clock, which is almost always a wrong date on the phone.
 * - 'none': no warning for the person. Either the phone could not check its own address, or
 *   one of our own gateways signed an overlong window (a gateway misconfiguration). The beacon
 *   still fails, so mesh trust stays off.
 */
export function beaconAlert(reason: BeaconFailure): 'impersonation' | 'clock' | 'none' {
  switch (reason) {
    case 'not-yet-valid':
    case 'expired':
      return 'clock';
    case 'client-ip-unknown':
    case 'window-too-long':
      return 'none';
    default:
      return 'impersonation';
  }
}

const MAX_SKEW_MS = 5 * 60_000;
const MAX_WINDOW_MS = 10 * 60_000;
const TOKEN = /^[A-Za-z0-9_-]{8,64}$/;
const NONCE = /^[A-Za-z0-9_-]{22,64}$/;
const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const HEX = /^[0-9a-f]+$/;
const BEACON_KEYS = ['v', 'keyId', 'meshId', 'nodeId', 'issuedAt', 'expiresAt', 'nonce', 'clientIp', 'sig'];

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !HEX.test(hex)) throw new Error('invalid hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** The exact bytes the gateway signs. Field order and separators are part of the protocol. */
export function canonicalBeacon(b: Omit<MeshBeacon, 'sig'>): Uint8Array {
  const text = ['afribit-mesh-beacon/1', b.keyId, b.meshId, b.nodeId, String(b.issuedAt), String(b.expiresAt), b.nonce, b.clientIp].join('\n');
  return new TextEncoder().encode(text);
}

function parseBeacon(raw: unknown): MeshBeacon | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length !== BEACON_KEYS.length || !BEACON_KEYS.every((k) => keys.includes(k))) return null;
  if (o.v !== 1) return null;
  for (const k of ['keyId', 'meshId', 'nodeId'] as const) if (typeof o[k] !== 'string' || !TOKEN.test(o[k] as string)) return null;
  if (typeof o.nonce !== 'string' || !NONCE.test(o.nonce)) return null;
  if (typeof o.clientIp !== 'string' || !IPV4.test(o.clientIp)) return null;
  if (!Number.isSafeInteger(o.issuedAt) || !Number.isSafeInteger(o.expiresAt)) return null;
  if (typeof o.sig !== 'string' || o.sig.length !== 128 || !HEX.test(o.sig)) return null;
  return o as unknown as MeshBeacon;
}

export function verifyBeacon(
  raw: unknown,
  opts: {
    readonly expectedNonce: string;
    readonly nowMs: number;
    readonly pinnedKeys: PinnedMeshKeys;
    /**
     * This phone's address on the Wi-Fi network, or null when the OS does not report one.
     * The gateway signs the address it saw the request come from. A different address means
     * the beacon was fetched by someone else and relayed here, for example by a fake access
     * point that proxies a real gateway.
     */
    readonly expectedClientIp: string | null;
  },
): BeaconResult {
  const b = parseBeacon(raw);
  if (!b) return { ok: false, reason: 'malformed' };
  const pub = Object.prototype.hasOwnProperty.call(opts.pinnedKeys, b.keyId) ? opts.pinnedKeys[b.keyId] : undefined;
  if (!pub) return { ok: false, reason: 'unknown-key' };

  let valid = false;
  try {
    const { sig, ...unsigned } = b;
    valid = ed25519.verify(hexToBytes(sig), canonicalBeacon(unsigned), hexToBytes(pub));
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, reason: 'bad-signature' };
  // Checked after the signature so the reasons below are about an authentic beacon.
  if (b.nonce !== opts.expectedNonce) return { ok: false, reason: 'nonce-mismatch' };
  if (b.expiresAt - b.issuedAt > MAX_WINDOW_MS || b.expiresAt <= b.issuedAt) return { ok: false, reason: 'window-too-long' };
  if (b.issuedAt > opts.nowMs + MAX_SKEW_MS) return { ok: false, reason: 'not-yet-valid' };
  if (b.expiresAt <= opts.nowMs - MAX_SKEW_MS) return { ok: false, reason: 'expired' };
  if (opts.expectedClientIp === null) return { ok: false, reason: 'client-ip-unknown' };
  if (b.clientIp !== opts.expectedClientIp) return { ok: false, reason: 'client-ip-mismatch' };
  return { ok: true, beacon: b };
}

export interface JoinLink {
  readonly ticket: string;
  readonly session: string;
}

const TICKET = /^[A-Za-z0-9_-]{43}$/;
const SESSION = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/i;
const JOIN_ORIGINS: ReadonlyArray<{ protocol: string; host: string; path: string }> = [
  { protocol: 'afribit:', host: 'connect', path: '/join' },
  { protocol: 'https:', host: 'wifi.afribit.africa', path: '/api/mesh/join' },
];

/**
 * Validates a join hand-off link. It never acts on the link: the caller must show
 * a review screen first (PRD §3.3: deep links never auto-consent).
 */
export function parseJoinLink(url: string): JoinLink | null {
  if (url.length > 512) return null;
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const path = u.pathname === '' ? '/' : u.pathname;
  const origin = JOIN_ORIGINS.find((o) => o.protocol === u.protocol && o.host === u.host && o.path === path);
  if (!origin || u.username || u.password || u.hash) return null;
  const keys = [...u.searchParams.keys()];
  if (keys.length !== 2 || !keys.includes('ticket') || !keys.includes('session')) return null;
  const ticket = u.searchParams.get('ticket') ?? '';
  const session = u.searchParams.get('session') ?? '';
  if (!TICKET.test(ticket) || !SESSION.test(session)) return null;
  return { ticket, session };
}

export interface AppJoinResponse {
  readonly deviceKey: string;
  readonly grantId: string | null;
  readonly restored: boolean;
}

const DEVICE_KEY = /^[A-Za-z0-9_-]{43}$/;
const GRANT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const APP_JOIN_KEYS = ['deviceKey', 'grantId', 'restored'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Validates the mesh service's app-join answer. The device key in it is the credential the
 * shell keeps and presents on later mesh calls, so every field is checked exactly here: a
 * caller must never store a value this function did not approve.
 */
export function parseAppJoinResponse(raw: unknown): AppJoinResponse | null {
  if (!isRecord(raw)) return null;
  const keys = Object.keys(raw);
  if (keys.length !== APP_JOIN_KEYS.length || !APP_JOIN_KEYS.every((k) => keys.includes(k))) return null;
  const { deviceKey, grantId, restored } = raw;
  if (typeof deviceKey !== 'string' || !DEVICE_KEY.test(deviceKey)) return null;
  if (grantId !== null && (typeof grantId !== 'string' || !GRANT_ID.test(grantId))) return null;
  if (typeof restored !== 'boolean') return null;
  return { deviceKey, grantId, restored };
}
