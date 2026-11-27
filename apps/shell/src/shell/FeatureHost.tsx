import { Button, Icon, Screen, Stack, Text, color, space } from '@afribit/design';
import type { FeatureContext, FeatureProps } from '@afribit/feature-sdk';
import { router } from 'expo-router';
import { Component, useEffect, useMemo, useState, type ComponentType, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FEATURE_ENTRIES } from '../features';
import { pick, strings } from '../i18n';
import { ensureFeatureDataDir } from './featureData';
import { useShell } from './ShellProvider';
import { kvStorage, secureStorage } from './storage';

type DataDir = { readonly kind: 'preparing' } | { readonly kind: 'ready'; readonly dataDir: string } | { readonly kind: 'failed' };

/**
 * Mounts one feature app inside its boundary (isolation I-1):
 * - its own error boundary: a crash is contained, counted and may quarantine the app;
 * - a FeatureContext built by the host (scoped storage, caller-bound broker client);
 * - the shell's "Afribit Home" bar, which the feature cannot remove.
 */
class Boundary extends Component<{ onCrash: (e: Error) => void; fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onCrash(error);
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function FeatureHost({ id }: { id: string }) {
  const shell = useShell();
  const t = strings[shell.setup.locale];
  const feature = shell.registry.get(id);
  const [generation, setGeneration] = useState(0);
  const [crashState, setCrashState] = useState<'none' | 'crashed' | 'quarantined'>('none');
  const [dataDir, setDataDir] = useState<DataDir>({ kind: 'preparing' });
  const avail = shell.availabilityOf(id);
  const featureId = feature?.manifest.id;

  // The feature is not mounted until its own data directory exists. A wait that
  // finishes after the host unmounts must not touch state (CR-2b).
  useEffect(() => {
    if (!featureId) return;
    let live = true;
    setDataDir({ kind: 'preparing' });
    void ensureFeatureDataDir(featureId).then(
      (dir) => { if (live) setDataDir({ kind: 'ready', dataDir: dir }); },
      () => { if (live) setDataDir({ kind: 'failed' }); },
    );
    return () => { live = false; };
  }, [featureId]);

  const ctx = useMemo<FeatureContext | null>(() => {
    if (!feature || dataDir.kind !== 'ready') return null;
    const ns = feature.manifest.isolation.storageNamespace;
    const client = shell.broker.clientFor(feature.manifest.id);
    return {
      featureId: feature.manifest.id,
      locale: shell.setup.locale,
      connectivity: shell.connectivity,
      storage: kvStorage(ns),
      secureStorage: secureStorage(ns),
      paths: { dataDir: dataDir.dataDir },
      request: (intent) => client.request(intent),
      exit: () => router.back(),
    };
  }, [feature, dataDir, shell.broker, shell.setup.locale, shell.connectivity]);

  const Entry = useMemo<ComponentType<FeatureProps> | null>(() => {
    const load = feature ? FEATURE_ENTRIES[feature.manifest.id] : undefined;
    if (!load) return null;
    try {
      return load();
    } catch {
      return null;
    }
  }, [feature]);

  const title = feature ? pick(feature.manifest.displayName, shell.setup.locale) : id;
  const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const homeBar = (
    <SafeAreaView edges={['top']} style={styles.barSafe}>
      <View style={styles.bar}>
        <Pressable testID="afribit-home" accessibilityRole="button" accessibilityLabel={t.afribitHome} onPress={goHome} style={styles.homeButton} hitSlop={8}>
          <Icon name="chevron-back" size={20} />
          <Text variant="button">{t.afribitHome}</Text>
        </Pressable>
        <Text variant="supporting" tone="muted" numberOfLines={1}>{title}</Text>
      </View>
    </SafeAreaView>
  );

  let body: ReactNode;
  if (!feature || !ctx || !Entry || avail.status === 'unavailable' || crashState !== 'none') {
    const quarantined = crashState === 'quarantined' || (avail.status === 'unavailable' && avail.reason === 'quarantined');
    const crashed = crashState === 'crashed';
    const dirFailed = dataDir.kind === 'failed';
    body = (
      <Screen edges={['bottom']} scroll={false}>
        <View style={styles.center}>
          <Icon name={crashed || quarantined || dirFailed ? 'alert-circle-outline' : 'time-outline'} size={40} tint={color.muted} />
          <Text variant="section" style={styles.centerText}>
            {quarantined ? t.quarantinedTitle(title) : crashed ? t.crashedTitle(title) : `${title}: ${t.unavailable}`}
          </Text>
          <Text variant="body" tone="muted" style={styles.centerText}>
            {quarantined ? t.quarantinedBody : crashed ? t.crashedBody : pick(feature?.manifest.tagline ?? { en: '', sw: '' }, shell.setup.locale)}
          </Text>
          <Stack gap={space.s} style={styles.actions}>
            {crashed && !quarantined ? (
              <Button testID="restart-app" label={t.restartApp(title)} onPress={() => { setCrashState('none'); setGeneration((g) => g + 1); }} />
            ) : null}
            <Button testID="back-home" label={t.goHome} kind={crashed && !quarantined ? 'secondary' : 'primary'} onPress={goHome} />
          </Stack>
        </View>
      </Screen>
    );
  } else {
    body = (
      <Boundary
        key={generation}
        fallback={null}
        onCrash={(error) => {
          if (__DEV__) console.warn(`[feature:${id}] contained crash: ${error.message}`);
          void shell.reportCrash(id).then((q) => setCrashState(q ? 'quarantined' : 'crashed'));
        }}
      >
        <Entry ctx={ctx} />
      </Boundary>
    );
  }

  return (
    <View style={styles.root}>
      {homeBar}
      <View style={styles.root}>{body}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.paper },
  barSafe: { backgroundColor: color.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.divider },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.l, minHeight: 52, gap: space.m },
  homeButton: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.m },
  centerText: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', marginTop: space.l },
});
