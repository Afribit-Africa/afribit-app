import type { ConnectivitySnapshot } from '@afribit/feature-sdk';
import { CHAT_POLICY } from './policy';
import type { ChatRoom } from './types';

export class ChatError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}
export function canReachMesh(c: ConnectivitySnapshot): boolean {
  return (c.meshTrust === 'attested' || c.meshTrust === 'local-verified') && ['INTERNET', 'LOCAL_ONLY', 'DEGRADED'].includes(c.state);
}
export function requireEncryptedRoom(room: ChatRoom | undefined): ChatRoom {
  if (!room?.encrypted) throw new ChatError('encryption-required');
  if (room.verification === 'changed') throw new ChatError('verification-changed');
  return room;
}
export function validateMessage(text: string): string {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > CHAT_POLICY.maxMessageCharacters) throw new ChatError('invalid-message');
  return trimmed;
}
export function validateUserId(value: string, serverName: string): string {
  if (!/^@[a-z0-9_.=/-]+:[A-Za-z0-9.-]+(?::[0-9]+)?$/.test(value) || value.split(':').slice(1).join(':') !== serverName) throw new ChatError('invalid-contact');
  return value;
}
/** A contact QR identifies someone. Only the native verification exchange establishes trust. */
export function parseContact(payload: string, serverName: string): { userId: string; verification: string } {
  if (payload.length > 4096) throw new ChatError('invalid-contact');
  let value: unknown;
  try { value = JSON.parse(payload); } catch { throw new ChatError('invalid-contact'); }
  if (!value || typeof value !== 'object') throw new ChatError('invalid-contact');
  const q = value as Record<string, unknown>;
  if (q.v !== 1 || q.type !== 'afribit.chat.contact' || typeof q.userId !== 'string' || typeof q.verification !== 'string' || q.verification.length < 16 || q.verification.length > 2048) throw new ChatError('invalid-contact');
  return { userId: validateUserId(q.userId, serverName), verification: q.verification };
}
export function paymentRequest(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 16 || trimmed.length > 4096 || /[\s\u0000-\u001f]/.test(trimmed)) return null;
  // Full checksum/amount/expiry validation belongs to Wallet, which owns payment approval.
  if (/^(?:lightning:)?ln(?:bc|tb|bcrt)[0-9]*[munp]?1[02-9ac-hj-np-z]+$/i.test(trimmed) || /^(?:lightning:)?lnurl1[02-9ac-hj-np-z]+$/i.test(trimmed)) return trimmed.replace(/^lightning:/i, '');
  return null;
}
