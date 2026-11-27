import { beaconAlert, classifyInternetProbe, verifyBeacon, type PinnedMeshKeys, type Probes } from '@afribit/kernel';
import * as Crypto from 'expo-crypto';
import { AfribitNetwork } from '../../modules/afribit-network';

/**
 * Real probes behind the connectivity state (PRD §12.3). Nothing here trusts the
 * Wi-Fi icon or an SSID name.
 */

/** HTTP 204 reachability endpoint (the one Android itself uses). Replace with an Afribit-operated 204 endpoint. */
export const INTERNET_PROBE_URL = 'https://connectivitycheck.gstatic.com/generate_204';

/**
 * Pinned Afribit Mesh gateway keys (keyId -> Ed25519 public key, hex). Empty until the
 * gateway beacon is deployed; with no pinned keys the app never claims local mesh trust.
 */
export const PINNED_MESH_KEYS: PinnedMeshKeys = {};
export const MESH_BEACON_URL = 'https://gateway.mesh.afribit.africa/.well-known/afribit-mesh-beacon';

async function timed<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await run(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function probeInternet(): Promise<Probes['internet']> {
  const started = Date.now();
  try {
    return await timed(8000, async (signal) => {
      const r = await fetch(`${INTERNET_PROBE_URL}?t=${started}`, { signal, headers: { 'Cache-Control': 'no-cache' } });
      const body = await r.text();
      const redirected = r.redirected || !r.url.startsWith(INTERNET_PROBE_URL);
      return classifyInternetProbe({ status: r.status, redirected, bodyLength: body.length, elapsedMs: Date.now() - started });
    });
  } catch {
    return 'fail';
  }
}

const BEACON_MAX_BYTES = 2048;

/**
 * The beacon body, or '' when there is none. On Android the request is bound to the Wi-Fi
 * network (the mesh often has no uplink, and Android then routes the default network over
 * mobile data). Elsewhere, or in a binary without the native module, plain fetch.
 */
async function fetchBeaconText(url: string): Promise<string> {
  if (AfribitNetwork) {
    try {
      const r = await AfribitNetwork.wifiGet(url, 3000, BEACON_MAX_BYTES);
      if (!r.unsupported) return r.status >= 200 && r.status < 300 && !r.tooLarge ? r.body : '';
    } catch {
      return '';
    }
  }
  try {
    return await timed(3000, async (signal) => {
      const r = await fetch(url, { signal });
      return r.ok ? await r.text() : '';
    });
  } catch {
    return '';
  }
}

/**
 * This phone's address on the Wi-Fi network. The native module reads it from the Wi-Fi
 * link itself, which still works when Android has made mobile data the default network.
 */
export function wifiAddress(netInfo: { type: string; details: unknown }): string | null {
  const native = AfribitNetwork?.wifiIpv4() ?? null;
  if (native) return native;
  if (netInfo.type !== 'wifi') return null;
  const ip = (netInfo.details as { ipAddress?: unknown } | null)?.ipAddress;
  return typeof ip === 'string' && ip.length > 0 ? ip : null;
}

/** What the person should be told about the current Wi-Fi, beyond the connectivity state. */
export type MeshAlert = 'impersonation' | 'clock' | null;

export interface MeshBeaconProbe {
  readonly beacon: Probes['meshBeacon'];
  readonly alert: MeshAlert;
}

const NO_BEACON: MeshBeaconProbe = { beacon: 'absent', alert: null };

/**
 * Asks the gateway on the current Wi-Fi to prove it is Afribit Mesh.
 *
 * `wifiIp` is this phone's address on the Wi-Fi network (null when not on Wi-Fi or unknown).
 * The mesh is Wi-Fi only, so off Wi-Fi nothing is fetched. An unreachable or missing beacon
 * is simply "not on the mesh"; a beacon that answers but fails verification means the network
 * claims to be Afribit Mesh and cannot prove it.
 */
export async function probeMeshBeacon(wifiIp: string | null): Promise<MeshBeaconProbe> {
  if (Object.keys(PINNED_MESH_KEYS).length === 0 || wifiIp === null) return NO_BEACON;
  const nonce = Crypto.randomUUID().replaceAll('-', '');
  const text = await fetchBeaconText(`${MESH_BEACON_URL}?nonce=${nonce}`);
  if (text === '') return NO_BEACON;
  let raw: unknown = null;
  try {
    raw = text.length > BEACON_MAX_BYTES ? null : (JSON.parse(text) as unknown);
  } catch {
    raw = null;
  }
  const result = verifyBeacon(raw, { expectedNonce: nonce, nowMs: Date.now(), pinnedKeys: PINNED_MESH_KEYS, expectedClientIp: wifiIp });
  if (result.ok) return { beacon: 'verified', alert: null };
  const alert = beaconAlert(result.reason);
  return { beacon: 'invalid', alert: alert === 'none' ? null : alert };
}
