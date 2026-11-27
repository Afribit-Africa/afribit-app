import type { CapabilityIntent } from '@afribit/feature-sdk';

/** Host capability catalogue (PRD §15.3, P0). Anything not listed here does not exist. */
export const CAPABILITIES = [
  'app.openService',
  'app.locale.read',
  'connectivity.read',
  'wallet.showReceive',
  'wallet.preparePayment',
  'wallet.payContact',
  'wallet.createRequest',
  'mesh.passes.read',
  'mesh.open',
  'profile.read',
  'notify.local',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const KNOWN: ReadonlySet<string> = new Set(CAPABILITIES);

export function isKnownCapability(name: string): name is Capability {
  return KNOWN.has(name);
}

/** Names that must never be granted, even if someone adds them to the catalogue by mistake. */
export const FORBIDDEN_CAPABILITIES: ReadonlySet<string> = new Set([
  'signRawTransaction',
  'getSeed',
  'exportPrivateKey',
  'arbitraryNativeCall',
  'webviewExecuteNativeCode',
  'sendWithoutReview',
  'approveClanVoteAsSignature',
  'getAllUserData',
  'wallet.sign',
  'wallet.exportSeed',
  'storage.readAny',
]);

/** Which capability an intent needs, and which feature is the only valid destination. */
export const INTENT_ROUTES: Readonly<Record<CapabilityIntent['kind'], { capability: Capability; destination: string | 'shell' }>> = {
  'app.openService': { capability: 'app.openService', destination: 'shell' },
  'wallet.showReceive': { capability: 'wallet.showReceive', destination: 'wallet' },
  'wallet.preparePayment': { capability: 'wallet.preparePayment', destination: 'wallet' },
  'wallet.payContact': { capability: 'wallet.payContact', destination: 'wallet' },
  'wallet.createRequest': { capability: 'wallet.createRequest', destination: 'wallet' },
  'shell.openMesh': { capability: 'mesh.open', destination: 'shell' },
  'profile.read': { capability: 'profile.read', destination: 'shell' },
  'notify.local': { capability: 'notify.local', destination: 'shell' },
};
