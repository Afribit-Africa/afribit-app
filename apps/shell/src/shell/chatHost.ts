import type { CapabilityIntent, CapabilityOutcome } from '@afribit/feature-sdk';
import type { ChatHost } from '@afribit/feature-chat';
import { chatPaymentOutcome, CHAT_GATE_ORIGIN, CHAT_MATRIX_ORIGIN, CHAT_MATRIX_SERVER_NAME } from '@afribit/kernel';
import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { router } from 'expo-router';
import { CHAT_GATE_ORIGINS } from './chatOrigins';
import { authorizeRequest } from './identity';
import { deferDeviceRevocation, identityLifecycle } from './lifecycle';
import { contactScan } from './qrBridge';
import { screenSecurity } from './screenSecurity';
import { featureVault } from './vault';

/** The runtime services the shell hands to the Chat host. Everything else is imported. */
export interface ChatHostDeps {
  /** The live shell profile: the device npub and the nickname. */
  profile(): Promise<{ readonly npub: string; readonly nickname: string }>;
  /** The broker client bound to the Chat feature by the shell. */
  request(intent: CapabilityIntent): Promise<CapabilityOutcome>;
  /** Chat's own data directory, already created by FeatureHost (`ctx.paths.dataDir`, CR-2b). */
  dataDir: string;
}

/**
 * Builds the host object Chat runs against (C1). The shell owns the identity key,
 * the broker and the vault, so Chat only ever sees this narrow surface: it never
 * receives a secret and cannot reach a service the release policy did not grant.
 */
export function createChatHost(deps: ChatHostDeps): ChatHost {
  return {
    dataDir: deps.dataDir,
    gateOrigin: CHAT_GATE_ORIGIN,
    matrixOrigin: CHAT_MATRIX_ORIGIN,
    matrixServerName: CHAT_MATRIX_SERVER_NAME,
    profile: () => deps.profile(),
    authorize: (request) => authorizeRequest('chat', { ...request, allowedOrigins: CHAT_GATE_ORIGINS }),
    sha256: (body) => digestStringAsync(CryptoDigestAlgorithm.SHA256, body),
    vault: featureVault('chat'),
    async notify({ title, body }) {
      await deps.request({ kind: 'notify.local', title, body });
    },
    screenSecurity: (enabled) => screenSecurity('chat', enabled),
    onIdentityEnding: (listener) => identityLifecycle.onIdentityEnding({ label: 'chat', run: listener }),
    scanQr() {
      const pending = contactScan.request();
      router.push('/scan');
      return pending;
    },
    showQr(payload, caption) {
      router.push({ pathname: '/qr', params: { data: payload, caption } });
      return Promise.resolve();
    },
    deferDeviceRevocation: (session) => deferDeviceRevocation(session),
    async requestPayment(request) {
      return chatPaymentOutcome(await deps.request({ kind: 'wallet.preparePayment', paymentRequest: request, purpose: 'manual' }));
    },
  };
}
