/**
 * The native edges Chat's host and engine need, kept as a value so the wiring below
 * stays pure (no React, no Expo import) and can be tested with fakes (C1).
 */
import type { FeatureContext } from '@afribit/feature-sdk';
import type * as Sdk from '@unomed/react-native-matrix-sdk';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import type { ChatHostDeps } from '../shell/chatHost';
import type { NativeMatrixDeps } from './nativeMatrix';

type SdkModule = typeof Sdk;

export interface ChatNatives {
  /** The Matrix engine, imported lazily so its native module only loads when Chat opens. */
  loadSdk(): Promise<SdkModule>;
  /** CSPRNG from expo-crypto. */
  randomBytes(length: number): Uint8Array;
  /** expo-file-system delete; the engine asks for the idempotent form. */
  deleteAsync(path: string, options: { idempotent: boolean }): Promise<void>;
  /** The app version from expo-constants, when available. */
  appVersion?: string;
  /** Lets the user pick a photo for encrypted sending; absent means images are unavailable. */
  pickImage?: NonNullable<NativeMatrixDeps['pickImage']>;
}

export interface ChatDeps {
  /** Arguments for `createChatHost`. */
  host: ChatHostDeps;
  /** Arguments for `createNativeMatrixPort`. */
  engine: NativeMatrixDeps;
}

/** Maps a FeatureContext plus the native edges onto the host and engine arguments. */
export function createChatDeps(ctx: FeatureContext, natives: ChatNatives): ChatDeps {
  return {
    host: {
      dataDir: ctx.paths.dataDir,
      request: (intent) => ctx.request(intent),
      async profile() {
        const outcome = await ctx.request({ kind: 'profile.read' });
        if (outcome.status !== 'profile' || outcome.profile.npub === null) {
          throw new Error(outcome.status === 'profile' ? 'chat identity is not ready' : `chat profile is ${outcome.status}`);
        }
        return { npub: outcome.profile.npub, nickname: outcome.profile.nickname };
      },
    },
    engine: {
      loadSdk: () => natives.loadSdk(),
      secrets: {
        get: (name) => ctx.secureStorage.getItem(name),
        put: (name, value) => ctx.secureStorage.setItem(name, value),
        remove: (name) => ctx.secureStorage.removeItem(name),
      },
      aead: {
        seal: (key, nonce, plaintext, associatedData) => xchacha20poly1305(key, nonce, associatedData).encrypt(plaintext),
        open: (key, nonce, sealed, associatedData) => xchacha20poly1305(key, nonce, associatedData).decrypt(sealed),
      },
      randomBytes: (length) => natives.randomBytes(length),
      removeDir: (path) => natives.deleteAsync(path, { idempotent: true }),
      ...(natives.appVersion ? { userAgent: `Afribit/${natives.appVersion}` } : {}),
      ...(natives.pickImage ? { pickImage: natives.pickImage } : {}),
    },
  };
}
