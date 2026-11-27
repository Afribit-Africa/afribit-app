import type { CapabilityIntent } from '@afribit/feature-sdk';
import { describe, expect, it, vi } from 'vitest';
import { changedDeviceRefusal, createHandoffSlot, HANDOFF_TTL_MS, walletHandoffFor } from '../src/wallet/handoffCore';

function pay(paymentRequest: string): CapabilityIntent {
  return { kind: 'wallet.preparePayment', paymentRequest, purpose: 'mesh_pass' };
}

const FORMS = [
  ['a BOLT11 invoice', 'lnbc10u1pexample'],
  ['an LNURL', 'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0'],
  ['a Lightning address', 'bob@afribit.africa'],
  ['a segwit address', 'bc1qexampleaddress00000000000'],
  ['a base58 address', '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2'],
] as const;

describe('walletHandoffFor', () => {
  it('opens Receive for wallet.showReceive', () => {
    expect(walletHandoffFor({ kind: 'wallet.showReceive' })).toEqual({ kind: 'receive' });
  });

  for (const [name, request] of FORMS) {
    it(`accepts ${name}`, () => {
      expect(walletHandoffFor(pay(request))).toEqual({ kind: 'send', destination: request });
    });
  }

  it('strips a lightning: prefix', () => {
    expect(walletHandoffFor(pay('lightning:lnbc10u1pexample'))).toEqual({ kind: 'send', destination: 'lnbc10u1pexample' });
  });

  it('strips a bitcoin: prefix', () => {
    expect(walletHandoffFor(pay('bitcoin:lnbc10u1pexample'))).toEqual({ kind: 'send', destination: 'lnbc10u1pexample' });
  });

  it('strips an lnurl: prefix', () => {
    expect(walletHandoffFor(pay('lnurl:lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0'))).toEqual({
      kind: 'send',
      destination: 'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0',
    });
  });

  for (const request of ['settings', 'card/details', 'x?y=1', '', 'javascript:alert(1)']) {
    it(`refuses the request ${JSON.stringify(request)}`, () => {
      expect(walletHandoffFor(pay(request))).toBeNull();
    });
  }

  it('opens a send to the contact payment address', () => {
    const intent: CapabilityIntent = {
      kind: 'wallet.payContact',
      contact: { displayName: 'Bob', paymentAddress: 'bob@afribit.africa', verification: 'unverified' },
    };
    expect(walletHandoffFor(intent)).toEqual({ kind: 'send', destination: 'bob@afribit.africa' });
  });

  it('opens a send to a BOLT11 contact address', () => {
    const intent: CapabilityIntent = {
      kind: 'wallet.payContact',
      contact: { displayName: 'Bob', paymentAddress: 'lnbc10u1pexample', verification: 'verified' },
    };
    expect(walletHandoffFor(intent)).toEqual({ kind: 'send', destination: 'lnbc10u1pexample' });
  });

  it('strips the scheme from a bitcoin: contact address', () => {
    const intent: CapabilityIntent = {
      kind: 'wallet.payContact',
      contact: { displayName: 'Bob', paymentAddress: 'bitcoin:bc1qexampleaddress00000000000', verification: 'verified' },
    };
    expect(walletHandoffFor(intent)).toEqual({ kind: 'send', destination: 'bc1qexampleaddress00000000000' });
  });

  it('copies the amount and note when present', () => {
    const intent: CapabilityIntent = {
      kind: 'wallet.payContact',
      contact: { displayName: 'Bob', paymentAddress: 'bob@afribit.africa', verification: 'unverified' },
      amount: { currency: 'KES', value: 250.5 },
      note: 'Lunch',
    };
    expect(walletHandoffFor(intent)).toEqual({
      kind: 'send',
      destination: 'bob@afribit.africa',
      amount: { currency: 'KES', value: 250.5 },
      note: 'Lunch',
    });
  });

  it('never puts the contact displayName in the hand-off', () => {
    const intent: CapabilityIntent = {
      kind: 'wallet.payContact',
      contact: { displayName: 'Bob Otieno', paymentAddress: 'lnbob@afribit.africa', verification: 'verified' },
      amount: { currency: 'KES', value: 50 },
      note: 'Lunch',
    };
    expect(JSON.stringify(walletHandoffFor(intent))).not.toContain('Otieno');
  });

  it('does not copy extra fields', () => {
    const intent = {
      kind: 'wallet.payContact',
      contact: { displayName: 'Bob', paymentAddress: 'bob@afribit.africa', verification: 'unverified', nickname: 'bobby' },
      purpose: 'mesh_pass',
    } as unknown as CapabilityIntent;
    expect(walletHandoffFor(intent)).toEqual({ kind: 'send', destination: 'bob@afribit.africa' });
  });

  for (const paymentAddress of ['settings', 'x?y=1']) {
    it(`refuses the contact address ${JSON.stringify(paymentAddress)}`, () => {
      const intent: CapabilityIntent = {
        kind: 'wallet.payContact',
        contact: { displayName: 'Bob', paymentAddress, verification: 'unverified' },
      };
      expect(walletHandoffFor(intent)).toBeNull();
    });
  }

  it('opens Receive for wallet.createRequest at its amount and note', () => {
    const intent: CapabilityIntent = {
      kind: 'wallet.createRequest',
      amount: { currency: 'KES', value: 100 },
      note: 'For the ride',
    };
    expect(walletHandoffFor(intent)).toEqual({ kind: 'receive', amount: { currency: 'KES', value: 100 }, note: 'For the ride' });
  });

  it('opens Receive for wallet.createRequest without a note when none is given', () => {
    const intent: CapabilityIntent = { kind: 'wallet.createRequest', amount: { currency: 'BTC', value: 2100 } };
    expect(walletHandoffFor(intent)).toEqual({ kind: 'receive', amount: { currency: 'BTC', value: 2100 } });
  });
});

describe('changedDeviceRefusal', () => {
  it('refuses a contact whose device changed', () => {
    expect(changedDeviceRefusal('changed-device')).toBe('contact-changed-device');
  });

  it.each(['verified', 'unverified'] as const)('lets a %s contact through', (verification) => {
    expect(changedDeviceRefusal(verification)).toBeNull();
  });
});

describe('createHandoffSlot', () => {
  it('hands back what was put, once', () => {
    const slot = createHandoffSlot();
    slot.put({ kind: 'receive' }, 1_000);
    expect(slot.take(1_000)).toEqual({ kind: 'receive' });
    expect(slot.take(1_000)).toBeNull();
  });

  it('drops a hand-off older than the TTL', () => {
    const slot = createHandoffSlot();
    slot.put({ kind: 'send', destination: 'bob@afribit.africa' }, 1_000);
    expect(slot.take(1_000 + HANDOFF_TTL_MS)).toBeNull();
  });

  it('keeps a hand-off younger than the TTL', () => {
    const slot = createHandoffSlot();
    slot.put({ kind: 'receive' }, 1_000);
    expect(slot.take(1_000 + HANDOFF_TTL_MS - 1)).toEqual({ kind: 'receive' });
  });

  it('honours the TTL it was created with', () => {
    const slot = createHandoffSlot(10);
    slot.put({ kind: 'receive' }, 0);
    expect(slot.take(9)).toEqual({ kind: 'receive' });
    slot.put({ kind: 'receive' }, 0);
    expect(slot.take(10)).toBeNull();
  });

  it('lets a newer put replace the older one', () => {
    const slot = createHandoffSlot();
    slot.put({ kind: 'receive' }, 1_000);
    slot.put({ kind: 'send', destination: 'bob@afribit.africa' }, 1_001);
    expect(slot.take(1_002)).toEqual({ kind: 'send', destination: 'bob@afribit.africa' });
  });

  it('notifies a listener on each put, and stops after unsubscribe', () => {
    const slot = createHandoffSlot();
    const listener = vi.fn();
    const unsubscribe = slot.subscribe(listener);
    slot.put({ kind: 'receive' }, 1);
    slot.put({ kind: 'receive' }, 2);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    slot.put({ kind: 'receive' }, 3);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
