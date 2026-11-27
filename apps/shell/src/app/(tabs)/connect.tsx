import { Button, Card, Divider, Icon, ListRow, Screen, StatusPill, Text, color, space, type IconName } from '@afribit/design';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Fragment } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { availabilityLabel, connectivityLabel, meshTrustLabel, pick, strings } from '../../i18n';
import { FEATURE_LOOK } from '../../release-policy';
import { MeshAlertCard } from '../../shell/MeshAlertCard';
import { loadMeshCredentials, type MeshCredentials } from '../../shell/meshCredentials';
import { networkServices, type NetworkNeed } from '../../shell/networkServicesCore';
import { useShell } from '../../shell/ShellProvider';

const PASS_URL = 'https://wifi.afribit.africa';

const NEED_TEXT: Record<NetworkNeed, 'networkWorksOffline' | 'networkNeedsInternet' | 'networkWorksOnMesh' | 'networkNeedsInternetOrMesh'> = {
  offline: 'networkWorksOffline',
  internet: 'networkNeedsInternet',
  mesh: 'networkWorksOnMesh',
  'internet-or-mesh': 'networkNeedsInternetOrMesh',
};

/** Connect: honest network state + Afribit Mesh trust (PRD M01). */
export default function Connect() {
  const shell = useShell();
  const { setup, connectivity, probing, registry, availabilityOf } = shell;
  const t = strings[setup.locale];
  const onMesh = connectivity.meshTrust !== 'none';
  const { services, paymentNotice } = networkServices(registry.features, availabilityOf, connectivity);
  const checked = connectivity.checkedAt > 0
    ? new Date(connectivity.checkedAt).toLocaleTimeString(setup.locale === 'sw' ? 'sw-KE' : 'en-KE', { hour: '2-digit', minute: '2-digit' })
    : '–';

  // Buy in the app when the Mesh has joined this phone; otherwise keep the portal for the not-joined case.
  const onBuy = async () => {
    let credentials: MeshCredentials | null;
    try {
      credentials = await loadMeshCredentials();
    } catch {
      // A locked or broken keychain is a real failure, not "not joined": tell the user instead of opening the portal.
      Alert.alert(t.passesReadFailed);
      return;
    }
    if (credentials) router.push('/connect/buy');
    else await WebBrowser.openBrowserAsync(PASS_URL);
  };

  return (
    <Screen edges={['top']}>
      <Text variant="screen">{t.connectTitle}</Text>
      <MeshAlertCard alert={shell.meshAlert} locale={setup.locale} />
      <Card>
        <View style={styles.hero}>
          <View style={[styles.badge, { backgroundColor: onMesh ? color.forestTint : color.paper }]}>
            <Icon name={onMesh ? 'shield-checkmark' : 'git-network-outline'} size={28} tint={onMesh ? color.forest : color.muted} />
          </View>
          <View style={styles.flex}>
            <Text variant="section">{onMesh ? t.meshFound : t.meshNotFound}</Text>
            <Text variant="supporting" tone="muted">{onMesh ? meshTrustLabel(connectivity.meshTrust, setup.locale) : t.meshNotFoundBody}</Text>
          </View>
        </View>
        {shell.simulatedMesh ? <StatusPill label={t.simulated} tone="warning" /> : null}
        <Divider />
        <ListRow icon="globe-outline" title={connectivityLabel(connectivity.state, setup.locale)} detail={`${t.lastChecked}: ${checked}`} />
        <ListRow icon="key-outline" title={t.meshTrustLabel} detail={meshTrustLabel(connectivity.meshTrust, setup.locale)} />
        <Button testID="connect-recheck" label={t.checkAgain} kind="secondary" busy={probing} onPress={() => void shell.refreshConnectivity()} />
      </Card>
      <Text variant="section">{t.connectWhatWorks}</Text>
      <Card>
        {services.map((s, i) => {
          const feature = registry.get(s.id);
          if (!feature) return null;
          const status = availabilityLabel(availabilityOf(s.id), setup.locale);
          return (
            <Fragment key={s.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                testID={`connect-works-${s.id}`}
                icon={(FEATURE_LOOK[s.id]?.icon ?? 'apps') as IconName}
                title={pick(feature.manifest.displayName, setup.locale)}
                detail={t[NEED_TEXT[s.need]]}
                trailing={status ? <StatusPill label={status.label} tone={status.tone} /> : undefined}
                onPress={s.usable ? () => router.push({ pathname: '/service/[id]', params: { id: s.id } }) : undefined}
              />
            </Fragment>
          );
        })}
        {paymentNotice ? <Text variant="supporting" tone="muted">{t.networkNoInternet}</Text> : null}
      </Card>
      <Card>
        <ListRow
          testID="connect-my-passes"
          icon="ticket-outline"
          title={t.passesTitle}
          detail={t.passesConnectNote}
          onPress={() => router.push('/connect/passes')}
        />
      </Card>
      <Card>
        <Button testID="connect-buy" label={t.buyPass} icon="ticket-outline" onPress={() => void onBuy()} />
        <Text variant="supporting" tone="muted">{t.buyPassNote}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', gap: space.m, alignItems: 'center' },
  badge: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
