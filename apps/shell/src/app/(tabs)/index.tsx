import { AppTile, Button, Card, Icon, ListRow, Screen, StatusPill, Text, color, space, type IconName, type PillTone } from '@afribit/design';
import type { ConnectivityState } from '@afribit/feature-sdk';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { availabilityLabel, connectivityLabel, pick, strings } from '../../i18n';
import { FEATURE_LOOK } from '../../release-policy';
import { openFeature } from '../../shell/openFeature';
import { MeshAlertCard } from '../../shell/MeshAlertCard';
import { useShell } from '../../shell/ShellProvider';

const STATE_TONE: Record<ConnectivityState, PillTone> = {
  INTERNET: 'positive', DEGRADED: 'warning', LOCAL_ONLY: 'positive', OFFLINE: 'neutral', UNTRUSTED_PORTAL: 'warning',
};

/** Afribit Home: a hub for apps, not a dashboard (Product Flow §1, PRD §3.2). */
export default function Home() {
  const shell = useShell();
  const { setup, connectivity, registry } = shell;
  const t = strings[setup.locale];
  const visible = registry.features.filter((f) => f.enabled);
  const rows: (typeof visible)[] = [];
  for (let i = 0; i < visible.length; i += 2) rows.push(visible.slice(i, i + 2));
  const last = shell.lastAppId ? registry.get(shell.lastAppId) : undefined;
  const onMesh = connectivity.meshTrust !== 'none';

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <Image source={require('../../../assets/images/afribit-symbol.png')} style={styles.logo} accessibilityLabel="Afribit" />
          <Text variant="section">{t.greeting(setup.nickname)}</Text>
        </View>
        <Pressable testID="home-profile" accessibilityRole="button" accessibilityLabel={t.tabProfile} onPress={() => router.navigate('/profile')} hitSlop={8} style={styles.avatar}>
          <Text variant="button">{setup.nickname.slice(0, 1).toUpperCase()}</Text>
        </Pressable>
      </View>

      <Pressable testID="home-connectivity" accessibilityRole="button" onPress={() => router.navigate('/connect')} style={styles.statusRow}>
        <StatusPill
          label={onMesh ? `Afribit Mesh · ${connectivityLabel(connectivity.state, setup.locale)}` : connectivityLabel(connectivity.state, setup.locale)}
          tone={STATE_TONE[connectivity.state]}
          icon={onMesh ? 'shield-checkmark' : connectivity.state === 'OFFLINE' ? 'cloud-offline-outline' : 'wifi'}
        />
        {shell.simulatedMesh ? <StatusPill label={t.simulated} tone="warning" /> : null}
      </Pressable>

      <MeshAlertCard alert={shell.meshAlert} locale={setup.locale} />

      <Text variant="welcome">{t.homePrompt}</Text>

      <View style={styles.grid}>
        {rows.map((row) => (
          <View key={row.map((f) => f.manifest.id).join()} style={styles.gridRow}>
            {row.map((f) => {
              const id = f.manifest.id;
              const look = FEATURE_LOOK[id] ?? { icon: 'apps', accent: color.ink };
              return (
                <AppTile
                  key={id}
                  testID={`tile-${id}`}
                  title={pick(f.manifest.displayName, setup.locale)}
                  subtitle={pick(f.manifest.tagline, setup.locale)}
                  icon={look.icon as IconName}
                  accent={look.accent}
                  status={availabilityLabel(shell.availabilityOf(id), setup.locale)}
                  onPress={() => openFeature(shell, id)}
                />
              );
            })}
            {row.length === 1 ? <View style={styles.spacer} /> : null}
          </View>
        ))}
      </View>

      {last && shell.availabilityOf(last.manifest.id).status !== 'unavailable' ? (
        <Card>
          <ListRow
            testID="home-resume"
            icon={(FEATURE_LOOK[last.manifest.id]?.icon ?? 'apps') as IconName}
            title={t.resume}
            detail={pick(last.manifest.displayName, setup.locale)}
            onPress={() => openFeature(shell, last.manifest.id)}
          />
        </Card>
      ) : null}

      <Button testID="home-all-apps" label={t.allApps} kind="secondary" icon="grid-outline" onPress={() => router.navigate('/apps')} />
      <View style={styles.footNote}>
        <Icon name="shield-outline" size={16} tint={color.muted} />
        <Text variant="supporting" tone="muted" style={styles.flex}>{t.appsBody}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  logo: { width: 36, height: 36 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: color.white, borderWidth: 1, borderColor: color.divider, alignItems: 'center', justifyContent: 'center' },
  statusRow: { flexDirection: 'row', gap: space.s, minHeight: 32, alignItems: 'center' },
  grid: { gap: space.m },
  gridRow: { flexDirection: 'row', gap: space.m },
  spacer: { flex: 1 },
  footNote: { flexDirection: 'row', gap: space.s, alignItems: 'flex-start' },
  flex: { flex: 1 },
});
