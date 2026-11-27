const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const MARKER = '# afribit: built-in Wallet keep rules';

/**
 * R8 rules the built-in Wallet needs, ported from the wallet fork's proguard-rules.pro (W1).
 * - Fingerprint: react-native-fingerprint-scanner's fingerprintidentify and Samsung Pass refer to
 *   android.hardware.fingerprint and com.samsung classes the current SDK does not have, so R8
 *   stops on them as missing classes. They are only reached on the old devices that have them.
 * - GeeTest, EventBus, SVG, Hermes and JNI classes are reached by reflection or from native code.
 * - Room: full-mode R8 strips WorkManager's reflective WorkDatabase_Impl constructor, which
 *   crashes InitializationProvider at launch.
 */
const RULES = `
${MARKER}
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }
-keep public class com.horcrux.svg.** { *; }
-dontwarn com.geetest.sdk.**
-keep class com.geetest.sdk.** { *; }
-keepattributes *Annotation*
-keepclassmembers class ** {
  @org.greenrobot.eventbus.Subscribe <methods>;
}
-keep enum org.greenrobot.eventbus.ThreadMode { *; }
-dontwarn com.samsung.**
-keep class com.samsung.** { *; }
-dontwarn androidx.privacysandbox.ads.**
-dontwarn com.google.android.gms.ads.identifier.**
-dontwarn android.hardware.fingerprint.**
-keepclassmembers class * extends androidx.room.RoomDatabase { public <init>(); }
-keep class androidx.work.impl.WorkDatabase_Impl
`;

module.exports = function withWalletProguard(config) {
  return withDangerousMod(config, [
    'android',
    async (c) => {
      const file = path.join(c.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (!current.includes(MARKER)) fs.writeFileSync(file, `${current.replace(/\s*$/, '\n')}${RULES}`);
      return c;
    },
  ]);
};

module.exports.RULES = RULES;
