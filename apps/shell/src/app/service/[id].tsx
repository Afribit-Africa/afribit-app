import { Button, Card, Divider, Icon, ListRow, Screen, StatusPill, Text, color, space, type IconName } from '@afribit/design';
import { router, useLocalSearchParams } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { availabilityLabel, pick, strings, type Strings } from '../../i18n';
import { FEATURE_LOOK } from '../../release-policy';
import { openFeature } from '../../shell/openFeature';
import { useShell } from '../../shell/ShellProvider';

const CAPABILITY_TEXT: Record<string, { en: string; sw: string }> = {
  'app.openService': { en: 'Open another Afribit app', sw: 'Kufungua programu nyingine ya Afribit' },
  'app.locale.read': { en: 'Read your language setting', sw: 'Kusoma mpangilio wa lugha' },
  'connectivity.read': { en: 'See whether you are online or on the mesh', sw: 'Kuona kama uko mtandaoni au kwenye mesh' },
  'wallet.showReceive': { en: 'Ask Wallet to show a receive request', sw: 'Kuomba Pochi ionyeshe ombi la kupokea' },
  'wallet.preparePayment': { en: 'Ask Wallet to prepare a payment, which you confirm in Wallet', sw: 'Kuomba Pochi iandae malipo, unayothibitisha kwenye Pochi' },
  'wallet.payContact': { en: 'Ask Wallet to pay a contact you name in Chat, which you confirm in Wallet', sw: 'Kuomba Pochi imlipe mtu unayemtaja kwenye Gumzo, unayothibitisha kwenye Pochi' },
  'wallet.createRequest': { en: 'Ask Wallet to create a payment request', sw: 'Kuomba Pochi iunde ombi la malipo' },
  'mesh.passes.read': { en: 'See your internet pass status', sw: 'Kuona hali ya pasi yako ya intaneti' },
};

const NETWORK_TEXT = {
  none: { en: 'Works offline', sw: 'Inafanya kazi bila mtandao' },
  internet: { en: 'Needs internet', sw: 'Inahitaji intaneti' },
  mesh: { en: 'Only on the Afribit Mesh', sw: 'Kwenye Afribit Mesh pekee' },
  'internet-or-mesh': { en: 'Internet or Afribit Mesh', sw: 'Intaneti au Afribit Mesh' },
} as const;

const ISOLATION_TEXT: Record<'shell' | 'dedicated' | 'builtin', (t: Strings) => string> = {
  shell: (t) => t.isolationShell,
  dedicated: (t) => t.isolationDedicated,
  builtin: (t) => t.isolationBuiltin,
};

/** Service details: what an app does, what it can ask for, how it is isolated (PRD H03). */
export default function ServiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const shell = useShell();
  const t = strings[shell.setup.locale];
  const l = shell.setup.locale;
  const f = typeof id === 'string' ? shell.registry.get(id) : undefined;
  if (!f) {
    return (
      <Screen>
        <Text variant="screen">{t.unavailable}</Text>
        <Button label={t.goHome} onPress={() => router.replace('/')} />
      </Screen>
    );
  }
  const m = f.manifest;
  const a = shell.availabilityOf(m.id);
  const status = availabilityLabel(a, l);
  const look = FEATURE_LOOK[m.id] ?? { icon: 'apps', accent: color.ink };
  const caps = [...f.effectiveCapabilities].filter((c) => c !== 'app.openService');

  const openButton = a.status !== 'unavailable'
    ? <Button testID="service-open" label={t.open} onPress={() => openFeature(shell, m.id)} />
    : undefined;

  return (
    <Screen footer={openButton}>
      <Pressable accessibilityRole="button" accessibilityLabel={t.back} onPress={() => router.back()} style={styles.back} hitSlop={8}>
        <Icon name="chevron-back" size={20} />
        <Text variant="button">{t.back}</Text>
      </Pressable>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: look.accent }]}>
          <Icon name={look.icon as IconName} size={30} tint={color.white} />
        </View>
        <View style={styles.flex}>
          <Text variant="screen">{pick(m.displayName, l)}</Text>
          {status ? <StatusPill label={status.label} tone={status.tone} /> : <StatusPill label={t.open} tone="positive" />}
        </View>
      </View>
      <Text variant="body">{pick(m.tagline, l)}</Text>

      <Text variant="section">{t.permissions}</Text>
      <Card>
        {caps.length === 0 ? <Text variant="supporting" tone="muted">{t.noPermissions}</Text> : caps.map((c, i) => (
          <Fragment key={c}>
            {i > 0 ? <Divider /> : null}
            <ListRow icon="checkmark-circle-outline" title={CAPABILITY_TEXT[c]?.[l] ?? c} />
          </Fragment>
        ))}
      </Card>

      <Text variant="section">{t.aboutApp}</Text>
      <Card>
        <ListRow icon="wifi-outline" title={t.network} detail={NETWORK_TEXT[m.requires.network][l]} />
        <Divider />
        <ListRow icon="shield-outline" title={t.isolation} detail={ISOLATION_TEXT[m.isolation.process](t)} />
        <Divider />
        <ListRow icon="ribbon-outline" title={t.classLabel} detail={m.classification} />
        <Divider />
        <ListRow icon="business-outline" title={t.provenance} detail={`${m.owner} · ${m.license}`} />
        <Divider />
        <ListRow icon="pricetag-outline" title={t.version} detail={m.version} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 44, alignSelf: 'flex-start' },
  head: { flexDirection: 'row', gap: space.l, alignItems: 'center' },
  icon: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: space.s },
});
