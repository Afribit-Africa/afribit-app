import { Button, Icon, Screen, Text, color, space } from '@afribit/design';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { strings } from '../../i18n';
import { useShell } from '../../shell/ShellProvider';
import { StepDots } from '../../shell/StepDots';

/** Explains the purpose first, then asks once. "Not now" is a first-class answer (Product Flow §5). */
export default function NotificationsStep() {
  const { setup, updateSetup } = useShell();
  const t = strings[setup.locale];
  const [busy, setBusy] = useState(false);

  const allow = async () => {
    setBusy(true);
    try {
      const r = await Notifications.requestPermissionsAsync();
      await updateSetup({ notifications: r.granted ? 'allowed' : 'declined' });
    } catch {
      await updateSetup({ notifications: 'declined' });
    } finally {
      setBusy(false);
    }
    router.push('/onboarding/protection');
  };

  const later = async () => {
    await updateSetup({ notifications: 'declined' });
    router.push('/onboarding/protection');
  };

  return (
    <Screen
      footer={
        <>
          <Button testID="notif-allow" label={t.notifAllow} busy={busy} onPress={() => void allow()} />
          <Button testID="notif-later" label={t.skip} kind="quiet" onPress={() => void later()} />
        </>
      }
    >
      <StepDots step={4} />
      <View style={styles.hero}>
        <Icon name="notifications-outline" size={40} tint={color.ink} />
      </View>
      <Text variant="screen">{t.notifTitle}</Text>
      <Text variant="body" tone="muted">{t.notifBody}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { width: 72, height: 72, borderRadius: 20, backgroundColor: color.white, borderWidth: 1, borderColor: color.divider, alignItems: 'center', justifyContent: 'center', marginTop: space.l },
});
