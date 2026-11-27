/**
 * Chat's host-integration values (C1): the fixed mesh origins and Matrix server
 * name the shell hands to Chat, plus the mapping from a broker outcome to the
 * payment outcome Chat's host promises.
 */
import type { CapabilityOutcome } from '@afribit/feature-sdk';

/**
 * The gateway Chat signs NIP-98 requests for (CR-3). Exact origin only. The
 * shell's signing allow-list (`chatOrigins.ts`) keeps the same value; a shell
 * test pins the two together.
 */
export const CHAT_GATE_ORIGIN = 'https://chat-gate.mesh.afribit.africa';
/** The Matrix homeserver Chat syncs with. */
export const CHAT_MATRIX_ORIGIN = 'https://chat.mesh.afribit.africa';
/** The Matrix server name in user ids (`@user:chat.mesh.afribit.africa`). */
export const CHAT_MATRIX_SERVER_NAME = 'chat.mesh.afribit.africa';

/** A `wallet.preparePayment` outcome: a payment never carries an identity profile. */
export type PaymentOutcome = Exclude<CapabilityOutcome, { status: 'profile' }>;

/**
 * Narrows a broker outcome to the payment outcome the Chat host returns. Only
 * `profile.read` yields a `profile` result, so a payment can never receive one;
 * treat that as a failed hand-off rather than leak a profile through `pay`.
 */
export function chatPaymentOutcome(outcome: CapabilityOutcome): PaymentOutcome {
  if (outcome.status === 'profile') {
    return { requestId: outcome.requestId, status: 'failed', code: 'unexpected-profile' };
  }
  return outcome;
}
