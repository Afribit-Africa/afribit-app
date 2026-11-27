const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/**
 * Expo's defaults (they already cover the npm workspaces), plus what the built-in Wallet needs:
 * - `.svg` files load as React components (react-native-svg-transformer), not as images;
 * - Node's `stream` and `zlib` resolve to the browser builds `node-libs-react-native` maps them to
 *   (a declared Wallet dependency), as the fork's Metro config did.
 */
const walletDir = path.resolve(__dirname, '../../modules/wallet');
const nodeLibs = require(require.resolve('node-libs-react-native', { paths: [walletDir] }));
const config = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = config.resolver;

config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer/expo'),
};
config.resolver = {
  ...config.resolver,
  assetExts: assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...sourceExts, 'svg'],
  extraNodeModules: {
    ...config.resolver.extraNodeModules,
    stream: nodeLibs.stream,
    zlib: nodeLibs.zlib,
  },
};

module.exports = config;
