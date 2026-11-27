const path = require('path');

/**
 * Expo's preset, plus the built-in Wallet's import alias: its sources (modules/wallet) import
 * each other as `@app/...`. The alias points only there, so no other package can be redirected.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [['module-resolver', { alias: { '@app': path.resolve(__dirname, '../../modules/wallet/app') } }]],
  };
};
