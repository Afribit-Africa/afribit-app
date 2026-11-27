import { Card, Icon, Text, color, space } from '@afribit/design';
import type { Locale } from '@afribit/feature-sdk';
import { StyleSheet, View } from 'react-native';
import { strings } from '../i18n';
import type { MeshAlert } from './connectivity';

/**
 * Warning shown when the current Wi-Fi answers as an Afribit Mesh gateway but cannot prove it
 * (S-14), or when an authentic beacon only fails because of the phone clock.
 */
export function MeshAlertCard({ alert, locale }: { alert: MeshAlert; locale: Locale }) {
  if (alert === null) return null;
  const t = strings[locale];
  const impostor = alert === 'impersonation';
  const tint = impostor ? color.error : color.warning;
  return (
    <Card style={{ backgroundColor: impostor ? color.errorTint : color.warningTint, borderColor: tint }}>
      <View testID={`mesh-alert-${alert}`} accessibilityRole="alert" style={styles.row}>
        <Icon name={impostor ? 'warning' : 'time-outline'} size={24} tint={tint} />
        <View style={styles.flex}>
          <Text variant="section" tone={impostor ? 'error' : 'warning'}>{impostor ? t.meshImpostorTitle : t.meshClockTitle}</Text>
          <Text variant="supporting">{impostor ? t.meshImpostorBody : t.meshClockBody}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.m, alignItems: 'flex-start' },
  flex: { flex: 1 },
});
