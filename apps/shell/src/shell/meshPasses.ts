import type { MeshPassFailure, MeshPassStatus } from '@afribit/kernel';
import type { Strings } from '../i18n';

/** The Afribit Mesh service that owns passes and access status (same host the browser join uses). */
export const MESH_BASE_URL = 'https://wifi.afribit.africa';

/** Pass codes are ten digits; people may type spaces or dashes between them. */
export const PASS_CODE_DIGITS = 10;

/**
 * Keeps digits, spaces and dashes and stops at ten digits, so the field matches the code the
 * service expects no matter how the separators are typed. Everything else a number pad cannot
 * produce (letters, punctuation) is dropped.
 */
export function cleanPassCodeInput(raw: string): string {
  let digits = 0;
  let out = '';
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') {
      if (digits === PASS_CODE_DIGITS) continue;
      digits += 1;
      out += ch;
    } else if (ch === ' ' || ch === '-') {
      out += ch;
    }
  }
  return out;
}

/** The code the service receives: digits only, separators removed. */
export function passCodeDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function isPassCodeComplete(raw: string): boolean {
  return passCodeDigits(raw).length === PASS_CODE_DIGITS;
}

export type PassState = 'active' | 'waiting' | 'expired' | 'failed';

const PASS_STATE: Record<MeshPassStatus, PassState> = {
  active: 'active',
  pending: 'waiting',
  expired: 'expired',
  failed: 'failed',
};

export function passState(status: MeshPassStatus): PassState {
  return PASS_STATE[status];
}

export type PassCountdown =
  | { readonly kind: 'unknown' }
  | { readonly kind: 'expired' }
  | { readonly kind: 'soon' }
  | { readonly kind: 'minutes'; readonly value: number }
  | { readonly kind: 'hours'; readonly value: number }
  | { readonly kind: 'days'; readonly value: number };

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Coarse time left on a pass. Hours and days, not seconds: a status refresh is not a stopwatch. */
export function passCountdown(expiresAt: string | null, nowMs: number): PassCountdown {
  if (expiresAt === null) return { kind: 'unknown' };
  const end = Date.parse(expiresAt);
  if (Number.isNaN(end)) return { kind: 'unknown' };
  const ms = end - nowMs;
  if (ms <= 0) return { kind: 'expired' };
  if (ms < MINUTE_MS) return { kind: 'soon' };
  if (ms < HOUR_MS) return { kind: 'minutes', value: Math.floor(ms / MINUTE_MS) };
  if (ms < DAY_MS) return { kind: 'hours', value: Math.floor(ms / HOUR_MS) };
  return { kind: 'days', value: Math.floor(ms / DAY_MS) };
}

/**
 * A pass the server still calls active but whose expiry has passed is shown as expired: the
 * phone should tell the truth about the clock it can see, not wait for the next refresh.
 */
export function effectivePassState(status: MeshPassStatus, countdown: PassCountdown): PassState {
  const state = passState(status);
  return state === 'active' && countdown.kind === 'expired' ? 'expired' : state;
}

/**
 * The "time left" line for a pass, or null when there is nothing to say. A pass with no usable
 * expiry has nothing to count down, and an expired one is already labelled by its state pill.
 */
export function countdownText(countdown: PassCountdown, t: Strings): string | null {
  switch (countdown.kind) {
    case 'soon':
      return t.passesLeftSoon;
    case 'minutes':
      return t.passesLeftMinutes(countdown.value);
    case 'hours':
      return t.passesLeftHours(countdown.value);
    case 'days':
      return t.passesLeftDays(countdown.value);
    case 'unknown':
    case 'expired':
      return null;
  }
}

/** How a mesh call failed. `storage` is this phone's keychain, not the service. */
export type PassesFailure = MeshPassFailure | 'storage';

/**
 * The copy key for every way a load or redemption can fail. Typed as a full record, so adding
 * a failure reason without a message is a compile error rather than a blank line on screen.
 */
export const PASSES_FAILURE_KEY = {
  offline: 'passesOffline',
  timeout: 'passesTimeout',
  'not-found': 'passesNotFound',
  unauthorized: 'passesUnauthorized',
  rejected: 'passesRejected',
  server: 'passesServerError',
  'invalid-response': 'passesInvalid',
  storage: 'passesReadFailed',
} as const satisfies Record<PassesFailure, keyof Strings>;

export const PASS_STATE_LABEL = {
  active: 'passActive',
  waiting: 'passWaiting',
  expired: 'passExpired',
  failed: 'passFailed',
} as const satisfies Record<PassState, keyof Strings>;
