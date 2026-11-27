import { describe, expect, it } from 'vitest';
import { npubFromPublicKey, publicKeyFromNpub } from '../src';

// NIP-19 spec examples (nostr-protocol/nips 19.md).
const HEX_A = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
const NPUB_A = 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6';
const HEX_B = '7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e';
const NPUB_B = 'npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg';

describe('npubFromPublicKey', () => {
  it('encodes the NIP-19 example public keys', () => {
    expect(npubFromPublicKey(HEX_A)).toBe(NPUB_A);
    expect(npubFromPublicKey(HEX_B)).toBe(NPUB_B);
  });

  it('rejects input that is not 32 bytes of lowercase hex', () => {
    expect(() => npubFromPublicKey(HEX_A.slice(0, 62))).toThrow();
    expect(() => npubFromPublicKey(HEX_A + '00')).toThrow();
    expect(() => npubFromPublicKey(HEX_A.toUpperCase())).toThrow();
    expect(() => npubFromPublicKey(`npub1${HEX_A}`)).toThrow();
  });
});

describe('publicKeyFromNpub', () => {
  it('decodes the NIP-19 example npubs', () => {
    expect(publicKeyFromNpub(NPUB_A)).toBe(HEX_A);
    expect(publicKeyFromNpub(NPUB_B)).toBe(HEX_B);
  });

  it('round-trips every public key', () => {
    const hex = `${'00'.repeat(31)}02`;
    expect(publicKeyFromNpub(npubFromPublicKey(hex))).toBe(hex);
  });

  it('rejects a wrong prefix', () => {
    expect(publicKeyFromNpub(`nsec1${NPUB_A.slice(5)}`)).toBeNull();
    expect(publicKeyFromNpub(`note1${NPUB_A.slice(5)}`)).toBeNull();
  });

  it('rejects a bad checksum', () => {
    expect(publicKeyFromNpub(`${NPUB_A.slice(0, 20)}q${NPUB_A.slice(21)}`)).toBeNull();
  });

  it('rejects the wrong length', () => {
    expect(publicKeyFromNpub(NPUB_A.slice(0, -1))).toBeNull();
    expect(publicKeyFromNpub(`${NPUB_A}q`)).toBeNull();
  });

  it('rejects characters outside the bech32 alphabet', () => {
    expect(publicKeyFromNpub(`npub1${'b'.repeat(58)}`)).toBeNull();
    expect(publicKeyFromNpub(`npub1${'Q'.repeat(58)}`)).toBeNull();
  });
});
