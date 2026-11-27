import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { describe, expect, it } from 'vitest';
import { applyDiff, createNativeMatrixPort, initialsOf, MatrixAdapterError, projectItem, storePath, type NativeMatrixDeps } from '../src/chat/nativeMatrix';

const SESSION = { homeserver: 'https://chat.mesh.test', userId: '@a_1:chat.mesh.test', deviceId: 'DEV1', accessToken: 'token' };
const ROOM = '!r:chat.mesh.test';

type Listener = { onUpdate(diffs: unknown[]): void };

/** An own text item, or someone else's, in the SDK's tagged-enum shape. */
function textItem(body: string, opts: { own?: boolean; txn?: string; eventId?: string; send?: 'NotSentYet' | 'Sent' | 'SendingFailed' } = {}) {
  const ref = opts.txn ? { tag: 'TransactionId', inner: { transactionId: opts.txn } } : { tag: 'EventId', inner: { eventId: opts.eventId ?? '$e' } };
  const localSendState = opts.send ? { tag: opts.send, inner: opts.send === 'Sent' ? { eventId: opts.eventId } : {} } : undefined;
  const event = {
    eventOrTransactionId: ref, sender: opts.own ? SESSION.userId : '@b:chat.mesh.test', senderProfile: { tag: 'Ready', inner: { displayName: 'Bee' } },
    isOwn: Boolean(opts.own), timestamp: 1000n, readReceipts: new Map(), localSendState,
    content: { tag: 'MsgLike', inner: { content: { kind: { tag: 'Message', inner: { content: { msgType: { tag: 'Text', inner: { content: { body } } } } } } } } },
  };
  return { asEvent: () => event };
}

type Delegate = Record<string, (...args: unknown[]) => void>;

function fakeSdk() {
  const timelineListeners: Listener[] = [];
  const calls: string[] = [];
  const images: unknown[][] = [];
  const identities = new Map<string, { masterKey: string | undefined; verified: boolean }>([
    [SESSION.userId, { masterKey: 'OWNMASTERKEY0123456789abcdefghijklmnopqrstu', verified: true }],
    ['@b:chat.mesh.test', { masterKey: 'BEEMASTERKEY0123456789abcdefghijklmnopqrstu', verified: false }],
  ]);
  let delegate: Delegate | undefined;
  const controller = {
    setDelegate: (d: Delegate | undefined) => { delegate = d; },
    requestUserVerification: async (u: string) => { calls.push(`request ${u}`); },
    startSasVerification: async () => { calls.push('sas'); },
    approveVerification: async () => { calls.push('approve'); },
    declineVerification: async () => { calls.push('decline'); },
    cancelVerification: async () => { calls.push('cancel'); },
  };
  const sent: string[] = [];
  const info = { id: ROOM, membership: 1, isDirect: true, heroes: [{ userId: '@b:chat.mesh.test' }], displayName: 'Bee Kay', encryptionState: 0, numUnreadMessages: 2n, joinedMembersCount: 2n };
  const timeline = {
    addListener: async (l: Listener) => { timelineListeners.push(l); return { cancel() {} }; },
    paginateBackwards: async () => true,
    send: async (content: { body: string }) => { sent.push(content.body); return {}; },
    sendReadReceipt: async () => undefined,
    sendImage: (...args: unknown[]) => { images.push(args); return { join: async () => undefined, cancel() {} }; },
  };
  const room = { id: () => ROOM, roomInfo: async () => info, subscribeToRoomInfoUpdates: () => ({ cancel() {} }), timeline: async () => timeline, inviteUserById: async () => undefined, leave: async () => undefined };
  const syncService = { start: async () => undefined, stop: async () => undefined, roomListService: () => ({ allRooms: async () => ({ entriesWithDynamicAdapters: () => ({ controller: () => ({ setFilter: () => true }), entriesStream: () => ({ cancel() {} }) }) }) }) };
  const client = {
    restoreSession: async () => undefined, deviceId: () => 'DEV1', userId: () => SESSION.userId, syncService: () => ({ finish: async () => syncService }),
    rooms: () => [room], getRoom: () => room, accountData: async () => undefined, setAccountData: async () => undefined,
    displayName: async () => '', setDisplayName: async () => undefined, ignoreUser: async () => undefined, createRoom: async () => ROOM,
    encryption: () => ({
      recoveryState: () => 2, backupExistsOnServer: async () => false, recover: async () => undefined, enableRecovery: async () => 'k',
      userIdentity: async (u: string) => { const i = identities.get(u); return i ? { masterKey: () => i.masterKey, isVerified: () => i.verified } : undefined; },
    }),
    getSessionVerificationController: async () => controller,
  };
  const builder = (): unknown => { const proxy: unknown = new Proxy({}, { get: (_t, key) => (key === 'build' ? async () => client : key === 'then' ? undefined : () => proxy) }); return proxy; };
  class Builder { constructor() { return builder() as Builder; } }
  const sdk = {
    Membership: { Joined: 1 }, EncryptionState: { Encrypted: 0 }, RecoveryState: { Unknown: 0, Enabled: 1, Disabled: 2, Incomplete: 3 },
    SqliteStoreBuilder: Builder, ClientBuilder: Builder, Session: { create: (s: unknown) => s }, SlidingSyncVersionBuilder: { Native: 1 }, SlidingSyncVersion: { Native: 1 },
    messageEventContentFromMarkdown: (body: string) => ({ body }), RoomListEntriesDynamicFilterKind: { All: { new: (x: unknown) => x } },
    CreateRoomParameters: { create: (x: unknown) => x }, RoomVisibility: { Private: class {} }, RoomPreset: { PrivateChat: 0, TrustedPrivateChat: 2 }, ReceiptType: { Read: 0 },
    UploadSource: { File: { new: (x: { filename: string }) => ({ tag: 'File', inner: x }) } },
  };
  const emit = (name: string, ...args: unknown[]) => delegate?.[name]?.(...args);
  return { sdk, sent, calls, images, identities, emit, hasDelegate: () => !!delegate, push: (diffs: unknown[]) => { for (const l of timelineListeners) l.onUpdate(diffs); } };
}

function deps(sdk: unknown, store = new Map<string, string>(), removed: string[] = []): NativeMatrixDeps {
  let counter = 0;
  return {
    loadSdk: async () => sdk as never,
    secrets: { get: async (n) => store.get(n) ?? null, put: async (n, v) => { store.set(n, v); }, remove: async (n) => { store.delete(n); } },
    aead: { seal: (k, n, p, ad) => xchacha20poly1305(k, n, ad).encrypt(p), open: (k, n, s, ad) => xchacha20poly1305(k, n, ad).decrypt(s) },
    randomBytes: (len) => Uint8Array.from({ length: len }, () => (counter++ * 37 + 11) & 0xff),
    removeDir: async (p) => { removed.push(p); },
    sendTimeoutMs: 500,
  };
}

describe('applyDiff', () => {
  it('applies every vector diff the SDK sends', () => {
    let l: string[] = [];
    l = applyDiff(l, { tag: 'Append', inner: { values: ['a', 'b'] } });
    l = applyDiff(l, { tag: 'PushFront', inner: { value: 'z' } });
    l = applyDiff(l, { tag: 'PushBack', inner: { value: 'c' } });
    l = applyDiff(l, { tag: 'Insert', inner: { index: 1, value: 'y' } });
    l = applyDiff(l, { tag: 'Set', inner: { index: 0, value: 'Z' } });
    expect(l).toEqual(['Z', 'y', 'a', 'b', 'c']);
    l = applyDiff(l, { tag: 'Remove', inner: { index: 1 } });
    l = applyDiff(l, { tag: 'PopFront' });
    l = applyDiff(l, { tag: 'PopBack' });
    expect(l).toEqual(['a', 'b']);
    expect(applyDiff(l, { tag: 'Truncate', inner: { length: 1 } })).toEqual(['a']);
    expect(applyDiff(l, { tag: 'Reset', inner: { values: ['q'] } })).toEqual(['q']);
    expect(applyDiff(l, { tag: 'Clear' })).toEqual([]);
  });
});

describe('projectItem', () => {
  it('turns a text event into a message and ignores everything else', () => {
    expect(projectItem(ROOM, textItem('hi', { eventId: '$1' }) as never)?.message).toMatchObject({ id: '$1', text: 'hi', own: false, status: 'delivered', senderName: 'Bee' });
    expect(projectItem(ROOM, { asEvent: () => undefined } as never)).toBeNull();
    const notText = textItem('x') as { asEvent(): { content: unknown } };
    notText.asEvent().content = { tag: 'MsgLike', inner: { content: { kind: { tag: 'UnableToDecrypt' } } } };
    expect(projectItem(ROOM, notText as never)).toBeNull();
  });

  it('follows an own message from local echo to sent or failed', () => {
    expect(projectItem(ROOM, textItem('m', { own: true, txn: 't1', send: 'NotSentYet' }) as never)?.message.status).toBe('sending');
    const sent = projectItem(ROOM, textItem('m', { own: true, txn: 't1', send: 'Sent', eventId: '$9' }) as never);
    expect(sent?.sentEventId).toBe('$9');
    expect(projectItem(ROOM, textItem('m', { own: true, txn: 't1', send: 'SendingFailed' }) as never)?.message.status).toBe('failed');
  });
});

describe('storePath', () => {
  it('turns the file:// data directory into the filesystem path the Rust store needs', () => {
    expect(storePath('file:///data/user/0/africa.afribit.os/files/features/chat/')).toBe('/data/user/0/africa.afribit.os/files/features/chat/');
    expect(storePath('file:///data/My%20Files/features/chat')).toBe('/data/My Files/features/chat/');
    expect(storePath('/already/a/path/')).toBe('/already/a/path/');
    expect(() => storePath('relative/dir/')).toThrow(MatrixAdapterError);
  });
});

describe('initialsOf', () => {
  it('uses the first and last word, and never returns an empty string', () => {
    expect(initialsOf('Bee Kay Ell')).toBe('BE');
    expect(initialsOf('otieno')).toBe('O');
    expect(initialsOf('  ')).toBe('?');
  });
});

describe('createNativeMatrixPort', () => {
  it('seals and unseals, and refuses another associated data or a tampered value', async () => {
    const { sdk } = fakeSdk();
    const port = createNativeMatrixPort(deps(sdk));
    await port.open({ dataDir: '/d/features/chat/', owner: 'npub1a', session: SESSION });
    const sealed = await port.seal('secret text', 'outbox:1');
    expect(sealed).not.toContain('secret');
    expect(await port.unseal(sealed, 'outbox:1')).toBe('secret text');
    await expect(port.unseal(sealed, 'outbox:2')).rejects.toBeInstanceOf(MatrixAdapterError);
    await expect(port.unseal(sealed.slice(0, -2) + 'AA', 'outbox:1')).rejects.toBeInstanceOf(MatrixAdapterError);
  });

  it('refuses to open a store recorded for another identity', async () => {
    const { sdk } = fakeSdk();
    const store = new Map<string, string>();
    await createNativeMatrixPort(deps(sdk, store)).open({ dataDir: '/d/', owner: 'npub1a', session: SESSION });
    await expect(createNativeMatrixPort(deps(sdk, store)).open({ dataDir: '/d/', owner: 'npub1b', session: SESSION })).rejects.toMatchObject({ reason: 'owner-mismatch' });
  });

  it('projects joined rooms and resolves a send with the server event id from its echo', async () => {
    const fake = fakeSdk();
    const port = createNativeMatrixPort(deps(fake.sdk));
    let latest: readonly { id: string; kind: string; unread: number; encrypted: boolean; peerUserId?: string; messages: readonly unknown[] }[] = [];
    port.subscribe((rooms) => { latest = rooms; });
    await port.open({ dataDir: '/d/', owner: 'npub1a', session: SESSION });
    await port.sync();
    expect(latest).toHaveLength(1);
    expect(latest[0]).toMatchObject({ id: ROOM, kind: 'direct', unread: 2, encrypted: true, peerUserId: '@b:chat.mesh.test' });

    const sending = port.sendEncrypted(ROOM, 'hello', 'our-txn');
    await new Promise((r) => setTimeout(r, 0));
    expect(fake.sent).toEqual(['hello']);
    fake.push([{ tag: 'PushBack', inner: { value: textItem('hello', { own: true, txn: 'sdk-txn', send: 'NotSentYet' }) } }]);
    fake.push([{ tag: 'Set', inner: { index: 0, value: textItem('hello', { own: true, txn: 'sdk-txn', send: 'Sent', eventId: '$sent' }) } }]);
    await expect(sending).resolves.toEqual({ eventId: '$sent' });
  });

  it('resolves a send whose remote echo replaced the local one before it was seen as sent', async () => {
    const fake = fakeSdk();
    const port = createNativeMatrixPort(deps(fake.sdk));
    await port.open({ dataDir: '/d/', owner: 'npub1a', session: SESSION });
    await port.sync();
    fake.push([{ tag: 'PushBack', inner: { value: textItem('again', { own: true, eventId: '$old' }) } }]);
    const sending = port.sendEncrypted(ROOM, 'again', 'our-txn');
    await new Promise((r) => setTimeout(r, 0));
    fake.push([{ tag: 'PushBack', inner: { value: textItem('again', { own: true, txn: 'sdk-txn', send: 'NotSentYet' }) } }]);
    fake.push([{ tag: 'Set', inner: { index: 1, value: textItem('again', { own: true, eventId: '$remote' }) } }]);
    await expect(sending).resolves.toEqual({ eventId: '$remote' });
  });

  it('fails a send whose echo never arrives, and one the SDK marks failed', async () => {
    const fake = fakeSdk();
    const port = createNativeMatrixPort(deps(fake.sdk));
    await port.open({ dataDir: '/d/', owner: 'npub1a', session: SESSION });
    await port.sync();
    await expect(port.sendEncrypted(ROOM, 'lost', 't1')).rejects.toMatchObject({ reason: 'send-timeout' });
    const failing = port.sendEncrypted(ROOM, 'bad', 't2');
    await new Promise((r) => setTimeout(r, 0));
    fake.push([{ tag: 'PushBack', inner: { value: textItem('bad', { own: true, txn: 'x2', send: 'SendingFailed' }) } }]);
    await expect(failing).rejects.toMatchObject({ reason: 'send-failed' });
  });

  it('wipes its secrets and the data directory', async () => {
    const { sdk } = fakeSdk();
    const store = new Map<string, string>();
    const removed: string[] = [];
    const port = createNativeMatrixPort(deps(sdk, store, removed));
    await port.open({ dataDir: '/d/features/chat/', owner: 'npub1a', session: SESSION });
    expect(store.size).toBe(3);
    await port.wipe();
    expect(store.size).toBe(0);
    expect(removed).toEqual(['/d/features/chat/']);
    await expect(port.seal('x', 'y')).rejects.toMatchObject({ reason: 'not-open' });
  });

  it('refuses verification, contact QR and images before it is open', async () => {
    const port = createNativeMatrixPort(deps(fakeSdk().sdk));
    await expect(port.ownContactQr()).rejects.toMatchObject({ reason: 'not-open' });
    await expect(port.verifyContactQr('x')).rejects.toMatchObject({ reason: 'not-open' });
    await expect(port.beginVerification('@b:chat.mesh.test')).rejects.toMatchObject({ reason: 'not-open' });
    await expect(port.sendEncryptedImage(ROOM, { maxDimension: 1, maxBytes: 1, allowedTypes: [] })).rejects.toMatchObject({ reason: 'not-open' });
  });
});

const emojiData = { tag: 'Emojis', inner: { emojis: ['🐶', '🔑', '🌵', '🎸', '🚀', '⚓', '🍎'].map((symbol, i) => ({ symbol: () => symbol, description: () => `e${i}` })), indices: new ArrayBuffer(7) } };
const tick = () => new Promise((r) => setTimeout(r, 0));

async function openPort(fake: ReturnType<typeof fakeSdk>, extra: Partial<NativeMatrixDeps> = {}) {
  const port = createNativeMatrixPort({ ...deps(fake.sdk), verificationTimeoutMs: 300, ...extra });
  await port.open({ dataDir: 'file:///data/chat/', owner: 'npub1owner', session: SESSION });
  await port.sync();
  return port;
}

describe('emoji verification', () => {
  it('requests, starts SAS once the other phone accepts, shows the emoji, and finishes on a match', async () => {
    const fake = fakeSdk();
    const port = await openPort(fake);
    const started = port.beginVerification('@b:chat.mesh.test');
    await tick();
    expect(fake.calls).toEqual(['request @b:chat.mesh.test']);
    fake.emit('didAcceptVerificationRequest');
    await tick();
    expect(fake.calls).toContain('sas');
    fake.emit('didReceiveVerificationData', emojiData);
    const challenge = await started;
    expect(challenge.emoji).toHaveLength(7);
    expect(challenge.emoji[0]).toEqual({ symbol: '🐶', label: 'e0' });
    const confirmed = port.confirmVerification(challenge.id, true);
    await tick();
    expect(fake.calls).toContain('approve');
    fake.emit('didFinish');
    await confirmed;
    expect(fake.hasDelegate()).toBe(false);
  });

  it('declines on a mismatch and trusts nothing', async () => {
    const fake = fakeSdk();
    const port = await openPort(fake);
    const started = port.beginVerification('@b:chat.mesh.test');
    await tick();
    fake.emit('didReceiveVerificationData', emojiData);
    const challenge = await started;
    await port.confirmVerification(challenge.id, false);
    expect(fake.calls).toContain('decline');
    expect(fake.calls).not.toContain('approve');
    await expect(port.confirmVerification(challenge.id, true)).rejects.toMatchObject({ reason: 'no-verification' });
  });

  it('fails when the other phone cancels, fails, or never answers', async () => {
    const fake = fakeSdk();
    const port = await openPort(fake);
    const cancelled = port.beginVerification('@b:chat.mesh.test');
    await tick();
    fake.emit('didCancel');
    await expect(cancelled).rejects.toMatchObject({ reason: 'verification-cancelled' });

    const silent = port.beginVerification('@b:chat.mesh.test');
    await expect(silent).rejects.toMatchObject({ reason: 'verification-timeout' });
    expect(fake.calls.filter((c) => c === 'cancel').length).toBeGreaterThan(0);

    const approved = port.beginVerification('@b:chat.mesh.test');
    await tick();
    fake.emit('didReceiveVerificationData', emojiData);
    const challenge = await approved;
    const confirm = port.confirmVerification(challenge.id, true);
    await tick();
    fake.emit('didFail');
    await expect(confirm).rejects.toMatchObject({ reason: 'verification-failed' });
  });

  it('shows the numbers an older client sends instead of emoji', async () => {
    const fake = fakeSdk();
    const port = await openPort(fake);
    const started = port.beginVerification('@b:chat.mesh.test');
    await tick();
    fake.emit('didReceiveVerificationData', { tag: 'Decimals', inner: { values: [1234, 5678, 9012] } });
    expect((await started).emoji.map((e) => e.symbol)).toEqual(['1234', '5678', '9012']);
  });

  it('a new verification cancels the one in progress', async () => {
    const fake = fakeSdk();
    const port = await openPort(fake);
    const first = port.beginVerification('@b:chat.mesh.test');
    await tick();
    fake.emit('didReceiveVerificationData', emojiData);
    const old = await first;
    const second = port.beginVerification('@b:chat.mesh.test');
    await tick();
    expect(fake.calls).toContain('cancel');
    await expect(port.confirmVerification(old.id, true)).rejects.toMatchObject({ reason: 'no-verification' });
    fake.emit('didCancel');
    await expect(second).rejects.toMatchObject({ reason: 'verification-cancelled' });
  });
});

describe('contact QR', () => {
  it('carries this account and its master key', async () => {
    const fake = fakeSdk();
    const port = await openPort(fake);
    expect(JSON.parse(await port.ownContactQr())).toEqual({ v: 1, type: 'afribit.chat.contact', userId: SESSION.userId, verification: 'OWNMASTERKEY0123456789abcdefghijklmnopqrstu' });
    fake.identities.get(SESSION.userId)!.masterKey = undefined;
    await expect(port.ownContactQr()).rejects.toMatchObject({ reason: 'no-identity' });
  });

  it('checks the scanned key against the server and never verifies by itself', async () => {
    const fake = fakeSdk();
    const port = await openPort(fake);
    const qr = (verification: string, userId = '@b:chat.mesh.test') => JSON.stringify({ v: 1, type: 'afribit.chat.contact', userId, verification });
    expect(await port.verifyContactQr(qr('BEEMASTERKEY0123456789abcdefghijklmnopqrstu'))).toEqual({ userId: '@b:chat.mesh.test', verified: false });
    await expect(port.verifyContactQr(qr('SWAPPEDKEY0123456789abcdefghijklmnopqrstuvw'))).rejects.toMatchObject({ reason: 'contact-key-mismatch' });
    await expect(port.verifyContactQr(qr('ANYKEY0123456789abcdef', '@nobody:chat.mesh.test'))).rejects.toMatchObject({ reason: 'no-identity' });
    await expect(port.verifyContactQr('not json')).rejects.toMatchObject({ reason: 'invalid-contact' });
    fake.identities.get('@b:chat.mesh.test')!.verified = true;
    expect((await port.verifyContactQr(qr('BEEMASTERKEY0123456789abcdefghijklmnopqrstu'))).verified).toBe(true);
  });
});

describe('encrypted images', () => {
  const limits = { maxDimension: 1600, maxBytes: 1_000_000, allowedTypes: ['image/jpeg'] };

  it('sends the picked, resized file through the SDK, which encrypts it', async () => {
    const fake = fakeSdk();
    const port = await openPort(fake, { pickImage: async () => ({ path: 'file:///cache/My%20Pic.jpg', mimeType: 'image/jpeg', width: 1600, height: 900, bytes: 200_000 }) });
    await port.sendEncryptedImage(ROOM, limits);
    expect(fake.images).toHaveLength(1);
    const [params, thumb, info] = fake.images[0] as [{ source: { inner: { filename: string } } }, unknown, Record<string, unknown>];
    expect(params.source.inner.filename).toBe('/cache/My Pic.jpg');
    expect(thumb).toBeUndefined();
    expect(info).toMatchObject({ width: 1600n, height: 900n, mimetype: 'image/jpeg', size: 200_000n });
  });

  it('does nothing when the user cancels, and refuses anything over the limits', async () => {
    const fake = fakeSdk();
    let next: unknown = null;
    const port = await openPort(fake, { pickImage: async () => next as never });
    await port.sendEncryptedImage(ROOM, limits);
    for (const bad of [
      { path: '/c/a.png', mimeType: 'image/png', width: 10, height: 10, bytes: 10 },
      { path: '/c/a.jpg', mimeType: 'image/jpeg', width: 1601, height: 10, bytes: 10 },
      { path: '/c/a.jpg', mimeType: 'image/jpeg', width: 10, height: 10, bytes: 1_000_001 },
    ]) {
      next = bad;
      await expect(port.sendEncryptedImage(ROOM, limits)).rejects.toMatchObject({ reason: 'media-rejected' });
    }
    expect(fake.images).toHaveLength(0);
  });

  it('is unavailable without a picker', async () => {
    const port = await openPort(fakeSdk());
    await expect(port.sendEncryptedImage(ROOM, limits)).rejects.toMatchObject({ reason: 'no-media' });
  });
});
