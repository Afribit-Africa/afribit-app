import { availability, createRegistry } from '@afribit/kernel';
import { describe, expect, it } from 'vitest';
import { FEATURE_MANIFESTS, RELEASE_POLICY } from '../src/release-policy';

const online = { state: 'INTERNET', meshTrust: 'none', uplink: 'mesh', checkedAt: 0 } as const;

describe('shipped release policy', () => {
  const registry = createRegistry(FEATURE_MANIFESTS, RELEASE_POLICY);

  it('registers every shipped app', () => {
    expect(registry.rejected).toEqual([]);
  });

  it('builds the Wallet in (S-17): it opens inside Afribit', () => {
    const wallet = registry.get('wallet')!;
    expect(wallet.manifest.classification).toBe('A');
    expect(wallet.manifest.isolation.process).toBe('builtin');
    const ctx = { connectivity: online, quarantined: new Set<string>(), hasAccount: false, host: { dedicatedProcess: false } };
    expect(availability(wallet, ctx).status).toBe('available');
  });
});
