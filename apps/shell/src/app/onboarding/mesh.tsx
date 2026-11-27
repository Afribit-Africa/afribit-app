import { Button, Card, Icon, Screen, StatusPill, Text, color, space } from '@afribit/design';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { connectivityLabel, meshTrustLabel, strings } from '../../i18n';
import { useShell } from '../../shell/ShellProvider';
import { StepDots } from '../../shell/StepDots';

export default function Mesh() {
  const { setup, connectivity, probing, refreshConnectivity } = useShell();
  const t = strings[setup.locale];
  const onMesh = connectivity.meshTrust !== 'none';
  const checking = probing && connectivity.checkedAt === 0;

  return (
    <Screen footer={<Button testID="mesh-continue" label={t.continue} onPress={() => router.push('/onboarding/notifications')} />}>
      <StepDots step={3} />
      <View style={styles.hero}>
        <Icon name="git-network-outline" size={40} tint={color.forest} />
      </View>
      <Text variant="screen">{t.meshTitle}</Text>
      <Text variant="body" tone="muted">{t.meshBody}</Text>
      <Card>
        {checking ? (
          <View style={styles.row}>
            <ActivityIndicator color={color.ink} />
            <Text variant="body">{t.meshChecking}</Text>
          </View>
        ) : (
          <>
            <StatusPill
              label={onMesh ? t.meshFound : t.meshNotFound}
              tone={onMesh ? 'positive' : 'neutral'}
              icon={onMesh ? 'shield-checkmark' : 'wifi-outline'}
            />
            <Text variant="supporting" tone="muted">
              {onMesh ? meshTrustLabel(connectivity.meshTrust, setup.locale) : t.meshNotFoundBody}
            </Text>
            <Text variant="supporting" tone="muted">{connectivityLabel(connectivity.state, setup.locale)}</Text>
          </>
        )}
        <Button testID="mesh-recheck" label={t.checkAgain} kind="secondary" busy={probing} onPress={() => void refreshConnectivity()} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { width: 72, height: 72, borderRadius: 20, backgroundColor: color.forestTint, alignItems: 'center', justifyContent: 'center', marginTop: space.l },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m },
});
