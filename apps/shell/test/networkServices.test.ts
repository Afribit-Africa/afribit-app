import type { ConnectivitySnapshot, ConnectivityState, MeshTrust, Uplink } from '@afribit/feature-sdk';
import type { AvailabilityResult, Capability, FeatureManifest, NetworkRequirement, RegisteredFeature } from '@afribit/kernel';
import { describe, expect, it } from 'vitest';
import { networkServices } from '../src/shell/networkServicesCore';

function feature(id: string, network: NetworkRequirement, enabled = true): RegisteredFeature {
  const manifest: FeatureManifest = {
    schemaVersion: 1,
    id,
    displayName: { en: id, sw: id },
    tagline: { en: '', sw: '' },
    version: '0.1.0',
    owner: 'afribit-africa',
    license: 'internal-owned',
    classification: 'B',
    kind: 'native',
    readiness: 'available',
    category: 'tools',
    requires: { network, account: false },
    requestedCapabilities: [],
    networkDomains: [],
    isolation: { process: 'shell', storageNamespace: `feature.${id}` },
    minimumHostContract: '1.0',
  };
  return { manifest, effectiveCapabilities: new Set<Capability>(), enabled };
}

const available = (): AvailabilityResult => ({ status: 'available' });
const unavailable = (): AvailabilityResult => ({ status: 'unavailable', reason: 'quarantined' });

const snapshot = (state: ConnectivityState, meshTrust: MeshTrust = 'none', uplink: Uplink = 'none'): ConnectivitySnapshot =>
  ({ state, meshTrust, uplink, checkedAt: 0 });

describe('networkServices', () => {
  it.each([
    ['none', 'offline'],
    ['internet', 'internet'],
    ['mesh', 'mesh'],
    ['internet-or-mesh', 'internet-or-mesh'],
  ] as const)('reports requires.network %s as need %s', (network, need) => {
    const { services } = networkServices([feature('a', network)], available, snapshot('INTERNET'));
    expect(services).toEqual([{ id: 'a', need, usable: true }]);
  });

  it('lists usable features before unusable ones, in registry order within each group', () => {
    const features = [feature('a', 'internet'), feature('b', 'internet'), feature('c', 'internet'), feature('d', 'internet')];
    const availabilityOf = (id: string): AvailabilityResult => (id === 'b' || id === 'd' ? unavailable() : available());
    const { services } = networkServices(features, availabilityOf, snapshot('INTERNET'));
    expect(services.map((s) => s.id)).toEqual(['a', 'c', 'b', 'd']);
    expect(services.map((s) => s.usable)).toEqual([true, true, false, false]);
  });

  it('treats a limited feature as usable', () => {
    const availabilityOf = (): AvailabilityResult => ({ status: 'limited', reason: 'preview' });
    const { services } = networkServices([feature('a', 'mesh')], availabilityOf, snapshot('INTERNET'));
    expect(services[0]?.usable).toBe(true);
  });

  it('leaves disabled features out', () => {
    const features = [feature('a', 'internet'), feature('b', 'internet', false), feature('c', 'internet')];
    const { services } = networkServices(features, available, snapshot('INTERNET'));
    expect(services.map((s) => s.id)).toEqual(['a', 'c']);
  });

  describe('paymentNotice', () => {
    it('is false when the internet is available', () => {
      expect(networkServices([], available, snapshot('INTERNET')).paymentNotice).toBe(false);
    });

    it('is false when the internet is slow', () => {
      expect(networkServices([], available, snapshot('DEGRADED')).paymentNotice).toBe(false);
    });

    it('is false when offline', () => {
      expect(networkServices([], available, snapshot('OFFLINE')).paymentNotice).toBe(false);
    });

    it('is true on a mesh with no internet', () => {
      expect(networkServices([], available, snapshot('LOCAL_ONLY')).paymentNotice).toBe(true);
      expect(networkServices([], available, snapshot('LOCAL_ONLY', 'local-verified')).paymentNotice).toBe(true);
    });

    it.each([
      ['mesh', 'INTERNET', 'attested', 'mesh'],
      ['mobile-opt-in', 'DEGRADED', 'attested', 'mobile-opt-in'],
      ['none', 'LOCAL_ONLY', 'local-verified', 'none'],
    ] as const)('on the mesh with uplink %s', (_label, state, meshTrust, uplink) => {
      const expected = uplink === 'none';
      expect(networkServices([], available, snapshot(state, meshTrust, uplink)).paymentNotice).toBe(expected);
    });
  });
});
