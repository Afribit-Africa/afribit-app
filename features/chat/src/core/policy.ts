/** Owner defaults, 2026-11-24. Reconcile with the owner policies at each milestone. */
export const CHAT_POLICY = Object.freeze({
  status: 'PROVISIONAL',
  directoryDefault: false,
  serverRetentionDays: 90,
  imageMaxDimension: 1600,
  imageMaxBytes: 2 * 1024 * 1024,
  allowedMedia: ['image/jpeg', 'image/png', 'image/webp'] as readonly string[],
  maxGroupMembers: 256,
  notificationPreviewsDefault: false,
  maxMessageCharacters: 8000,
  maxOutboxEntries: 100,
  // Unset until the owner names and reviews the reporting destination.
  reportRoomId: null as string | null,
});
