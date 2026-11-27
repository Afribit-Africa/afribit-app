/// <reference types="node" />
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExpoConfig } from 'expo/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

const SHELL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WALLET_KEYS = ['BREEZ_API_KEY', 'SPARK_TOKEN_IDENTIFIER', 'SPARK_REGTEST_TOKEN_IDENTIFIER', 'AFRIBIT_LNURL_DOMAIN',
  'AFRIBIT_LNURL_DOMAIN_REGTEST', 'AFRIBIT_LNURL_PAY_DOMAIN_REGTEST', 'AFRIBIT_LNURL_ALIASES', 'AFRIBIT_MFA_REQUIRED',
  'GEO_IPIFY_API_KEY', 'IPINFO_API_KEY', 'PROXYCHECK_API_KEY', 'IPAPI_API_KEY', 'IGNORE_LOGS'];
const WALLET_FONTS = join(SHELL, '../../modules/wallet/app/assets/fonts');

async function loadConfig(env: Record<string, string | undefined>): Promise<ExpoConfig> {
  vi.resetModules();
  // Start from a clean build environment: the config treats an empty value as unset.
  for (const key of WALLET_KEYS) vi.stubEnv(key, '');
  vi.stubEnv('APP_VARIANT', '');
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value as string);
  return (await import('../app.config')).default;
}

function fontPlugin(config: ExpoConfig): string[] {
  const entry = config.plugins?.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-font');
  return ((entry as [string, { fonts: string[] }] | undefined)?.[1].fonts) ?? [];
}

afterEach(() => vi.unstubAllEnvs());

describe('app config: built-in Wallet (W1-2c)', () => {
  it('bundles every wallet font, and every bundled font exists', async () => {
    const fonts = fontPlugin(await loadConfig({}));
    for (const file of fonts) expect(existsSync(join(SHELL, file)), file).toBe(true);

    const shipped = readdirSync(WALLET_FONTS).filter((name) => name.endsWith('.ttf'));
    const listed = fonts.map((file) => file.split('/').pop());
    for (const name of shipped) expect(listed).toContain(name);
  });

  it('passes only the allow-listed wallet settings that are set', async () => {
    const config = await loadConfig({ BREEZ_API_KEY: 'test-key', IPINFO_API_KEY: '', NOT_A_WALLET_KEY: 'x' });
    expect(config.extra?.wallet).toEqual({ BREEZ_API_KEY: 'test-key' });
  });

  it('refuses a production build that switches MFA off', async () => {
    await expect(loadConfig({ APP_VARIANT: 'production', AFRIBIT_MFA_REQUIRED: 'false' })).rejects.toThrow(
      /AFRIBIT_MFA_REQUIRED/,
    );
  });

  it('lets a test build switch MFA off', async () => {
    const config = await loadConfig({ APP_VARIANT: 'preview', AFRIBIT_MFA_REQUIRED: 'false' });
    expect(config.extra?.wallet).toEqual({ AFRIBIT_MFA_REQUIRED: 'false' });
  });
});

describe('app config: payment link schemes (W1 follow-up)', () => {
  it('registers afribit first, then the payment schemes', async () => {
    const { scheme } = await loadConfig({});
    expect(scheme).toEqual(['afribit', 'lightning', 'bitcoin', 'lnurl']);
  });

  it('registers exactly the schemes the shell turns into Wallet hand-offs', async () => {
    const { scheme } = await loadConfig({});
    const { PAYMENT_SCHEMES } = await import('../src/wallet/systemLinkCore');
    expect(scheme).toEqual(['afribit', ...PAYMENT_SCHEMES]);
  });
});

describe('app config: loadable by Expo', () => {
  it('imports nothing from the app sources, which Expo cannot load at build time', () => {
    const source = readFileSync(join(SHELL, 'app.config.ts'), 'utf8');
    const relative = [...source.matchAll(/from\s+'(\.[^']*)'/g)].map((m) => m[1]);
    expect(relative.filter((path) => path?.startsWith('./src') || path?.startsWith('../'))).toEqual([]);
  });
});

describe('app config: Android floor', () => {
  it('raises minSdk to 26, which the Wallet native modules need for the manifest merge', async () => {
    const config = await loadConfig({});
    expect(config.plugins).toContain('./plugins/withMinSdk');
    const { MIN_SDK } = await import('../plugins/withMinSdk');
    expect(Number(MIN_SDK)).toBeGreaterThanOrEqual(26);
  });
});

describe('app config: Wallet R8 rules', () => {
  it('ports the fork rules that stop R8 failing on the fingerprint library and stripping Room', async () => {
    const config = await loadConfig({});
    expect(config.plugins).toContain('./plugins/withWalletProguard');
    const { RULES } = await import('../plugins/withWalletProguard');
    for (const rule of ['-dontwarn android.hardware.fingerprint.**', '-dontwarn com.samsung.**', '-keep class com.geetest.sdk.** { *; }', '-keep class androidx.work.impl.WorkDatabase_Impl']) {
      expect(RULES).toContain(rule);
    }
  });
});

describe('app config: library compileSdk', () => {
  it('raises a library that pins an old compileSdk to the app SDK', async () => {
    const config = await loadConfig({});
    expect(config.plugins).toContain('./plugins/withLibraryCompileSdk');
    const { BLOCK } = await import('../plugins/withLibraryCompileSdk');
    expect(BLOCK).toContain('rootProject.ext.compileSdkVersion');
    expect(BLOCK).toContain('current < target');
  });
});

describe('app config: Android permissions', () => {
  it('asks for the camera, for QR scanning, and blocks media reads the photo picker does not need', async () => {
    const { android } = await loadConfig({});
    expect(android?.permissions).toContain('android.permission.CAMERA');
    for (const blocked of ['android.permission.READ_MEDIA_IMAGES', 'android.permission.READ_MEDIA_VIDEO', 'android.permission.RECORD_AUDIO']) {
      expect(android?.blockedPermissions).toContain(blocked);
    }
  });
});
