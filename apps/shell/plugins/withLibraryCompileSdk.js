const { withProjectBuildGradle } = require('expo/config-plugins');

const MARKER = '// afribit: libraries compile against the app SDK';

/**
 * Some of the Wallet's libraries pin an old compileSdk: react-native-image-picker 7.1.2
 * hardcodes 33. React Native 0.88 and current AndroidX need 34 or later, so the AAR metadata
 * check fails. As in the wallet fork's root build.gradle, a library compiling below the app's
 * compileSdk is raised to it. This hook is registered before the libraries are evaluated, so it
 * runs ahead of the Android plugin's own afterEvaluate. compileSdk only picks the API stubs
 * the code compiles against; it does not change the library's minSdk or its behaviour.
 */
const BLOCK = `
${MARKER}
subprojects { sub ->
  def raise = {
    if (sub.plugins.hasPlugin('com.android.library')) {
      def target = rootProject.ext.compileSdkVersion as Integer
      def current = sub.android.compileSdk
      if (current == null || current < target) sub.android.compileSdk = target
    }
  }
  if (sub.state.executed) raise() else sub.afterEvaluate { raise() }
}
`;

module.exports = function withLibraryCompileSdk(config) {
  return withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      throw new Error('withLibraryCompileSdk expects a Groovy android/build.gradle');
    }
    if (!mod.modResults.contents.includes(MARKER)) mod.modResults.contents += BLOCK;
    return mod;
  });
};

module.exports.BLOCK = BLOCK;
