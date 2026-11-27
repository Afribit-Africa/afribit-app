import { describe, expect, it } from 'vitest';
import { strings } from '../src/i18n';
import {
  PASSES_FAILURE_KEY,
  PASS_STATE_LABEL,
  cleanPassCodeInput,
  countdownText,
  effectivePassState,
  isPassCodeComplete,
  passCodeDigits,
  passCountdown,
  passState,
} from '../src/shell/meshPasses';

describe('cleanPassCodeInput', () => {
  it('keeps the spaces and dashes a person types', () => {
    expect(cleanPassCodeInput('1234 5678-90')).toBe('1234 5678-90');
  });

  it('drops characters a number pad cannot produce', () => {
    expect(cleanPassCodeInput('12a34b 56')).toBe('1234 56');
  });

  it('stops after ten digits', () => {
    expect(cleanPassCodeInput('1234 5678 901234')).toBe('1234 5678 90');
  });
});

describe('isPassCodeComplete', () => {
  it('is true for ten digits, separators or not', () => {
    expect(isPassCodeComplete('1234 5678-90')).toBe(true);
  });

  it('is false for nine or eleven digits', () => {
    expect(isPassCodeComplete('1234 5678-9')).toBe(false);
    expect(isPassCodeComplete('12345678901')).toBe(false);
  });
});

describe('passCodeDigits', () => {
  it('removes separators', () => {
    expect(passCodeDigits('1234 5678-90')).toBe('1234567890');
  });
});

describe('passState', () => {
  it('maps the server status to the four display states', () => {
    expect(passState('active')).toBe('active');
    expect(passState('pending')).toBe('waiting');
    expect(passState('expired')).toBe('expired');
    expect(passState('failed')).toBe('failed');
  });
});

describe('passCountdown', () => {
  const now = Date.parse('2026-01-01T00:00:00.000Z');
  const at = (iso: string) => passCountdown(iso, now);

  it('has no time for a pass with no usable expiry', () => {
    expect(passCountdown(null, now)).toEqual({ kind: 'unknown' });
    expect(passCountdown('not-a-date', now)).toEqual({ kind: 'unknown' });
  });

  it('is expired at or past the moment', () => {
    expect(at('2025-12-31T23:59:59.000Z')).toEqual({ kind: 'expired' });
    expect(at('2026-01-01T00:00:00.000Z')).toEqual({ kind: 'expired' });
  });

  it('rounds down to the coarse unit', () => {
    expect(at('2026-01-01T00:00:30.000Z')).toEqual({ kind: 'soon' });
    expect(at('2026-01-01T00:10:00.000Z')).toEqual({ kind: 'minutes', value: 10 });
    expect(at('2026-01-01T02:00:00.000Z')).toEqual({ kind: 'hours', value: 2 });
    expect(at('2026-01-03T00:00:00.000Z')).toEqual({ kind: 'days', value: 2 });
  });
});

describe('countdownText', () => {
  const t = strings.en;

  it('names the soon case instead of leaving an active pass with no time left', () => {
    expect(countdownText({ kind: 'soon' }, t)).toBe(t.passesLeftSoon);
  });

  it('renders the coarse units with the unit count', () => {
    expect(countdownText({ kind: 'minutes', value: 10 }, t)).toBe('10 min left');
    expect(countdownText({ kind: 'hours', value: 2 }, t)).toBe('2 h left');
    expect(countdownText({ kind: 'days', value: 1 }, t)).toBe('1 day left');
    expect(countdownText({ kind: 'days', value: 3 }, t)).toBe('3 days left');
  });

  it('has no line for a pass with no usable expiry or one already expired', () => {
    expect(countdownText({ kind: 'unknown' }, t)).toBeNull();
    expect(countdownText({ kind: 'expired' }, t)).toBeNull();
  });
});

describe('effectivePassState', () => {
  it('shows an active pass whose clock has passed as expired', () => {
    expect(effectivePassState('active', { kind: 'expired' })).toBe('expired');
    expect(effectivePassState('active', { kind: 'hours', value: 1 })).toBe('active');
  });

  it('leaves the other states alone', () => {
    expect(effectivePassState('pending', { kind: 'expired' })).toBe('waiting');
    expect(effectivePassState('failed', { kind: 'unknown' })).toBe('failed');
  });
});

describe('pass copy', () => {
  it('has a message for every way a mesh call can fail', () => {
    expect(PASSES_FAILURE_KEY).toEqual({
      offline: 'passesOffline',
      timeout: 'passesTimeout',
      'not-found': 'passesNotFound',
      unauthorized: 'passesUnauthorized',
      rejected: 'passesRejected',
      server: 'passesServerError',
      'invalid-response': 'passesInvalid',
      storage: 'passesReadFailed',
    });
  });

  it('resolves every key in both languages', () => {
    for (const key of [...Object.values(PASSES_FAILURE_KEY), ...Object.values(PASS_STATE_LABEL)]) {
      expect(strings.en[key]).toBeTruthy();
      expect(strings.sw[key]).toBeTruthy();
    }
  });

  it('uses the exact offline copy the issue asks for', () => {
    expect(strings.en.passesOffline).toBe("You're not connected. Join Afribit Mesh Wi-Fi and try again.");
  });
});
