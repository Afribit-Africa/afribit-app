import { Button, Icon, Screen, Text, color, space } from '@afribit/design';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { strings } from '../../i18n';
import { pendingRoute } from '../../shell/pendingRoute';
import { useShell } from '../../shell/ShellProvider';
import { StepDots } from '../../shell/StepDots';

export default function Done() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { setup, updateSetup, ensureIdentity } = useShell();
  const t = strings[setup.locale];
  const [finishing, setFinishing] = useState(false);

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      // The device key must exist before setup is marked complete. If it cannot be
      // created, say so and stay here rather than leave without an identity.
      const identity = await ensureIdentity();
      if (!identity.ok) {
        Alert.alert(t.identityKey, t.identityError);
        return;
      }
      // The Wallet step's "Set up" opens the built-in Wallet on top of Home; it replaces a link
      // kept during onboarding, since the user chose it last.
      if (next === 'wallet') pendingRoute.put('/app/wallet');
      // Completing setup turns onboarding into a redirect to Home, which then opens the kept
      // route, if any.
      await updateSetup({ completed: true });
    } finally {
      setFinishing(false);
    }
  };
  return (
    <Screen footer={<Button testID="done-home" label={t.goHome} busy={finishing} onPress={() => void finish()} />}>
      <StepDots step={7} />
      <View style={styles.hero}>
        <Icon name="checkmark" size={44} tint={color.forest} />
      </View>
      <Text variant="welcome">{t.doneTitle(setup.nickname)}</Text>
      <Text variant="body" tone="muted">{t.doneBody}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { width: 80, height: 80, borderRadius: 40, backgroundColor: color.forestTint, alignItems: 'center', justifyContent: 'center', marginTop: space.xl },
});
