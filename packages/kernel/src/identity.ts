/**
 * Nostr identity encoding (NIP-19).
 *
 * The shell owns the device keypair (S-09); features only ever see the public
 * npub, never the secret. Only the `npub` form is handled here. Bech32 is
 * implemented inline so the kernel needs no extra dependency.
 */
import { hexToBytes } from './mesh';

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const NPUB_PAYLOAD = 52; // 32 bytes as 5-bit groups, padded
const HEX32 = /^[0-9a-f]{64}$/;

function polymod(values: readonly number[]): number {
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < GENERATOR.length; i++) {
      const g = GENERATOR[i];
      if (g !== undefined && ((top >>> i) & 1) === 1) chk ^= g;
    }
  }
  return chk;
}

/** bech32 expands the human-readable part: high bits, separator, low bits. */
function expandHrp(hrp: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) >>> 5);
  out.push(0);
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) & 31);
  return out;
}

function convertBits(data: readonly number[], from: number, to: number, pad: boolean): number[] | null {
  let acc = 0;
  let bits = 0;
  const maxv = (1 << to) - 1;
  const out: number[] = [];
  for (const value of data) {
    if (value < 0 || value >>> from !== 0) return null;
    acc = (acc << from) | value;
    bits += from;
    while (bits >= to) {
      bits -= to;
      out.push((acc >>> bits) & maxv);
    }
  }
  if (pad) {
    if (bits > 0) out.push((acc << (to - bits)) & maxv);
  } else if (bits >= from || ((acc << (to - bits)) & maxv) !== 0) {
    return null;
  }
  return out;
}

function createChecksum(data: readonly number[]): number[] {
  const mod = polymod([...expandHrp('npub'), ...data, 0, 0, 0, 0, 0, 0]) ^ 1;
  const out: number[] = [];
  for (let i = 0; i < 6; i++) out.push((mod >>> (5 * (5 - i))) & 31);
  return out;
}

function verifyChecksum(data: readonly number[]): boolean {
  return polymod([...expandHrp('npub'), ...data]) === 1;
}

/** Encodes a 32-byte public key (lowercase hex) as its NIP-19 `npub`. Throws on anything else. */
export function npubFromPublicKey(hex32: string): string {
  if (!HEX32.test(hex32)) throw new Error('invalid public key');
  const data = convertBits([...hexToBytes(hex32)], 8, 5, true);
  if (!data) throw new Error('invalid public key');
  return 'npub1' + [...data, ...createChecksum(data)].map((d) => CHARSET.charAt(d)).join('');
}

/** Decodes a NIP-19 `npub` back to lowercase hex, or null if the prefix, length, alphabet or checksum is wrong. */
export function publicKeyFromNpub(npub: string): string | null {
  if (!npub.startsWith('npub1')) return null;
  const encoded = npub.slice(5);
  if (encoded.length !== NPUB_PAYLOAD + 6) return null;
  const values: number[] = [];
  for (const c of encoded) {
    const d = CHARSET.indexOf(c);
    if (d < 0) return null;
    values.push(d);
  }
  if (!verifyChecksum(values)) return null;
  const bytes = convertBits(values.slice(0, NPUB_PAYLOAD), 5, 8, false);
  if (!bytes || bytes.length !== 32) return null;
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}
