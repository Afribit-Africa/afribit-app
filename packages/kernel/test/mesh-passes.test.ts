import { describe, expect, it, vi } from 'vitest';
import { createMeshPassClient, type MeshPassConfig } from '../src';

const BASE = 'https://wifi.afribit.africa';
const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const DEVICE_UUID = '9c858901-8a57-4791-81fe-4c455b099bc9';
const GRANT_UUID = '2b1f5c9a-6d3e-4a7b-8c0d-1e2f3a4b5c6d';
const SESSION = `${UUID}.${'a'.repeat(43)}`;
const DEVICE_KEY = 'b'.repeat(43);
const PASS = { id: UUID, status: 'active', expiresAt: '2026-12-01T00:00:00.000Z', label: 'Kibera week', devices: 2 };

const PACKAGE_UUID = '1d2e3f40-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const REQUEST_UUID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const PAYMENT_UUID = 'b3d1c2f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const PACKAGE = {
  id: PACKAGE_UUID,
  name: 'Day pass',
  description: null,
  priceKes: 50,
  durationMinutes: 1440,
  dataLimitMb: null,
  kind: 'personal',
  deviceLimit: 1,
  bitcoinKes: 47.5,
};
const LNBC = 'lnbc2500u1p3xqzjrpp5qqq';

interface Call {
  readonly url: string;
  readonly init: RequestInit;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function makeClient(
  responder: (url: string, init: RequestInit) => Response | Promise<Response>,
  over: Partial<MeshPassConfig> = {},
) {
  const calls: Call[] = [];
  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const requestInit = init ?? {};
    calls.push({ url, init: requestInit });
    return responder(url, requestInit);
  }) as typeof fetch;
  const client = createMeshPassClient({
    baseUrl: BASE,
    session: SESSION,
    deviceKey: DEVICE_KEY,
    fetch: fakeFetch,
    timeoutMs: 5000,
    ...over,
  });
  return { client, calls };
}

describe('listPasses', () => {
  it('keeps only the fields the app needs and ignores the rest', async () => {
    const { client, calls } = makeClient(() => json({ passes: [{ ...PASS, unused: 'ignored' }], total: 1 }));

    await expect(client.listPasses()).resolves.toEqual({
      ok: true,
      value: [{ id: UUID, status: 'active', expiresAt: '2026-12-01T00:00:00.000Z', label: 'Kibera week', devices: 2 }],
    });
    expect(calls.map((c) => c.url)).toEqual([`${BASE}/api/mesh/pass`]);
  });

  it('accepts a device with no passes', async () => {
    const { client } = makeClient(() => json({ passes: [] }));
    await expect(client.listPasses()).resolves.toEqual({ ok: true, value: [] });
  });

  it('rejects an unknown pass status', async () => {
    const { client } = makeClient(() => json({ passes: [{ ...PASS, status: 'revoked' }] }));
    await expect(client.listPasses()).resolves.toEqual({ ok: false, reason: 'invalid-response' });
  });

  it('rejects a pass whose fields have the wrong type', async () => {
    const { client } = makeClient(() => json({ passes: [{ ...PASS, devices: '2' }] }));
    await expect(client.listPasses()).resolves.toEqual({ ok: false, reason: 'invalid-response' });

    const { client: other } = makeClient(() => json({ passes: [{ ...PASS, expiresAt: 12 }] }));
    await expect(other.listPasses()).resolves.toEqual({ ok: false, reason: 'invalid-response' });
  });

  it('rejects a body that is not a passes list', async () => {
    const { client } = makeClient(() => json({ passes: 'nope' }));
    await expect(client.listPasses()).resolves.toEqual({ ok: false, reason: 'invalid-response' });
  });

  it('reports an unknown device as unauthorized', async () => {
    const { client } = makeClient(() => new Response('', { status: 401 }));
    await expect(client.listPasses()).resolves.toEqual({ ok: false, reason: 'unauthorized' });
  });

  it('reports a server error without trusting its body', async () => {
    const { client } = makeClient(() => json({ error: 'backing store down' }, 500));
    await expect(client.listPasses()).resolves.toEqual({ ok: false, reason: 'server' });
  });
});

describe('redeemCode', () => {
  it('sends the code, label and replacement device and returns the grant', async () => {
    const { client, calls } = makeClient(() => json({ grantId: GRANT_UUID }));

    await expect(
      client.redeemCode({ code: '1234 5678-90', label: 'Kibera', replaceDeviceId: DEVICE_UUID }),
    ).resolves.toEqual({ ok: true, value: { grantId: GRANT_UUID } });
    expect(calls[0]?.url).toBe(`${BASE}/api/mesh/pass/code`);
    expect(calls[0]?.init.method).toBe('POST');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      code: '1234 5678-90',
      label: 'Kibera',
      replaceDeviceId: DEVICE_UUID,
    });
  });

  it('omits the optional body fields when they are absent', async () => {
    const { client, calls } = makeClient(() => json({ grantId: GRANT_UUID }));
    await client.redeemCode({ code: '1234567890' });
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ code: '1234567890' });
  });

  it('rejects a malformed code, label or device id before sending', async () => {
    const { client, calls } = makeClient(() => json({ grantId: GRANT_UUID }));

    await expect(client.redeemCode({ code: 'short' })).resolves.toEqual({ ok: false, reason: 'invalid-response' });
    await expect(client.redeemCode({ code: '1234567890', label: 'x'.repeat(25) })).resolves.toEqual({ ok: false, reason: 'invalid-response' });
    await expect(client.redeemCode({ code: '1234567890', replaceDeviceId: 'not-a-uuid' })).resolves.toEqual({ ok: false, reason: 'invalid-response' });
    expect(calls).toHaveLength(0);
  });

  it('passes the server error text through for a rejected code', async () => {
    const { client } = makeClient(() => json({ error: 'Code already used' }, 400));
    await expect(client.redeemCode({ code: '1234567890' })).resolves.toEqual({
      ok: false,
      reason: 'rejected',
      message: 'Code already used',
    });
  });

  it('trims a server error message to 200 characters', async () => {
    const { client } = makeClient(() => json({ error: 'x'.repeat(500) }, 400));
    const result = await client.redeemCode({ code: '1234567890' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected a failure');
    expect(result.message).toHaveLength(200);
  });

  it('rejects a 2xx body that is not the grant shape', async () => {
    const { client } = makeClient(() => json({ grantId: 'nope' }));
    await expect(client.redeemCode({ code: '1234567890' })).resolves.toEqual({ ok: false, reason: 'invalid-response' });
  });
});

describe('accessStatus', () => {
  it('returns the status and expiry for a grant', async () => {
    const { client, calls } = makeClient(() => json({ status: 'active', expiresAt: '2026-12-01T00:00:00.000Z' }));

    await expect(client.accessStatus(GRANT_UUID)).resolves.toEqual({
      ok: true,
      value: { status: 'active', expiresAt: '2026-12-01T00:00:00.000Z' },
    });
    expect(calls[0]?.url).toBe(`${BASE}/api/mesh/access/status?grant=${GRANT_UUID}`);
  });

  it('normalises a missing expiry to null', async () => {
    const { client } = makeClient(() => json({ status: 'pending' }));
    await expect(client.accessStatus(GRANT_UUID)).resolves.toEqual({ ok: true, value: { status: 'pending', expiresAt: null } });
  });

  it('reports a missing pass as not-found with the server text', async () => {
    const { client } = makeClient(() => json({ error: 'Pass not found' }, 404));
    await expect(client.accessStatus(GRANT_UUID)).resolves.toEqual({
      ok: false,
      reason: 'not-found',
      message: 'Pass not found',
    });
  });

  it('reports a 503 as a server failure without its body', async () => {
    const { client } = makeClient(() => json({ error: 'Could not check your connection' }, 503));
    await expect(client.accessStatus(GRANT_UUID)).resolves.toEqual({ ok: false, reason: 'server' });
  });

  it('rejects an unknown status value', async () => {
    const { client } = makeClient(() => json({ status: 'weird' }));
    await expect(client.accessStatus(GRANT_UUID)).resolves.toEqual({ ok: false, reason: 'invalid-response' });
  });

  it('rejects a grant id that is not a UUID before sending', async () => {
    const { client, calls } = makeClient(() => json({ status: 'active' }));
    await expect(client.accessStatus('nope')).resolves.toEqual({ ok: false, reason: 'invalid-response' });
    expect(calls).toHaveLength(0);
  });
});

describe('listPackages', () => {
  it('returns the catalog, keeping the fields the app needs', async () => {
    const { client, calls } = makeClient(() =>
      json({ packages: [{ ...PACKAGE, unused: 'ignored' }], bitcoinEnabled: true, mpesaEnabled: true }),
    );

    await expect(client.listPackages()).resolves.toEqual({
      ok: true,
      value: { packages: [PACKAGE], bitcoinEnabled: true, mpesaEnabled: true },
    });
    expect(calls[0]?.url).toBe(`${BASE}/api/mesh/app/packages`);
  });

  it('keeps a null bitcoin price and an empty catalog', async () => {
    const { client } = makeClient(() =>
      json({ packages: [{ ...PACKAGE, bitcoinKes: null }], bitcoinEnabled: false, mpesaEnabled: true }),
    );
    await expect(client.listPackages()).resolves.toEqual({
      ok: true,
      value: { packages: [{ ...PACKAGE, bitcoinKes: null }], bitcoinEnabled: false, mpesaEnabled: true },
    });

    const { client: empty } = makeClient(() => json({ packages: [], bitcoinEnabled: true, mpesaEnabled: false }));
    await expect(empty.listPackages()).resolves.toEqual({
      ok: true,
      value: { packages: [], bitcoinEnabled: true, mpesaEnabled: false },
    });
  });

  it('drops a package that fails a field check but keeps the order of the rest', async () => {
    const { client } = makeClient(() =>
      json({
        packages: [
          { ...PACKAGE, id: UUID, name: 'First' },
          { ...PACKAGE, kind: 'weird' },
          { ...PACKAGE, id: GRANT_UUID, name: 'Second', bitcoinKes: '47.5' },
          { ...PACKAGE, id: DEVICE_UUID, name: 'Third' },
        ],
        bitcoinEnabled: true,
        mpesaEnabled: true,
      }),
    );

    const result = await client.listPackages();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected a catalog');
    expect(result.value.packages.map((p) => p.name)).toEqual(['First', 'Third']);
  });

  it('rejects a catalog whose top-level flags are not booleans', async () => {
    const { client } = makeClient(() => json({ packages: [], bitcoinEnabled: 'yes', mpesaEnabled: true }));
    await expect(client.listPackages()).resolves.toEqual({ ok: false, reason: 'invalid-response' });

    const { client: other } = makeClient(() => json({ packages: 'nope', bitcoinEnabled: true, mpesaEnabled: true }));
    await expect(other.listPackages()).resolves.toEqual({ ok: false, reason: 'invalid-response' });
  });
});

describe('startPurchase', () => {
  it('starts a Lightning purchase with the caller-made request id', async () => {
    const { client, calls } = makeClient(() => json({ paymentId: PAYMENT_UUID, checkoutUrl: 'https://pay.example/x' }));

    await expect(
      client.startPurchase({ packageId: PACKAGE_UUID, provider: 'lightning', requestId: REQUEST_UUID }),
    ).resolves.toEqual({ ok: true, value: { paymentId: PAYMENT_UUID } });
    expect(calls[0]?.url).toBe(`${BASE}/api/payments`);
    expect(calls[0]?.init.method).toBe('POST');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      packageId: PACKAGE_UUID,
      provider: 'lightning',
      requestId: REQUEST_UUID,
    });
  });

  it('sends mpesa with the phone, and lets the service pick the M-Pesa provider', async () => {
    const { client, calls } = makeClient(() => json({ paymentId: PAYMENT_UUID, checkoutUrl: 'https://pay.example/x' }));

    await expect(
      client.startPurchase({ packageId: PACKAGE_UUID, provider: 'mpesa', requestId: REQUEST_UUID, phone: '+254712345678' }),
    ).resolves.toEqual({ ok: true, value: { paymentId: PAYMENT_UUID } });
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      packageId: PACKAGE_UUID,
      provider: 'mpesa',
      requestId: REQUEST_UUID,
      phone: '+254712345678',
    });
  });

  it('passes a device code through for another screen', async () => {
    const { client, calls } = makeClient(() => json({ paymentId: PAYMENT_UUID, checkoutUrl: 'https://pay.example/x' }));
    await client.startPurchase({ packageId: PACKAGE_UUID, provider: 'lightning', requestId: REQUEST_UUID, forDeviceCode: 'tv-01' });
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      packageId: PACKAGE_UUID,
      provider: 'lightning',
      requestId: REQUEST_UUID,
      forDeviceCode: 'tv-01',
    });
  });

  it('fails before sending when mpesa has no phone', async () => {
    const { client, calls } = makeClient(() => json({ paymentId: PAYMENT_UUID }));
    await expect(
      client.startPurchase({ packageId: PACKAGE_UUID, provider: 'mpesa', requestId: REQUEST_UUID }),
    ).resolves.toEqual({ ok: false, reason: 'invalid-response' });
    expect(calls).toHaveLength(0);
  });

  it('fails before sending when the request id or package id is not a UUID', async () => {
    const { client, calls } = makeClient(() => json({ paymentId: PAYMENT_UUID }));
    await expect(
      client.startPurchase({ packageId: PACKAGE_UUID, provider: 'lightning', requestId: 'nope' }),
    ).resolves.toEqual({ ok: false, reason: 'invalid-response' });
    await expect(
      client.startPurchase({ packageId: 'nope', provider: 'lightning', requestId: REQUEST_UUID }),
    ).resolves.toEqual({ ok: false, reason: 'invalid-response' });
    expect(calls).toHaveLength(0);
  });

  it('returns the open payment id for earlier_payment', async () => {
    const { client } = makeClient(() =>
      json({ error: 'An earlier payment is still open', code: 'earlier_payment', paymentId: PAYMENT_UUID }, 409),
    );
    await expect(
      client.startPurchase({ packageId: PACKAGE_UUID, provider: 'lightning', requestId: REQUEST_UUID }),
    ).resolves.toEqual({ ok: false, reason: 'earlier-payment', paymentId: PAYMENT_UUID });
  });

  it('tells the caller to make a new request id for reference_closed', async () => {
    const { client } = makeClient(() => json({ error: 'reference closed', code: 'reference_closed' }, 409));
    await expect(
      client.startPurchase({ packageId: PACKAGE_UUID, provider: 'mpesa', requestId: REQUEST_UUID, phone: '+254712345678' }),
    ).resolves.toEqual({ ok: false, reason: 'reference-closed' });
  });

  it('keeps the server message on a 503', async () => {
    const { client } = makeClient(() => json({ error: 'The internet line is down, try again' }, 503));
    await expect(
      client.startPurchase({ packageId: PACKAGE_UUID, provider: 'lightning', requestId: REQUEST_UUID }),
    ).resolves.toEqual({ ok: false, reason: 'server', message: 'The internet line is down, try again' });
  });

  it('caps a long 503 message like the other calls', async () => {
    const { client } = makeClient(() => json({ error: 'x'.repeat(500) }, 503));
    const result = await client.startPurchase({ packageId: PACKAGE_UUID, provider: 'lightning', requestId: REQUEST_UUID });
    if (result.ok || result.reason !== 'server') throw new Error('expected a server failure');
    expect(result.message).toHaveLength(200);
  });

  it('reports any other rejection with the server text', async () => {
    const { client } = makeClient(() => json({ error: 'bad package' }, 400));
    await expect(
      client.startPurchase({ packageId: PACKAGE_UUID, provider: 'lightning', requestId: REQUEST_UUID }),
    ).resolves.toEqual({ ok: false, reason: 'rejected', message: 'bad package' });
  });

  it('rejects a success body that has no payment id', async () => {
    const { client } = makeClient(() => json({ checkoutUrl: 'https://pay.example/x' }));
    await expect(
      client.startPurchase({ packageId: PACKAGE_UUID, provider: 'lightning', requestId: REQUEST_UUID }),
    ).resolves.toEqual({ ok: false, reason: 'invalid-response' });
  });

  it('never returns the phone number', async () => {
    const phone = '+254712345678';
    const { client } = makeClient(() => json({ error: 'payment could not start' }, 400));
    const result = await client.startPurchase({
      packageId: PACKAGE_UUID,
      provider: 'mpesa',
      requestId: REQUEST_UUID,
      phone,
    });
    expect(result).toEqual({ ok: false, reason: 'rejected', message: 'payment could not start' });
    expect(JSON.stringify(result)).not.toContain(phone);
    expect(JSON.stringify(result)).not.toContain('254712345678');
  });
});

describe('paymentStatus', () => {
  it('returns the status and access for a payment', async () => {
    const { client, calls } = makeClient(() =>
      json({ status: 'processing', provider: 'mpesa', nativeAccess: { status: 'pending', expiresAt: null }, unused: 1 }),
    );

    await expect(client.paymentStatus(PAYMENT_UUID)).resolves.toEqual({
      ok: true,
      value: { status: 'processing', nativeAccess: { status: 'pending', expiresAt: null } },
    });
    expect(calls[0]?.url).toBe(`${BASE}/api/payments/${PAYMENT_UUID}`);
  });

  it('normalises a missing access block to null', async () => {
    const { client } = makeClient(() => json({ status: 'new' }));
    await expect(client.paymentStatus(PAYMENT_UUID)).resolves.toEqual({
      ok: true,
      value: { status: 'new', nativeAccess: null },
    });
  });

  it('keeps a valid Lightning invoice', async () => {
    const { client } = makeClient(() =>
      json({
        status: 'new',
        provider: 'lightning',
        nativeAccess: null,
        lightning: { paymentRequest: LNBC, satoshis: 2100, expiresAt: '2026-11-26T10:00:00.000Z' },
      }),
    );
    await expect(client.paymentStatus(PAYMENT_UUID)).resolves.toEqual({
      ok: true,
      value: {
        status: 'new',
        nativeAccess: null,
        lightning: { paymentRequest: LNBC, satoshis: 2100, expiresAt: '2026-11-26T10:00:00.000Z' },
      },
    });
  });

  it('drops a bad BOLT11 invoice and keeps the rest', async () => {
    const { client } = makeClient(() =>
      json({ status: 'new', nativeAccess: null, lightning: { paymentRequest: 'lnbc123', satoshis: 2100, expiresAt: null } }),
    );
    await expect(client.paymentStatus(PAYMENT_UUID)).resolves.toEqual({
      ok: true,
      value: { status: 'new', nativeAccess: null },
    });

    const { client: testnet } = makeClient(() =>
      json({ status: 'new', nativeAccess: null, lightning: { paymentRequest: 'lntb2500u1p3xqzjrpp5qqq', satoshis: 2100, expiresAt: null } }),
    );
    await expect(testnet.paymentStatus(PAYMENT_UUID)).resolves.toEqual({
      ok: true,
      value: { status: 'new', nativeAccess: null },
    });
  });

  it('rejects a payment id that is not a UUID before sending', async () => {
    const { client, calls } = makeClient(() => json({ status: 'new' }));
    await expect(client.paymentStatus('nope')).resolves.toEqual({ ok: false, reason: 'rejected' });
    expect(calls).toHaveLength(0);
  });

  it('reports a payment the service does not know as not-found', async () => {
    const { client } = makeClient(() => json({ error: 'no such payment' }, 404));
    await expect(client.paymentStatus(PAYMENT_UUID)).resolves.toEqual({
      ok: false,
      reason: 'not-found',
      message: 'no such payment',
    });
  });
});

describe('transport', () => {
  it('reports offline when the request throws', async () => {
    const { client } = makeClient(() => Promise.reject(new Error('no route')));
    await expect(client.listPasses()).resolves.toEqual({ ok: false, reason: 'offline' });
  });

  it('reports timeout when the request outlives the budget', async () => {
    vi.useFakeTimers();
    try {
      const { client } = makeClient(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      );
      const pending = client.listPasses();
      await vi.advanceTimersByTimeAsync(5000);
      await expect(pending).resolves.toEqual({ ok: false, reason: 'timeout' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects a redirect', async () => {
    const { client } = makeClient(() => new Response('', { status: 302, headers: { location: 'https://elsewhere.example/' } }));
    await expect(client.listPasses()).resolves.toEqual({ ok: false, reason: 'invalid-response' });
  });

  it('rejects a body over 64 KB', async () => {
    const { client } = makeClient(() => json({ passes: [], padding: 'x'.repeat(70 * 1024) }));
    await expect(client.listPasses()).resolves.toEqual({ ok: false, reason: 'invalid-response' });
  });

  it('rejects a non-JSON success body', async () => {
    const { client } = makeClient(() => new Response('<html>', { status: 200 }));
    await expect(client.listPasses()).resolves.toEqual({ ok: false, reason: 'invalid-response' });
  });

  it('sends the session and device key as headers and never in the URL', async () => {
    const { client, calls } = makeClient((url) => {
      if (url.includes('/api/mesh/pass/code')) return json({ grantId: GRANT_UUID });
      if (url.includes('/api/mesh/app/packages')) return json({ packages: [], bitcoinEnabled: true, mpesaEnabled: true });
      if (url.includes('/api/payments')) return json({ paymentId: PAYMENT_UUID, checkoutUrl: 'https://pay.example/x', status: 'new' });
      return json({ passes: [] });
    });

    await client.listPasses();
    await client.redeemCode({ code: '1234567890' });
    await client.accessStatus(GRANT_UUID);
    await client.listPackages();
    await client.startPurchase({ packageId: PACKAGE_UUID, provider: 'lightning', requestId: REQUEST_UUID });
    await client.paymentStatus(PAYMENT_UUID);

    expect(calls).toHaveLength(6);
    for (const { url, init } of calls) {
      const headers = new Headers(init.headers);
      expect(headers.get('X-Afribit-Mesh-Session')).toBe(SESSION);
      expect(headers.get('X-Afribit-Mesh-Device')).toBe(DEVICE_KEY);
      expect(url).not.toContain(SESSION);
      expect(url).not.toContain(DEVICE_KEY);
    }
  });

  it('fails before any request when the base URL is not HTTPS', async () => {
    const { client, calls } = makeClient(() => json({ passes: [] }), { baseUrl: 'http://wifi.afribit.africa' });
    await expect(client.listPasses()).resolves.toEqual({ ok: false, reason: 'invalid-response' });
    expect(calls).toHaveLength(0);
  });

  it('fails before any request when the session or device key is malformed', async () => {
    const { client, calls } = makeClient(() => json({ passes: [] }), { session: 'not-a-session' });
    await expect(client.listPasses()).resolves.toEqual({ ok: false, reason: 'invalid-response' });

    const { client: other, calls: otherCalls } = makeClient(() => json({ passes: [] }), { deviceKey: 'short' });
    await expect(other.listPasses()).resolves.toEqual({ ok: false, reason: 'invalid-response' });

    expect(calls).toHaveLength(0);
    expect(otherCalls).toHaveLength(0);
  });
});
