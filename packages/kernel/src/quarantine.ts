/**
 * Crash containment policy. When a feature app keeps crashing, the shell takes
 * it out of service so it cannot disrupt the rest of the app. Pure and persisted
 * by the shell; a quarantine is lifted by the user ("Try again") or a new release.
 */
export const CRASH_WINDOW_MS = 10 * 60_000;
export const CRASH_THRESHOLD = 3;

export interface CrashRecord {
  /** featureId -> crash timestamps inside the window */
  readonly crashes: Readonly<Record<string, readonly number[]>>;
  readonly quarantined: readonly string[];
}

export const EMPTY_CRASH_RECORD: CrashRecord = { crashes: {}, quarantined: [] };

export function recordCrash(rec: CrashRecord, featureId: string, now: number): CrashRecord {
  const recent = (rec.crashes[featureId] ?? []).filter((t) => now - t < CRASH_WINDOW_MS);
  recent.push(now);
  const quarantined = recent.length >= CRASH_THRESHOLD && !rec.quarantined.includes(featureId)
    ? [...rec.quarantined, featureId]
    : rec.quarantined;
  return { crashes: { ...rec.crashes, [featureId]: recent }, quarantined };
}

export function releaseQuarantine(rec: CrashRecord, featureId: string): CrashRecord {
  const { [featureId]: _dropped, ...crashes } = rec.crashes;
  return { crashes, quarantined: rec.quarantined.filter((id) => id !== featureId) };
}

/** Defensive parse of the persisted record; anything unexpected resets to empty. */
export function parseCrashRecord(json: string | null): CrashRecord {
  if (!json) return EMPTY_CRASH_RECORD;
  try {
    const v = JSON.parse(json) as unknown;
    if (typeof v !== 'object' || v === null) return EMPTY_CRASH_RECORD;
    const o = v as Record<string, unknown>;
    if (!Array.isArray(o.quarantined) || !o.quarantined.every((x) => typeof x === 'string')) return EMPTY_CRASH_RECORD;
    if (typeof o.crashes !== 'object' || o.crashes === null) return EMPTY_CRASH_RECORD;
    const crashes: Record<string, number[]> = {};
    for (const [k, val] of Object.entries(o.crashes as Record<string, unknown>)) {
      if (Array.isArray(val) && val.every((t) => typeof t === 'number')) crashes[k] = val as number[];
    }
    return { crashes, quarantined: o.quarantined as string[] };
  } catch {
    return EMPTY_CRASH_RECORD;
  }
}
