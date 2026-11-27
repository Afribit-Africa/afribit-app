import { describe, expect, it } from 'vitest';
import type { MeshPass, MeshPassStatus } from '@afribit/kernel';
import {
  PASS_REMINDER_PREFIX,
  planPassReminders,
  syncPassReminders,
  type PassReminder,
  type ReminderScheduler,
} from '../src/shell/passRemindersCore';

const NOW = Date.parse('2026-01-01T08:00:00.000Z');
const ENDS_AT = '2026-01-01T10:00:00.000Z';

function pass(overrides: Partial<MeshPass> = {}): MeshPass {
  return { id: 'pass-1', status: 'active', expiresAt: ENDS_AT, label: 'Weekly pass', devices: 1, ...overrides };
}

class FakeScheduler implements ReminderScheduler {
  readonly ids: Set<string>;
  readonly scheduledCalls: PassReminder[] = [];
  readonly cancelledIds: string[] = [];

  constructor(initial: readonly string[] = []) {
    this.ids = new Set(initial);
  }

  async scheduled(): Promise<readonly string[]> {
    return [...this.ids];
  }

  async schedule(reminder: PassReminder): Promise<void> {
    this.scheduledCalls.push(reminder);
    this.ids.add(reminder.id);
  }

  async cancel(id: string): Promise<void> {
    this.cancelledIds.push(id);
    this.ids.delete(id);
  }
}

describe('planPassReminders', () => {
  it('places an active pass reminder 30 minutes before it ends', () => {
    expect(planPassReminders([pass()], NOW)).toEqual([
      {
        id: `${PASS_REMINDER_PREFIX}pass-1:${ENDS_AT}`,
        passId: 'pass-1',
        fireAt: Date.parse('2026-01-01T09:30:00.000Z'),
        label: 'Weekly pass',
      },
    ]);
  });

  it('ignores passes that are not active', () => {
    const inactive: readonly MeshPassStatus[] = ['pending', 'expired', 'failed'];
    expect(planPassReminders(inactive.map((status) => pass({ status })), NOW)).toEqual([]);
  });

  it('ignores a pass with no expiry', () => {
    expect(planPassReminders([pass({ expiresAt: null })], NOW)).toEqual([]);
  });

  it('ignores a pass with an unparseable expiry', () => {
    expect(planPassReminders([pass({ expiresAt: 'not-a-date' })], NOW)).toEqual([]);
  });

  it('ignores a pass already inside the lead window', () => {
    const nowInsideLead = Date.parse('2026-01-01T09:35:00.000Z');
    expect(planPassReminders([pass()], nowInsideLead)).toEqual([]);
  });
});

describe('syncPassReminders', () => {
  it('schedules a planned reminder that is not scheduled yet', async () => {
    const scheduler = new FakeScheduler();
    const plan = planPassReminders([pass()], NOW);

    const result = await syncPassReminders(scheduler, plan);

    expect(result).toEqual({ scheduled: 1, cancelled: 0 });
    expect(scheduler.scheduledCalls).toEqual(plan);
    expect([...scheduler.ids]).toEqual([plan[0]?.id]);
  });

  it('cancels the old reminder and schedules the new one when a pass is extended', async () => {
    const scheduler = new FakeScheduler();
    const firstId = `${PASS_REMINDER_PREFIX}pass-1:${ENDS_AT}`;
    await syncPassReminders(scheduler, planPassReminders([pass()], NOW));

    const extended = pass({ expiresAt: '2026-01-01T11:00:00.000Z' });
    const extendedId = `${PASS_REMINDER_PREFIX}pass-1:2026-01-01T11:00:00.000Z`;
    const result = await syncPassReminders(scheduler, planPassReminders([extended], NOW));

    expect(result).toEqual({ scheduled: 1, cancelled: 1 });
    expect(scheduler.cancelledIds).toEqual([firstId]);
    expect(scheduler.scheduledCalls.map((reminder) => reminder.id)).toEqual([firstId, extendedId]);
    expect([...scheduler.ids]).toEqual([extendedId]);
  });

  it('cancels stale prefixed reminders and leaves other notifications alone', async () => {
    const unrelatedId = 'chat-message';
    const staleId = `${PASS_REMINDER_PREFIX}gone:2026-01-01T09:00:00.000Z`;
    const scheduler = new FakeScheduler([unrelatedId, staleId]);
    const plan = planPassReminders([pass()], NOW);

    const result = await syncPassReminders(scheduler, plan);

    expect(result).toEqual({ scheduled: 1, cancelled: 1 });
    expect(scheduler.cancelledIds).toEqual([staleId]);
    expect([...scheduler.ids].sort()).toEqual([plan[0]?.id, unrelatedId].sort());
  });

  it('makes no schedule or cancel calls on a second sync with the same plan', async () => {
    const scheduler = new FakeScheduler();
    const plan = planPassReminders([pass()], NOW);
    await syncPassReminders(scheduler, plan);
    scheduler.scheduledCalls.length = 0;
    scheduler.cancelledIds.length = 0;

    const result = await syncPassReminders(scheduler, plan);

    expect(result).toEqual({ scheduled: 0, cancelled: 0 });
    expect(scheduler.scheduledCalls).toEqual([]);
    expect(scheduler.cancelledIds).toEqual([]);
  });
});