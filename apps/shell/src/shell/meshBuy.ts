import type { CapabilityOutcome } from '@afribit/feature-sdk';
import type { MeshPassClient, MeshPassFailure, MeshPaymentProvider, MeshPaymentStatus } from '@afribit/kernel';
import type { Strings } from '../i18n';
import { MESH_BASE_URL } from './meshPasses';

/** The Mesh payment page the browser fallback opens when a purchase cannot be paid in the app. */
export function meshPayUrl(paymentId: string): string {
  return `${MESH_BASE_URL}/pay/${paymentId}`;
}

/** How long a purchase is followed before the screen gives up and offers a retry. */
export const PURCHASE_TIMEOUT_MS = 10 * 60_000;

/** The two ways to pay for a pass: M-Pesa, or Lightning from the Wallet. */
export type MeshBuyMethod = MeshPaymentProvider;

/** Keeps the digits and one leading + a phone field can hold; the server normalises the rest. */
export function cleanPhoneInput(raw: string): string {
  let out = '';
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') out += ch;
    else if (ch === '+' && out === '') out = '+';
  }
  return out;
}

const KENYAN_PHONE = /^(?:\+?254|0)[71]\d{8}$/;

/** A basic Kenyan shape check (07…, 01…, +2547…, 2541…); the server owns the real validation. */
export function isKenyanPhone(raw: string): boolean {
  return KENYAN_PHONE.test(cleanPhoneInput(raw));
}

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const MB_PER_GB = 1024;

export function packageDurationText(minutes: number, t: Strings): string {
  if (minutes % MINUTES_PER_DAY === 0) return t.buyDurationDays(minutes / MINUTES_PER_DAY);
  if (minutes % MINUTES_PER_HOUR === 0) return t.buyDurationHours(minutes / MINUTES_PER_HOUR);
  return t.buyDurationMinutes(minutes);
}

export function packageDataText(mb: number, t: Strings): string {
  return mb >= MB_PER_GB ? t.buyDataGb(mb / MB_PER_GB) : t.buyDataMb(mb);
}

/** How the Wallet hand-off ended, as far as the buy screen needs to know. */
export type WalletStep =
  | { readonly kind: 'none' }
  | { readonly kind: 'paying' }
  | { readonly kind: 'opened' }
  | { readonly kind: 'unavailable'; readonly reason: string }
  | { readonly kind: 'denied'; readonly reason: string }
  | { readonly kind: 'failed'; readonly code: string };

/** Why a purchase stopped. The payment statuses are terminal outcomes, not transport failures. */
export type MeshBuyFailure = MeshPassFailure | 'reference-closed' | 'expired' | 'invalid' | 'refunded' | 'timed-out';

export type MeshBuyState =
  | { readonly kind: 'select' }
  | { readonly kind: 'paying'; readonly packageId: string; readonly method: MeshBuyMethod }
  | {
      readonly kind: 'waiting';
      readonly packageId: string;
      readonly method: MeshBuyMethod;
      readonly paymentId: string;
      readonly payment: MeshPaymentStatus;
      readonly wallet: WalletStep;
    }
  | { readonly kind: 'done'; readonly access: 'active' | 'pending' }
  | { readonly kind: 'failed'; readonly reason: MeshBuyFailure; readonly reuseRequestId: boolean };

/** The two client calls the buy flow needs; a full `MeshPassClient` satisfies it. */
export type MeshBuyClient = Pick<MeshPassClient, 'startPurchase' | 'paymentStatus'>;

export interface MeshBuyDeps {
  readonly client: MeshBuyClient;
  readonly payFromWallet: (paymentRequest: string, purpose: 'mesh_pass') => Promise<CapabilityOutcome>;
  readonly newRequestId: () => string;
  readonly now: () => number;
  readonly timeoutMs?: number;
}

export interface MeshBuy {
  getState(): MeshBuyState;
  subscribe(listener: () => void): () => void;
  /** Starts a purchase, reusing the request id from the current run only when told to. */
  begin(packageId: string, method: MeshBuyMethod, phone?: string): Promise<void>;
  /** Fetches the payment once. No-ops unless the machine is waiting. */
  poll(): Promise<void>;
  /** Retries a failed purchase, reusing or replacing the request id per the failure. */
  retry(): Promise<void>;
}

function walletStep(outcome: CapabilityOutcome): WalletStep {
  switch (outcome.status) {
    case 'opened':
      return { kind: 'opened' };
    case 'unavailable':
      return { kind: 'unavailable', reason: outcome.reason };
    case 'denied':
      return { kind: 'denied', reason: outcome.reason };
    default:
      return { kind: 'failed', code: outcome.status === 'failed' ? outcome.code : 'unexpected' };
  }
}

/**
 * The buy flow as a plain state machine (select → paying → waiting → done | failed). It holds the
 * request id across retries and hands each Lightning invoice to the Wallet at most once, so the
 * screen stays a thin render of `getState()` and the whole flow is testable without React.
 */
export function createMeshBuy(deps: MeshBuyDeps): MeshBuy {
  const timeoutMs = deps.timeoutMs ?? PURCHASE_TIMEOUT_MS;
  let state: MeshBuyState = { kind: 'select' };
  let requestId = '';
  let packageId = '';
  let method: MeshBuyMethod = 'mpesa';
  let phone: string | undefined;
  let startedAt = 0;
  let handedOffInvoice: string | null = null;
  let busy = false;
  const listeners = new Set<() => void>();

  const set = (next: MeshBuyState): void => {
    state = next;
    for (const listener of listeners) listener();
  };

  const fail = (reason: MeshBuyFailure, reuse: boolean): void => {
    set({ kind: 'failed', reason, reuseRequestId: reuse });
  };

  const enterWaiting = (paymentId: string): void => {
    startedAt = deps.now();
    handedOffInvoice = null;
    set({ kind: 'waiting', packageId, method, paymentId, payment: 'new', wallet: { kind: 'none' } });
  };

  async function run(id: string): Promise<void> {
    busy = true;
    requestId = id;
    set({ kind: 'paying', packageId, method });
    let attemptId = id;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await deps.client.startPurchase({
        packageId,
        provider: method,
        requestId: attemptId,
        ...(method === 'mpesa' && phone !== undefined ? { phone } : {}),
      });
      if (result.ok) {
        busy = false;
        enterWaiting(result.value.paymentId);
        return;
      }
      if (result.reason === 'earlier-payment') {
        busy = false;
        enterWaiting(result.paymentId);
        return;
      }
      if (result.reason === 'reference-closed') {
        if (attempt === 0) {
          // The server closed that reference; a fresh id gets one more try.
          attemptId = deps.newRequestId();
          requestId = attemptId;
          continue;
        }
        busy = false;
        fail('reference-closed', false);
        return;
      }
      busy = false;
      fail(result.reason, true);
      return;
    }
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async begin(nextPackageId, nextMethod, nextPhone) {
      if (busy) return;
      packageId = nextPackageId;
      method = nextMethod;
      phone = nextPhone;
      await run(deps.newRequestId());
    },

    async poll() {
      const current = state;
      if (busy || current.kind !== 'waiting') return;
      if (deps.now() - startedAt >= timeoutMs) {
        fail('timed-out', true);
        return;
      }
      busy = true;
      try {
        const result = await deps.client.paymentStatus(current.paymentId);
        if (!result.ok) return;
        const payment = result.value;
        if (payment.status === 'settled') {
          const access = payment.nativeAccess?.status;
          if (access === 'active' || access === 'pending') set({ kind: 'done', access });
          else fail('invalid-response', false);
          return;
        }
        if (payment.status === 'expired' || payment.status === 'invalid' || payment.status === 'refunded') {
          fail(payment.status, false);
          return;
        }
        let wallet = current.wallet;
        const invoice = current.method === 'lightning' ? payment.lightning?.paymentRequest : undefined;
        if (invoice !== undefined && invoice !== handedOffInvoice) {
          // Mark before the await, so a second poll with the same invoice never hands off again.
          handedOffInvoice = invoice;
          wallet = { kind: 'paying' };
          set({ ...current, payment: payment.status, wallet });
          wallet = walletStep(await deps.payFromWallet(invoice, 'mesh_pass'));
        }
        set({ ...current, payment: payment.status, wallet });
      } finally {
        busy = false;
      }
    },

    async retry() {
      const current = state;
      if (busy || current.kind !== 'failed') return;
      await run(current.reuseRequestId && requestId !== '' ? requestId : deps.newRequestId());
    },
  };
}

/**
 * The copy key for every way a purchase can stop. Typed as a full record, so a new reason without
 * a message is a compile error rather than a blank line on screen.
 */
export const BUY_FAILURE_KEY = {
  offline: 'buyOffline',
  timeout: 'buyTimeout',
  'not-found': 'buyNotFound',
  unauthorized: 'buyUnauthorized',
  rejected: 'buyRejected',
  server: 'buyServer',
  'invalid-response': 'buyInvalidResponse',
  'reference-closed': 'buyReferenceClosed',
  expired: 'buyExpired',
  invalid: 'buyInvalid',
  refunded: 'buyRefunded',
  'timed-out': 'buyTimedOut',
} as const satisfies Record<MeshBuyFailure, keyof Strings>;
