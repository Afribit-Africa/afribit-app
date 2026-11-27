import { describe, expect, it, vi } from 'vitest';
import type { CapabilityOutcome } from '@afribit/feature-sdk';
import { createBroker, createRegistry, parseIntent } from '../src';
import { manifest, policy } from './fixtures';

function setup(opts: { walletAvailable?: boolean } = {}) {
  const registry = createRegistry([
    manifest({ requestedCapabilities: ['app.openService', 'wallet.preparePayment', 'wallet.payContact', 'wallet.createRequest', 'mesh.open', 'notify.local'] }),
    manifest({ id: 'ai', requestedCapabilities: ['app.openService'] }),
    manifest({ id: 'wallet', classification: 'A', category: 'money', isolation: { process: 'dedicated', storageNamespace: 'feature.wallet' } }),
  ], policy);
  const shell = vi.fn(async () => ({ requestId: 'ignored', status: 'opened' as const }));
  const wallet = vi.fn(async () => ({ requestId: 'spoofed', status: 'pending' as const, correlationId: 'c1' }));
  let n = 0;
  const broker = createBroker({
    registry,
    handlers: { shell, wallet },
    isAvailable: (id) => id === 'wallet' && (opts.walletAvailable ?? true),
    newRequestId: () => `r${++n}`,
    rateLimit: { max: 3, windowMs: 1000 },
    now: () => 0,
  });
  return { broker, shell, wallet };
}

const pay = { kind: 'wallet.preparePayment', paymentRequest: 'lnbc10u1pexample', purpose: 'merchant' };

describe('broker', () => {
  it('routes an allowed intent and correlates the outcome to the host request id', async () => {
    const { broker, wallet } = setup();
    const out = await broker.clientFor('chat').request(pay);
    expect(out).toEqual({ requestId: 'r1', status: 'pending', correlationId: 'c1' });
    expect(wallet).toHaveBeenCalledWith(pay, { requestId: 'r1', caller: 'chat' });
  });

  it('identifies the caller from the host binding, not from the request', async () => {
    const { broker, wallet } = setup();
    const out = await broker.clientFor('ai').request({ ...pay, caller: 'chat' });
    expect(out.status).toBe('denied'); // extra key rejected
    const out2 = await broker.clientFor('ai').request(pay);
    expect(out2).toMatchObject({ status: 'denied', reason: 'capability-not-granted' });
    expect(wallet).not.toHaveBeenCalled();
  });

  it('denies unknown callers', async () => {
    const { broker } = setup();
    expect(await broker.clientFor('rogue').request(pay)).toMatchObject({ status: 'denied', reason: 'unknown-caller' });
  });

  it('reports an unavailable destination instead of pretending', async () => {
    const { broker } = setup({ walletAvailable: false });
    expect(await broker.clientFor('chat').request(pay)).toMatchObject({ status: 'unavailable', reason: 'destination-unavailable' });
  });

  it('rejects unknown services', async () => {
    const { broker, shell } = setup();
    expect(await broker.clientFor('chat').request({ kind: 'app.openService', serviceId: 'clans' })).toMatchObject({ status: 'failed', code: 'unknown-service' });
    expect(shell).not.toHaveBeenCalled();
  });

  it('rate-limits a noisy feature', async () => {
    const { broker } = setup();
    const c = broker.clientFor('chat');
    const open = { kind: 'app.openService', serviceId: 'ai' };
    for (let i = 0; i < 3; i++) expect((await c.request(open)).status).toBe('opened');
    expect(await c.request(open)).toMatchObject({ status: 'denied', reason: 'rate-limited' });
  });

  it('contains handler exceptions', async () => {
    const registry = createRegistry([manifest()], policy);
    const broker = createBroker({ registry, handlers: { shell: async () => { throw new Error('boom'); } }, isAvailable: () => true });
    const out = await broker.clientFor('chat').request({ kind: 'app.openService', serviceId: 'chat' });
    expect(out).toMatchObject({ status: 'failed', code: 'handler-error' });
  });
});

describe('broker notify.local', () => {
  const notice = { kind: 'notify.local', title: 'Afribit Chat', body: 'You have a new message.' };

  it('routes a local notification to the shell', async () => {
    const { broker, shell } = setup();
    const out = await broker.clientFor('chat').request(notice);
    expect(out).toEqual({ requestId: 'r1', status: 'opened' });
    expect(shell).toHaveBeenCalledWith(notice, { requestId: 'r1', caller: 'chat' });
  });

  it('rate-limits notify.local at five per window, separately from the general limit', async () => {
    const { broker } = setup(); // general limit is 3 per 1000 ms
    const c = broker.clientFor('chat');
    for (let i = 0; i < 5; i++) expect((await c.request(notice)).status).toBe('opened');
    expect(await c.request(notice)).toMatchObject({ status: 'denied', reason: 'rate-limited' });
  });

  it('surfaces the shell reporting notifications are not ready', async () => {
    const registry = createRegistry([manifest({ requestedCapabilities: ['notify.local'] })], policy);
    const broker = createBroker({
      registry,
      handlers: { shell: async (_intent, meta) => ({ requestId: meta.requestId, status: 'unavailable' as const, reason: 'notifications-not-ready' }) },
      isAvailable: () => true,
    });
    expect(await broker.clientFor('chat').request(notice))
      .toEqual({ requestId: expect.any(String), status: 'unavailable', reason: 'notifications-not-ready' });
  });

  it('denies notify.local when the caller was not granted the capability', async () => {
    const { broker, shell } = setup();
    expect(await broker.clientFor('ai').request(notice)).toMatchObject({ status: 'denied', reason: 'capability-not-granted' });
    expect(shell).not.toHaveBeenCalled();
  });
});

describe('broker shell.openMesh', () => {
  it('routes an intent without a section to the shell', async () => {
    const { broker, shell } = setup();
    const out = await broker.clientFor('chat').request({ kind: 'shell.openMesh' });
    expect(out).toEqual({ requestId: 'r1', status: 'opened' });
    expect(shell).toHaveBeenCalledWith({ kind: 'shell.openMesh' }, { requestId: 'r1', caller: 'chat' });
  });

  it('routes an intent with a section to the shell', async () => {
    const { broker, shell } = setup();
    const out = await broker.clientFor('chat').request({ kind: 'shell.openMesh', section: 'settings' });
    expect(out).toEqual({ requestId: 'r1', status: 'opened' });
    expect(shell).toHaveBeenCalledWith({ kind: 'shell.openMesh', section: 'settings' }, { requestId: 'r1', caller: 'chat' });
  });

  it('denies a bad section', async () => {
    const { broker, shell } = setup();
    expect(await broker.clientFor('chat').request({ kind: 'shell.openMesh', section: 'secret' }))
      .toMatchObject({ status: 'denied', reason: 'invalid-intent' });
    expect(shell).not.toHaveBeenCalled();
  });

  it('denies an extra key', async () => {
    const { broker, shell } = setup();
    expect(await broker.clientFor('chat').request({ kind: 'shell.openMesh', path: '/settings' }))
      .toMatchObject({ status: 'denied', reason: 'invalid-intent' });
    expect(shell).not.toHaveBeenCalled();
  });

  it('denies when the capability is not granted', async () => {
    const { broker, shell } = setup();
    expect(await broker.clientFor('ai').request({ kind: 'shell.openMesh' }))
      .toMatchObject({ status: 'denied', reason: 'capability-not-granted' });
    expect(shell).not.toHaveBeenCalled();
  });
});

describe('broker profile.read', () => {
  function profileSetup(outcome: CapabilityOutcome) {
    const registry = createRegistry([
      manifest({ requestedCapabilities: ['app.openService', 'profile.read'] }),
      manifest({ id: 'ai', requestedCapabilities: ['app.openService'] }),
      manifest({ id: 'wallet', classification: 'A', category: 'money', isolation: { process: 'dedicated', storageNamespace: 'feature.wallet' } }),
    ], policy);
    const shell = vi.fn(async () => outcome);
    let n = 0;
    const broker = createBroker({
      registry,
      handlers: { shell },
      isAvailable: () => true,
      newRequestId: () => `r${++n}`,
      rateLimit: { max: 3, windowMs: 1000 },
      now: () => 0,
    });
    return { broker, shell };
  }

  it('returns the inherited nickname and a null npub', async () => {
    const { broker, shell } = profileSetup({ requestId: 'ignored', status: 'profile', profile: { nickname: 'Amina', npub: null } });
    const out = await broker.clientFor('chat').request({ kind: 'profile.read' });
    expect(out).toEqual({ requestId: 'r1', status: 'profile', profile: { nickname: 'Amina', npub: null } });
    expect(shell).toHaveBeenCalledWith({ kind: 'profile.read' }, { requestId: 'r1', caller: 'chat' });
  });

  it('strips fields the handler was not allowed to add', async () => {
    const spoofed = {
      requestId: 'ignored',
      status: 'profile' as const,
      profile: { nickname: 'Amina', npub: 'npub1example', keys: 'secret', legalName: 'Amina Wanjiru' },
    };
    const { broker } = profileSetup(spoofed);
    const out = await broker.clientFor('chat').request({ kind: 'profile.read' });
    expect(out).toEqual({ requestId: 'r1', status: 'profile', profile: { nickname: 'Amina', npub: 'npub1example' } });
  });

  it('fails when the nickname is longer than 64 characters', async () => {
    const { broker } = profileSetup({ requestId: 'ignored', status: 'profile', profile: { nickname: 'a'.repeat(65), npub: null } });
    expect(await broker.clientFor('chat').request({ kind: 'profile.read' })).toMatchObject({ status: 'failed', code: 'bad-profile' });
  });

  it('denies a feature without the profile.read capability', async () => {
    const { broker, shell } = profileSetup({ requestId: 'ignored', status: 'profile', profile: { nickname: 'Amina', npub: null } });
    expect(await broker.clientFor('ai').request({ kind: 'profile.read' }))
      .toMatchObject({ status: 'denied', reason: 'capability-not-granted' });
    expect(shell).not.toHaveBeenCalled();
  });
});

describe('parseIntent', () => {
  it('accepts exactly { kind: profile.read }', () => {
    expect(parseIntent({ kind: 'profile.read' })).toEqual({ kind: 'profile.read' });
  });

  it.each([
    [null],
    [[]],
    [{ kind: 'wallet.sign', tx: 'x' }],
    [{ kind: 'wallet.preparePayment', paymentRequest: '', purpose: 'merchant' }],
    [{ kind: 'wallet.preparePayment', paymentRequest: 'a b', purpose: 'merchant' }],
    [{ kind: 'wallet.preparePayment', paymentRequest: 'x'.repeat(4097), purpose: 'merchant' }],
    [{ kind: 'wallet.preparePayment', paymentRequest: 'lnbc1', purpose: 'donation' }],
    [{ kind: 'wallet.showReceive', amount: 5 }],
    [{ kind: 'app.openService', serviceId: '../wallet' }],
    [{ kind: 'shell.openMesh', section: 'secret' }],
    [{ kind: 'shell.openMesh', section: 5 }],
    [{ kind: 'shell.openMesh', path: '/settings' }],
    [{ kind: 'shell.openMesh', section: 'settings', path: '/settings' }],
    [{ kind: 'profile.read', npub: 'npub1example' }],
  ])('rejects %j', (raw) => {
    expect(parseIntent(raw)).toBeNull();
  });
});

describe('parseIntent notify.local', () => {
  it('accepts a minimal notification', () => {
    expect(parseIntent({ kind: 'notify.local', title: 'A', body: 'B' }))
      .toEqual({ kind: 'notify.local', title: 'A', body: 'B' });
  });

  it('accepts a title of 40 and a body of 120 characters', () => {
    const title = 't'.repeat(40);
    const body = 'b'.repeat(120);
    expect(parseIntent({ kind: 'notify.local', title, body }))
      .toEqual({ kind: 'notify.local', title, body });
  });

  it.each([
    ['an empty title', { kind: 'notify.local', title: '', body: 'body' }],
    ['a title over 40 characters', { kind: 'notify.local', title: 't'.repeat(41), body: 'body' }],
    ['an empty body', { kind: 'notify.local', title: 'title', body: '' }],
    ['a body over 120 characters', { kind: 'notify.local', title: 'title', body: 'b'.repeat(121) }],
    ['a line break in the title', { kind: 'notify.local', title: 'a\nb', body: 'body' }],
    ['a carriage return in the body', { kind: 'notify.local', title: 'title', body: 'a\rb' }],
    ['a tab in the title', { kind: 'notify.local', title: 'a\tb', body: 'body' }],
    ['a NUL byte in the body', { kind: 'notify.local', title: 'title', body: 'a\u0000b' }],
    ['a non-string title', { kind: 'notify.local', title: 5, body: 'body' }],
    ['a non-string body', { kind: 'notify.local', title: 'title', body: 5 }],
    ['a missing key', { kind: 'notify.local', title: 'title' }],
    ['an extra key', { kind: 'notify.local', title: 'title', body: 'body', room: 'x' }],
  ])('rejects %s', (_name, raw) => {
    expect(parseIntent(raw)).toBeNull();
  });
});

describe('parseIntent wallet.payContact', () => {
  const contact = { displayName: 'Amina', paymentAddress: 'lnbc10u1pexample', verification: 'verified' };

  it('accepts a contact with no amount or note', () => {
    const intent = { kind: 'wallet.payContact', contact };
    expect(parseIntent(intent)).toEqual(intent);
  });

  it('keeps the amount and note when given', () => {
    const intent = { kind: 'wallet.payContact', contact, amount: { currency: 'KES', value: 250.5 }, note: 'Lunch' };
    expect(parseIntent(intent)).toEqual(intent);
  });

  it('accepts an integer number of sats and each verification state', () => {
    for (const verification of ['verified', 'unverified', 'changed-device']) {
      const intent = { kind: 'wallet.payContact', contact: { ...contact, verification }, amount: { currency: 'BTC', value: 21 } };
      expect(parseIntent(intent)).toEqual(intent);
    }
  });

  it.each([
    ['an empty display name', { contact: { ...contact, displayName: '' } }],
    ['a display name over 64 characters', { contact: { ...contact, displayName: 'a'.repeat(65) } }],
    ['a line break in the display name', { contact: { ...contact, displayName: 'a\nb' } }],
    ['a control character in the display name', { contact: { ...contact, displayName: 'a\u0000b' } }],
    ['a non-string display name', { contact: { ...contact, displayName: 5 } }],
    ['an empty payment address', { contact: { ...contact, paymentAddress: '' } }],
    ['whitespace in the payment address', { contact: { ...contact, paymentAddress: 'a b' } }],
    ['a payment address over 2048 characters', { contact: { ...contact, paymentAddress: 'x'.repeat(2049) } }],
    ['an unknown verification', { contact: { ...contact, verification: 'trusted' } }],
    ['a non-string verification', { contact: { ...contact, verification: 1 } }],
    ['a contact with an extra key', { contact: { ...contact, id: 'x' } }],
    ['a contact missing verification', { contact: { displayName: 'Amina', paymentAddress: 'lnbc1' } }],
    ['a non-object contact', { contact: 'Amina' }],
    ['a missing contact', { contact: undefined }],
    ['an unknown currency', { amount: { currency: 'USD', value: 1 } }],
    ['a zero amount', { amount: { currency: 'KES', value: 0 } }],
    ['a negative amount', { amount: { currency: 'KES', value: -1 } }],
    ['a NaN amount', { amount: { currency: 'KES', value: Number.NaN } }],
    ['an infinite amount', { amount: { currency: 'KES', value: Number.POSITIVE_INFINITY } }],
    ['three-decimal KES', { amount: { currency: 'KES', value: 1.005 } }],
    ['KES over the cap', { amount: { currency: 'KES', value: 1_000_001 } }],
    ['fractional sats', { amount: { currency: 'BTC', value: 1.5 } }],
    ['BTC over the cap', { amount: { currency: 'BTC', value: 2_100_000_000_000_001 } }],
    ['an amount with an extra key', { amount: { currency: 'KES', value: 1, rate: 0.1 } }],
    ['a non-object amount', { amount: 5 }],
    ['a note over 140 characters', { note: 'n'.repeat(141) }],
    ['a line break in the note', { note: 'a\nb' }],
    ['a top-level extra key', { purpose: 'manual' }],
  ])('rejects %s', (_name, overrides) => {
    expect(parseIntent({ kind: 'wallet.payContact', contact, ...overrides })).toBeNull();
  });
});

describe('parseIntent wallet.createRequest', () => {
  it('accepts an amount with no note', () => {
    const raw = { kind: 'wallet.createRequest', amount: { currency: 'KES', value: 100 } };
    expect(parseIntent(raw)).toEqual(raw);
  });

  it('keeps the note when given', () => {
    const raw = { kind: 'wallet.createRequest', amount: { currency: 'BTC', value: 21 }, note: 'For the ride' };
    expect(parseIntent(raw)).toEqual(raw);
  });

  it.each([
    ['a missing amount', { kind: 'wallet.createRequest' }],
    ['an unknown currency', { kind: 'wallet.createRequest', amount: { currency: 'USD', value: 1 } }],
    ['a zero amount', { kind: 'wallet.createRequest', amount: { currency: 'KES', value: 0 } }],
    ['a NaN amount', { kind: 'wallet.createRequest', amount: { currency: 'KES', value: Number.NaN } }],
    ['fractional sats', { kind: 'wallet.createRequest', amount: { currency: 'BTC', value: 2.5 } }],
    ['a note over 140 characters', { kind: 'wallet.createRequest', amount: { currency: 'KES', value: 1 }, note: 'n'.repeat(141) }],
    ['a non-object amount', { kind: 'wallet.createRequest', amount: 5 }],
    ['an extra key', { kind: 'wallet.createRequest', amount: { currency: 'KES', value: 1 }, contact: 'Amina' }],
  ])('rejects %s', (_name, raw) => {
    expect(parseIntent(raw)).toBeNull();
  });
});

describe('broker payment prompts', () => {
  const contact = { displayName: 'Amina', paymentAddress: 'lnbc10u1pexample', verification: 'verified' };
  const payContact = { kind: 'wallet.payContact', contact };
  const createRequest = { kind: 'wallet.createRequest', amount: { currency: 'KES', value: 100 } };

  const payContactPolicy = {
    chat: { classification: 'B', allowedCapabilities: ['wallet.payContact'], enabled: true },
    ai: { classification: 'B', allowedCapabilities: ['wallet.payContact'], enabled: true },
  } as const;
  const payContactManifests = [
    manifest({ requestedCapabilities: ['wallet.payContact'] }),
    manifest({ id: 'ai', requestedCapabilities: ['wallet.payContact'] }),
  ];

  it('shares one payment limit across preparePayment, payContact and createRequest', async () => {
    const { broker, wallet } = setup(); // payment limit defaults to 3 per 60 s
    const c = broker.clientFor('chat');
    expect((await c.request(pay)).status).toBe('pending');
    expect((await c.request(payContact)).status).toBe('pending');
    expect((await c.request(createRequest)).status).toBe('pending');
    expect(await c.request(pay)).toMatchObject({ status: 'denied', reason: 'rate-limited' });
    expect(wallet).toHaveBeenCalledTimes(3);
  });

  it('keeps the payment limit per caller', async () => {
    const registry = createRegistry(payContactManifests, payContactPolicy);
    const wallet = vi.fn(async () => ({ requestId: 'ignored', status: 'opened' as const }));
    let n = 0;
    const broker = createBroker({
      registry,
      handlers: { wallet },
      isAvailable: () => true,
      newRequestId: () => `r${++n}`,
      rateLimit: { max: 3, windowMs: 1000 },
      now: () => 0,
    });
    const chat = broker.clientFor('chat');
    const ai = broker.clientFor('ai');
    for (let i = 0; i < 3; i++) expect((await chat.request(payContact)).status).toBe('opened');
    expect(await chat.request(payContact)).toMatchObject({ status: 'denied', reason: 'rate-limited' });
    expect((await ai.request(payContact)).status).toBe('opened');
  });

  it('denies a missing capability before the rate limit counts the call', async () => {
    const { broker, wallet } = setup();
    const ai = broker.clientFor('ai'); // not granted any wallet capability
    for (let i = 0; i < 5; i++) {
      expect(await ai.request(payContact)).toMatchObject({ status: 'denied', reason: 'capability-not-granted' });
    }
    expect(wallet).not.toHaveBeenCalled();
  });
});
