import { ed25519 } from '@noble/curves/ed25519.js';
import { describe, expect, it } from 'vitest';
import {
  canonicalBeacon, classifyInternetProbe, deriveConnectivity, parseJoinLink, parseAppJoinResponse, recordCrash, releaseQuarantine,
  parseCrashRecord, EMPTY_CRASH_RECORD, verifyBeacon, beaconAlert, type MeshBeacon, type Probes,
} from '../src';

const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

const secret = ed25519.utils.randomSecretKey();
const pub = toHex(ed25519.getPublicKey(secret));
const otherSecret = ed25519.utils.randomSecretKey();
const pinned = { 'km-2026a': pub };
const NOW = 1_795_000_000_000;
const NONCE = 'n0nce-abcdefghijklmnopqrstuv';

function beacon(over: Partial<MeshBeacon> = {}, key = secret): MeshBeacon {
  const unsigned = {
    v: 1 as const, keyId: 'km-2026a', meshId: 'kibera-mesh', nodeId: 'KM-LAB-001',
    issuedAt: NOW - 1000, expiresAt: NOW + 120_000, nonce: NONCE, clientIp: '10.30.0.42', ...over,
  };
  const { sig: _ignored, ...forSig } = unsigned as typeof unsigned & { sig?: string };
  return { ...unsigned, sig: over.sig ?? toHex(ed25519.sign(canonicalBeacon(forSig), key)) };
}

const opts = { expectedNonce: NONCE, nowMs: NOW, pinnedKeys: pinned, expectedClientIp: '10.30.0.42' };

describe('verifyBeacon', () => {
  it('accepts an authentic, fresh beacon', () => {
    expect(verifyBeacon(beacon(), opts).ok).toBe(true);
  });

  it('rejects a beacon signed by an unpinned key', () => {
    expect(verifyBeacon(beacon({}, otherSecret), opts)).toEqual({ ok: false, reason: 'bad-signature' });
  });

  it('rejects tampering with any signed field', () => {
    const b = beacon();
    expect(verifyBeacon({ ...b, clientIp: '10.30.0.43' }, opts)).toEqual({ ok: false, reason: 'bad-signature' });
    expect(verifyBeacon({ ...b, expiresAt: b.expiresAt + 1 }, opts)).toEqual({ ok: false, reason: 'bad-signature' });
  });

  it('rejects replay (wrong nonce), expiry, future issue and overlong windows', () => {
    expect(verifyBeacon(beacon({ nonce: 'other-nonce-abcdefghijklmnop' }), opts)).toEqual({ ok: false, reason: 'nonce-mismatch' });
    expect(verifyBeacon(beacon({ issuedAt: NOW - 900_000, expiresAt: NOW - 400_000 }), opts)).toEqual({ ok: false, reason: 'expired' });
    expect(verifyBeacon(beacon({ issuedAt: NOW + 400_000, expiresAt: NOW + 500_000 }), opts)).toEqual({ ok: false, reason: 'not-yet-valid' });
    expect(verifyBeacon(beacon({ expiresAt: NOW + 3_600_000 }), opts)).toEqual({ ok: false, reason: 'window-too-long' });
  });

  it('rejects a beacon relayed from another client address', () => {
    // A fake access point can fetch a real gateway's beacon and pass it on. The gateway signed
    // the address it saw, so the relay shows up as a different clientIp.
    expect(verifyBeacon(beacon(), { ...opts, expectedClientIp: '10.30.0.77' })).toEqual({ ok: false, reason: 'client-ip-mismatch' });
  });

  it('fails closed when the phone does not know its own address', () => {
    expect(verifyBeacon(beacon(), { ...opts, expectedClientIp: null })).toEqual({ ok: false, reason: 'client-ip-unknown' });
  });

  it('checks the signature before the client address', () => {
    expect(verifyBeacon(beacon({}, otherSecret), { ...opts, expectedClientIp: '10.30.0.77' })).toEqual({ ok: false, reason: 'bad-signature' });
  });

  it('rejects unknown key ids and malformed input', () => {
    expect(verifyBeacon(beacon({ keyId: 'unknown-key' }), opts)).toEqual({ ok: false, reason: 'unknown-key' });
    expect(verifyBeacon(beacon({ keyId: 'constructor' }), opts)).toEqual({ ok: false, reason: 'unknown-key' });
    expect(verifyBeacon({ ...beacon(), extra: 1 }, opts)).toEqual({ ok: false, reason: 'malformed' });
    expect(verifyBeacon('nope', opts)).toEqual({ ok: false, reason: 'malformed' });
    expect(verifyBeacon({ ...beacon(), clientIp: '10.30.0.999' }, opts)).toEqual({ ok: false, reason: 'malformed' });
  });
});

describe('beaconAlert', () => {
  it('treats a network that cannot prove it is Afribit Mesh as an impostor', () => {
    for (const reason of ['malformed', 'unknown-key', 'bad-signature', 'nonce-mismatch', 'client-ip-mismatch'] as const) {
      expect(beaconAlert(reason)).toBe('impersonation');
    }
  });

  it('blames the phone clock for an authentic beacon outside its window', () => {
    expect(beaconAlert('expired')).toBe('clock');
    expect(beaconAlert('not-yet-valid')).toBe('clock');
  });

  it('does not accuse the network for an unknown own address or a misconfigured gateway', () => {
    expect(beaconAlert('client-ip-unknown')).toBe('none');
    expect(beaconAlert('window-too-long')).toBe('none');
  });
});

describe('deriveConnectivity', () => {
  const base: Omit<Probes, 'internet'> = { meshBeacon: 'unknown', meshAttested: false, internetVia: 'none', cellularOptIn: false, checkedAt: 1 };
  it.each([
    [{ internet: 'ok', meshBeacon: 'absent' }, 'INTERNET', 'none', 'none'],
    [{ internet: 'slow', meshBeacon: 'absent' }, 'DEGRADED', 'none', 'none'],
    [{ internet: 'captive', meshBeacon: 'absent' }, 'UNTRUSTED_PORTAL', 'none', 'none'],
    [{ internet: 'captive', meshBeacon: 'verified' }, 'LOCAL_ONLY', 'local-verified', 'none'],
    [{ internet: 'fail', meshBeacon: 'verified' }, 'LOCAL_ONLY', 'local-verified', 'none'],
    [{ internet: 'fail', meshBeacon: 'absent' }, 'OFFLINE', 'none', 'none'],
    [{ internet: 'ok', meshBeacon: 'absent', meshAttested: true }, 'INTERNET', 'attested', 'none'],
    [{ internet: 'captive', meshBeacon: 'invalid', meshAttested: true }, 'UNTRUSTED_PORTAL', 'none', 'none'],
  ] as const)('%j -> %s / %s / %s', (probe, state, trust, uplink) => {
    expect(deriveConnectivity({ ...base, ...probe })).toEqual({ state, meshTrust: trust, uplink, checkedAt: 1 });
  });

  it.each([
    // The mesh router's uplink is usable only over Wi-Fi on a network that proved it is Afribit Mesh.
    [{ internet: 'ok', meshBeacon: 'verified', internetVia: 'wifi' }, 'mesh'],
    [{ internet: 'slow', meshBeacon: 'absent', meshAttested: true, internetVia: 'wifi' }, 'mesh'],
    // Cellular works only with the person's opt-in, even when the phone is also on the mesh.
    [{ internet: 'ok', meshBeacon: 'absent', internetVia: 'cellular', cellularOptIn: true }, 'mobile-opt-in'],
    [{ internet: 'slow', meshBeacon: 'verified', internetVia: 'cellular', cellularOptIn: true }, 'mobile-opt-in'],
    // Cellular without the opt-in never reaches the internet for payments.
    [{ internet: 'ok', meshBeacon: 'absent', internetVia: 'cellular', cellularOptIn: false }, 'none'],
    // Internet over Wi-Fi that is not a verified mesh is not the shared uplink.
    [{ internet: 'ok', meshBeacon: 'absent', internetVia: 'wifi' }, 'none'],
    [{ internet: 'ok', internetVia: 'none', cellularOptIn: true }, 'none'],
    [{ internet: 'captive', meshBeacon: 'verified', internetVia: 'wifi' }, 'none'],
  ] as const)('%j -> uplink %s', (probe, uplink) => {
    expect(deriveConnectivity({ ...base, ...probe }).uplink).toBe(uplink);
  });

  it('classifies probe responses', () => {
    expect(classifyInternetProbe({ status: 204, redirected: false, bodyLength: 0, elapsedMs: 100 })).toBe('ok');
    expect(classifyInternetProbe({ status: 204, redirected: false, bodyLength: 0, elapsedMs: 5000 })).toBe('slow');
    expect(classifyInternetProbe({ status: 200, redirected: false, bodyLength: 512, elapsedMs: 100 })).toBe('captive');
    expect(classifyInternetProbe({ status: 204, redirected: true, bodyLength: 0, elapsedMs: 100 })).toBe('captive');
    expect(classifyInternetProbe({ status: 503, redirected: false, bodyLength: 0, elapsedMs: 100 })).toBe('fail');
  });
});

describe('parseJoinLink', () => {
  const ticket = 'A'.repeat(43);
  const session = `123e4567-e89b-12d3-a456-426614174000.${'b'.repeat(43)}`;
  it('accepts the app scheme and the mesh service URL', () => {
    expect(parseJoinLink(`afribit://connect/join?ticket=${ticket}&session=${session}`)).toEqual({ ticket, session });
    expect(parseJoinLink(`https://wifi.afribit.africa/api/mesh/join?ticket=${ticket}&session=${session}`)).toEqual({ ticket, session });
  });
  it.each([
    `https://evil.example/api/mesh/join?ticket=${ticket}&session=${session}`,
    `http://wifi.afribit.africa/api/mesh/join?ticket=${ticket}&session=${session}`,
    `afribit://connect/join?ticket=${ticket}&session=${session}&autopay=1`,
    `afribit://connect/join?ticket=short&session=${session}`,
    `afribit://connect/other?ticket=${ticket}&session=${session}`,
    `https://user:pw@wifi.afribit.africa/api/mesh/join?ticket=${ticket}&session=${session}`,
    'not a url',
  ])('rejects %s', (url) => {
    expect(parseJoinLink(url)).toBeNull();
  });
});

describe('parseAppJoinResponse', () => {
  const deviceKey = 'A'.repeat(43);
  const grantId = '123e4567-e89b-12d3-a456-426614174000';

  it('accepts a full response', () => {
    expect(parseAppJoinResponse({ deviceKey, grantId, restored: false })).toEqual({ deviceKey, grantId, restored: false });
  });

  it('accepts a null grant id and a restored pass', () => {
    expect(parseAppJoinResponse({ deviceKey, grantId: null, restored: true })).toEqual({ deviceKey, grantId: null, restored: true });
  });

  it.each<[string, unknown]>([
    ['device key too short', { deviceKey: 'A'.repeat(42), grantId, restored: false }],
    ['device key too long', { deviceKey: 'A'.repeat(44), grantId, restored: false }],
    ['device key not base64url', { deviceKey: `${'A'.repeat(42)}!`, grantId, restored: false }],
    ['grant id not a uuid', { deviceKey, grantId: 'not-a-uuid', restored: false }],
    ['grant id not a string', { deviceKey, grantId: 42, restored: false }],
    ['restored not a boolean', { deviceKey, grantId, restored: 'yes' }],
    ['an extra key', { deviceKey, grantId, restored: false, extra: 1 }],
    ['a missing field', { deviceKey, grantId }],
  ])('rejects %s', (_name, raw) => {
    expect(parseAppJoinResponse(raw)).toBeNull();
  });

  it.each<[string, unknown]>([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'device-key'],
    ['a number', 42],
    ['an array', [deviceKey, grantId, false]],
  ])('rejects %s as a non-object', (_name, raw) => {
    expect(parseAppJoinResponse(raw)).toBeNull();
  });
});

describe('crash quarantine', () => {
  it('quarantines after three crashes inside ten minutes and can be released', () => {
    let r = EMPTY_CRASH_RECORD;
    r = recordCrash(r, 'chat', 0);
    r = recordCrash(r, 'chat', 60_000);
    expect(r.quarantined).toEqual([]);
    r = recordCrash(r, 'chat', 120_000);
    expect(r.quarantined).toEqual(['chat']);
    expect(releaseQuarantine(r, 'chat').quarantined).toEqual([]);
  });

  it('forgets crashes older than the window', () => {
    let r = EMPTY_CRASH_RECORD;
    r = recordCrash(r, 'ai', 0);
    r = recordCrash(r, 'ai', 1);
    r = recordCrash(r, 'ai', 11 * 60_000);
    expect(r.quarantined).toEqual([]);
  });

  it('resets on a corrupt persisted record', () => {
    expect(parseCrashRecord('{not json')).toEqual(EMPTY_CRASH_RECORD);
    expect(parseCrashRecord(JSON.stringify({ crashes: {}, quarantined: [1] }))).toEqual(EMPTY_CRASH_RECORD);
  });
});
