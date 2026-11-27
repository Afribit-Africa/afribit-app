import type { MeshPass } from '@afribit/kernel';
import * as Notifications from 'expo-notifications';
import type { Strings } from '../i18n';
import { notificationData } from './notificationRoutesCore';
import {
  planPassReminders,
  syncPassReminders,
  type PassReminder,
  type ReminderScheduler,
} from './passRemindersCore';

function expoScheduler(t: Strings): ReminderScheduler {
  return {
    scheduled: async () => {
      const requests = await Notifications.getAllScheduledNotificationsAsync();
      return requests.map((request) => request.identifier);
    },
    schedule: async (reminder: PassReminder) => {
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.id,
        content: { title: t.passReminderTitle, body: t.passReminderBody(reminder.label), sound: false, data: notificationData({ open: 'passes' }) },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.fireAt },
      });
    },
    cancel: async (id: string) => {
      await Notifications.cancelScheduledNotificationAsync(id);
    },
  };
}

/**
 * Keeps the phone's pass reminders in step with the passes just loaded. Without permission it
 * does nothing rather than prompting again. A reminder is a convenience, so a failure here
 * never surfaces on the passes screen.
 */
export async function refreshPassReminders(passes: readonly MeshPass[], t: Strings): Promise<void> {
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;
    await syncPassReminders(expoScheduler(t), planPassReminders(passes, Date.now()));
  } catch {
    // Deliberate: the passes screen keeps working even if notifications do not.
  }
}