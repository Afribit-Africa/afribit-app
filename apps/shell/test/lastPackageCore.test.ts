import { describe, expect, it } from 'vitest';
import type { MeshCatalog, MeshPackage } from '@afribit/kernel';
import {
  MAX_LAST_PACKAGE_ID,
  passNeedsRenewal,
  rememberedPackage,
  serializeLastPackage,
} from '../src/shell/lastPackageCore';
import { PASS_REMINDER_LEAD_MS } from '../src/shell/passRemindersCore';

function pkg(overrides: Partial<MeshPackage> = {}): MeshPackage {
  return {
    id: 'week-1',
    name: 'Weekly',
    description: null,
    priceKes: 100,
    durationMinutes: 10_080,
    dataLimitMb: null,
    kind: 'personal',
    deviceLimit: 1,
    bitcoinKes: null,
    ...overrides,
  };
}

function catalog(packages: readonly MeshPackage[]): MeshCatalog {
  return { packages, bitcoinEnabled: false, mpesaEnabled: true };
}

const CATALOG = catalog([pkg(), pkg({ id: 'day-1' })]);

describe('rememberedPackage', () => {
  it('returns the stored package while the catalog still offers it', () => {
    expect(rememberedPackage(serializeLastPackage('day-1'), CATALOG)?.id).toBe('day-1');
  });

  it('returns null when the stored id is no longer in the catalog', () => {
    expect(rememberedPackage(serializeLastPackage('gone-1'), CATALOG)).toBeNull();
  });

  it('returns null for a stored value that is not an object', () => {
    expect(rememberedPackage('not json', CATALOG)).toBeNull();
    expect(rememberedPackage(42, CATALOG)).toBeNull();
    expect(rememberedPackage(null, CATALOG)).toBeNull();
  });

  it('returns null when packageId is not a string', () => {
    expect(rememberedPackage({ packageId: 7 }, CATALOG)).toBeNull();
  });

  it('returns null when the id is longer than the limit', () => {
    const long = 'x'.repeat(MAX_LAST_PACKAGE_ID + 1);
    expect(rememberedPackage({ packageId: long }, CATALOG)).toBeNull();
  });

  it('returns null for extra fields, so no phone number or payment id is read back', () => {
    expect(rememberedPackage({ packageId: 'day-1', phone: '254700000000' }, CATALOG)).toBeNull();
    expect(rememberedPackage({ packageId: 'day-1', paymentId: 'p-1' }, CATALOG)).toBeNull();
  });
});

describe('serializeLastPackage', () => {
  it('writes only the package id', () => {
    expect(JSON.parse(serializeLastPackage('week-1'))).toEqual({ packageId: 'week-1' });
  });

  it('round-trips through rememberedPackage', () => {
    const stored = serializeLastPackage('week-1');
    expect(rememberedPackage(stored, CATALOG)).toEqual(pkg());
  });
});

describe('passNeedsRenewal', () => {
  const now = Date.parse('2026-01-01T08:00:00.000Z');
  const atLead = new Date(now + PASS_REMINDER_LEAD_MS).toISOString();

  it('is true for an expired pass', () => {
    expect(passNeedsRenewal('expired', '2025-12-01T00:00:00.000Z', now)).toBe(true);
  });

  it('is true for an active pass ending exactly at the lead boundary', () => {
    expect(passNeedsRenewal('active', atLead, now)).toBe(true);
  });

  it('is false for an active pass ending one millisecond past the lead boundary', () => {
    const outside = new Date(now + PASS_REMINDER_LEAD_MS + 1).toISOString();
    expect(passNeedsRenewal('active', outside, now)).toBe(false);
  });

  it('is false for a pass that is neither active nor expired', () => {
    expect(passNeedsRenewal('pending', atLead, now)).toBe(false);
    expect(passNeedsRenewal('failed', atLead, now)).toBe(false);
  });

  it('is false for an active pass with no or unparseable expiry', () => {
    expect(passNeedsRenewal('active', null, now)).toBe(false);
    expect(passNeedsRenewal('active', 'not-a-date', now)).toBe(false);
  });
});
