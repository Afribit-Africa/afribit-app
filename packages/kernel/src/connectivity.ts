import type { ConnectivitySnapshot, ConnectivityState, MeshTrust, Uplink } from '@afribit/feature-sdk';

/**
 * Connectivity is derived from real probes, not the Wi-Fi icon (PRD §12.3, §20).
 *
 * - internet: result of an HTTPS reachability probe to an Afribit endpoint.
 *   'captive' means the probe was intercepted (redirect or unexpected body).
 * - meshBeacon: result of verifying the signed local beacon (see mesh.ts).
 * - meshAttested: an enrolled router attested this device (join ticket redeemed)
 *   during the current network session.
 * - internetVia: the interface the internet probe actually used.
 * - cellularOptIn: whether the person has enabled mobile data for internet use.
 */
export interface Probes {
  readonly internet: 'ok' | 'slow' | 'captive' | 'fail' | 'unknown';
  readonly meshBeacon: 'verified' | 'invalid' | 'absent' | 'unknown';
  readonly meshAttested: boolean;
  readonly internetVia: 'wifi' | 'cellular' | 'none';
  readonly cellularOptIn: boolean;
  readonly checkedAt: number;
}

export function deriveConnectivity(p: Probes): ConnectivitySnapshot {
  // An invalid beacon is a red flag (spoofed or misconfigured gateway). It cancels mesh trust.
  let meshTrust: MeshTrust = 'none';
  if (p.meshBeacon !== 'invalid') {
    if (p.meshAttested) meshTrust = 'attested';
    else if (p.meshBeacon === 'verified') meshTrust = 'local-verified';
  }
  const onVerifiedMesh = p.meshBeacon === 'verified' || meshTrust === 'attested';

  const internetUp = p.internet === 'ok' || p.internet === 'slow';
  let uplink: Uplink = 'none';
  if (internetUp && p.internetVia === 'wifi' && onVerifiedMesh) uplink = 'mesh';
  else if (internetUp && p.internetVia === 'cellular' && p.cellularOptIn) uplink = 'mobile-opt-in';

  let state: ConnectivityState;
  switch (p.internet) {
    case 'ok':
      state = 'INTERNET';
      break;
    case 'slow':
      state = 'DEGRADED';
      break;
    case 'captive':
      // A captive page from a verified Afribit Mesh gateway is local service, not a threat.
      state = onVerifiedMesh ? 'LOCAL_ONLY' : 'UNTRUSTED_PORTAL';
      break;
    case 'fail':
    case 'unknown':
      state = onVerifiedMesh ? 'LOCAL_ONLY' : 'OFFLINE';
      break;
  }
  return { state, meshTrust, uplink, checkedAt: p.checkedAt };
}

/** Classifies a reachability probe response. Expect HTTP 204 with an empty body. */
export function classifyInternetProbe(r: { status: number; redirected: boolean; bodyLength: number; elapsedMs: number }): Probes['internet'] {
  if (r.redirected || (r.status >= 300 && r.status < 400) || (r.status === 200 && r.bodyLength > 0)) return 'captive';
  if (r.status !== 204) return 'fail';
  return r.elapsedMs > 4000 ? 'slow' : 'ok';
}
