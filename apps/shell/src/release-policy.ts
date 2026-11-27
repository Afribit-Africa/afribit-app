/**
 * Release policy: compiled into the signed app and authoritative over manifests.
 * Pure data (no React Native) so the admission check can import it.
 *
 * Adding a feature = new package under features/, its manifest here, a policy
 * entry, and passing `npm run check`. Remote config may hide a feature later;
 * it can never grant one more power than this file allows.
 */
// The tokens file alone: the package index pulls in React Native, and this file stays pure data.
import { color } from '@afribit/design/src/tokens';
import type { ReleasePolicy } from '@afribit/kernel';
import ai from '@afribit/feature-ai/manifest.json';
import chat from '@afribit/feature-chat/manifest.json';
import diagnostics from '@afribit/feature-diagnostics/manifest.json';
import wallet from '@afribit/feature-wallet/manifest.json';

export const DIAGNOSTICS_BUILD = process.env.EXPO_PUBLIC_DIAGNOSTICS === '1';

/** Display order on Home. Wallet and Chat are the foundation apps. */
export const FEATURE_MANIFESTS: readonly unknown[] = [wallet, chat, ai, diagnostics];

export const RELEASE_POLICY: ReleasePolicy = {
  // Wallet is built into the app (S-17, W1): first-party class A code in the shell's process
  // until W2 gives it its own. Only this compiled policy can build an app in.
  wallet: {
    classification: 'A',
    allowedCapabilities: ['app.openService'],
    enabled: true,
    builtIn: true,
  },
  // profile.read gives Chat the device npub and nickname for gate sign-in; notify.local shows message alerts.
  chat: {
    classification: 'B',
    allowedCapabilities: ['app.openService', 'wallet.preparePayment', 'wallet.payContact', 'wallet.createRequest', 'profile.read', 'notify.local'],
    enabled: true,
  },
  ai: { classification: 'B', allowedCapabilities: ['app.openService'], enabled: true },
  // Deliberately NOT granted wallet.preparePayment, so its broker check shows a denial.
  diagnostics: { classification: 'B', allowedCapabilities: ['app.openService'], enabled: DIAGNOSTICS_BUILD },
};

/** Per-app identity on the shared frame (Product Flow v0.1: apps keep their own identity). */
export const FEATURE_LOOK: Readonly<Record<string, { icon: string; accent: string }>> = {
  wallet: { icon: 'wallet', accent: color.ink },
  chat: { icon: 'chatbubbles', accent: color.forest },
  ai: { icon: 'sparkles', accent: color.ink },
  diagnostics: { icon: 'pulse', accent: color.muted },
};
