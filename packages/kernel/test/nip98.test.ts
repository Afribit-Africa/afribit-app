import { schnorr } from '@noble/curves/secp256k1.js';
import { describe, expect, it } from 'vitest';
import { assertAllowedRequest, hexToBytes, nip98Event, nip98EventId, nip98Header, type SignedNip98Event } from '../src';

const URL = 'https://chat-gate.mesh.afribit.africa/v1/session';
const METHOD = 'POST';
const PAYLOAD = '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a';
const CREATED_AT = 1795500000;
const PUBKEY = '6e468422dfb74a5738702a8823b9b28168abab8655faacb6853cd0ee15deee93';
const ALLOWED = ['https://chat-gate.mesh.afribit.africa'];

const toHex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

describe('nip98Event', () => {
  it('builds the unsigned NIP-98 event with the spec tags in order', () => {
    expect(nip98Event({ url: URL, method: METHOD, bodySha256: PAYLOAD, createdAt: CREATED_AT })).toEqual({
      kind: 27235,
      content: '',
      created_at: CREATED_AT,
      tags: [
        ['u', URL],
        ['method', METHOD],
        ['payload', PAYLOAD],
      ],
    });
  });

  it.each([
    ['uppercase hex', PAYLOAD.toUpperCase()],
    ['too short', PAYLOAD.slice(1)],
    ['not hex', 'g'.repeat(64)],
    ['empty', ''],
  ])('rejects a payload hash that is %s', (_label, bodySha256) => {
    expect(() => nip98Event({ url: URL, method: METHOD, bodySha256, createdAt: CREATED_AT })).toThrow();
  });
});

describe('nip98EventId', () => {
  const event = nip98Event({ url: URL, method: METHOD, bodySha256: PAYLOAD, createdAt: CREATED_AT });

  it('hashes the NIP-01 serialization, not the event object', async () => {
    const serialized = JSON.stringify([0, PUBKEY, CREATED_AT, 27235, event.tags, '']);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized));
    const expected = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    expect(nip98EventId(event, PUBKEY)).toBe(expected);
  });

  it('matches a fixed id computed independently', () => {
    expect(nip98EventId(event, PUBKEY)).toBe('41ae86f413edf420e84dac58710d702906cee14d40d451aa87bb86b79f114d10');
  });

  it('rejects a pubkey that is not 64 lowercase hex chars', () => {
    expect(() => nip98EventId(event, PUBKEY.toUpperCase())).toThrow();
    expect(() => nip98EventId(event, PUBKEY.slice(1))).toThrow();
  });
});

describe('nip98Header', () => {
  it('round-trips the signed event through the base64 header', () => {
    const event = nip98Event({ url: URL, method: METHOD, bodySha256: PAYLOAD, createdAt: CREATED_AT });
    const signed: SignedNip98Event = { ...event, id: nip98EventId(event, PUBKEY), pubkey: PUBKEY, sig: 'ab'.repeat(64) };
    const header = nip98Header(signed);
    expect(header.startsWith('Nostr ')).toBe(true);
    expect(JSON.parse(atob(header.slice('Nostr '.length))) as unknown).toEqual(signed);
  });

  it('carries a signature over the event id that verifies against the signer pubkey', () => {
    const secret = hexToBytes('11'.repeat(32));
    const pubkey = toHex(schnorr.getPublicKey(secret));
    const event = nip98Event({ url: URL, method: METHOD, bodySha256: PAYLOAD, createdAt: CREATED_AT });
    const id = nip98EventId(event, pubkey);
    const sig = toHex(schnorr.sign(hexToBytes(id), secret));
    expect(schnorr.verify(hexToBytes(sig), hexToBytes(id), hexToBytes(pubkey))).toBe(true);
  });
});

describe('assertAllowedRequest', () => {
  it('accepts the exact allowed origin, with a path and query', () => {
    expect(() => assertAllowedRequest(URL, ALLOWED)).not.toThrow();
    expect(() => assertAllowedRequest('https://chat-gate.mesh.afribit.africa/v1/session?retry=1', ALLOWED)).not.toThrow();
  });

  it.each([
    ['http', 'http://chat-gate.mesh.afribit.africa/v1/session'],
    ['a lookalike host', 'https://chat-gate.mesh.afribit.africa.evil.example/v1/session'],
    ['a changed port', 'https://chat-gate.mesh.afribit.africa:8443/v1/session'],
    ['user info', 'https://user@chat-gate.mesh.afribit.africa/v1/session'],
    ['a fragment', 'https://chat-gate.mesh.afribit.africa/v1/session#x'],
    ['an origin not on the list', 'https://other.example/v1/session'],
    ['a relative url', '/v1/session'],
  ])('refuses %s', (_label, url) => {
    expect(() => assertAllowedRequest(url, ALLOWED)).toThrow();
  });
});

describe('inline SHA-256 and base64 against the platform', () => {
  // The gate recomputes the id with its own SHA-256, so every padding boundary must agree.
  it('gives the same event id as WebCrypto for every serialized length across several blocks', async () => {
    for (let n = 0; n < 200; n++) {
      const event = nip98Event({ url: `https://chat-gate.mesh.afribit.africa/${'é'.repeat(n % 3)}${'x'.repeat(n)}`, method: METHOD, bodySha256: PAYLOAD, createdAt: CREATED_AT + n });
      const serialized = new TextEncoder().encode(JSON.stringify([0, PUBKEY, event.created_at, event.kind, event.tags, event.content]));
      expect(nip98EventId(event, PUBKEY)).toBe(toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', serialized))));
    }
  });

  it('encodes the header exactly as btoa over the UTF-8 bytes for every remainder length', () => {
    for (let n = 0; n < 6; n++) {
      const event: SignedNip98Event = { ...nip98Event({ url: URL + 'é'.repeat(n), method: METHOD, bodySha256: PAYLOAD, createdAt: CREATED_AT }), id: '0'.repeat(64), pubkey: PUBKEY, sig: '1'.repeat(128) };
      const bytes = new TextEncoder().encode(JSON.stringify(event));
      expect(nip98Header(event)).toBe('Nostr ' + btoa(String.fromCharCode(...bytes)));
    }
  });
});
