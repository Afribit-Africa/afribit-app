const { withGradleProperties } = require('expo/config-plugins');

/**
 * Android 8.0 (API 26) is the lowest the app installs on. The Wallet's native modules require
 * it (the GeeTest module declares minSdk 26), so the manifest merge fails below it. This is a
 * technical floor only: the product floor is the PRD's (Android 10 for the alpha, ADR-033).
 * Expo's Android template reads `android.minSdkVersion` from gradle.properties.
 */
const MIN_SDK = '26';

module.exports = function withMinSdk(config) {
  return withGradleProperties(config, (c) => {
    c.modResults = c.modResults.filter((item) => !(item.type === 'property' && item.key === 'android.minSdkVersion'));
    c.modResults.push({ type: 'property', key: 'android.minSdkVersion', value: MIN_SDK });
    return c;
  });
};

module.exports.MIN_SDK = MIN_SDK;
