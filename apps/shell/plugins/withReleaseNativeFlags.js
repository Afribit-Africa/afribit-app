const { withProjectBuildGradle } = require('expo/config-plugins');

const MARKER = '// afribit: release C++ without debug info';

/**
 * Library C++ in release builds compiles without debug info (-g), one file at a time.
 *
 * Android builds release native code as RelWithDebInfo. The Matrix SDK's generated bindings
 * (one 2.8 MB file) need over 6 GB in clang: measured 6.27 GB at -O0 and 6.36 GB at -O1, so
 * the optimisation level barely matters. The build host therefore compiles that one library
 * on its own, before Gradle runs, because it cannot share a memory cap with the Gradle JVM.
 * It stays at -O1, since its C++ is only the JSI glue around the precompiled Rust engine.
 * Every other library stays at -O2. Each library also compiles one file at a time (a Ninja
 * job pool), so parallel compiles do not add up. The shipped APK strips these symbols anyway.
 */
const BLOCK = `
${MARKER}
subprojects { sub ->
  sub.plugins.withId('com.android.library') {
    def opt = sub.name == 'unomed_react-native-matrix-sdk' ? '-O1' : '-O2'
    sub.android.defaultConfig.externalNativeBuild.cmake.arguments(
      "-DCMAKE_C_FLAGS_RELWITHDEBINFO=\${opt} -DNDEBUG".toString(),
      "-DCMAKE_CXX_FLAGS_RELWITHDEBINFO=\${opt} -DNDEBUG".toString(),
      '-DCMAKE_JOB_POOLS=compile=1',
      '-DCMAKE_JOB_POOL_COMPILE=compile'
    )
  }
}
`;

module.exports = function withReleaseNativeFlags(config) {
  return withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      throw new Error('withReleaseNativeFlags expects a Groovy android/build.gradle');
    }
    if (!mod.modResults.contents.includes(MARKER)) mod.modResults.contents += BLOCK;
    return mod;
  });
};
