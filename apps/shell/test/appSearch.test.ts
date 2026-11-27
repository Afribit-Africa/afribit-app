import type { LocalizedText } from '@afribit/feature-sdk';
import type { AvailabilityResult, Capability, FeatureManifest, RegisteredFeature } from '@afribit/kernel';
import { describe, expect, it } from 'vitest';
import { filterApps } from '../src/shell/appSearchCore';

function feature(id: string, displayName: LocalizedText, tagline: LocalizedText = { en: '', sw: '' }): RegisteredFeature {
  const manifest: FeatureManifest = {
    schemaVersion: 1,
    id,
    displayName,
    tagline,
    version: '0.1.0',
    owner: 'afribit-africa',
    license: 'internal-owned',
    classification: 'B',
    kind: 'native',
    readiness: 'available',
    category: 'tools',
    requires: { network: 'none', account: false },
    requestedCapabilities: [],
    networkDomains: [],
    isolation: { process: 'shell', storageNamespace: `feature.${id}` },
    minimumHostContract: '1.0',
  };
  return { manifest, effectiveCapabilities: new Set<Capability>(), enabled: true };
}

const available = (): AvailabilityResult => ({ status: 'available' });
const ids = (features: readonly RegisteredFeature[]) => features.map((f) => f.manifest.id);

const chat = feature('chat', { en: 'Chat', sw: 'Gumzo' }, { en: 'Talk with your community', sw: 'Zungumza na jamii yako' });
const wallet = feature('wallet', { en: 'Wallet', sw: 'Pochi' }, { en: 'Send and receive money', sw: 'Tuma na pokea pesa' });
const cafe = feature('cafe', { en: 'Café Net', sw: 'Wifi ya Mkahawa' }, { en: 'Wi-Fi for cafés', sw: 'Wifi kwa mikahawa' });

const all = [chat, wallet, cafe];

describe('filterApps', () => {
  it('matches the display name in the current locale and in English', () => {
    expect(ids(filterApps(all, { query: 'gumzo', worksNow: false }, 'sw', available))).toEqual(['chat']);
    expect(ids(filterApps(all, { query: 'chat', worksNow: false }, 'sw', available))).toEqual(['chat']);
  });

  it('matches the tagline in the current locale and in English', () => {
    expect(ids(filterApps(all, { query: 'pokea pesa', worksNow: false }, 'sw', available))).toEqual(['wallet']);
    expect(ids(filterApps(all, { query: 'receive money', worksNow: false }, 'sw', available))).toEqual(['wallet']);
  });

  it('ignores case', () => {
    expect(ids(filterApps(all, { query: 'CHAT', worksNow: false }, 'en', available))).toEqual(['chat']);
  });

  it('ignores accents on both sides of the comparison', () => {
    expect(ids(filterApps(all, { query: 'cafe', worksNow: false }, 'en', available))).toEqual(['cafe']);
    expect(ids(filterApps(all, { query: 'CAFÉ', worksNow: false }, 'en', available))).toEqual(['cafe']);
    expect(ids(filterApps(all, { query: 'MKAHAWA', worksNow: false }, 'sw', available))).toEqual(['cafe']);
  });

  it('treats an empty or whitespace query as matching everything', () => {
    expect(ids(filterApps(all, { query: '', worksNow: false }, 'en', available))).toEqual(['chat', 'wallet', 'cafe']);
    expect(ids(filterApps(all, { query: '   ', worksNow: false }, 'en', available))).toEqual(['chat', 'wallet', 'cafe']);
  });

  it('keeps only apps that are not unavailable when worksNow is on', () => {
    const availability = (id: string): AvailabilityResult =>
      id === 'chat'
        ? { status: 'available' }
        : id === 'wallet'
          ? { status: 'limited', reason: 'account-required' }
          : { status: 'unavailable', reason: 'network-required' };
    expect(ids(filterApps(all, { query: '', worksNow: true }, 'en', availability))).toEqual(['chat', 'wallet']);
  });

  it('keeps registry order', () => {
    expect(ids(filterApps(all, { query: '', worksNow: false }, 'en', available))).toEqual(['chat', 'wallet', 'cafe']);
  });
});
