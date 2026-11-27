import type { MeshPass } from '@afribit/kernel';

/** Identifies the reminders this app owns, so passes refresh only cancels its own. */
export const PASS_REMINDER_PREFIX = 'mesh-pass-expiry:';

export const PASS_REMINDER_LEAD_MS = 30 * 60_000;

export interface PassReminder {
  readonly id: string;
  readonly passId: string;
  readonly fireAt: number;
  readonly label: string;
}

export interface ReminderScheduler {
  /** Identifiers of reminders already scheduled by this app. */
  scheduled(): Promise<readonly string[]>;
  schedule(reminder: PassReminder): Promise<void>;
  cancel(id: string): Promise<void>;
}

/**
 * One reminder per active pass, 30 minutes before it ends. A pass already inside the lead
 * window gets none: a reminder that would fire now or in the past is worse than no reminder.
 * The expiry is part of the id, so extending a pass moves its reminder instead of keeping the old one.
 */
export function planPassReminders(
  passes: readonly MeshPass[],
  now: number,
  leadMs: number = PASS_REMINDER_LEAD_MS,
): PassReminder[] {
  const reminders: PassReminder[] = [];
  for (const pass of passes) {
    if (pass.status !== 'active' || pass.expiresAt === null) continue;
    const endsAt = Date.parse(pass.expiresAt);
    if (Number.isNaN(endsAt)) continue;
    const fireAt = endsAt - leadMs;
    if (fireAt <= now) continue;
    reminders.push({
      id: `${PASS_REMINDER_PREFIX}${pass.id}:${pass.expiresAt}`,
      passId: pass.id,
      fireAt,
      label: pass.label,
    });
  }
  return reminders;
}

/**
 * Brings scheduled reminders in line with the plan: cancels stale ones this app scheduled,
 * adds the missing ones, and leaves every other notification alone. Running it twice with the
 * same plan makes no scheduler calls on the second run.
 */
export async function syncPassReminders(
  scheduler: ReminderScheduler,
  plan: readonly PassReminder[],
): Promise<{ scheduled: number; cancelled: number }> {
  const existing = await scheduler.scheduled();
  const existingIds = new Set(existing);
  const plannedIds = new Set(plan.map((reminder) => reminder.id));

  let cancelled = 0;
  for (const id of existing) {
    if (!id.startsWith(PASS_REMINDER_PREFIX) || plannedIds.has(id)) continue;
    await scheduler.cancel(id);
    cancelled += 1;
  }

  let scheduled = 0;
  const added = new Set<string>();
  for (const reminder of plan) {
    if (existingIds.has(reminder.id) || added.has(reminder.id)) continue;
    await scheduler.schedule(reminder);
    added.add(reminder.id);
    scheduled += 1;
  }

  return { scheduled, cancelled };
}