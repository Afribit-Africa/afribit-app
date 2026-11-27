import { describe, expect, it } from 'vitest';
import type { CapabilityOutcome } from '@afribit/feature-sdk';
import type { MeshPassResult, MeshPayment, MeshPurchaseInput, MeshPurchaseResult } from '@afribit/kernel';
import { strings } from '../src/i18n';
import {
  cleanPhoneInput,
  createMeshBuy,
  isKenyanPhone,
  meshPayUrl,
  packageDataText,
  packageDurationText,
  PURCHASE_TIMEOUT_MS,
  type MeshBuyClient,
  type MeshBuyState,
} from '../src/shell/meshBuy';

const ok = (paymentId: string): MeshPurchaseResult => ({ ok: true, value: { paymentId } });
const invoice = (paymentRequest: string): MeshPayment => ({
  status: 'processing',
  nativeAccess: null,
  lightning: { paymentRequest, satoshis: 100, expiresAt: null },
});

class FakeClient implements MeshBuyClient {
  readonly purchases: MeshPurchaseInput[] = [];
  readonly statusCalls: string[] = [];
  private readonly queue: MeshPurchaseResult[];
  private payment: MeshPayment = { status: 'new', nativeAccess: null };

  constructor(queue: MeshPurchaseResult[]) {
    this.queue = [...queue];
  }

  setPayment(payment: MeshPayment): void {
    this.payment = payment;
  }

  async startPurchase(input: MeshPurchaseInput): Promise<MeshPurchaseResult> {
    this.purchases.push(input);
    return this.queue.shift() ?? ok('p-default');
  }

  async paymentStatus(paymentId: string): Promise<MeshPassResult<MeshPayment>> {
    this.statusCalls.push(paymentId);
    return { ok: true, value: this.payment };
  }
}

function setup(queue: MeshPurchaseResult[]) {
  const client = new FakeClient(queue);
  const ids = ['req-1', 'req-2', 'req-3', 'req-4'];
  let idIndex = 0;
  let now = 0;
  const walletCalls: string[] = [];
  let walletOutcome: CapabilityOutcome = { requestId: 'wallet', status: 'opened' };
  const machine = createMeshBuy({
    client,
    payFromWallet: async (paymentRequest) => {
      walletCalls.push(paymentRequest);
      return walletOutcome;
    },
    newRequestId: () => ids[idIndex++] ?? `req-${idIndex}`,
    now: () => now,
  });
  return {
    machine,
    client,
    walletCalls,
    setWallet: (outcome: CapabilityOutcome) => {
      walletOutcome = outcome;
    },
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('request ids', () => {
  it('reuses the request id when a failed purchase is retried', async () => {
    const { machine, client } = setup([{ ok: false, reason: 'server' }, ok('p1')]);
    await machine.begin('pkg', 'mpesa', '0712345678');
    expect(machine.getState()).toEqual({ kind: 'failed', reason: 'server', reuseRequestId: true });
    await machine.retry();
    expect(client.purchases.map((p) => p.requestId)).toEqual(['req-1', 'req-1']);
  });

  it('makes a new request id after reference-closed', async () => {
    const { machine, client } = setup([{ ok: false, reason: 'reference-closed' }, ok('p2')]);
    await machine.begin('pkg', 'mpesa', '0712345678');
    expect(client.purchases.map((p) => p.requestId)).toEqual(['req-1', 'req-2']);
    expect(machine.getState()).toMatchObject({ kind: 'waiting', paymentId: 'p2' });
  });

  it('gives up after reference-closed twice, then retries with a fresh id', async () => {
    const { machine, client } = setup([
      { ok: false, reason: 'reference-closed' },
      { ok: false, reason: 'reference-closed' },
      ok('p3'),
    ]);
    await machine.begin('pkg', 'mpesa', '0712345678');
    expect(machine.getState()).toEqual({ kind: 'failed', reason: 'reference-closed', reuseRequestId: false });
    await machine.retry();
    expect(client.purchases.map((p) => p.requestId)).toEqual(['req-1', 'req-2', 'req-3']);
  });

  it('resumes an earlier payment instead of starting a new one', async () => {
    const { machine, client } = setup([{ ok: false, reason: 'earlier-payment', paymentId: 'p-old' }]);
    await machine.begin('pkg', 'lightning');
    expect(machine.getState()).toEqual({
      kind: 'waiting',
      packageId: 'pkg',
      method: 'lightning',
      paymentId: 'p-old',
      payment: 'new',
      wallet: { kind: 'none' },
    });
    expect(client.purchases).toHaveLength(1);
  });
});

describe('wallet hand-off', () => {
  it('hands the invoice to the wallet exactly once per invoice', async () => {
    const { machine, client, walletCalls } = setup([ok('p1')]);
    await machine.begin('pkg', 'lightning');
    client.setPayment(invoice('lnbc10u1pexample'));
    await machine.poll();
    await machine.poll();
    await machine.poll();
    expect(walletCalls).toEqual(['lnbc10u1pexample']);
    expect(machine.getState()).toMatchObject({ kind: 'waiting', wallet: { kind: 'opened' } });
  });

  it('offers the portal fallback when the wallet is unavailable', async () => {
    const { machine, client, setWallet } = setup([ok('p1')]);
    setWallet({ requestId: 'wallet', status: 'unavailable', reason: 'no-wallet' });
    await machine.begin('pkg', 'lightning');
    client.setPayment(invoice('lnbc10u1pexample'));
    await machine.poll();
    expect(machine.getState()).toMatchObject({
      kind: 'waiting',
      wallet: { kind: 'unavailable', reason: 'no-wallet' },
    });
    expect(meshPayUrl('p1')).toBe('https://wifi.afribit.africa/pay/p1');
  });

  it("shows the wallet's reason when the hand-off is denied", async () => {
    const { machine, client, setWallet } = setup([ok('p1')]);
    setWallet({ requestId: 'wallet', status: 'denied', reason: 'user-cancelled' });
    await machine.begin('pkg', 'lightning');
    client.setPayment(invoice('lnbc10u1pexample'));
    await machine.poll();
    expect(machine.getState()).toMatchObject({
      kind: 'waiting',
      wallet: { kind: 'denied', reason: 'user-cancelled' },
    });
  });

  it('shows a failed hand-off as a failure', async () => {
    const { machine, client, setWallet } = setup([ok('p1')]);
    setWallet({ requestId: 'wallet', status: 'failed', code: 'sign-failed' });
    await machine.begin('pkg', 'lightning');
    client.setPayment(invoice('lnbc10u1pexample'));
    await machine.poll();
    expect(machine.getState()).toMatchObject({
      kind: 'waiting',
      wallet: { kind: 'failed', code: 'sign-failed' },
    });
  });
});

describe('polling stops', () => {
  const terminals: ReadonlyArray<{ payment: MeshPayment; state: MeshBuyState }> = [
    {
      payment: { status: 'settled', nativeAccess: { status: 'active', expiresAt: null } },
      state: { kind: 'done', access: 'active' },
    },
    {
      payment: { status: 'settled', nativeAccess: { status: 'pending', expiresAt: null } },
      state: { kind: 'done', access: 'pending' },
    },
    {
      payment: { status: 'settled', nativeAccess: null },
      state: { kind: 'failed', reason: 'invalid-response', reuseRequestId: false },
    },
    {
      payment: { status: 'expired', nativeAccess: null },
      state: { kind: 'failed', reason: 'expired', reuseRequestId: false },
    },
    {
      payment: { status: 'invalid', nativeAccess: null },
      state: { kind: 'failed', reason: 'invalid', reuseRequestId: false },
    },
    {
      payment: { status: 'refunded', nativeAccess: null },
      state: { kind: 'failed', reason: 'refunded', reuseRequestId: false },
    },
  ];

  for (const { payment, state } of terminals) {
    it(`stops on ${payment.status}${payment.status === 'settled' ? `/${payment.nativeAccess?.status ?? 'no access'}` : ''}`, async () => {
      const { machine, client } = setup([ok('p1')]);
      await machine.begin('pkg', 'mpesa', '0712345678');
      client.setPayment(payment);
      await machine.poll();
      expect(machine.getState()).toEqual(state);
      const calls = client.statusCalls.length;
      await machine.poll();
      expect(client.statusCalls.length).toBe(calls);
    });
  }

  it('stops after ten minutes and offers a retry with the same request id', async () => {
    const { machine, client, advance } = setup([ok('p1')]);
    await machine.begin('pkg', 'mpesa', '0712345678');
    advance(PURCHASE_TIMEOUT_MS);
    await machine.poll();
    expect(machine.getState()).toEqual({ kind: 'failed', reason: 'timed-out', reuseRequestId: true });
    expect(client.statusCalls).toHaveLength(0);
  });
});

describe('phone privacy', () => {
  it('sends the phone to the server but never keeps it in a state', async () => {
    const phone = '0712345678';
    const { machine, client } = setup([{ ok: false, reason: 'server' }]);
    await machine.begin('pkg', 'mpesa', phone);
    expect(client.purchases[0]?.phone).toBe(phone);
    const text = JSON.stringify(machine.getState());
    expect(text).not.toContain(phone);
    expect(text).not.toContain('712345678');
  });

  it('keeps the phone out of the waiting state too', async () => {
    const phone = '0712345678';
    const { machine } = setup([ok('p1')]);
    await machine.begin('pkg', 'mpesa', phone);
    expect(JSON.stringify(machine.getState())).not.toContain(phone);
  });
});

describe('phone input', () => {
  it('accepts the shapes a Kenyan number is written in', () => {
    expect(isKenyanPhone('0712345678')).toBe(true);
    expect(isKenyanPhone('0112345678')).toBe(true);
    expect(isKenyanPhone('+254712345678')).toBe(true);
    expect(isKenyanPhone('254112345678')).toBe(true);
  });

  it('rejects anything that is not a Kenyan mobile number', () => {
    expect(isKenyanPhone('071234567')).toBe(false);
    expect(isKenyanPhone('0812345678')).toBe(false);
    expect(isKenyanPhone('712345678')).toBe(false);
    expect(isKenyanPhone('+25471234567')).toBe(false);
  });

  it('keeps digits and one leading plus, and drops everything else', () => {
    expect(cleanPhoneInput('0712 345-678')).toBe('0712345678');
    expect(cleanPhoneInput('+254 (712) 345 678')).toBe('+254712345678');
    expect(cleanPhoneInput('abc0712')).toBe('0712');
  });
});

describe('package copy', () => {
  const t = strings.en;

  it('reads a duration in the largest whole unit', () => {
    expect(packageDurationText(30 * 24 * 60, t)).toBe(t.buyDurationDays(30));
    expect(packageDurationText(60, t)).toBe(t.buyDurationHours(1));
    expect(packageDurationText(90, t)).toBe(t.buyDurationMinutes(90));
  });

  it('reads a data limit in GB once it is at least 1024 MB', () => {
    expect(packageDataText(512, t)).toBe(t.buyDataMb(512));
    expect(packageDataText(2048, t)).toBe(t.buyDataGb(2));
  });
});
