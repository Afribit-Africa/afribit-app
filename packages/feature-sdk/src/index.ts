/**
 * @afribit/feature-sdk: the only contract a feature app is given.
 *
 * A feature app receives a FeatureContext from the shell. It must not import
 * the shell, the kernel, another feature, or storage/native modules directly;
 * the admission check enforces this. Everything a feature may do outside its
 * own screens goes through this context.
 */

export type Locale = 'en' | 'sw';

export type LocalizedText = Readonly<Record<Locale, string>>;

export type ConnectivityState =
  | 'INTERNET'
  | 'DEGRADED'
  | 'LOCAL_ONLY'
  | 'OFFLINE'
  | 'UNTRUSTED_PORTAL';

/** How strongly the shell trusts that the phone is on the Afribit Mesh. */
export type MeshTrust = 'attested' | 'local-verified' | 'none';

/**
 * How payments can reach the internet. `'mesh'` is the mesh router's shared
 * uplink, `'mobile-opt-in'` is the user-enabled mobile data for this feature,
 * `'none'` when neither is available. Only this coarse state is exposed: never
 * SSIDs, IP addresses or the carrier.
 */
export type Uplink = 'mesh' | 'mobile-opt-in' | 'none';

export interface ConnectivitySnapshot {
  readonly state: ConnectivityState;
  readonly meshTrust: MeshTrust;
  readonly uplink: Uplink;
  readonly checkedAt: number;
}

/**
 * Intents a feature may ask the shell to route. Typed, allow-listed, no raw calls.
 * A feature can *ask* the Wallet to move money (`wallet.payContact`) or to produce a
 * request (`wallet.createRequest`). It can never approve: payment only completes
 * through the Wallet's own confirmation (S-12).
 */
export type CapabilityIntent =
  | { readonly kind: 'app.openService'; readonly serviceId: string }
  | { readonly kind: 'wallet.showReceive' }
  | {
      readonly kind: 'wallet.preparePayment';
      readonly paymentRequest: string;
      readonly purpose: 'merchant' | 'manual' | 'mesh_pass';
    }
  | {
      readonly kind: 'wallet.payContact';
      /**
       * `displayName` is untrusted text supplied by the calling feature. The Wallet
       * labels it "as named in Chat" and never treats it as an identity. The Wallet
       * pays only to `paymentAddress`.
       */
      readonly contact: {
        readonly displayName: string;
        readonly paymentAddress: string;
        readonly verification: 'verified' | 'unverified' | 'changed-device';
      };
      readonly amount?: { readonly currency: 'KES' | 'BTC'; readonly value: number };
      readonly note?: string;
    }
  | {
      readonly kind: 'wallet.createRequest';
      readonly amount: { readonly currency: 'KES' | 'BTC'; readonly value: number };
      readonly note?: string;
    }
  | { readonly kind: 'shell.openMesh'; readonly section?: 'settings' | 'identity' | 'packages' }
  | { readonly kind: 'profile.read' }
  | { readonly kind: 'notify.local'; readonly title: string; readonly body: string };

export type CapabilityOutcome =
  | { readonly requestId: string; readonly status: 'opened' }
  | { readonly requestId: string; readonly status: 'cancelled' }
  | { readonly requestId: string; readonly status: 'pending'; readonly correlationId: string }
  | {
      readonly requestId: string;
      readonly status: 'completed';
      readonly receiptReference?: string;
      /** The payment request a `wallet.createRequest` produced, when the Wallet returns one. */
      readonly request?: string;
    }
  | {
      readonly requestId: string;
      readonly status: 'profile';
      readonly profile: { readonly nickname: string; readonly npub: string | null };
    }
  | { readonly requestId: string; readonly status: 'unavailable'; readonly reason: string }
  | { readonly requestId: string; readonly status: 'denied'; readonly reason: string }
  | { readonly requestId: string; readonly status: 'failed'; readonly code: string };

/** Key/value storage the shell scopes to one feature. Another feature cannot read it. */
export interface ScopedStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface FeatureContext {
  /** The feature's own registered id, supplied by the shell, never by the feature. */
  readonly featureId: string;
  readonly locale: Locale;
  readonly connectivity: ConnectivitySnapshot;
  /** Non-secret local state. */
  readonly storage: ScopedStorage;
  /** OS-protected storage (Keychain/Keystore) under a keychain service unique to this feature. */
  readonly secureStorage: ScopedStorage;
  /**
   * A directory only this feature is given; the shell wipes it when the identity ends.
   * Store only encrypted data here.
   */
  readonly paths: { readonly dataDir: string };
  /** Ask the shell to route an intent. The shell identifies the caller itself. */
  request(intent: CapabilityIntent): Promise<CapabilityOutcome>;
  /** Leave the feature and return to the shell. */
  exit(): void;
}

export interface FeatureProps {
  readonly ctx: FeatureContext;
}
