/**
 * MatrixPort over the reviewed native engine: matrix-rust-sdk through
 * `@unomed/react-native-matrix-sdk` (ADR-001, proven on Hermes by C-0). Chat's runtime
 * owns policy; this file only translates. It never logs tokens, keys or message text.
 *
 * Open, sync, rooms and timelines, encrypted send, room membership, read receipts,
 * block, recovery, the directory preference, the outbox seal, stop and wipe; then
 * emoji (SAS) verification, the contact QR, and encrypted images.
 *
 * The SDK's bindings have no QR cross-signing for users, so a contact QR never
 * verifies anyone by itself: scanning checks the contact's master key against the
 * server (a swapped key is refused) and reports whether the SDK already trusts it.
 * Trust only ever comes from a completed emoji comparison.
 */
import type * as Sdk from '@unomed/react-native-matrix-sdk';
import type { ChatMessage, ChatRoom, MatrixPort, MessageStatus, Session, VerificationChallenge } from '@afribit/feature-chat/src/core/types';

type SdkModule = typeof Sdk;
type Client = Sdk.ClientLike;
type Room = Sdk.RoomLike;
type Timeline = Sdk.TimelineLike;
type Item = Sdk.TimelineItemLike;

/** Secrets live in the shell's secure store under the feature's namespace. */
export interface NativeMatrixSecrets {
  get(name: string): Promise<string | null>;
  put(name: string, value: string): Promise<void>;
  remove(name: string): Promise<void>;
}

/** XChaCha20-Poly1305 or equivalent AEAD with a 24-byte nonce. */
export interface Aead {
  seal(key: Uint8Array, nonce: Uint8Array, plaintext: Uint8Array, associatedData: Uint8Array): Uint8Array;
  open(key: Uint8Array, nonce: Uint8Array, sealed: Uint8Array, associatedData: Uint8Array): Uint8Array;
}

export interface NativeMatrixDeps {
  loadSdk(): Promise<SdkModule>;
  secrets: NativeMatrixSecrets;
  aead: Aead;
  randomBytes(length: number): Uint8Array;
  /** Removes the directory and everything under it; resolves when it is gone or never existed. */
  removeDir(path: string): Promise<void>;
  userAgent?: string;
  /** How long a send waits for the server's echo before failing. */
  sendTimeoutMs?: number;
  /** How long each verification step waits for the other phone. */
  verificationTimeoutMs?: number;
  /**
   * Lets the user pick a photo and returns a local file already resized and
   * re-encoded within the limits (which also drops its location data), or null if
   * they cancelled. Without it, sending images is unavailable.
   */
  pickImage?(limits: { maxDimension: number; maxBytes: number; allowedTypes: readonly string[] }): Promise<PickedImage | null>;
}

export interface PickedImage {
  /** Absolute filesystem path or file:// URI. */
  readonly path: string;
  readonly mimeType: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
}

export class MatrixAdapterError extends Error {
  constructor(readonly reason: 'not-open' | 'owner-mismatch' | 'send-failed' | 'send-timeout' | 'no-room' | 'sealed-invalid' | 'bad-data-dir'
    | 'no-identity' | 'contact-key-mismatch' | 'invalid-contact' | 'no-verification' | 'verification-cancelled' | 'verification-failed' | 'verification-timeout'
    | 'no-media' | 'media-rejected') {
    super(reason);
  }
}

const STORE_PASS = 'matrix.store.v1';
const SEAL_KEY = 'matrix.seal.v1';
const OWNER = 'matrix.owner.v1';
const DIRECTORY_EVENT = 'africa.afribit.chat.directory';
const TIMELINE_PAGE = 30;
const NONCE_BYTES = 24;

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return globalThis.btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new MatrixAdapterError('sealed-invalid');
  const s = globalThis.atob(text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

/** FeatureHost hands out a `file://` URI (CR-2b); the Rust SQLite store needs a filesystem path. */
export function storePath(dir: string): string {
  const path = dir.startsWith('file://') ? decodeURIComponent(dir.slice('file://'.length)) : dir;
  if (!path.startsWith('/')) throw new MatrixAdapterError('bad-data-dir');
  return path.endsWith('/') ? path : path + '/';
}

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return letters.map((w) => Array.from(w ?? '')[0] ?? '').join('').toUpperCase() || '?';
}

/** Applies one vector diff (TimelineDiff and RoomListEntriesUpdate share the shape). */
export function applyDiff<T>(list: T[], diff: { tag: string; inner?: unknown }): T[] {
  const d = (diff.inner ?? {}) as { values?: T[]; value?: T; index?: number; length?: number };
  switch (diff.tag) {
    case 'Append': return [...list, ...(d.values ?? [])];
    case 'Clear': return [];
    case 'PushFront': return d.value === undefined ? list : [d.value, ...list];
    case 'PushBack': return d.value === undefined ? list : [...list, d.value];
    case 'PopFront': return list.slice(1);
    case 'PopBack': return list.slice(0, -1);
    case 'Insert': return d.value === undefined || d.index === undefined ? list : [...list.slice(0, d.index), d.value, ...list.slice(d.index)];
    case 'Set': return d.value === undefined || d.index === undefined ? list : list.map((x, i) => (i === d.index ? (d.value as T) : x));
    case 'Remove': return d.index === undefined ? list : list.filter((_, i) => i !== d.index);
    case 'Truncate': return d.length === undefined ? list : list.slice(0, d.length);
    case 'Reset': return [...(d.values ?? [])];
    default: return list;
  }
}

type Projected = { message: ChatMessage; localTxn?: string; sentEventId?: string; failed: boolean };

/** One timeline item as a Chat message, or null for anything that isn't a text message. */
export function projectItem(roomId: string, item: Item): Projected | null {
  const event = item.asEvent();
  if (!event) return null;
  const content = event.content as { tag: string; inner?: { content?: { kind?: { tag: string; inner?: { content?: { msgType?: { tag: string; inner?: { content?: { body?: string } } } } } } } } };
  if (content.tag !== 'MsgLike') return null;
  const kind = content.inner?.content?.kind;
  if (kind?.tag !== 'Message') return null;
  const msgType = kind.inner?.content?.msgType;
  if (msgType?.tag !== 'Text') return null;
  const body = msgType.inner?.content?.body;
  if (typeof body !== 'string') return null;

  const ref = event.eventOrTransactionId as { tag: string; inner: { eventId?: string; transactionId?: string } };
  const send = event.localSendState as { tag: string; inner?: { eventId?: string } } | undefined;
  const localTxn = ref.tag === 'TransactionId' ? ref.inner.transactionId : undefined;
  const sentEventId = send?.tag === 'Sent' ? send.inner?.eventId : undefined;
  const failed = send?.tag === 'SendingFailed';
  const id = ref.tag === 'EventId' ? (ref.inner.eventId ?? '') : (sentEventId ?? localTxn ?? '');
  const status: MessageStatus = !event.isOwn ? 'delivered'
    : failed ? 'failed'
      : send?.tag === 'NotSentYet' ? 'sending'
        : event.readReceipts.size > 1 ? 'read' : 'sent';
  const profile = event.senderProfile as { tag: string; inner?: { displayName?: string } };
  return {
    message: {
      id, roomId, senderId: event.sender, text: body, timestamp: Number(event.timestamp), own: event.isOwn, status,
      ...(profile.tag === 'Ready' && profile.inner?.displayName ? { senderName: profile.inner.displayName } : {}),
      ...(localTxn ? { transactionId: localTxn } : {}),
    },
    ...(localTxn ? { localTxn } : {}),
    ...(sentEventId ? { sentEventId } : {}),
    failed,
  };
}

/** The seven emoji (or, from an older client, the three numbers) both phones show. */
export function verificationEmoji(data: Sdk.SessionVerificationData): VerificationChallenge['emoji'] {
  const d = data as unknown as { tag: string; inner: { emojis?: readonly { symbol(): string; description(): string }[]; values?: readonly number[] } };
  if (d.tag === 'Emojis' && d.inner.emojis?.length) return d.inner.emojis.map((e) => ({ symbol: e.symbol(), label: e.description() }));
  if (d.tag === 'Decimals' && d.inner.values?.length) return d.inner.values.map((n) => ({ symbol: String(n), label: String(n) }));
  throw new MatrixAdapterError('verification-failed');
}

/** The contact QR's fields; the runtime has already checked the user id against the server name. */
function readContact(payload: string): { userId: string; verification: string } {
  let value: unknown;
  try { value = JSON.parse(payload); } catch { throw new MatrixAdapterError('invalid-contact'); }
  const q = value as Record<string, unknown> | null;
  if (!q || q.v !== 1 || q.type !== 'afribit.chat.contact' || typeof q.userId !== 'string' || typeof q.verification !== 'string') throw new MatrixAdapterError('invalid-contact');
  return { userId: q.userId, verification: q.verification };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new MatrixAdapterError('verification-timeout')), ms); }),
  ]).finally(() => clearTimeout(timer));
}

type RoomState = { room: Room; timeline?: Timeline; items: Item[]; handle?: { cancel(): void }; info?: Sdk.RoomInfo };

export function createNativeMatrixPort(deps: NativeMatrixDeps): MatrixPort {
  let sdk: SdkModule | undefined;
  let client: Client | undefined;
  let sync: Sdk.SyncServiceLike | undefined;
  let syncing = false;
  let dataDir: string | undefined;
  let sealKey: Uint8Array | undefined;
  let entriesHandle: { cancel(): void } | undefined;
  let entriesResult: Sdk.RoomListEntriesWithDynamicAdaptersResultLike | undefined;
  const rooms = new Map<string, RoomState>();
  const listeners = new Set<(rooms: readonly ChatRoom[]) => void>();
  /** Sends wait here for their local echo to turn into a server event id. */
  const pending = new Map<string, { roomId: string; text: string; resolve(eventId: string): void; reject(e: Error): void; txn?: string; before: Set<string> }>();
  const sendTimeoutMs = deps.sendTimeoutMs ?? 60_000;
  /** One send at a time per room, so a local echo can be matched to its send. */
  const roomQueues = new Map<string, Promise<unknown>>();

  const verificationTimeoutMs = deps.verificationTimeoutMs ?? 120_000;
  /** One emoji comparison at a time. */
  let verification: { id: string; controller: Sdk.SessionVerificationControllerLike; ended: Promise<'done' | 'cancelled' | 'failed'> } | undefined;

  const need = (): { sdk: SdkModule; client: Client } => {
    if (!sdk || !client) throw new MatrixAdapterError('not-open');
    return { sdk, client };
  };

  async function secret(name: string, bytes: number): Promise<string> {
    const existing = await deps.secrets.get(name);
    if (existing) return existing;
    const created = b64url(deps.randomBytes(bytes));
    await deps.secrets.put(name, created);
    return created;
  }

  function snapshot(): readonly ChatRoom[] {
    const out: ChatRoom[] = [];
    for (const [id, state] of rooms) {
      const info = state.info;
      if (!info || info.membership !== need().sdk.Membership.Joined) continue;
      const direct = info.isDirect;
      const peer = direct ? info.heroes[0]?.userId : undefined;
      const name = info.displayName ?? info.rawName ?? peer ?? id;
      const messages = state.items.map((item) => projectItem(id, item)?.message).filter((m): m is ChatMessage => Boolean(m));
      out.push({
        id, name, initials: initialsOf(name), kind: direct ? 'direct' : 'group',
        unread: Number(info.numUnreadMessages), verification: 'unverified',
        encrypted: info.encryptionState === need().sdk.EncryptionState.Encrypted,
        members: Number(info.joinedMembersCount), messages,
        ...(peer ? { peerUserId: peer } : {}),
      });
    }
    return out;
  }

  function emit() {
    const view = snapshot();
    for (const l of listeners) l(view);
  }

  const ownEventIds = (roomId: string, state: RoomState): Set<string> => new Set(state.items
    .map((item) => projectItem(roomId, item))
    .filter((p): p is Projected => Boolean(p?.message.own && !p.localTxn))
    .map((p) => p.message.id));

  function settlePending(roomId: string, state: RoomState) {
    const projected = state.items.map((item) => projectItem(roomId, item)).filter((p): p is Projected => Boolean(p?.message.own));
    for (const [ours, wait] of pending) {
      if (wait.roomId !== roomId) continue;
      for (const p of projected) {
        if (!p.localTxn) continue;
        // The first unclaimed own local echo with our text, after our send began, is ours.
        if (!wait.txn && p.message.text === wait.text && ![...pending.values()].some((w) => w.txn === p.localTxn)) wait.txn = p.localTxn;
        if (wait.txn !== p.localTxn) continue;
        if (p.sentEventId) { pending.delete(ours); wait.resolve(p.sentEventId); }
        else if (p.failed) { pending.delete(ours); wait.reject(new MatrixAdapterError('send-failed')); }
      }
      // The remote echo can replace the local echo before it is seen as sent: the new own
      // event with our text, which was not in the timeline when the send began, is ours.
      if (pending.has(ours) && wait.txn && !projected.some((p) => p.localTxn === wait.txn)) {
        const remote = projected.find((p) => !p.localTxn && p.message.text === wait.text && !wait.before.has(p.message.id));
        if (remote) { pending.delete(ours); wait.resolve(remote.message.id); }
      }
    }
  }

  async function track(room: Room) {
    const id = room.id();
    if (rooms.has(id)) return;
    const state: RoomState = { room, items: [] };
    rooms.set(id, state);
    state.info = await room.roomInfo();
    room.subscribeToRoomInfoUpdates({ call(info: Sdk.RoomInfo) { state.info = info; emit(); } });
    if (state.info.membership !== need().sdk.Membership.Joined) { emit(); return; }
    await openTimeline(id, state);
  }

  async function openTimeline(id: string, state: RoomState) {
    if (state.timeline) return;
    const timeline = await state.room.timeline();
    state.timeline = timeline;
    state.handle = await timeline.addListener({
      onUpdate(diffs: Sdk.TimelineDiff[]) {
        for (const d of diffs) state.items = applyDiff(state.items, d as unknown as { tag: string; inner?: unknown });
        settlePending(id, state);
        emit();
      },
    });
    await timeline.paginateBackwards(TIMELINE_PAGE).catch(() => false);
  }

  function room(id: string): RoomState {
    const state = rooms.get(id);
    if (!state) throw new MatrixAdapterError('no-room');
    return state;
  }

  async function refreshRooms() {
    const { client: c } = need();
    for (const r of c.rooms()) await track(r);
    emit();
  }

  async function endVerification() {
    const current = verification;
    verification = undefined;
    if (!current) return;
    current.controller.setDelegate(undefined);
    await current.controller.cancelVerification().catch(() => undefined);
  }

  const port: MatrixPort = {
    randomId: () => b64url(deps.randomBytes(16)),

    async open({ dataDir: dir, owner, session }: { dataDir: string; owner: string; session: Session }) {
      // A store opened for one identity is never reused by another (CR-7).
      const recorded = await deps.secrets.get(OWNER);
      if (recorded && recorded !== owner) throw new MatrixAdapterError('owner-mismatch');
      if (!recorded) await deps.secrets.put(OWNER, owner);
      sdk = await deps.loadSdk();
      const pass = await secret(STORE_PASS, 32);
      sealKey = unb64url(await secret(SEAL_KEY, 32));
      dataDir = dir;
      const root = storePath(dir);
      const store = new sdk.SqliteStoreBuilder(root + 'data', root + 'cache').passphrase(pass);
      client = await new sdk.ClientBuilder()
        .homeserverUrl(session.homeserver)
        .sqliteStore(store)
        .slidingSyncVersionBuilder(sdk.SlidingSyncVersionBuilder.Native)
        .userAgent(deps.userAgent ?? 'Afribit')
        .build();
      await client.restoreSession(sdk.Session.create({
        accessToken: session.accessToken, userId: session.userId, deviceId: session.deviceId,
        homeserverUrl: session.homeserver, slidingSyncVersion: sdk.SlidingSyncVersion.Native,
      }));
      if (client.deviceId() !== session.deviceId) throw new MatrixAdapterError('owner-mismatch');
      sync = await client.syncService().finish();
    },

    async security() {
      need();
      // The store is always opened with a passphrase, and matrix-rust-sdk always does E2EE.
      return { encryptedStore: true, e2ee: true };
    },

    async preferences() {
      const { client: c } = need();
      const raw = await c.accountData(DIRECTORY_EVENT).catch(() => undefined);
      try { return { directoryOptIn: Boolean(raw && (JSON.parse(raw) as { optIn?: unknown }).optIn === true) }; }
      catch { return { directoryOptIn: false }; }
    },

    async setDirectoryOptIn(enabled: boolean) {
      const { client: c } = need();
      await c.setAccountData(DIRECTORY_EVENT, JSON.stringify({ optIn: enabled }));
    },

    async recovery() {
      const { sdk: s, client: c } = need();
      const state = c.encryption().recoveryState();
      if (state === s.RecoveryState.Unknown) {
        // Unknown until the first sync settles; ask the server whether a backup exists.
        return { exists: await c.encryption().backupExistsOnServer() };
      }
      return { exists: state === s.RecoveryState.Enabled || state === s.RecoveryState.Incomplete };
    },

    /** The recovery secret is a passphrase the SDK stretches; the vault keeps it (CR-6). */
    async newRecoveryKey() { return b64url(deps.randomBytes(32)); },

    async enableRecovery(key: string) {
      const { sdk: s, client: c } = need();
      const e = c.encryption();
      const state = e.recoveryState();
      if (state === s.RecoveryState.Enabled || state === s.RecoveryState.Incomplete || (state === s.RecoveryState.Unknown && await e.backupExistsOnServer())) {
        await e.recover(key);
        return;
      }
      await e.enableRecovery(false, key, { onUpdate() {} });
    },

    async setInitialDisplayName(nickname: string) {
      const { client: c } = need();
      const current = await c.displayName().catch(() => '');
      const localpart = c.userId().slice(1).split(':')[0] ?? '';
      if (!current || current === localpart) await c.setDisplayName(nickname);
    },

    subscribe(listener) {
      listeners.add(listener);
      if (client) listener(snapshot());
      return () => { listeners.delete(listener); };
    },

    async sync() {
      const { client: c } = need();
      if (!sync) sync = await c.syncService().finish();
      if (!syncing) {
        await sync.start();
        syncing = true;
        const list = await sync.roomListService().allRooms();
        entriesResult = list.entriesWithDynamicAdapters(50, {
          onUpdate() { void refreshRooms(); },
        });
        entriesResult.controller().setFilter(need().sdk.RoomListEntriesDynamicFilterKind.All.new({ filters: [] }));
        entriesHandle = entriesResult.entriesStream();
      }
      await refreshRooms();
    },

    async seal(value: string, associatedData: string) {
      if (!sealKey) throw new MatrixAdapterError('not-open');
      const nonce = deps.randomBytes(NONCE_BYTES);
      const sealed = deps.aead.seal(sealKey, nonce, enc.encode(value), enc.encode(associatedData));
      const out = new Uint8Array(nonce.length + sealed.length);
      out.set(nonce); out.set(sealed, nonce.length);
      return b64url(out);
    },

    async unseal(value: string, associatedData: string) {
      if (!sealKey) throw new MatrixAdapterError('not-open');
      const bytes = unb64url(value);
      if (bytes.length <= NONCE_BYTES) throw new MatrixAdapterError('sealed-invalid');
      try { return dec.decode(deps.aead.open(sealKey, bytes.slice(0, NONCE_BYTES), bytes.slice(NONCE_BYTES), enc.encode(associatedData))); }
      catch { throw new MatrixAdapterError('sealed-invalid'); }
    },

    async sendEncrypted(roomId: string, text: string, transactionId: string) {
      const { sdk: s } = need();
      const state = room(roomId);
      if (state.info?.encryptionState !== s.EncryptionState.Encrypted) throw new MatrixAdapterError('send-failed');
      const previous = roomQueues.get(roomId) ?? Promise.resolve();
      const run = previous.catch(() => undefined).then(async () => {
        await openTimeline(roomId, state);
        const echo = new Promise<string>((resolve, reject) => {
          pending.set(transactionId, { roomId, text, resolve, reject, before: ownEventIds(roomId, state) });
          setTimeout(() => { if (pending.delete(transactionId)) reject(new MatrixAdapterError('send-timeout')); }, sendTimeoutMs);
        });
        await state.timeline!.send(s.messageEventContentFromMarkdown(text));
        settlePending(roomId, state);
        return { eventId: await echo };
      });
      roomQueues.set(roomId, run);
      return run;
    },

    async createEncryptedRoom(name: string, users: readonly string[], group: boolean) {
      const { sdk: s, client: c } = need();
      const id = await c.createRoom(s.CreateRoomParameters.create({
        ...(group ? { name } : {}),
        isEncrypted: true, isDirect: !group, isSpace: false,
        visibility: new s.RoomVisibility.Private(),
        preset: group ? s.RoomPreset.PrivateChat : s.RoomPreset.TrustedPrivateChat,
        invite: [...users],
      }));
      const created = c.getRoom(id);
      if (created) await track(created);
      emit();
      return id;
    },

    async invite(roomId: string, userId: string) { await room(roomId).room.inviteUserById(userId); },
    async leave(roomId: string) { await room(roomId).room.leave(); },

    async markRead(roomId: string, eventId: string) {
      const { sdk: s } = need();
      const state = room(roomId);
      await openTimeline(roomId, state);
      await state.timeline!.sendReadReceipt(s.ReceiptType.Read, eventId);
    },

    async block(userId: string) { await need().client.ignoreUser(userId); },

    async beginVerification(userId: string): Promise<VerificationChallenge> {
      const { client: c } = need();
      await endVerification();
      const controller = await c.getSessionVerificationController();
      const id = port.randomId();
      let challenge!: (value: VerificationChallenge) => void;
      let refuse!: (e: Error) => void;
      let finish!: (outcome: 'done' | 'cancelled' | 'failed') => void;
      const shown = new Promise<VerificationChallenge>((resolve, reject) => { challenge = resolve; refuse = reject; });
      const ended = new Promise<'done' | 'cancelled' | 'failed'>((resolve) => { finish = resolve; });
      shown.catch(() => undefined); // a cancel after the user has already left is not an error
      const stop = (outcome: 'cancelled' | 'failed') => { refuse(new MatrixAdapterError(outcome === 'cancelled' ? 'verification-cancelled' : 'verification-failed')); finish(outcome); };
      controller.setDelegate({
        // Requests from other people are answered in a later pass; this flow is the one we started.
        didReceiveVerificationRequest() {},
        didAcceptVerificationRequest() { controller.startSasVerification().catch(() => stop('failed')); },
        didStartSasVerification() {},
        didReceiveVerificationData(data: Sdk.SessionVerificationData) { challenge({ id, emoji: verificationEmoji(data) }); },
        didFail() { stop('failed'); },
        didCancel() { stop('cancelled'); },
        didFinish() { finish('done'); },
      });
      verification = { id, controller, ended };
      try {
        await controller.requestUserVerification(userId);
        return await withTimeout(shown, verificationTimeoutMs);
      } catch (e) {
        await endVerification();
        throw e;
      }
    },

    async confirmVerification(id: string, matches: boolean) {
      const current = verification;
      if (!current || current.id !== id) throw new MatrixAdapterError('no-verification');
      if (!matches) {
        // Different emoji mean someone is in the middle: tell the other phone and trust nothing.
        await current.controller.declineVerification().catch(() => undefined);
        await endVerification();
        return;
      }
      try {
        await current.controller.approveVerification();
        const outcome = await withTimeout(current.ended, verificationTimeoutMs);
        if (outcome !== 'done') throw new MatrixAdapterError(outcome === 'cancelled' ? 'verification-cancelled' : 'verification-failed');
      } finally {
        if (verification === current) { current.controller.setDelegate(undefined); verification = undefined; }
      }
      emit();
    },

    async ownContactQr(): Promise<string> {
      const { client: c } = need();
      const userId = c.userId();
      const masterKey = (await c.encryption().userIdentity(userId, true))?.masterKey();
      if (!masterKey) throw new MatrixAdapterError('no-identity');
      return JSON.stringify({ v: 1, type: 'afribit.chat.contact', userId, verification: masterKey });
    },

    async verifyContactQr(payload: string): Promise<{ userId: string; verified: boolean }> {
      const { client: c } = need();
      const contact = readContact(payload);
      const identity = await c.encryption().userIdentity(contact.userId, true);
      const masterKey = identity?.masterKey();
      if (!identity || !masterKey) throw new MatrixAdapterError('no-identity');
      if (masterKey !== contact.verification) throw new MatrixAdapterError('contact-key-mismatch');
      return { userId: contact.userId, verified: identity.isVerified() };
    },

    async sendEncryptedImage(roomId: string, limits: { maxDimension: number; maxBytes: number; allowedTypes: readonly string[] }) {
      const { sdk: s } = need();
      const state = room(roomId);
      if (state.info?.encryptionState !== s.EncryptionState.Encrypted) throw new MatrixAdapterError('send-failed');
      if (!deps.pickImage) throw new MatrixAdapterError('no-media');
      const picked = await deps.pickImage(limits);
      if (!picked) return;
      if (!limits.allowedTypes.includes(picked.mimeType) || picked.bytes <= 0 || picked.bytes > limits.maxBytes
        || picked.width <= 0 || picked.height <= 0 || Math.max(picked.width, picked.height) > limits.maxDimension) {
        throw new MatrixAdapterError('media-rejected');
      }
      await openTimeline(roomId, state);
      // The SDK encrypts the file before upload in an encrypted room; the server only sees ciphertext.
      const handle = state.timeline!.sendImage(
        { source: s.UploadSource.File.new({ filename: storePath(picked.path).replace(/\/$/, '') }) },
        undefined,
        { width: BigInt(picked.width), height: BigInt(picked.height), mimetype: picked.mimeType, size: BigInt(picked.bytes), isAnimated: false },
      );
      await handle.join();
    },

    async stop() {
      await endVerification();
      entriesHandle?.cancel(); entriesHandle = undefined; entriesResult = undefined;
      for (const state of rooms.values()) state.handle?.cancel();
      rooms.clear();
      for (const [id, wait] of pending) { pending.delete(id); wait.reject(new MatrixAdapterError('not-open')); }
      if (sync && syncing) await sync.stop().catch(() => undefined);
      syncing = false; sync = undefined; client = undefined;
    },

    async wipe() {
      await port.stop();
      const dir = dataDir;
      sealKey = undefined; dataDir = undefined;
      await Promise.all([deps.secrets.remove(STORE_PASS), deps.secrets.remove(SEAL_KEY), deps.secrets.remove(OWNER)]);
      if (dir) await deps.removeDir(dir);
    },
  };
  return port;
}
