import type { CapabilityOutcome } from '@afribit/feature-sdk';
import { describe, expect, it } from 'vitest';
import {
  CHAT_GATE_ORIGIN,
  CHAT_MATRIX_ORIGIN,
  CHAT_MATRIX_SERVER_NAME,
  chatPaymentOutcome,
} from '../src';

describe('chat origins', () => {
  it('pins the exact mesh endpoints', () => {
    expect(CHAT_GATE_ORIGIN).toBe('https://chat-gate.mesh.afribit.africa');
    expect(CHAT_MATRIX_ORIGIN).toBe('https://chat.mesh.afribit.africa');
    expect(CHAT_MATRIX_SERVER_NAME).toBe('chat.mesh.afribit.africa');
  });
});

describe('chatPaymentOutcome', () => {
  const nonProfile: readonly CapabilityOutcome[] = [
    { requestId: 'r-open', status: 'opened' },
    { requestId: 'r-cancel', status: 'cancelled' },
    { requestId: 'r-pending', status: 'pending', correlationId: 'c1' },
    { requestId: 'r-done', status: 'completed', receiptReference: 'ref' },
    { requestId: 'r-avail', status: 'unavailable', reason: 'offline' },
    { requestId: 'r-denied', status: 'denied', reason: 'wallet-unavailable' },
    { requestId: 'r-failed', status: 'failed', code: 'handler-error' },
  ];

  it.each(nonProfile.map((outcome) => [outcome.status, outcome] as const))(
    'returns the %s outcome unchanged',
    (_status, outcome) => {
      expect(chatPaymentOutcome(outcome)).toBe(outcome);
    },
  );

  it('turns a profile outcome into a failed hand-off without the profile', () => {
    const profile: CapabilityOutcome = {
      requestId: 'r-profile',
      status: 'profile',
      profile: { nickname: 'Amina', npub: null },
    };
    const outcome = chatPaymentOutcome(profile);
    expect(outcome).toEqual({ requestId: 'r-profile', status: 'failed', code: 'unexpected-profile' });
    expect(outcome).not.toHaveProperty('profile');
  });
});
