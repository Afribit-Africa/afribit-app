/**
 * NIP-98 HTTP auth (CR-3). A request is signed as a kind-27235 Nostr event so a
 * service can admit it as this Afribit identity (S-09/SH-8). Pure TS: the shell
 * holds the secret and produces the schnorr signature; this module only builds
 * the event, computes its NIP-01 id, formats the Authorization header and
 * refuses a host that is not on the allow-list.
 *
 * SHA-256 and base64 are implemented inline so the kernel needs no extra
 * dependency, in the same spirit as the inline bech32 in `identity.ts`.
 */

/** The request fields that get bound into the event. */
export interface Nip98Request {
  readonly url: string;
  readonly method: string;
  readonly bodySha256: string;
  readonly createdAt: number;
}

export type Nip98Tag = readonly [string, string];

/** The event before the identity is attached. */
export interface Nip98Event {
  readonly kind: 27235;
  readonly content: '';
  readonly created_at: number;
  readonly tags: readonly Nip98Tag[];
}

/** A complete event: the shell adds the id, the signer's pubkey and the signature. */
export interface SignedNip98Event extends Nip98Event {
  readonly id: string;
  readonly pubkey: string;
  readonly sig: string;
}

const HEX64 = /^[0-9a-f]{64}$/;

/** Builds the unsigned NIP-98 event: empty content and the `u`, `method`, `payload` tags. */
export function nip98Event(request: Nip98Request): Nip98Event {
  if (!HEX64.test(request.bodySha256)) throw new Error('bodySha256 must be 64 lowercase hex chars');
  return {
    kind: 27235,
    content: '',
    created_at: request.createdAt,
    tags: [
      ['u', request.url],
      ['method', request.method],
      ['payload', request.bodySha256],
    ],
  };
}

/**
 * NIP-01 event id: the lowercase-hex SHA-256 of `[0, pubkey, created_at, kind, tags, content]`.
 * The array order and the absence of whitespace are part of the protocol; the server recomputes
 * this and rejects the event when it does not match.
 */
export function nip98EventId(event: Nip98Event, pubkey: string): string {
  if (!HEX64.test(pubkey)) throw new Error('pubkey must be 64 lowercase hex chars');
  const serialized = JSON.stringify([0, pubkey, event.created_at, event.kind, event.tags, event.content]);
  return toHex(sha256Bytes(new TextEncoder().encode(serialized)));
}

/** `Authorization: Nostr <base64 of the JSON event>` — the only value a caller may forward. */
export function nip98Header(event: SignedNip98Event): string {
  return 'Nostr ' + base64(new TextEncoder().encode(JSON.stringify(event)));
}

/**
 * Refuses a URL the shell must not sign for: it has to be HTTPS, carry no user info or fragment,
 * and its exact origin must be on the allow-list. A lookalike host, another port or an http URL
 * throws, so a feature can never turn an allowed host into a signature for a different one.
 */
export function assertAllowedRequest(url: string, allowedOrigins: readonly string[]): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('request url is not absolute');
  }
  if (parsed.protocol !== 'https:') throw new Error('request url must be https');
  if (parsed.username !== '' || parsed.password !== '') throw new Error('request url must not carry user info');
  if (parsed.hash !== '') throw new Error('request url must not carry a fragment');
  if (!allowedOrigins.includes(parsed.origin)) throw new Error(`request origin ${parsed.origin} is not allowed`);
}

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    const remaining = bytes.length - i;
    out += BASE64.charAt(b0 >> 2);
    out += BASE64.charAt(((b0 & 0x03) << 4) | (b1 >> 4));
    out += remaining > 1 ? BASE64.charAt(((b1 & 0x0f) << 2) | (b2 >> 6)) : '=';
    out += remaining > 2 ? BASE64.charAt(b2 & 0x3f) : '=';
  }
  return out;
}

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

function sha256Bytes(bytes: Uint8Array): Uint8Array {
  const bitLength = bytes.length * 8;
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x1_0000_0000));
  view.setUint32(padded.length - 4, bitLength >>> 0);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Uint32Array(64);

  for (let off = 0; off < padded.length; off += 64) {
    for (let t = 0; t < 16; t++) w[t] = view.getUint32(off + t * 4);
    for (let t = 16; t < 64; t++) {
      const x = w[t - 15] ?? 0;
      const y = w[t - 2] ?? 0;
      const s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
      const s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
      w[t] = ((w[t - 16] ?? 0) + s0 + (w[t - 7] ?? 0) + s1) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let t = 0; t < 64; t++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + (K[t] ?? 0) + (w[t] ?? 0)) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  [h0, h1, h2, h3, h4, h5, h6, h7].forEach((word, i) => outView.setUint32(i * 4, word));
  return out;
}
