import {
  Button,
  Card,
  Divider,
  Icon,
  ListRow,
  Screen,
  StatusPill,
  Text,
  color,
  radius,
  space,
  touchTarget,
  type as typo,
  type PillTone,
} from '@afribit/design';
import {
  createMeshPassClient,
  type MeshPass,
  type MeshPassFailure,
} from '@afribit/kernel';
import { router, useFocusEffect } from 'expo-router';
import { Fragment, useCallback, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { strings, type Strings } from '../../i18n';
import { passNeedsRenewal } from '../../shell/lastPackageCore';
import {
  MESH_BASE_URL,
  PASSES_FAILURE_KEY,
  PASS_STATE_LABEL,
  cleanPassCodeInput,
  countdownText,
  effectivePassState,
  isPassCodeComplete,
  passCodeDigits,
  passCountdown,
  type PassesFailure,
  type PassState,
} from '../../shell/meshPasses';
import { loadMeshCredentials, type MeshCredentials } from '../../shell/meshCredentials';
import { refreshPassReminders } from '../../shell/passReminders';
import { useShell } from '../../shell/ShellProvider';

/** Active passes are re-checked at most this often, and only while this screen is in front. */
const STATUS_REFRESH_MS = 30_000;

const STATE_TONE: Record<PassState, PillTone> = {
  active: 'positive',
  waiting: 'warning',
  expired: 'neutral',
  failed: 'error',
};

function failureText(reason: PassesFailure, t: Strings): string {
  return t[PASSES_FAILURE_KEY[reason]];
}

type ListPhase =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready' }
  | { readonly kind: 'no-credentials' }
  | { readonly kind: 'unauthorized' }
  | { readonly kind: 'failed'; readonly reason: PassesFailure };

type SubmitError = { readonly reason: MeshPassFailure; readonly message?: string };

/** My Mesh passes, and a pass-code entry, without leaving the app (#41 gives the credentials). */
export default function Passes() {
  const { setup } = useShell();
  const t = strings[setup.locale];

  const [phase, setPhase] = useState<ListPhase>({ kind: 'loading' });
  const [passes, setPasses] = useState<readonly MeshPass[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const clientRef = useRef<ReturnType<typeof createMeshPassClient> | null>(null);
  const passesRef = useRef<readonly MeshPass[]>([]);
  passesRef.current = passes;

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'refresh') setRefreshing(true);
    else setPhase({ kind: 'loading' });

    let credentials: MeshCredentials | null;
    try {
      // Only the keychain read throws (a locked or broken keychain); the pass client returns typed failures.
      credentials = await loadMeshCredentials();
    } catch {
      setPhase({ kind: 'failed', reason: 'storage' });
      if (mode === 'refresh') setRefreshing(false);
      return;
    }

    let next: ListPhase;
    if (!credentials) {
      clientRef.current = null;
      next = { kind: 'no-credentials' };
    } else {
      // A fresh client per load: credentials can change (a re-join), and a cached client would keep the old session.
      const client = createMeshPassClient({
        baseUrl: MESH_BASE_URL,
        session: credentials.session,
        deviceKey: credentials.deviceKey,
        fetch,
      });
      clientRef.current = client;
      const result = await client.listPasses();
      if (result.ok) {
        setPasses(result.value);
        void refreshPassReminders(result.value, t);
        next = { kind: 'ready' };
      } else if (result.reason === 'unauthorized') {
        next = { kind: 'unauthorized' };
      } else {
        next = { kind: 'failed', reason: result.reason };
      }
    }
    setPhase(next);
    if (mode === 'refresh') setRefreshing(false);
  }, [t]);

  // Load on focus so a purchase that just settled shows up when the buy screen sends us back.
  useFocusEffect(useCallback(() => {
    void load('initial');
  }, [load]));

  const refreshStatuses = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    const active = passesRef.current.filter((pass) => pass.status === 'active');
    if (active.length === 0) return;
    const results = await Promise.all(active.map((pass) => client.accessStatus(pass.id)));
    setPasses((previous) => previous.map((pass) => {
      const index = active.findIndex((candidate) => candidate.id === pass.id);
      const result = index >= 0 ? results[index] : undefined;
      return result && result.ok
        ? { ...pass, status: result.value.status, expiresAt: result.value.expiresAt }
        : pass;
    }));
  }, []);

  useFocusEffect(useCallback(() => {
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refreshStatuses();
    }, STATUS_REFRESH_MS);
    return () => clearInterval(timer);
  }, [refreshStatuses]));

  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const [added, setAdded] = useState(false);

  const submit = async () => {
    const client = clientRef.current;
    if (!client || busy || !isPassCodeComplete(code)) return;
    setBusy(true);
    setSubmitError(null);
    setAdded(false);
    const deviceLabel = label.trim();
    const result = await client.redeemCode({
      code: passCodeDigits(code),
      ...(deviceLabel ? { label: deviceLabel } : {}),
    });
    setBusy(false);
    if (result.ok) {
      setCode('');
      setLabel('');
      setAdded(true);
      await load('refresh');
    } else {
      setSubmitError({ reason: result.reason, ...(result.message ? { message: result.message } : {}) });
    }
  };

  const back = (
    <Pressable accessibilityRole="button" accessibilityLabel={t.back} onPress={() => router.back()} style={styles.back} hitSlop={8}>
      <Icon name="chevron-back" size={20} />
      <Text variant="button">{t.back}</Text>
    </Pressable>
  );

  if (phase.kind === 'no-credentials' || phase.kind === 'unauthorized') {
    return (
      <Screen>
        {back}
        <Text variant="screen">{t.passesTitle}</Text>
        <Card>
          <View style={styles.stateIcon}><Icon name="wifi-outline" size={26} tint={color.muted} /></View>
          <Text variant="section">{phase.kind === 'no-credentials' ? t.passesNotJoined : t.passesUnauthorized}</Text>
          {phase.kind === 'no-credentials' ? <Text variant="supporting" tone="muted">{t.passesNotJoinedBody}</Text> : null}
        </Card>
      </Screen>
    );
  }

  const showEmpty = phase.kind === 'ready' && passes.length === 0;

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} tintColor={color.ink} colors={[color.ink]} />}
    >
      {back}
      <Text variant="screen">{t.passesTitle}</Text>
      <Text variant="body" tone="muted">{t.passesBody}</Text>

      <Button testID="passes-buy" label={t.buyPass} icon="ticket-outline" onPress={() => router.push('/connect/buy')} />

      {phase.kind === 'loading' ? (
        <Card>
          <View style={styles.loading}>
            <ActivityIndicator color={color.ink} />
            <Text variant="supporting" tone="muted">{t.passesLoading}</Text>
          </View>
        </Card>
      ) : null}

      {showEmpty ? (
        <Card>
          <Text variant="section">{t.passesEmpty}</Text>
          <Text variant="supporting" tone="muted">{t.passesEmptyBody}</Text>
        </Card>
      ) : null}

      {phase.kind === 'ready' && passes.length > 0 ? (
        <Card>
          {passes.map((pass, index) => {
            const now = Date.now();
            const countdown = passCountdown(pass.expiresAt, now);
            const state = effectivePassState(pass.status, countdown);
            return (
              <Fragment key={pass.id}>
                {index > 0 ? <Divider /> : null}
                <ListRow
                  testID={`pass-${pass.id}`}
                  icon="ticket-outline"
                  title={pass.label}
                  detail={countdownText(countdown, t) ?? undefined}
                  trailing={<StatusPill label={t[PASS_STATE_LABEL[state]]} tone={STATE_TONE[state]} />}
                />
                {passNeedsRenewal(pass.status, pass.expiresAt, now) ? (
                  <Button
                    testID={`pass-buy-again-${pass.id}`}
                    label={t.buyAgain}
                    kind="secondary"
                    onPress={() => router.push('/connect/buy')}
                  />
                ) : null}
              </Fragment>
            );
          })}
        </Card>
      ) : null}

      {phase.kind === 'failed' ? (
        <Card>
          <Text variant="section">{failureText(phase.reason, t)}</Text>
          <Button testID="passes-retry" label={t.tryAgain} kind="secondary" onPress={() => void load('initial')} />
        </Card>
      ) : null}

      {phase.kind === 'ready' ? (
        <>
          <Text variant="section">{t.addPassCode}</Text>
          <Card>
            <Text variant="supporting" tone="muted">{t.addPassCodeBody}</Text>
            <TextInput
              testID="pass-code-input"
              value={code}
              onChangeText={(value) => setCode(cleanPassCodeInput(value))}
              placeholder={t.passCodePlaceholder}
              placeholderTextColor={color.inputBoundary}
              keyboardType="number-pad"
              autoComplete="off"
              importantForAutofill="no"
              accessibilityLabel={t.passCodeLabel}
              style={[styles.input, typo.body]}
            />
            <TextInput
              testID="pass-label-input"
              value={label}
              onChangeText={setLabel}
              placeholder={t.deviceLabelPlaceholder}
              placeholderTextColor={color.inputBoundary}
              autoCapitalize="sentences"
              autoCorrect={false}
              autoComplete="off"
              importantForAutofill="no"
              maxLength={24}
              accessibilityLabel={t.deviceLabel}
              style={[styles.input, typo.body]}
            />
            {submitError ? (
              <Text variant="supporting" tone="error">
                {submitError.reason === 'rejected' && submitError.message ? submitError.message : failureText(submitError.reason, t)}
              </Text>
            ) : null}
            {added ? <Text variant="supporting" tone="forest">{t.passAdded}</Text> : null}
            <Button
              testID="pass-add"
              label={t.addPass}
              busy={busy}
              disabled={!isPassCodeComplete(code)}
              onPress={() => void submit()}
            />
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: touchTarget, alignSelf: 'flex-start' },
  stateIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: color.paper, alignItems: 'center', justifyContent: 'center' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: touchTarget },
  input: {
    minHeight: touchTarget,
    borderWidth: 1,
    borderColor: color.inputBoundary,
    borderRadius: radius.control,
    paddingHorizontal: space.l,
    backgroundColor: color.white,
    color: color.ink,
  },
});
