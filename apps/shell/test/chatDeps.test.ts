/// <reference types="node" />
import Module from 'node:module';
import type { CapabilityOutcome, FeatureContext } from '@afribit/feature-sdk';
import { describe, expect, it, vi } from 'vitest';
import { createChatDeps, type ChatNatives } from '../src/chat/chatDeps';

// The Chat mount pulls in the native engine and the Expo modules; the mapping test
// below loads it for real, so those edges are faked here (C1).
vi.mock('@afribit/feature-chat', () => ({ default: () => null, createChatRuntime: () => ({}) }));
vi.mock('@unomed/react-native-matrix-sdk', () => ({}));
vi.mock('expo-router', () => ({ router: { push: vi.fn(), back: vi.fn() } }));
vi.mock('expo-constants', () => ({ default: { expoConfig: { version: '1.4.2' } } }));
vi.mock('expo-crypto', () => ({
  getRandomBytes: (length: number) => new Uint8Array(length),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async () => '',
}));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
  deleteItemAsync: async () => undefined,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'whenUnlockedThisDeviceOnly',
}));
vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => ({ execAsync: async () => undefined, getFirstAsync: async () => null, runAsync: async () => undefined, closeAsync: async () => undefined }),
  deleteDatabaseAsync: async () => undefined,
}));
vi.mock('expo-file-system/legacy', () => ({
  deleteAsync: async () => undefined,
  documentDirectory: null,
  makeDirectoryAsync: async () => undefined,
  getInfoAsync: async () => ({ exists: false, isDirectory: false }),
}));
vi.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: () => ({}) }, SaveFormat: { JPEG: 'jpeg' } }));
vi.mock('expo-image-picker', () => ({ launchImageLibraryAsync: async () => ({ canceled: true, assets: null }) }));

function fakeStorage(): { map: Map<string, string>; storage: FeatureContext['secureStorage'] } {
  const map = new Map<string, string>();
  return {
    map,
    storage: {
      getItem: vi.fn(async (key: string) => map.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => { map.set(key, value); }),
      removeItem: vi.fn(async (key: string) => { map.delete(key); }),
    },
  };
}

function fakeCtx(overrides: Partial<FeatureContext> = {}): FeatureContext {
  return {
    featureId: 'chat',
    locale: 'en',
    connectivity: { state: 'INTERNET', meshTrust: 'attested', uplink: 'mesh', checkedAt: 1 },
    storage: fakeStorage().storage,
    secureStorage: fakeStorage().storage,
    paths: { dataDir: 'file:///data/features/chat/' },
    request: vi.fn(async (): Promise<CapabilityOutcome> => ({ requestId: 'r', status: 'unavailable', reason: 'wallet-not-ready' })),
    exit: vi.fn(),
    ...overrides,
  };
}

function fakeNatives(overrides: Partial<ChatNatives> = {}): ChatNatives {
  return {
    loadSdk: vi.fn(async () => ({}) as never),
    randomBytes: vi.fn((length: number) => new Uint8Array(length)),
    deleteAsync: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('createChatDeps profile', () => {
  it('maps a profile outcome to npub and nickname', async () => {
    const request = vi.fn(async (): Promise<CapabilityOutcome> => ({ requestId: 'r1', status: 'profile', profile: { npub: 'npub1example', nickname: 'Amina' } }));
    const { host } = createChatDeps(fakeCtx({ request }), fakeNatives());
    await expect(host.profile()).resolves.toEqual({ npub: 'npub1example', nickname: 'Amina' });
    expect(request).toHaveBeenCalledWith({ kind: 'profile.read' });
  });

  it('throws when the profile outcome is unavailable', async () => {
    const request = vi.fn(async (): Promise<CapabilityOutcome> => ({ requestId: 'r1', status: 'unavailable', reason: 'wallet-not-ready' }));
    const { host } = createChatDeps(fakeCtx({ request }), fakeNatives());
    await expect(host.profile()).rejects.toThrow('chat profile is unavailable');
  });

  it('throws when the profile outcome is denied', async () => {
    const request = vi.fn(async (): Promise<CapabilityOutcome> => ({ requestId: 'r1', status: 'denied', reason: 'policy' }));
    const { host } = createChatDeps(fakeCtx({ request }), fakeNatives());
    await expect(host.profile()).rejects.toThrow('chat profile is denied');
  });

  it('throws when the profile has no identity yet', async () => {
    const request = vi.fn(async (): Promise<CapabilityOutcome> => ({ requestId: 'r1', status: 'profile', profile: { npub: null, nickname: '' } }));
    const { host } = createChatDeps(fakeCtx({ request }), fakeNatives());
    await expect(host.profile()).rejects.toThrow('chat identity is not ready');
  });
});

describe('createChatDeps engine', () => {
  it('maps the secrets onto the feature secure storage', async () => {
    const secure = fakeStorage();
    const { engine } = createChatDeps(fakeCtx({ secureStorage: secure.storage }), fakeNatives());
    await engine.secrets.put('matrix.store', 'sealed');
    await expect(engine.secrets.get('matrix.store')).resolves.toBe('sealed');
    await engine.secrets.remove('matrix.store');
    await expect(engine.secrets.get('matrix.store')).resolves.toBeNull();
    expect(secure.storage.setItem).toHaveBeenCalledWith('matrix.store', 'sealed');
    expect(secure.storage.removeItem).toHaveBeenCalledWith('matrix.store');
  });

  it('round-trips through real XChaCha20-Poly1305 with the associated data', () => {
    const { engine } = createChatDeps(fakeCtx(), fakeNatives());
    const key = new Uint8Array(32).fill(1);
    const nonce = new Uint8Array(24).fill(2);
    const aad = new TextEncoder().encode('matrix.store.v1');
    const plaintext = new TextEncoder().encode('mesh hello');
    const sealed = engine.aead.seal(key, nonce, plaintext, aad);
    expect(sealed).not.toEqual(plaintext);
    expect(new TextDecoder().decode(engine.aead.open(key, nonce, sealed, aad))).toBe('mesh hello');
  });

  it('fails to open a tampered sealed value', () => {
    const { engine } = createChatDeps(fakeCtx(), fakeNatives());
    const key = new Uint8Array(32).fill(1);
    const nonce = new Uint8Array(24).fill(2);
    const aad = new TextEncoder().encode('matrix.store.v1');
    const sealed = engine.aead.seal(key, nonce, new TextEncoder().encode('mesh hello'), aad);
    const tampered = Uint8Array.from(sealed);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    expect(() => engine.aead.open(key, nonce, tampered, aad)).toThrow();
  });

  it('forwards the requested random byte count', () => {
    const randomBytes = vi.fn((length: number) => new Uint8Array(length));
    const { engine } = createChatDeps(fakeCtx(), fakeNatives({ randomBytes }));
    expect(engine.randomBytes(24)).toHaveLength(24);
    expect(randomBytes).toHaveBeenCalledWith(24);
  });

  it('removes the directory idempotently', async () => {
    const deleteAsync = vi.fn(async () => undefined);
    const { engine } = createChatDeps(fakeCtx(), fakeNatives({ deleteAsync }));
    await engine.removeDir('/data/features/chat');
    await engine.removeDir('/data/features/chat');
    expect(deleteAsync).toHaveBeenCalledTimes(2);
    expect(deleteAsync).toHaveBeenCalledWith('/data/features/chat', { idempotent: true });
  });

  it('reports the app version as the Matrix user agent', () => {
    const { engine } = createChatDeps(fakeCtx(), fakeNatives({ appVersion: '1.4.2' }));
    expect(engine.userAgent).toBe('Afribit/1.4.2');
  });

  it('omits the user agent when the app version is unknown', () => {
    const { engine } = createChatDeps(fakeCtx(), fakeNatives());
    expect(engine.userAgent).toBeUndefined();
  });

  it('forwards the image picker when present', () => {
    const pickImage = vi.fn(async () => null);
    const { engine } = createChatDeps(fakeCtx(), fakeNatives({ pickImage }));
    expect(engine.pickImage).toBe(pickImage);
  });

  it('omits the image picker when absent', () => {
    const { engine } = createChatDeps(fakeCtx(), fakeNatives());
    expect(engine.pickImage).toBeUndefined();
  });
});

type NodeLoad = (request: string, parent: { filename?: string } | null, isMain: boolean) => unknown;

describe('feature entries', () => {
  it('routes the chat feature id to the Chat mount', async () => {
    const mount = (await import('../src/chat/ChatMount')).default;
    // features.ts loads entries through Metro's lazy `require`; Node's resolver here
    // cannot read a TSX path, so serve that one request from the module Vite loaded.
    const node = Module as unknown as { _load: NodeLoad };
    const original = node._load;
    node._load = (request, parent, isMain) => {
      if (request === './chat/ChatMount' && (parent?.filename ?? '').endsWith('/src/features.ts')) {
        return { default: mount };
      }
      return original(request, parent, isMain);
    };
    try {
      const { FEATURE_ENTRIES } = await import('../src/features');
      expect(FEATURE_ENTRIES.chat?.()).toBe(mount);
    } finally {
      node._load = original;
    }
  });
});

describe('chat grants', () => {
  it('lets Chat send every intent its host and mount send', async () => {
    const { RELEASE_POLICY, FEATURE_MANIFESTS } = await import('../src/release-policy');
    const manifest = FEATURE_MANIFESTS.find((m) => (m as { id?: string }).id === 'chat') as { requestedCapabilities: string[] };
    for (const capability of ['profile.read', 'notify.local', 'wallet.preparePayment']) {
      expect(RELEASE_POLICY.chat?.allowedCapabilities).toContain(capability);
      expect(manifest.requestedCapabilities).toContain(capability);
    }
  });
});
