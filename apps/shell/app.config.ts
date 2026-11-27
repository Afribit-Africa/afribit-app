import type { ExpoConfig } from 'expo/config';

/**
 * Variants (see docs/../AFRIBIT_OS_EXPO_BUILD_AND_PUBLISHING_PLAN): separate app ids so a
 * test build can never be mistaken for production. The production id is permanent once on Play.
 */
type Variant = 'development' | 'preview' | 'production';
const variant = (process.env.APP_VARIANT || 'development') as Variant;
const suffix = { development: '.dev', preview: '.preview', production: '' }[variant];
const nameSuffix = { development: ' Dev', preview: ' Preview', production: '' }[variant];

/**
 * Build settings the built-in Wallet reads as `Config.NAME` (its react-native-config stand-in reads
 * `extra.wallet`). Only these names are passed, and only when the build environment sets them;
 * nothing here is committed.
 */
const WALLET_CONFIG_KEYS = [
  'BREEZ_API_KEY',
  'SPARK_TOKEN_IDENTIFIER',
  'SPARK_REGTEST_TOKEN_IDENTIFIER',
  'AFRIBIT_LNURL_DOMAIN',
  'AFRIBIT_LNURL_DOMAIN_REGTEST',
  'AFRIBIT_LNURL_PAY_DOMAIN_REGTEST',
  'AFRIBIT_LNURL_ALIASES',
  'AFRIBIT_MFA_REQUIRED',
  'GEO_IPIFY_API_KEY',
  'IPINFO_API_KEY',
  'PROXYCHECK_API_KEY',
  'IPAPI_API_KEY',
  'IGNORE_LOGS',
] as const;

function walletConfig(): Record<string, string> {
  // MFA is compulsory (W-D11). Only a test build may switch it off; a production build refuses.
  if (variant === 'production' && process.env.AFRIBIT_MFA_REQUIRED !== undefined && process.env.AFRIBIT_MFA_REQUIRED !== '') {
    throw new Error('AFRIBIT_MFA_REQUIRED must not be set for a production build');
  }
  const out: Record<string, string> = {};
  for (const key of WALLET_CONFIG_KEYS) {
    const value = process.env[key];
    if (value !== undefined && value !== '') out[key] = value;
  }
  return out;
}

const WALLET_FONTS = [
  '../../modules/wallet/app/assets/fonts/DMSans-Bold.ttf',
  '../../modules/wallet/app/assets/fonts/Manrope-Medium.ttf',
  '../../modules/wallet/app/assets/fonts/Manrope-Regular.ttf',
  '../../modules/wallet/app/assets/fonts/Manrope-SemiBold.ttf',
  '../../modules/wallet/app/assets/fonts/SourceSansPro-Bold.ttf',
  '../../modules/wallet/app/assets/fonts/SourceSansPro-BoldItalic.ttf',
  '../../modules/wallet/app/assets/fonts/SourceSansPro-Italic.ttf',
  '../../modules/wallet/app/assets/fonts/SourceSansPro-Regular.ttf',
  '../../node_modules/react-native-vector-icons/Fonts/Ionicons.ttf',
  '../../node_modules/react-native-vector-icons/Fonts/MaterialIcons.ttf',
];

const config: ExpoConfig = {
  name: `Afribit${nameSuffix}`,
  slug: 'afribit-os',
  owner: 'afribit-africa',
  version: '0.2.0',
  // `afribit` keeps the shell's own links working; the payment schemes let other apps open a
  // payment link in the built-in Wallet (Android intent filters, iPhone URL types). Listed here,
  // not imported: Expo loads this file on its own and cannot load the app's TypeScript sources.
  // A test keeps the list equal to PAYMENT_SCHEMES in src/wallet/systemLinkCore.ts.
  scheme: ['afribit', 'lightning', 'bitcoin', 'lnurl'],
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'light',
  backgroundColor: '#F7F8F7',
  android: {
    package: `africa.afribit.os${suffix}`,
    versionCode: 3,
    adaptiveIcon: { foregroundImage: './assets/images/adaptive-foreground.png', backgroundColor: '#FFFFFF' },
    // Keys, identities and per-app data must not leave the phone through Android auto-backup.
    allowBackup: false,
    // Camera: scanning payment QR codes in Wallet and contact QR codes in Chat.
    permissions: ['android.permission.USE_BIOMETRIC', 'android.permission.POST_NOTIFICATIONS', 'android.permission.CAMERA'],
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_CONTACTS',
      // Photos come through the system photo picker, which needs no media permission.
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      // Added by a library; a signature permission an ordinary app is never granted.
      'android.permission.DUMP',
    ],
    predictiveBackGestureEnabled: false,
  },
  ios: {
    bundleIdentifier: `africa.afribit.os${suffix}`,
    supportsTablet: false,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: 'Afribit uses the camera to scan payment QR codes in Wallet and contact QR codes in Chat.',
    },
  },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { backgroundColor: '#FFFFFF', image: './assets/images/splash-symbol.png', imageWidth: 96 }],
    'expo-secure-store',
    ['expo-local-authentication', { faceIDPermission: 'Afribit uses Face ID to protect your apps.' }],
    'expo-sqlite',
    ['expo-notifications', { color: '#111312' }],
    ['expo-font', { fonts: WALLET_FONTS }],
    'expo-web-browser',
    // Photos for Chat (and QR screenshots for Wallet): the system photo picker only. No camera or
    // microphone through this module.
    ['expo-image-picker', { photosPermission: 'Afribit lets you choose photos to send in Chat, or a screenshot of a QR code to pay in Wallet.', cameraPermission: false, microphonePermission: false }],
    // Wallet: read NFC payment cards (LNURL-withdraw) to receive. Tag reading only, as in the fork.
    ['react-native-nfc-manager', { nfcPermission: 'Afribit Wallet reads NFC payment cards to receive payments.', includeNdefEntitlement: false }],
    'expo-status-bar',
    './plugins/withReleaseNativeFlags',
    './plugins/withMinSdk',
    './plugins/withWalletProguard',
    './plugins/withLibraryCompileSdk',
  ],
  experiments: { typedRoutes: false },
  // EAS project afribit-africa/afribit-os (created 2026-11-25; cloud Android and iOS builds).
  extra: { eas: { projectId: '62b5160b-ff37-41ed-b4e7-8be71347e8e0' }, wallet: walletConfig() },
};

export default config;
