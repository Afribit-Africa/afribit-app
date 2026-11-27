import { Button, Card, Icon, Screen, Text, color, space } from '@afribit/design';
import * as IntentLauncher from 'expo-intent-launcher';
import * as LocalAuthentication from 'expo-local-authentication';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { strings } from '../../i18n';
import { useShell } from '../../shell/ShellProvider';
import { StepDots } from '../../shell/StepDots';

/**
 * App protection is mandatory to finish setup; biometrics are optional (Product Flow §6).
 * We use the phone's own biometrics or screen lock, so Afribit never stores a PIN itself.
 */
export default function Protection() {
  const { setup, updateSetup } = useShell();
  const t = strings[setup.locale];
  const [level, setLevel] = useState<LocalAuthentication.SecurityLevel | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const check = useCallback(() => {
    void LocalAuthentication.getEnrolledLevelAsync().then(setLevel).catch(() => setLevel(LocalAuthentication.SecurityLevel.NONE));
  }, []);
  useFocusEffect(check);

  const hasLock = level !== null && level !== LocalAuthentication.SecurityLevel.NONE;

  const enable = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: t.protectPrompt, disableDeviceFallback: false });
      if (!r.success) { setFailed(true); return; }
      await updateSetup({ protection: true });
      router.push('/onboarding/wallet');
    } finally {
      setBusy(false);
    }
  };

  const openSettings = () => {
    if (Platform.OS === 'android') void IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.SECURITY_SETTINGS).finally(check);
  };

  return (
    <Screen
      footer={hasLock
        ? <Button testID="protect-enable" label={t.protectEnable} busy={busy} onPress={() => void enable()} icon="finger-print" />
        : (
          <>
            <Button testID="protect-settings" label={t.protectOpenSettings} onPress={openSettings} />
            <Button testID="protect-recheck" label={t.checkAgain} kind="quiet" onPress={check} />
          </>
        )}
    >
      <StepDots step={5} />
      <View style={styles.hero}>
        <Icon name="lock-closed-outline" size={40} tint={color.ink} />
      </View>
      <Text variant="screen">{t.protectTitle}</Text>
      <Text variant="body" tone="muted">{t.protectBody}</Text>
      {level !== null && !hasLock ? (
        <Card>
          <Text variant="section">{t.protectNoLock}</Text>
          <Text variant="supporting" tone="muted">{t.protectNoLockBody}</Text>
        </Card>
      ) : null}
      {failed ? <Text variant="supporting" tone="error">{t.protectFailed}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { width: 72, height: 72, borderRadius: 20, backgroundColor: color.white, borderWidth: 1, borderColor: color.divider, alignItems: 'center', justifyContent: 'center', marginTop: space.l },
});
