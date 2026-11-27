import { Button, Icon, Screen, Text, color } from '@afribit/design';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Camera, CameraType } from 'react-native-camera-kit';
import { PERMISSIONS, RESULTS, openSettings, request, type PermissionStatus } from 'react-native-permissions';
import { SafeAreaView } from 'react-native-safe-area-context';
import { strings } from '../i18n';
import { contactScan } from '../shell/qrBridge';
import { useShell } from '../shell/ShellProvider';

/** The shell owns the camera: this screen scans one contact QR and hands the string to Chat. */
export default function Scan() {
  const { setup } = useShell();
  const t = strings[setup.locale];
  const [status, setStatus] = useState<PermissionStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const handled = useRef(false);
  const allowed = status === RESULTS.GRANTED || status === RESULTS.LIMITED;

  useEffect(() => {
    const permission = Platform.OS === 'ios' ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA;
    let active = true;
    // A rejected prompt is a distinct failure, not a refusal: never show it as one.
    request(permission).then(
      result => { if (active) setStatus(result); },
      () => { if (active) setFailed(true); },
    );
    return () => { active = false; };
  }, []);

  // Leaving the screen any other way (gesture, navigation) still cancels the pending scan.
  useEffect(() => () => { contactScan.resolve(null); }, []);

  const read = (value: string) => {
    if (handled.current) return;
    handled.current = true;
    contactScan.resolve(value);
    router.back();
  };

  if (!allowed) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <Text variant="screen">{t.scanTitle}</Text>
          {failed ? (
            <Text tone="muted" style={styles.body}>{t.scanFailed}</Text>
          ) : status === null ? <ActivityIndicator color={color.forest} /> : (
            <>
              <Text tone="muted" style={styles.body}>{t.scanCameraBody}</Text>
              <Button label={t.scanOpenSettings} kind="secondary" onPress={() => void openSettings()} />
            </>
          )}
          <Button label={t.back} kind="quiet" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <View style={styles.root}>
      <Camera
        style={StyleSheet.absoluteFill}
        cameraType={CameraType.Back}
        scanBarcode
        showFrame={false}
        onReadCode={event => read(event.nativeEvent.codeStringValue)}
      />
      <SafeAreaView style={styles.overlay} edges={['top']} pointerEvents="box-none">
        <Pressable accessibilityRole="button" accessibilityLabel={t.back} onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Icon name="chevron-back" size={20} tint={color.white} />
          <Text variant="button" tone="white">{t.back}</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12, alignSelf: 'flex-start' },
  center: { flex: 1, justifyContent: 'center', gap: 16, paddingHorizontal: 24 },
  body: { marginBottom: 4 },
});
