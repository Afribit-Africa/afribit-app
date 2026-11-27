import type { ConnectivitySnapshot } from '@afribit/feature-sdk';
import type { ReleasePolicy } from '../src/registry';

export function manifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const id = (overrides.id as string | undefined) ?? 'chat';
  return {
    schemaVersion: 1,
    id,
    displayName: { en: 'Chat', sw: 'Gumzo' },
    tagline: { en: 'Message your community', sw: 'Tuma ujumbe kwa jamii yako' },
    version: '0.1.0',
    owner: 'afribit-africa',
    license: 'internal-owned',
    classification: 'B',
    kind: 'native',
    readiness: 'available',
    category: 'communication',
    requires: { network: 'none', account: false },
    requestedCapabilities: ['app.openService'],
    networkDomains: [],
    isolation: { process: 'shell', storageNamespace: `feature.${id}` },
    minimumHostContract: '1.0',
    ...overrides,
  };
}

export const policy: ReleasePolicy = {
  chat: { classification: 'B', allowedCapabilities: ['app.openService', 'wallet.preparePayment', 'wallet.payContact', 'wallet.createRequest', 'mesh.open', 'profile.read', 'notify.local'], enabled: true },
  wallet: { classification: 'A', allowedCapabilities: ['app.openService'], enabled: true },
  ai: { classification: 'B', allowedCapabilities: ['app.openService'], enabled: true },
  learn: { classification: 'C', allowedCapabilities: [], enabled: false },
};

export function conn(state: ConnectivitySnapshot['state'], meshTrust: ConnectivitySnapshot['meshTrust'] = 'none', uplink: ConnectivitySnapshot['uplink'] = 'none'): ConnectivitySnapshot {
  return { state, meshTrust, uplink, checkedAt: 0 };
}
