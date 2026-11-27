import { Button, Icon, Screen, Text, color, space } from '@afribit/design';
import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { strings } from '../../i18n';
import { useShell } from '../../shell/ShellProvider';
import { StepDots } from '../../shell/StepDots';

/**
 * SH-10 (S-13): one optional, skippable step. The Wallet is built into Afribit (S-17), so this
 * step opens it after setup; when the Wallet is unavailable the step is skipped. Nothing is
 * created here.
 */
export default function WalletStep() {
  const shell = useShell();
  const t = strings[shell.setup.locale];
  const a = shell.availabilityOf('wallet');
  if (a.status === 'unavailable') {
    return <Redirect href="/onboarding/done" />;
  }

  const setUp = () => {
    router.push({ pathname: '/onboarding/done', params: { next: 'wallet' } });
  };

  return (
    <Screen
      footer={
        <>
          <Button testID="wallet-setup" label={t.walletSetUp} icon="wallet-outline" onPress={setUp} />
          <Button testID="wallet-later" label={t.skip} kind="quiet" onPress={() => router.push('/onboarding/done')} />
        </>
      }
    >
      <StepDots step={6} />
      <View style={styles.hero}>
        <Icon name="wallet-outline" size={40} tint={color.ink} />
      </View>
      <Text variant="screen">{t.walletTitle}</Text>
      <Text variant="body" tone="muted">{t.walletBody}</Text>
      <View style={styles.points}>
        {t.walletPoints.map((p) => (
          <View key={p} style={styles.point}>
            <Icon name="shield-checkmark-outline" size={20} tint={color.forest} />
            <Text variant="supporting" style={styles.flex}>{p}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { width: 72, height: 72, borderRadius: 20, backgroundColor: color.white, borderWidth: 1, borderColor: color.divider, alignItems: 'center', justifyContent: 'center', marginTop: space.l },
  points: { gap: space.m },
  point: { flexDirection: 'row', gap: space.s, alignItems: 'center' },
  flex: { flex: 1 },
});
