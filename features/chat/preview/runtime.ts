/** Explicit visual-review fixture. Never imported by src/index.tsx or the shipping loader. */
import type { ChatMessage, ChatRoom, ChatRuntime, ChatSnapshot } from '../src/core/types';
import { ChatError } from '../src/core/security';

export type PreviewMode = 'default' | 'locked' | 'offline' | 'states' | 'stress' | 'long' | 'error' | 'connecting';
export function createPreviewRuntime(mode: PreviewMode = 'default'): ChatRuntime {
  const base = new Date(2026, 10, 24, 10, 38).getTime();
  const message = (n: number, text: string, own = false): ChatMessage => ({ id: 'sample-' + n, roomId: '!amina:chat.mesh.test', senderId: own ? '@you:chat.mesh.test' : '@amina:chat.mesh.test', text, timestamp: base + n * 60000, own, status: own ? 'delivered' : 'sent' });
  const direct: ChatRoom = { id: '!amina:chat.mesh.test', name: 'Amina', initials: 'A', kind: 'direct', peerUserId: '@amina:chat.mesh.test', unread: 2, verification: 'verified', encrypted: true, members: 2, messages: [message(0, 'Hey, is the workshop still on?'), message(1, 'Yes! Meet us at the hub at 2.', true), message(2, 'My internet is down. Glad this still works.'), message(3, 'We’re on the mesh. See you there!', true), message(4, 'Perfect. I’ll bring the tools.')] };
  const other = (id: string, name: string, initials: string, text: string, kind: 'group' | 'direct', unread: number, minutes: number): ChatRoom => ({ id, name, initials, kind, peerUserId: kind === 'direct' ? '@' + initials.toLowerCase() + ':chat.mesh.test' : undefined, unread, verification: 'unverified', encrypted: true, members: kind === 'group' ? 12 : 2, messages: [{ id: id + '-m', roomId: id, senderId: '@sample:chat.mesh.test', text, timestamp: base - minutes * 60000, own: false, status: 'sent' }] });
  let state: ChatSnapshot = { phase: 'ready', preview: true, directoryOptIn: false, profile: { npub: 'preview-only', nickname: 'You' }, connectivity: { state: 'LOCAL_ONLY', meshTrust: 'local-verified', uplink: 'none', checkedAt: Date.now() }, rooms: [direct, other('!makers:chat.mesh.test', 'Kibera Makers', 'KM', 'Nia: The workshop starts at 2.', 'group', 5, 8), other('!otieno:chat.mesh.test', 'Otieno', 'O', 'Thanks, nimepata.', 'direct', 0, 40), other('!garden:chat.mesh.test', 'Mtaa Garden', 'MG', 'You: I can bring the seedlings.', 'group', 0, 78), other('!zuri:chat.mesh.test', 'Zuri', 'Z', 'Are you on the mesh today?', 'direct', 0, 1440), other('!helpers:chat.mesh.test', 'Mesh Helpers', 'MH', 'Welcome to the community.', 'group', 0, 1450)] };
  if (mode === 'offline' || mode === 'states') state = { ...state, connectivity: { state: 'OFFLINE', meshTrust: 'none', uplink: 'none', checkedAt: Date.now() } };
  if (mode === 'error' || mode === 'connecting') state = { ...state, phase: mode === 'error' ? 'error' : 'connecting', rooms: [], error: mode === 'error' ? 'connection-failed' : undefined };
  if (mode === 'states') direct.messages = (['read', 'delivered', 'sent', 'sending', 'queued', 'failed'] as const).map((status, i) => ({ ...message(i, ['Earlier sample, read', 'Earlier sample, delivered', 'Sent to the server', 'Sending sample', 'Queued sample', 'Failed sample'][i]!, true), status }));
  if (mode === 'stress') {
    direct.messages = Array.from({ length: 500 }, (_, i) => message(i, `Workshop message ${i + 1}. We are meeting at the community hub and bringing tools.`, i % 2 === 0));
    state = { ...state, rooms: [...state.rooms, ...Array.from({ length: 44 }, (_, i) => other(`!review-${i}:chat.mesh.test`, `Community workshop ${i + 7}`, 'CW', 'The community conversation continues.', i % 2 ? 'group' : 'direct', i % 4, i + 10))] };
  }
  const listeners = new Set<(s: ChatSnapshot) => void>();
  const emit = () => listeners.forEach(fn => fn(state));
  const update = (id: string, fn: (room: ChatRoom) => ChatRoom) => { state = { ...state, rooms: state.rooms.map(r => r.id === id ? fn(r) : r) }; emit(); };
  return {
    snapshot: () => state, subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    async start() { emit(); }, async dispose() {}, async retry() {}, updateConnectivity() {},
    async send(id, text) { update(id, r => ({ ...r, messages: [...r.messages, { id: 'sample-queued-' + Date.now(), roomId: id, senderId: '@you:chat.mesh.test', text, timestamp: Date.now(), own: true, status: 'queued' }] })); },
    async createRoom(name, users, group) { const id = '!sample-' + Date.now() + ':chat.mesh.test'; state = { ...state, rooms: [{ id, name, initials: name.slice(0, 2).toUpperCase(), kind: group ? 'group' : 'direct', unread: 0, verification: 'unverified', encrypted: true, members: users.length + 1, messages: [] }, ...state.rooms] }; emit(); return id; },
    async invite(id) { update(id, r => ({ ...r, members: r.members + 1 })); },
    async leave(id) { state = { ...state, rooms: state.rooms.filter(r => r.id !== id) }; emit(); },
    async markRead(id) { update(id, r => ({ ...r, unread: 0 })); }, async addContact() { return { userId: '@sample:chat.mesh.test', verified: false }; },
    async ownQr() { return JSON.stringify({ preview: true, note: 'Sample only — not a contact QR' }); },
    async scanQr() { return null; }, async showOwnQr() {},
    async beginVerification() { return { id: 'sample-only', emoji: [{ symbol: '🔑', label: 'Key' }, { symbol: '🌳', label: 'Tree' }, { symbol: '🚲', label: 'Bicycle' }] }; },
    async confirmVerification() {}, async setDirectory(value) { state = { ...state, directoryOptIn: value }; emit(); },
    async protectScreen() { throw new ChatError('screen-security-unavailable'); }, async sendImage() { throw Error('Preview has no media access'); },
    async pay() { return { requestId: 'sample', status: 'unavailable', reason: 'Design preview' }; }, async block() {},
  };
}
