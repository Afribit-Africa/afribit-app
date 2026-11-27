import { notificationData, targetFromData, type NotificationTarget } from './notificationRoutesCore';

/**
 * A notification the shell has shown, kept so someone who missed or dismissed it can see it
 * again. There is deliberately no body field: a Chat notification's body can be a message
 * preview, and the log must not keep message content.
 */
export type AlertEntry = {
  readonly id: string;
  readonly at: number;
  readonly sender: string;
  readonly title: string;
  readonly target: NotificationTarget | null;
};

export const MAX_ENTRIES = 50;

/** Newest first, capped at MAX_ENTRIES, and an id already in the log is not added twice. */
export function appendAlert(log: readonly AlertEntry[], entry: AlertEntry): AlertEntry[] {
  if (log.some((e) => e.id === entry.id)) return [...log];
  return [entry, ...log].slice(0, MAX_ENTRIES);
}

/**
 * Re-checks a stored target against the fixed route set. A stored target may name an app that
 * has since left the registry, or a free-form route, so it goes back through the same check a
 * live notification tap does.
 */
function targetFromStored(raw: unknown, isKnownApp: (id: string) => boolean): NotificationTarget | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const open = record.open;
  const candidate: NotificationTarget | null = open === 'passes'
    ? { open: 'passes' }
    : open === 'app' && typeof record.id === 'string' ? { open: 'app', id: record.id } : null;
  return candidate ? targetFromData(notificationData(candidate), isKnownApp) : null;
}

function parseEntry(raw: unknown, isKnownApp: (id: string) => boolean): AlertEntry | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const { id, at, sender, title } = record;
  if (typeof id !== 'string' || id.length === 0) return null;
  if (typeof at !== 'number' || !Number.isFinite(at)) return null;
  if (typeof sender !== 'string' || typeof title !== 'string') return null;
  return { id, at, sender, title, target: targetFromStored(record.target, isKnownApp) };
}

/**
 * Reads a stored log. Bad JSON, a non-array, or an entry with the wrong shape is dropped
 * rather than thrown, so a corrupted store never stops the shell from booting.
 */
export function parseAlertLog(raw: string | null, isKnownApp: (id: string) => boolean): AlertEntry[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const entries: AlertEntry[] = [];
  for (const item of parsed) {
    const entry = parseEntry(item, isKnownApp);
    if (entry) entries.push(entry);
  }
  return entries;
}

export function serializeAlertLog(log: readonly AlertEntry[]): string {
  return JSON.stringify(log);
}
