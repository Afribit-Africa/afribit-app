import type { MeshCatalog, MeshPackage, MeshPassStatus } from '@afribit/kernel';
import { PASS_REMINDER_LEAD_MS } from './passRemindersCore';

/** Longest package id the store keeps; anything longer reads as corrupt. */
export const MAX_LAST_PACKAGE_ID = 128;

/**
 * The remembered package as JSON. Only the id is written: never the phone number or a payment
 * id, so a leftover record says nothing about how the pass was bought.
 */
export function serializeLastPackage(packageId: string): string {
  return JSON.stringify({ packageId });
}

function storedRecord(stored: unknown): Record<string, unknown> | null {
  let value = stored;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * The package a stored id still names, or null. A malformed record and an id the catalog no
 * longer offers both read as "nothing remembered", so a stale value never preselects a pass.
 */
export function rememberedPackage(stored: unknown, catalog: MeshCatalog): MeshPackage | null {
  const record = storedRecord(stored);
  if (record === null) return null;
  const keys = Object.keys(record);
  if (keys.length !== 1 || keys[0] !== 'packageId') return null;
  const id = record.packageId;
  if (typeof id !== 'string' || id.length === 0 || id.length > MAX_LAST_PACKAGE_ID) return null;
  return catalog.packages.find((pkg) => pkg.id === id) ?? null;
}

/**
 * True for an expired pass, or one still active that ends inside the reminder lead window.
 * The boundary matches `planPassReminders`: exactly the lead time left counts as ending soon.
 */
export function passNeedsRenewal(
  status: MeshPassStatus,
  expiresAt: string | null,
  nowMs: number,
  leadMs: number = PASS_REMINDER_LEAD_MS,
): boolean {
  if (status === 'expired') return true;
  if (status !== 'active' || expiresAt === null) return false;
  const endsAt = Date.parse(expiresAt);
  if (Number.isNaN(endsAt)) return false;
  return endsAt - nowMs <= leadMs;
}
