import type { ConnectivitySnapshot, FeatureContext } from '@afribit/feature-sdk';
import { CHAT_POLICY } from './policy';
import { EncryptedOutbox } from './outbox';
import { canReachMesh, ChatError, parseContact, paymentRequest, requireEncryptedRoom, validateUserId } from './security';
import type { ChatHost, ChatMessage, ChatRoom, ChatRuntime, ChatSnapshot, MatrixPort, Session } from './types';
import { copy, type ChatStrings } from '../strings';

const SESSION = 'matrix.session.v1';

/** All live operations require the host-owned identity and a reviewed native port. */
export function createChatRuntime(ctx: FeatureContext, host: ChatHost, matrix: MatrixPort, strings: ChatStrings = copy): ChatRuntime {
  let state: ChatSnapshot = { phase: 'locked', rooms: [], preview: false, directoryOptIn: false, connectivity: ctx.connectivity };
  const listeners = new Set<(s: ChatSnapshot) => void>();
  let session: Session | undefined;
  let outbox: EncryptedOutbox | undefined;
  let unsubscribe: (() => void) | undefined;
  let removeLifecycle: (() => void) | undefined;
  let epoch = 0;
  let starting: Promise<void> | undefined;
  let closed = false;
  let screenProtected = false;
  let requestAbort: AbortController | undefined;
  let nativeRooms: readonly ChatRoom[] = [];
  const echoes = new Map<string, ChatMessage>();
  const emit = (patch: Partial<ChatSnapshot>) => { state = { ...state, ...patch }; listeners.forEach(l => l(state)); };
  function publishRooms() {
    const rooms = nativeRooms.filter(r => r.encrypted).map(r => {
      for (const [id, echo] of echoes) if (r.messages.some(m => m.transactionId === id || m.id === echo.id)) echoes.delete(id);
      return { ...r, messages: [...r.messages, ...[...echoes.values()].filter(m => m.roomId === r.id)].sort((a, b) => a.timestamp - b.timestamp) };
    });
    emit({ rooms: rooms.sort((a, b) => (b.messages.at(-1)?.timestamp ?? 0) - (a.messages.at(-1)?.timestamp ?? 0)) });
  }
  const ready = () => { if (closed || state.phase !== 'ready') throw new ChatError('chat-not-ready'); };
  const online = () => { ready(); if (!canReachMesh(state.connectivity)) throw new ChatError('mesh-required'); };
  const room = (id: string) => requireEncryptedRoom(state.rooms.find(r => r.id === id));
  const serverName = () => { if (!session) throw new ChatError('chat-not-ready'); return host.matrixServerName; };
  const endpoint = (path: string) => {
    const url = new URL(host.gateOrigin);
    if (url.protocol !== 'https:' || url.origin !== host.gateOrigin) throw new ChatError('invalid-service-origin');
    return url.origin + path;
  };
  async function endIdentity() {
    closed = true; ++epoch;
    requestAbort?.abort();
    unsubscribe?.();
    emit({ phase: 'signed-out', rooms: [], profile: undefined, error: undefined, directoryOptIn: false });
    // Wait for in-flight setup before wiping: it must never write a token after wipe.
    await starting?.catch(() => undefined);
    try { if (session) await host.deferDeviceRevocation(session); }
    finally {
      await matrix.stop().catch(() => undefined);
      const result = await Promise.allSettled([outbox?.wipe(), matrix.wipe(), ctx.secureStorage.removeItem(SESSION), screenProtected ? host.screenSecurity(false) : Promise.resolve()]);
      session = undefined; echoes.clear(); nativeRooms = []; screenProtected = false;
      if (result.some(r => r.status === 'rejected')) throw new ChatError('wipe-incomplete');
    }
  }
  function watchIdentity() { removeLifecycle ??= host.onIdentityEnding(endIdentity); }
  watchIdentity();
  async function gate(path: string, value: object) {
    const url = endpoint(path); const body = JSON.stringify(value);
    const authorization = await host.authorize({ method: 'POST', url, bodySha256: await host.sha256(body) });
    if (closed) throw new ChatError('signed-out');
    const controller = new AbortController(); requestAbort = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, { method: 'POST', redirect: 'error', headers: { Authorization: authorization, 'Content-Type': 'application/json' }, body, signal: controller.signal });
      if (!response.ok) throw new ChatError('session-unavailable');
      return await response.json() as unknown;
    } finally { clearTimeout(timeout); if (requestAbort === controller) requestAbort = undefined; }
  }
  async function initialize(): Promise<void> {
    if (closed) throw new ChatError('signed-out');
    if (!canReachMesh(state.connectivity)) { emit({ phase: 'locked', error: 'mesh-required' }); return; }
    const generation = ++epoch;
    const current = () => { if (closed || generation !== epoch) throw new ChatError('signed-out'); };
    watchIdentity();
    emit({ phase: 'connecting', error: undefined });
    try {
      const profile = await host.profile();
      current();
      if (!/^npub1[02-9ac-hj-np-z]{58}$/.test(profile.npub)) throw new ChatError('identity-required');
      const saved = await ctx.secureStorage.getItem(SESSION);
      current();
      const stored = saved ? JSON.parse(saved) as { owner: string; session: Session } : undefined;
      if (stored && stored.owner !== profile.npub) throw new ChatError('identity-changed');
      const candidate = stored?.session ?? await gate('/v1/session', {});
      if (!candidate || typeof candidate !== 'object') throw new ChatError('invalid-session');
      const s = candidate as Session;
      if (s.homeserver !== host.matrixOrigin || new URL(s.homeserver).protocol !== 'https:' || typeof s.userId !== 'string'
        || typeof s.deviceId !== 'string' || !/^AFRIBIT_[a-f0-9]{36}$/.test(s.deviceId)
        || typeof s.accessToken !== 'string' || !/^[!-~]{1,8192}$/.test(s.accessToken)) throw new ChatError('invalid-session');
      validateUserId(s.userId, host.matrixServerName);
      if (generation !== epoch || closed) throw new ChatError('signed-out');
      session = s;
      await ctx.secureStorage.setItem(SESSION, JSON.stringify({ owner: profile.npub, session: s }));
      current();
      await matrix.open({ dataDir: host.dataDir, owner: profile.npub, session: s });
      current();
      const security = await matrix.security();
      current();
      if (!security.e2ee || !security.encryptedStore) throw new ChatError('encryption-required');
      let recoveryKey = await host.vault.get('matrix.recovery.v1');
      current();
      const recovery = await matrix.recovery();
      current();
      if (!recoveryKey && recovery.exists) throw new ChatError('recovery-required');
      if (!recoveryKey) { recoveryKey = await matrix.newRecoveryKey(); current(); await host.vault.put('matrix.recovery.v1', recoveryKey); current(); }
      await matrix.enableRecovery(recoveryKey);
      if (generation !== epoch || closed) throw new ChatError('signed-out');
      await matrix.setInitialDisplayName(profile.nickname);
      current();
      outbox = new EncryptedOutbox(ctx.secureStorage, matrix, profile.npub);
      for (const entry of await outbox.pending()) echoes.set(entry.transactionId, { id: entry.transactionId, transactionId: entry.transactionId, roomId: entry.roomId, senderId: s.userId, text: entry.text, timestamp: entry.createdAt, own: true, status: 'queued' });
      current();
      unsubscribe?.();
      unsubscribe = matrix.subscribe(rooms => {
        if (generation !== epoch || closed) return;
        const known = new Set(nativeRooms.flatMap(r => r.messages.map(m => m.id)));
        const newMessage = state.phase === 'ready' && rooms.some(r => r.encrypted && r.messages.some(m => !m.own && !known.has(m.id)));
        nativeRooms = rooms; publishRooms();
        if (newMessage) void host.notify({ title: strings.notificationTitle, body: strings.notificationBody }).catch(() => undefined);
      });
      await matrix.sync();
      if (generation !== epoch || closed) return;
      const preferences = await matrix.preferences();
      if (generation !== epoch || closed) return;
      emit({ phase: 'ready', profile, error: undefined, directoryOptIn: preferences.directoryOptIn });
      await drain();
    } catch (error) {
      if (!closed && generation === epoch) {
        ++epoch; unsubscribe?.(); unsubscribe = undefined;
        await matrix.stop().catch(() => undefined);
        if (error instanceof ChatError && error.code === 'session-expired') { await ctx.secureStorage.removeItem(SESSION); session = undefined; }
        emit({ phase: 'error', rooms: [], profile: undefined, error: error instanceof ChatError ? error.code : 'connection-failed' });
      }
    }
  }
  async function drain(): Promise<void> {
    if (!outbox || !canReachMesh(state.connectivity) || state.phase !== 'ready') return;
    await outbox.flush(async entry => {
      online(); room(entry.roomId);
      const echo = echoes.get(entry.transactionId);
      if (echo) { echoes.set(entry.transactionId, { ...echo, status: 'sending' }); publishRooms(); }
      try {
        const sent = await matrix.sendEncrypted(entry.roomId, entry.text, entry.transactionId);
        if (echo) { echoes.set(entry.transactionId, { ...echo, id: sent.eventId, status: 'sent' }); publishRooms(); }
      } catch (error) {
        if (echo) { echoes.set(entry.transactionId, { ...echo, status: 'failed' }); publishRooms(); }
        throw error;
      }
    });
  }
  const runtime: ChatRuntime = {
    snapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async start() { starting ??= initialize().finally(() => { starting = undefined; }); await starting; },
    async dispose() {
      ++epoch; requestAbort?.abort(); unsubscribe?.(); unsubscribe = undefined; removeLifecycle?.(); removeLifecycle = undefined;
      emit({ phase: 'locked', rooms: [], profile: undefined });
      // Native open may still be pending. Stop only after it settles so a late
      // store open cannot restart sync after the screen has been unmounted.
      await starting?.catch(() => undefined);
      await matrix.stop();
      if (screenProtected) { await host.screenSecurity(false); screenProtected = false; }
    },
    async retry() { if (state.phase === 'ready') { await matrix.sync(); await drain(); } else await runtime.start(); },
    updateConnectivity(connectivity) { emit({ connectivity }); if (state.phase === 'ready' && canReachMesh(connectivity)) void drain().catch(() => emit({ error: 'retry-needed' })); },
    async send(roomId, text) {
      ready(); room(roomId);
      const entry = await outbox!.enqueue(roomId, text);
      if (closed) throw new ChatError('signed-out');
      echoes.set(entry.transactionId, { id: entry.transactionId, transactionId: entry.transactionId, roomId, senderId: session!.userId, text: entry.text, timestamp: entry.createdAt, own: true, status: 'queued' });
      publishRooms();
      await drain().catch(() => emit({ error: 'retry-needed' }));
    },
    async createRoom(name, users, group) {
      online(); const label = name.trim();
      if (!label || label.length > 100 || users.length === 0 || users.length + 1 > CHAT_POLICY.maxGroupMembers || (!group && users.length !== 1)) throw new ChatError('invalid-group');
      return matrix.createEncryptedRoom(label, [...new Set(users.map(u => validateUserId(u, serverName())))], group);
    },
    async invite(id, user) { online(); const r = room(id); if (r.kind !== 'group' || r.members >= CHAT_POLICY.maxGroupMembers) throw new ChatError('group-full'); await matrix.invite(id, validateUserId(user, serverName())); },
    async leave(id) { online(); room(id); await matrix.leave(id); },
    async markRead(id) { online(); const r = room(id); const last = r.messages.at(-1); if (last) await matrix.markRead(id, last.id); },
    async addContact(payload) { online(); parseContact(payload, serverName()); return matrix.verifyContactQr(payload); },
    async ownQr() { online(); return matrix.ownContactQr(); },
    async scanQr() { return host.scanQr(); },
    async showOwnQr() { await host.showQr(await runtime.ownQr(), strings.ownQr); },
    async beginVerification(userId) { online(); return matrix.beginVerification(validateUserId(userId, serverName())); },
    async confirmVerification(id, matches) { online(); await matrix.confirmVerification(id, matches); },
    async setDirectory(enabled) { online(); await matrix.setDirectoryOptIn(enabled); emit({ directoryOptIn: enabled }); },
    async protectScreen(enabled) { ready(); try { await host.screenSecurity(enabled); screenProtected = enabled; } catch { throw new ChatError('screen-security-unavailable'); } },
    async sendImage(id) { online(); room(id); await matrix.sendEncryptedImage(id, { maxDimension: CHAT_POLICY.imageMaxDimension, maxBytes: CHAT_POLICY.imageMaxBytes, allowedTypes: CHAT_POLICY.allowedMedia }); },
    async pay(value) { ready(); const request = paymentRequest(value); if (!request) throw new ChatError('invalid-payment'); return host.requestPayment(request); },
    async block(userId) { online(); await matrix.block(validateUserId(userId, serverName())); },
  };
  return runtime;
}

/** Until CRs are supplied by the shell, there is no live runtime or plaintext fallback. */
export function unavailableSnapshot(ctx: FeatureContext): ChatSnapshot {
  return { phase: 'locked', rooms: [], connectivity: ctx.connectivity, preview: false, directoryOptIn: false, error: 'host-integration-required' };
}
