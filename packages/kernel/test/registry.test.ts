import { describe, expect, it } from 'vitest';
import { availability, createRegistry, validateManifest } from '../src';
import { conn, manifest, policy } from './fixtures';

const host = { dedicatedProcess: false };
const base = { quarantined: new Set<string>(), hasAccount: false, host };

describe('validateManifest', () => {
  it('accepts a well-formed manifest', () => {
    expect(validateManifest(manifest()).ok).toBe(true);
  });

  it.each([
    ['unknown key', { extra: true }, 'unknown key'],
    ['bad id', { id: 'Chat!' }, 'id must match'],
    ['missing Kiswahili', { displayName: { en: 'Chat' } }, 'displayName'],
    ['forbidden capability', { requestedCapabilities: ['getSeed'] }, 'forbidden'],
    ['unknown capability', { requestedCapabilities: ['camera.raw'] }, 'not in the host catalogue'],
    ['wildcard domain', { networkDomains: ['*.afribit.africa'] }, 'exact lowercase host'],
    ['domain with scheme', { networkDomains: ['https://afribit.africa'] }, 'exact lowercase host'],
    ['foreign storage namespace', { isolation: { process: 'shell', storageNamespace: 'feature.wallet' } }, 'storageNamespace'],
    ['newer host contract', { minimumHostContract: '2.0' }, 'not supported'],
    ['class D that is not external', { classification: 'D' }, 'class D'],
  ])('rejects %s', (_name, overrides, message) => {
    const r = validateManifest(manifest(overrides));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('\n')).toContain(message);
  });
});

describe('createRegistry', () => {
  it('grants only the intersection of requested and allowed capabilities', () => {
    const reg = createRegistry([manifest({ requestedCapabilities: ['app.openService', 'wallet.showReceive'] })], policy);
    expect([...reg.get('chat')!.effectiveCapabilities]).toEqual(['app.openService']);
  });

  it('rejects a feature missing from the release policy', () => {
    const reg = createRegistry([manifest({ id: 'rogue' })], policy);
    expect(reg.features).toHaveLength(0);
    expect(reg.rejected[0]!.errors[0]).toContain('not in the release policy');
  });

  it('rejects a manifest that claims a different class than the policy', () => {
    const reg = createRegistry([manifest({ classification: 'A', isolation: { process: 'dedicated', storageNamespace: 'feature.chat' } })], policy);
    expect(reg.rejected[0]!.errors[0]).toContain('release policy says B');
  });

  it('requires class A features to declare a dedicated process', () => {
    const reg = createRegistry([manifest({ id: 'wallet', classification: 'A' })], policy);
    expect(reg.rejected[0]!.errors.join()).toContain('dedicated process');
  });

  describe('built-in class A apps (S-17)', () => {
    const builtin = { id: 'wallet', classification: 'A', category: 'money', requires: { network: 'internet', account: false }, isolation: { process: 'builtin', storageNamespace: 'feature.wallet' } };
    const builtInPolicy = (b: unknown) => ({ ...policy, wallet: { ...policy.wallet!, builtIn: b } }) as typeof policy;

    it('accepts a class A app the release policy builds in', () => {
      const reg = createRegistry([manifest(builtin)], builtInPolicy(true));
      expect(reg.rejected).toEqual([]);
      const wallet = reg.get('wallet')!;
      expect(availability(wallet, { ...base, connectivity: conn('INTERNET') }).status).toBe('available');
    });

    it.each([['no policy flag', undefined], ['a flag that is not true', 'yes']])('rejects a built-in manifest with %s', (_n, b) => {
      const reg = createRegistry([manifest(builtin)], builtInPolicy(b));
      expect(reg.features).toHaveLength(0);
      expect(reg.rejected[0]!.errors.join()).toContain('does not build it in');
    });

    it('rejects the policy flag on an app that is not built in', () => {
      const reg = createRegistry([manifest({ ...builtin, isolation: { process: 'dedicated', storageNamespace: 'feature.wallet' } })], builtInPolicy(true));
      expect(reg.rejected[0]!.errors.join()).toContain('does not declare a built-in process');
    });

    it('is only for class A native apps', () => {
      const chatBuiltIn = { ...policy, chat: { ...policy.chat!, builtIn: true } } as typeof policy;
      const reg = createRegistry([manifest({ isolation: { process: 'builtin', storageNamespace: 'feature.chat' } })], chatBuiltIn);
      expect(reg.rejected[0]!.errors.join()).toContain('only for class A');
    });
  });

  it('rejects duplicate ids', () => {
    const reg = createRegistry([manifest(), manifest()], policy);
    expect(reg.features).toHaveLength(1);
    expect(reg.rejected[0]!.errors[0]).toContain('duplicate');
  });

  it('does not treat prototype keys as policy entries', () => {
    const reg = createRegistry([manifest({ id: 'constructor' })], policy);
    expect(reg.features).toHaveLength(0);
  });
});

describe('availability', () => {
  const reg = createRegistry([
    manifest(),
    manifest({ id: 'wallet', classification: 'A', category: 'money', isolation: { process: 'dedicated', storageNamespace: 'feature.wallet' } }),
    manifest({ id: 'ai', readiness: 'coming-later' }),
    manifest({ id: 'learn', classification: 'C', kind: 'bundled-web', requestedCapabilities: [] }),
  ], policy);
  const chat = reg.get('chat')!;

  it('requires mesh trust for a mesh-only feature', () => {
    const meshChat = createRegistry([manifest({ requires: { network: 'mesh', account: false } })], policy).get('chat')!;
    expect(availability(meshChat, { ...base, connectivity: conn('INTERNET') })).toEqual({ status: 'unavailable', reason: 'mesh-required' });
    expect(availability(meshChat, { ...base, connectivity: conn('LOCAL_ONLY', 'local-verified') }).status).toBe('available');
    expect(availability(meshChat, { ...base, connectivity: conn('INTERNET', 'attested') }).status).toBe('available');
  });

  it('keeps a privileged feature unavailable until the host can isolate it', () => {
    const wallet = reg.get('wallet')!;
    expect(availability(wallet, { ...base, connectivity: conn('INTERNET') })).toEqual({ status: 'unavailable', reason: 'isolation-pending' });
    expect(availability(wallet, { ...base, host: { dedicatedProcess: true }, connectivity: conn('INTERNET') }).status).toBe('available');
  });

  it('reports quarantine, disabled and coming-later truthfully', () => {
    expect(availability(chat, { ...base, quarantined: new Set(['chat']), connectivity: conn('INTERNET') }).status).toBe('unavailable');
    expect(availability(reg.get('learn')!, { ...base, connectivity: conn('INTERNET') })).toEqual({ status: 'unavailable', reason: 'disabled' });
    expect(availability(reg.get('ai')!, { ...base, connectivity: conn('INTERNET') })).toEqual({ status: 'unavailable', reason: 'coming-later' });
  });

  it('distinguishes internet-required from offline-capable features', () => {
    const online = createRegistry([manifest({ requires: { network: 'internet', account: false } })], policy).get('chat')!;
    expect(availability(online, { ...base, connectivity: conn('OFFLINE') }).status).toBe('unavailable');
    expect(availability(online, { ...base, connectivity: conn('DEGRADED') })).toEqual({ status: 'limited', reason: 'degraded' });
    expect(availability(chat, { ...base, connectivity: conn('OFFLINE') }).status).toBe('available');
  });
});
