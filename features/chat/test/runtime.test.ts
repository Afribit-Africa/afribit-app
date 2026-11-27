import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureContext } from '@afribit/feature-sdk';
import { createChatRuntime } from '../src/core/runtime';
import type { ChatHost, ChatRoom, MatrixPort, PaymentOutcome, Session } from '../src/core/types';
import { swahili } from '../src/strings';
import { encryptedFixture } from './helpers';

const npub = 'npub1' + 'q'.repeat(58);
const session: Session = { homeserver: 'https://matrix.mesh.test', userId: '@a_opaque:mesh.test', deviceId: 'AFRIBIT_' + 'a'.repeat(36), accessToken: 'secret-token' };
const room: ChatRoom = { id: '!r:mesh.test', name: 'Amina', initials: 'A', kind: 'direct', members: 2, unread: 0, encrypted: true, verification: 'verified', peerUserId: '@amina:mesh.test', messages: [] };
function fixture() {
  const f = encryptedFixture();
  f.values.set('matrix.session.v1', JSON.stringify({ owner: npub, session }));
  let onEnd: (() => Promise<void>) | undefined;
  let listener: ((rooms: readonly ChatRoom[]) => void) | undefined;
  const vault = new Map<string, string>();
  const ordinary = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
  const ctx: FeatureContext = { featureId: 'chat', locale: 'en', connectivity: { state: 'LOCAL_ONLY', meshTrust: 'local-verified', uplink: 'none', checkedAt: 1 }, storage: ordinary, secureStorage: f.store, paths: { dataDir: 'file:///test/features/chat/' }, request: vi.fn(async () => ({ requestId: 'p', status: 'unavailable', reason: 'wallet-not-ready' } as const)), exit: vi.fn() };
  const host: ChatHost = {
    dataDir: '/app/private/chat', gateOrigin: 'https://gate.mesh.test', matrixOrigin: session.homeserver, matrixServerName: 'mesh.test',
    profile: vi.fn(async () => ({ npub, nickname: 'Amina' })), authorize: vi.fn(), sha256: vi.fn(),
    vault: { get: vi.fn(async n => vault.get(n) ?? null), put: vi.fn(async (n, v) => { vault.set(n, v); }) },
    notify: vi.fn(async () => undefined), screenSecurity: vi.fn(async () => undefined),
    scanQr: vi.fn(async () => null), showQr: vi.fn(async () => undefined),
    onIdentityEnding(fn) { onEnd = fn; return () => { onEnd = undefined; }; },
    deferDeviceRevocation: vi.fn(async () => undefined), requestPayment: vi.fn(async (request: string) => (await ctx.request({ kind: 'wallet.preparePayment', paymentRequest: request, purpose: 'manual' })) as PaymentOutcome),
  };
  const matrix: MatrixPort = {
    ...f.crypto, open: vi.fn(async () => undefined), security: vi.fn(async () => ({ encryptedStore: true, e2ee: true })),
    preferences: vi.fn(async () => ({ directoryOptIn: false })),
    recovery: vi.fn(async () => ({ exists: false })), newRecoveryKey: vi.fn(async () => 'matrix-recovery-key'), enableRecovery: vi.fn(async () => undefined),
    setInitialDisplayName: vi.fn(async () => undefined),
    subscribe(fn) { listener = fn; return () => { listener = undefined; }; }, sync: vi.fn(async () => { listener?.([room]); }),
    sendEncrypted: vi.fn(async () => ({ eventId: '$sent' })), createEncryptedRoom: vi.fn(async () => '!created:mesh.test'),
    invite: vi.fn(async () => undefined), leave: vi.fn(async () => undefined), markRead: vi.fn(async () => undefined), block: vi.fn(async () => undefined),
    beginVerification: vi.fn(async () => ({ id: 'verification', emoji: [] })), confirmVerification: vi.fn(async () => undefined),
    verifyContactQr: vi.fn(async () => ({ userId: '@amina:mesh.test', verified: false })), ownContactQr: vi.fn(async () => '{}'),
    setDirectoryOptIn: vi.fn(async () => undefined), sendEncryptedImage: vi.fn(async () => undefined), stop: vi.fn(async () => undefined), wipe: vi.fn(async () => undefined),
  };
  return { ...f, ctx, host, matrix, ordinary, vault, end: () => onEnd!(), push: (rooms: readonly ChatRoom[]) => listener?.(rooms) };
}
describe('identity-bound encrypted runtime', () => {
  beforeEach(() => vi.restoreAllMocks());
  it('uses the shell profile and vault, never a Chat sign-up or ordinary storage', async () => {
    const f = fixture(); const app = createChatRuntime(f.ctx, f.host, f.matrix); await app.start();
    expect(app.snapshot().phase).toBe('ready'); expect(f.vault.get('matrix.recovery.v1')).toBe('matrix-recovery-key');
    expect(f.ordinary.setItem).not.toHaveBeenCalled(); expect(f.host.authorize).not.toHaveBeenCalled();
    await app.send(room.id, 'private text');
    expect(f.matrix.sendEncrypted).toHaveBeenCalled(); expect(f.ordinary.setItem).not.toHaveBeenCalled();
  });
  it('fails closed without E2EE and with an unencrypted native store', async () => {
    const f = fixture(); vi.mocked(f.matrix.security).mockResolvedValue({ e2ee: true, encryptedStore: false });
    const app = createChatRuntime(f.ctx, f.host, f.matrix); await app.start();
    expect(app.snapshot().phase).toBe('error'); expect(app.snapshot().error).toBe('encryption-required');
    await expect(app.send(room.id, 'secret')).rejects.toThrow('chat-not-ready'); expect(f.matrix.sendEncrypted).not.toHaveBeenCalled();
  });
  it('does not replace an existing recovery backup when the identity vault key is missing', async () => {
    const f = fixture(); vi.mocked(f.matrix.recovery).mockResolvedValue({ exists: true });
    const app = createChatRuntime(f.ctx, f.host, f.matrix); await app.start();
    expect(app.snapshot().error).toBe('recovery-required'); expect(f.matrix.newRecoveryKey).not.toHaveBeenCalled();
  });
  it('keeps unencrypted rooms out of UI and notifications, and blocks changed devices', async () => {
    const f = fixture(); const app = createChatRuntime(f.ctx, f.host, f.matrix); await app.start();
    f.push([{ ...room, verification: 'changed' }, { ...room, id: 'plaintext', encrypted: false }]);
    expect(app.snapshot().rooms.map(r => r.id)).toEqual([room.id]);
    await expect(app.send(room.id, 'secret')).rejects.toThrow('verification-changed');
    expect(f.matrix.sendEncrypted).not.toHaveBeenCalled();
  });
  it('queues encrypted messages while disconnected and preserves delivery truth', async () => {
    const f = fixture(); const app = createChatRuntime(f.ctx, f.host, f.matrix); await app.start();
    app.updateConnectivity({ state: 'OFFLINE', meshTrust: 'none', uplink: 'none', checkedAt: 2 });
    await app.send(room.id, 'queue this safely');
    expect(f.matrix.sendEncrypted).not.toHaveBeenCalled();
    expect(app.snapshot().rooms[0]!.messages[0]!.status).toBe('queued');
    expect([...f.values.values()].join()).not.toContain('queue this safely');
    app.updateConnectivity(f.ctx.connectivity); await app.retry();
    expect(f.matrix.sendEncrypted).toHaveBeenCalledTimes(1);
    expect(app.snapshot().rooms[0]!.messages[0]!.status).toBe('sent');
  });
  it('notification text never contains message content or sender identity', async () => {
    const f = fixture(); const app = createChatRuntime(f.ctx, f.host, f.matrix); await app.start();
    f.push([{ ...room, messages: [{ id: '$new', roomId: room.id, senderId: '@amina:mesh.test', text: 'private secret', timestamp: Date.now(), own: false, status: 'sent' }] }]);
    expect(f.host.notify).toHaveBeenCalledWith({ title: 'Afribit Chat', body: 'You have a new message.' });
  });
  it('notifies in Kiswahili when the runtime is created with the Kiswahili strings', async () => {
    const f = fixture(); const app = createChatRuntime(f.ctx, f.host, f.matrix, swahili); await app.start();
    f.push([{ ...room, messages: [{ id: '$new', roomId: room.id, senderId: '@amina:mesh.test', text: 'private secret', timestamp: Date.now(), own: false, status: 'sent' }] }]);
    expect(f.host.notify).toHaveBeenCalledWith({ title: 'Afribit Chat', body: 'Una ujumbe mpya.' });
  });
  it('revokes through the shell and wipes even when revocation is unavailable', async () => {
    const f = fixture(); const app = createChatRuntime(f.ctx, f.host, f.matrix); await app.start();
    vi.mocked(f.host.deferDeviceRevocation).mockRejectedValue(Error('offline'));
    await expect(f.end()).rejects.toThrow('offline');
    expect(app.snapshot().phase).toBe('signed-out'); expect(app.snapshot().rooms).toEqual([]);
    expect(f.matrix.wipe).toHaveBeenCalled(); expect(f.values.size).toBe(0);
    await expect(app.send(room.id, 'after signout')).rejects.toThrow('chat-not-ready');
  });
  it('prevents an old Matrix session crossing into another Afribit identity', async () => {
    const f = fixture(); vi.mocked(f.host.profile).mockResolvedValue({ npub: 'npub1' + 'p'.repeat(58), nickname: 'Other' });
    const app = createChatRuntime(f.ctx, f.host, f.matrix); await app.start();
    expect(app.snapshot().error).toBe('identity-changed'); expect(f.matrix.open).not.toHaveBeenCalled();
  });
  it('hands a payment to Wallet and returns its unavailable state honestly', async () => {
    const f = fixture(); const app = createChatRuntime(f.ctx, f.host, f.matrix); await app.start();
    const request = 'lnbc1qqqqqqqqqqqqqqqqqqqqqqqqqq';
    expect((await app.pay(request)).status).toBe('unavailable');
    expect(f.ctx.request).toHaveBeenCalledWith({ kind: 'wallet.preparePayment', paymentRequest: request, purpose: 'manual' });
  });
  it('sign-out during initialization cannot write a recovery key or leave a token behind', async () => {
    const f = fixture(); let opened!: () => void;
    const blocked = new Promise<void>(resolve => { opened = resolve; });
    let reached!: () => void; const readyToEnd = new Promise<void>(resolve => { reached = resolve; });
    vi.mocked(f.matrix.open).mockImplementation(async () => { reached(); await blocked; });
    const app = createChatRuntime(f.ctx, f.host, f.matrix);
    const starting = app.start(); await readyToEnd;
    const ending = f.end(); opened();
    await Promise.all([starting, ending]);
    expect(app.snapshot().phase).toBe('signed-out'); expect(f.values.size).toBe(0);
    expect(f.host.vault.put).not.toHaveBeenCalled(); expect(f.matrix.enableRecovery).not.toHaveBeenCalled();
    expect(f.matrix.wipe).toHaveBeenCalled();
  });
  it('attempts every local cleanup even if a native wipe fails', async () => {
    const f = fixture(); const app = createChatRuntime(f.ctx, f.host, f.matrix); await app.start();
    vi.mocked(f.matrix.wipe).mockRejectedValue(Error('native wipe failure'));
    await expect(f.end()).rejects.toThrow('wipe-incomplete');
    expect(f.values.size).toBe(0); expect(app.snapshot().rooms).toEqual([]);
  });
  it('waits for a pending native open before stopping on unmount', async () => {
    const f = fixture(); const order: string[] = [];
    let release!: () => void; let reached!: () => void;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const opening = new Promise<void>(resolve => { reached = resolve; });
    vi.mocked(f.matrix.open).mockImplementation(async () => { reached(); await blocked; order.push('opened'); });
    vi.mocked(f.matrix.stop).mockImplementation(async () => { order.push('stopped'); });
    const app = createChatRuntime(f.ctx, f.host, f.matrix);
    const starting = app.start(); await opening;
    const disposing = app.dispose();
    expect(app.snapshot().phase).toBe('locked'); expect(order).toEqual([]);
    release(); await Promise.all([starting, disposing]);
    expect(order).toEqual(['opened', 'stopped']); expect(f.host.vault.put).not.toHaveBeenCalled();
  });
  it('does not claim contact verification simply because a QR parses', async () => {
    const f = fixture(); const app = createChatRuntime(f.ctx, f.host, f.matrix); await app.start();
    const result = await app.addContact(JSON.stringify({ v: 1, type: 'afribit.chat.contact', userId: '@amina:mesh.test', verification: 'some-public-contact-data' }));
    expect(result.verified).toBe(false); expect(f.matrix.confirmVerification).not.toHaveBeenCalled();
  });
  it('adds nothing when the user only scans a contact QR', async () => {
    const f = fixture(); const app = createChatRuntime(f.ctx, f.host, f.matrix); await app.start();
    const payload = JSON.stringify({ v: 1, type: 'afribit.chat.contact', userId: '@amina:mesh.test', verification: 'some-public-contact-data' });
    vi.mocked(f.host.scanQr).mockResolvedValue(payload);
    await expect(app.scanQr()).resolves.toBe(payload);
    expect(f.matrix.verifyContactQr).not.toHaveBeenCalled();
    await app.addContact(payload);
    expect(f.matrix.verifyContactQr).toHaveBeenCalledWith(payload);
  });
  it('shows the owner QR through the host with the caption', async () => {
    const f = fixture(); const app = createChatRuntime(f.ctx, f.host, f.matrix); await app.start();
    await app.showOwnQr();
    expect(f.host.showQr).toHaveBeenCalledWith('{}', 'My contact QR');
  });
  it.each(['completed', 'pending', 'cancelled', 'unavailable', 'denied', 'failed'] as const)('preserves Wallet %s without claiming a successful payment', async status => {
    const f = fixture(); const app = createChatRuntime(f.ctx, f.host, f.matrix); await app.start();
    const outcome = { requestId: 'payment', status, correlationId: 'correlation', reason: 'test', code: 'test' } as PaymentOutcome;
    vi.mocked(f.host.requestPayment).mockResolvedValue(outcome);
    expect(await app.pay('lnbc1qqqqqqqqqqqqqqqqqqqqqqqqqq')).toEqual(outcome);
  });
  it('does not claim screen protection when the host rejects the capability', async () => {
    const f = fixture(); const app = createChatRuntime(f.ctx, f.host, f.matrix); await app.start();
    vi.mocked(f.host.screenSecurity).mockRejectedValue(Error('unsupported'));
    await expect(app.protectScreen(true)).rejects.toThrow('screen-security-unavailable');
    expect(app.snapshot().phase).toBe('ready');
  });
  it('uses the existing directory preference without silently opting anyone in', async () => {
    const f = fixture(); vi.mocked(f.matrix.preferences).mockResolvedValue({ directoryOptIn: true });
    const app = createChatRuntime(f.ctx, f.host, f.matrix); await app.start();
    expect(app.snapshot().directoryOptIn).toBe(true); expect(f.matrix.setDirectoryOptIn).not.toHaveBeenCalled();
  });
  it('does not request identity authorization on an untrusted or disconnected network', async () => {
    const f = fixture(); const app = createChatRuntime({ ...f.ctx, connectivity: { state: 'UNTRUSTED_PORTAL', meshTrust: 'none', uplink: 'none', checkedAt: 1 } }, f.host, f.matrix); await app.start();
    expect(app.snapshot().phase).toBe('locked'); expect(f.host.profile).not.toHaveBeenCalled(); expect(f.host.authorize).not.toHaveBeenCalled();
  });
});
