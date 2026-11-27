import * as Notifications from 'expo-notifications';
import { router, useRootNavigationState } from 'expo-router';
import { useEffect, useRef } from 'react';
import { isNewResponse, targetFromData } from './notificationRoutesCore';
import { openFeature } from './openFeature';
import { useShell } from './ShellProvider';

/** Held outside the component: the app lock unmounts it, and a remount must not replay a tap. */
let lastHandledId: string | null = null;

/**
 * Opens what a tapped notification is about: a Chat message opens Chat, a pass reminder opens
 * My passes. `useLastNotificationResponse` also returns the response that cold-started the app,
 * so this covers a tap that launched the shell. It acts once per response, only on a tap (not
 * another action), and only once boot and onboarding are done and the navigator is mounted.
 * It is rendered inside the app lock, so a tap that arrives while locked waits for the unlock.
 */
export function useNotificationRouting(): void {
  const shell = useShell();
  const shellRef = useRef(shell);
  shellRef.current = shell;
  const response = Notifications.useLastNotificationResponse();
  const navigatorReady = useRootNavigationState()?.key !== undefined;
  const ready = shell.ready;
  const completed = shell.setup.completed;

  useEffect(() => {
    if (!navigatorReady || !ready || !completed || !response) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const request = response.notification.request;
    // A pass reminder keeps its identifier when rescheduled, so the delivery time is part of the key.
    const responseId = `${request.identifier}@${response.notification.date}`;
    if (!isNewResponse(responseId, lastHandledId)) return;
    lastHandledId = responseId;

    const target = targetFromData(request.content.data, (id) => shellRef.current.registry.get(id) !== undefined);
    if (target?.open === 'app') openFeature(shellRef.current, target.id);
    else if (target?.open === 'passes') router.push('/connect/passes');

    void Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }, [response, navigatorReady, ready, completed]);
}

/** Mounts the routing inside the app lock, next to the navigator. */
export function NotificationRouting(): null {
  useNotificationRouting();
  return null;
}
