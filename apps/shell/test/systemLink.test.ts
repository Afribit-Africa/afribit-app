import { beforeEach, describe, expect, it, vi } from 'vitest';
import { redirectSystemPath } from '../src/app/+native-intent';
import { pendingRoute, setupStatus } from '../src/shell/pendingRoute';
import { walletHandoff } from '../src/wallet/handoff';
import { usesPaymentScheme, walletHandoffForLink } from '../src/wallet/systemLinkCore';

const BOLT11 = 'lnbc10u1pexample';
const LNURL = 'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0';
const ADDRESS = 'bob@afribit.africa';
const SEGWIT = 'bc1qexampleaddress00000000000';
const BASE58 = '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2';

describe('walletHandoffForLink: accepted payment links', () => {
  const accepted: ReadonlyArray<readonly [string, string]> = [
    [`lightning:${BOLT11}`, BOLT11],
    [`lightning://${BOLT11}`, BOLT11],
    [`LIGHTNING:${BOLT11}`, BOLT11],
    [`lightning:${BOLT11.toUpperCase()}`, BOLT11.toUpperCase()],
    [`lightning:${LNURL}`, LNURL],
    [`lightning:${ADDRESS}`, ADDRESS],
    [`lnurl:${LNURL}`, LNURL],
    [`lnurl://${LNURL}`, LNURL],
    [`LNURL:${LNURL.toUpperCase()}`, LNURL.toUpperCase()],
    [`lnurl:${BOLT11}`, BOLT11],
    [`lnurl:${ADDRESS}`, ADDRESS],
    [`bitcoin:${SEGWIT}`, SEGWIT],
    [`bitcoin://${SEGWIT}`, SEGWIT],
    [`BITCOIN:${SEGWIT}`, SEGWIT],
    [`bitcoin:${SEGWIT.toUpperCase()}`, SEGWIT.toUpperCase()],
    [`bitcoin:${BASE58}`, BASE58],
  ];

  for (const [url, destination] of accepted) {
    it(`opens a send to ${destination} for ${url}`, () => {
      expect(walletHandoffForLink(url)).toEqual({ kind: 'send', destination });
    });
  }
});

describe('walletHandoffForLink: BIP21', () => {
  const queries = [
    'amount=1.5',
    'amount=12345678',
    'label=Coffee%20Shop',
    'message=Thanks',
    `lightning=${BOLT11}`,
    `amount=1&label=Coffee&message=Thanks&lightning=${BOLT11}`,
  ];

  for (const query of queries) {
    it(`keeps the query ${query} for the Wallet`, () => {
      expect(walletHandoffForLink(`bitcoin:${SEGWIT}?${query}`)).toEqual({
        kind: 'send',
        destination: `bitcoin:${SEGWIT}?${query}`,
      });
    });
  }

  it('accepts a base58 address with a query', () => {
    expect(walletHandoffForLink(`bitcoin:${BASE58}?amount=1`)).toEqual({
      kind: 'send',
      destination: `bitcoin:${BASE58}?amount=1`,
    });
  });
});

describe('walletHandoffForLink: refused links', () => {
  const refused = [
    'afribit://connect/join?x=1',
    'http://example.com',
    'mailto:bob@afribit.africa',
    'javascript:alert(1)',
    '',
    'lightning:',
    'lnurl:',
    'bitcoin:',
    'lightning:settings',
    'lnurl:settings',
    'bitcoin:card/details',
    'lightning:javascript:alert(1)',
    'bitcoin:notanaddress',
    'bitcoin:notanaddress?amount=1',
    `bitcoin:${SEGWIT}?foo=bar`,
    `bitcoin:${SEGWIT}?amount=1&amount=2`,
    `bitcoin:${SEGWIT}?amount=1.123456789`,
    `bitcoin:${SEGWIT}?amount=abc`,
    `bitcoin:${SEGWIT}?lightning=notaninvoice`,
    `bitcoin:${SEGWIT}?label=${'a'.repeat(201)}`,
    `bitcoin:${SEGWIT}?label=a%0Ab`,
    `bitcoin:${SEGWIT}?label=%`,
    `lightning:${'a'.repeat(4100)}`,
  ];

  for (const url of refused) {
    it(`refuses ${JSON.stringify(url).slice(0, 60)}`, () => {
      expect(walletHandoffForLink(url)).toBeNull();
    });
  }
});

describe('usesPaymentScheme', () => {
  it('recognises a payment scheme even when the link is refused', () => {
    expect(usesPaymentScheme('lightning:settings')).toBe(true);
    expect(usesPaymentScheme('BITCOIN:card/details')).toBe(true);
  });

  it('ignores another scheme and a plain path', () => {
    expect(usesPaymentScheme('afribit://connect/join?x=1')).toBe(false);
    expect(usesPaymentScheme('/app/wallet')).toBe(false);
  });
});

describe('redirectSystemPath', () => {
  beforeEach(() => {
    walletHandoff.take(Date.now());
    pendingRoute.take();
    setupStatus.set(true);
  });

  it('keeps the route of a shell link that arrives during onboarding', () => {
    setupStatus.set(false);
    expect(redirectSystemPath({ path: 'afribit://connect/passes', initial: false })).toBe('afribit://connect/passes');
    expect(pendingRoute.take()).toBe('/connect/passes');
  });

  it('keeps the Wallet for a payment link that arrives during onboarding', () => {
    setupStatus.set(false);
    expect(redirectSystemPath({ path: `lightning:${BOLT11}`, initial: false })).toBe('/app/wallet');
    expect(pendingRoute.take()).toBe('/app/wallet');
  });

  it('keeps nothing once setup is complete', () => {
    redirectSystemPath({ path: 'afribit://connect/passes', initial: false });
    redirectSystemPath({ path: `lightning:${BOLT11}`, initial: false });
    expect(pendingRoute.take()).toBeNull();
  });

  it('puts one hand-off and opens the Wallet for a payment link', () => {
    expect(redirectSystemPath({ path: `lightning:${BOLT11}`, initial: true })).toBe('/app/wallet');
    expect(walletHandoff.take(Date.now())).toEqual({ kind: 'send', destination: BOLT11 });
    expect(walletHandoff.take(Date.now())).toBeNull();
  });

  it('sends a refused payment link Home and puts nothing', () => {
    expect(redirectSystemPath({ path: 'lightning:settings', initial: false })).toBe('/');
    expect(walletHandoff.take(Date.now())).toBeNull();
  });

  it('leaves the shell\u2019s own deep link unchanged', () => {
    expect(redirectSystemPath({ path: 'afribit://connect/join?x=1', initial: false })).toBe('afribit://connect/join?x=1');
  });

  it('leaves an ordinary path unchanged', () => {
    expect(redirectSystemPath({ path: '/app/wallet', initial: false })).toBe('/app/wallet');
  });

  it('returns Home when storing the hand-off throws', () => {
    const put = vi.spyOn(walletHandoff, 'put').mockImplementation(() => {
      throw new Error('storage failed');
    });
    expect(redirectSystemPath({ path: `bitcoin:${SEGWIT}`, initial: false })).toBe('/');
    put.mockRestore();
  });
});
