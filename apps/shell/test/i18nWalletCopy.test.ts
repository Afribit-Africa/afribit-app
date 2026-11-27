import { describe, expect, it } from 'vitest';
import { strings } from '../src/i18n';

/** Every plain string in a locale table, including the entries inside array values. */
function stringValues(table: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const value of Object.values(table)) {
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) out.push(...value.filter((item): item is string => typeof item === 'string'));
  }
  return out;
}

describe('onboarding wallet copy', () => {
  it('describes the Wallet as built into Afribit in both languages', () => {
    expect(strings.en.walletBody).toContain('built into Afribit');
    expect(strings.sw.walletBody).toContain('imejengwa ndani ya Afribit');
  });

  it("gives the Wallet its own keys and its own PIN, kept apart from the other apps", () => {
    expect(strings.en.walletBody).toContain('its own keys and its own PIN');
    expect(strings.en.walletBody).toContain('kept apart from your other apps');
    expect(strings.sw.walletBody).toContain('funguo zake na PIN yake');
    expect(strings.sw.walletBody).toContain('mbali na programu zako nyingine');
  });

  it('keeps the substance of the existing points in both languages', () => {
    expect(strings.en.walletPoints).toEqual([
      'Your keys never leave the Wallet',
      'Every payment is confirmed in Wallet, never in another app',
    ]);
    expect(strings.sw.walletPoints).toEqual([
      'Funguo zako hazitoki kwenye Pochi',
      'Kila malipo yanathibitishwa kwenye Pochi, si kwenye programu nyingine',
    ]);
  });

  it('never calls the Wallet a separate app in any shell string', () => {
    for (const value of [...stringValues(strings.en), ...stringValues(strings.sw)]) {
      expect(value).not.toContain('separate app');
      expect(value).not.toContain('programu tofauti');
    }
  });
});
