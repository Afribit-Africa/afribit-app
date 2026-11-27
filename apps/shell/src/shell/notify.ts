import * as Notifications from 'expo-notifications';
import { notificationData, type NotificationTarget } from './notificationRoutesCore';

// Show feature notifications while the shell is open too; without a handler the OS drops them.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export type LocalNotifyResult = 'shown' | 'no-permission';

/**
 * Shows one local notification now. The sender's registered name always leads the title, so
 * a feature can't pass its notification off as the shell's or the Wallet's. A target, when
 * given, names where tapping the notification opens.
 */
export async function showLocalNotification(
  sender: string,
  title: string,
  body: string,
  target?: NotificationTarget,
): Promise<LocalNotifyResult> {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return 'no-permission';
  await Notifications.scheduleNotificationAsync({
    content: { title: `${sender} · ${title}`, body, sound: false, ...(target ? { data: notificationData(target) } : {}) },
    trigger: null,
  });
  return 'shown';
}
