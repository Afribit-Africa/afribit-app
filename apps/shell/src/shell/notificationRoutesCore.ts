/**
 * Pure parsing for notification taps. A notification's payload names one destination from a
 * fixed set, never a free-form route, so a feature cannot steer the shell off that set.
 */

export type NotificationTarget = { readonly open: 'app'; readonly id: string } | { readonly open: 'passes' };

const OPEN_KEY = 'afribitOpen';
const APP_KEY = 'afribitApp';
/** An app id longer than this is not a registry id, so the target is dropped rather than used. */
const MAX_APP_ID_LENGTH = 64;

/** What a notification's `content.data` carries. */
export function notificationData(target: NotificationTarget): Record<string, string> {
  if (target.open === 'passes') return { [OPEN_KEY]: 'passes' };
  return { [OPEN_KEY]: 'app', [APP_KEY]: target.id };
}

/** The target a tapped notification's data names, or null. `isKnownApp` is the registry check. */
export function targetFromData(data: unknown, isKnownApp: (id: string) => boolean): NotificationTarget | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  const open = record[OPEN_KEY];
  if (open === 'passes') {
    return Object.keys(record).length === 1 ? { open: 'passes' } : null;
  }
  if (open === 'app') {
    const id = record[APP_KEY];
    if (typeof id !== 'string' || id.length === 0 || id.length > MAX_APP_ID_LENGTH) return null;
    if (!Object.keys(record).every((key) => key === OPEN_KEY || key === APP_KEY)) return null;
    return isKnownApp(id) ? { open: 'app', id } : null;
  }
  return null;
}

/** True once per response: a response id already handled, or null, is false. */
export function isNewResponse(responseId: string | null, lastHandledId: string | null): boolean {
  return responseId !== null && responseId !== lastHandledId;
}
