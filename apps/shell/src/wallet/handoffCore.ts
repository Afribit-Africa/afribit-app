import type { CapabilityIntent } from '@afribit/feature-sdk';
import type { WalletHandoff, WalletHandoffSource } from '@afribit/wallet-app';

/** A hand-off older than this is dropped: the user moved on instead of opening the Wallet. */
export const HANDOFF_TTL_MS = 2 * 60_000;

/** BOLT11 invoice. */
export const BOLT11 = /^ln(?:bc|tb|bcrt|tbs)[0-9a-z]{10,2040}$/i;
/** LNURL (bech32). */
export const LNURL = /^lnurl1[0-9a-z]{10,2040}$/i;
/** Lightning address. */
export const LIGHTNING_ADDRESS = /^[a-z0-9._-]{1,64}@[a-z0-9-]{1,63}(?:\.[a-z0-9-]{1,63})+$/i;
/** Segwit on-chain address. */
export const SEGWIT_ADDRESS = /^(?:bc1|tb1|bcrt1)[0-9a-z]{8,87}$/i;
/** Base58 on-chain address. */
export const BASE58_ADDRESS = /^[123mn][1-9A-HJ-NP-Za-km-z]{25,39}$/;

/** The Lightning destinations a `lightning:` or `lnurl:` link may carry. */
export const LIGHTNING_FORMS: readonly RegExp[] = [BOLT11, LNURL, LIGHTNING_ADDRESS];

/**
 * What the Wallet may be asked to open: a BOLT11 invoice, an LNURL, a Lightning address or an
 * on-chain address. Only these shapes pass, so a feature cannot use a payment request
 * ("settings", "card/details", "x?y=1") to steer the Wallet to another screen.
 */
const PAYMENT_FORMS: readonly RegExp[] = [...LIGHTNING_FORMS, SEGWIT_ADDRESS, BASE58_ADDRESS];
const SCHEME_PREFIX = /^(?:lightning|bitcoin|lnurl):/i;

type SendHandoff = Extract<WalletHandoff, { readonly kind: 'send' }>;

/** The send a payment address stands for, or null when it is not an allowed payment form. */
function sendFor(paymentAddress: string): SendHandoff | null {
  const destination = paymentAddress.replace(SCHEME_PREFIX, '');
  return PAYMENT_FORMS.some((form) => form.test(destination)) ? { kind: 'send', destination } : null;
}

/**
 * The Wallet request an intent stands for, or null when the intent has no Wallet form. The
 * Wallet shows its own confirmation and asks for its own PIN (S-12); a hand-off only chooses
 * the first screen.
 */
export function walletHandoffFor(intent: CapabilityIntent): WalletHandoff | null {
  switch (intent.kind) {
    case 'wallet.showReceive':
      return { kind: 'receive' };
    case 'wallet.preparePayment':
      return sendFor(intent.paymentRequest);
    case 'wallet.payContact': {
      const send = sendFor(intent.contact.paymentAddress);
      if (!send) return null;
      // Only the broker-validated fields cross over; displayName stays in Chat.
      return {
        ...send,
        ...(intent.amount !== undefined ? { amount: intent.amount } : {}),
        ...(intent.note !== undefined ? { note: intent.note } : {}),
      };
    }
    case 'wallet.createRequest':
      // The Wallet's Receive starts the request at this amount and note; the user can change
      // them there. Only the broker-validated fields cross over.
      return {
        kind: 'receive',
        amount: intent.amount,
        ...(intent.note !== undefined ? { note: intent.note } : {}),
      };
    default:
      return null;
  }
}

/**
 * The reason the shell refuses to hand a contact payment to the Wallet, or null when it may
 * proceed. Chat already blocks sends to a contact whose device changed; the shell checks again.
 */
export function changedDeviceRefusal(
  verification: 'verified' | 'unverified' | 'changed-device',
): 'contact-changed-device' | null {
  return verification === 'changed-device' ? 'contact-changed-device' : null;
}

export interface HandoffSlot extends WalletHandoffSource {
  put(handoff: WalletHandoff, now: number): void;
  /** The pending hand-off if it is younger than the TTL; clears the slot either way. */
  take(now: number): WalletHandoff | null;
  /** Called after each put. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

/** One hand-off slot: a newer put replaces the older one, and a take consumes it. */
export function createHandoffSlot(ttlMs: number = HANDOFF_TTL_MS): HandoffSlot {
  let pending: { readonly handoff: WalletHandoff; readonly at: number } | null = null;
  const listeners = new Set<() => void>();
  return {
    put(handoff, now) {
      pending = { handoff, at: now };
      for (const listener of listeners) listener();
    },
    take(now) {
      const current = pending;
      pending = null;
      if (!current || now - current.at >= ttlMs) return null;
      return current.handoff;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
