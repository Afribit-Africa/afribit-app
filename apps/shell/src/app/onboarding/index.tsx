import { Button, Icon, Screen, Stack, Text, color, space } from '@afribit/design';
import { router } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';
import { strings } from '../../i18n';
import { useShell } from '../../shell/ShellProvider';
import { StepDots } from '../../shell/StepDots';

export default function Welcome() {
  const { setup } = useShell();
  const t = strings[setup.locale];
  const icons = ['apps-outline', 'wifi-outline', 'person-outline'] as const;
  return (
    <Screen footer={<Button testID="welcome-start" label={t.start} onPress={() => router.push('/onboarding/language')} />}>
      <StepDots step={0} />
      <View style={styles.logoCanvas}>
        <Image source={require('../../../assets/images/afribit-symbol.png')} style={styles.logo} accessibilityLabel="Afribit" />
      </View>
      <Text variant="welcome">{t.welcomeTitle}</Text>
      <Text variant="body" tone="muted">{t.welcomeBody}</Text>
      <Stack gap={space.m} style={styles.points}>
        {t.welcomePoints.map((p, i) => (
          <View key={p} style={styles.point}>
            <Icon name={icons[i] ?? 'checkmark-outline'} size={22} tint={color.forest} />
            <Text variant="body" style={styles.flex}>{p}</Text>
          </View>
        ))}
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logoCanvas: { width: 96, height: 96, borderRadius: 24, backgroundColor: color.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.divider, marginTop: space.xl },
  logo: { width: 64, height: 64 },
  points: { marginTop: space.l },
  point: { flexDirection: 'row', gap: space.m, alignItems: 'center' },
  flex: { flex: 1 },
});
