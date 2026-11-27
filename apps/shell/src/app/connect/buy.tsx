import {
  Button,
  Card,
  Choice,
  Divider,
  Icon,
  Screen,
  Text,
  color,
  radius,
  space,
  touchTarget,
  type as typo,
} from '@afribit/design';
import {
  createMeshPassClient,
  type MeshCatalog,
  type MeshPackage,
  type MeshPassClient,
} from '@afribit/kernel';
import { randomUUID } from 'expo-crypto';
import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { strings, type Strings } from '../../i18n';
import {
  BUY_FAILURE_KEY,
  cleanPhoneInput,
  createMeshBuy,
  isKenyanPhone,
  meshPayUrl,
  packageDataText,
  packageDurationText,
  type MeshBuy,
  type MeshBuyFailure,
  type MeshBuyMethod,
  type MeshBuyState,
} from '../../shell/meshBuy';
import { rememberedPackage } from '../../shell/lastPackageCore';
import { loadMeshCredentials } from '../../shell/meshCredentials';
import { MESH_BASE_URL, PASSES_FAILURE_KEY, type PassesFailure } from '../../shell/meshPasses';
import { useShell } from '../../shell/ShellProvider';

/** The purchase is followed this often while the screen is in front. */
const POLL_MS = 3_000;

type LoadPhase =
  | { readonly kind: 'loading' }
  | { readonly kind: 'no-credentials' }
  | { readonly kind: 'unauthorized' }
  | { readonly kind: 'failed'; readonly reason: PassesFailure }
  | { readonly kind: 'ready' };

function packageDetail(pkg: MeshPackage, bitcoinEnabled: boolean, t: Strings): string {
  const parts = [t.buyPriceKes(pkg.priceKes), packageDurationText(pkg.durationMinutes, t)];
  if (pkg.dataLimitMb !== null) parts.push(packageDataText(pkg.dataLimitMb, t));
  if (pkg.kind === 'household') parts.push(t.buyDeviceLimit(pkg.deviceLimit));
  if (bitcoinEnabled && pkg.bitcoinKes !== null) parts.push(t.buyBitcoinPrice(pkg.bitcoinKes));
  return parts.join(' · ');
}

function buyFailureText(reason: MeshBuyFailure, t: Strings): string {
  return t[BUY_FAILURE_KEY[reason]];
}

function loadFailureText(reason: PassesFailure, t: Strings): string {
  return t[PASSES_FAILURE_KEY[reason]];
}

/** Buy a Mesh pass in the app: M-Pesa, or Lightning from the Wallet (#73). */
export default function Buy() {
  const shell = useShell();
  const t = strings[shell.setup.locale];

  const [phase, setPhase] = useState<LoadPhase>({ kind: 'loading' });
  const [catalog, setCatalog] = useState<MeshCatalog | null>(null);
  const [client, setClient] = useState<MeshPassClient | null>(null);
  const [buyState, setBuyState] = useState<MeshBuyState>({ kind: 'select' });
  const machineRef = useRef<MeshBuy | null>(null);

  const [packageId, setPackageId] = useState<string | null>(null);
  const [method, setMethod] = useState<MeshBuyMethod | null>(null);
  const [phone, setPhone] = useState('');

  const load = useCallback(async () => {
    setPhase({ kind: 'loading' });
    setClient(null);

    let credentials;
    try {
      // Only the keychain read throws (a locked or broken keychain); the pass client returns typed failures.
      credentials = await loadMeshCredentials();
    } catch {
      setPhase({ kind: 'failed', reason: 'storage' });
      return;
    }
    if (!credentials) {
      setPhase({ kind: 'no-credentials' });
      return;
    }
    // A fresh client per load with the stored credentials, exactly as passes.tsx does.
    const next = createMeshPassClient({
      baseUrl: MESH_BASE_URL,
      session: credentials.session,
      deviceKey: credentials.deviceKey,
      fetch,
    });
    const result = await next.listPackages();
    if (result.ok) {
      setCatalog(result.value);
      setClient(next);
      setPhase({ kind: 'ready' });
      return;
    }
    setPhase(result.reason === 'unauthorized' ? { kind: 'unauthorized' } : { kind: 'failed', reason: result.reason });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!client) return;
    const machine = createMeshBuy({
      client,
      payFromWallet: shell.payFromWallet,
      newRequestId: randomUUID,
      now: Date.now,
    });
    machineRef.current = machine;
    setBuyState(machine.getState());
    const unsubscribe = machine.subscribe(() => setBuyState(machine.getState()));
    return () => {
      unsubscribe();
      machineRef.current = null;
    };
  }, [client, shell.payFromWallet]);

  // Preselect the last package bought (if still on sale), and pick the only method when there is one.
  // Read through a ref: storing a settled purchase must not re-run this and reset the choice.
  const lastPackageRef = useRef(shell.lastPackageStored);
  lastPackageRef.current = shell.lastPackageStored;
  useEffect(() => {
    if (!catalog) return;
    setPackageId(rememberedPackage(lastPackageRef.current, catalog)?.id ?? null);
    const methods: MeshBuyMethod[] = [];
    if (catalog.mpesaEnabled) methods.push('mpesa');
    if (catalog.bitcoinEnabled) methods.push('lightning');
    setMethod(methods.length === 1 ? methods[0] ?? null : null);
  }, [catalog]);

  // A settled purchase is the new default for "Buy again"; the ref keeps a re-render from writing twice.
  const rememberedRef = useRef<string | null>(null);
  useEffect(() => {
    if (buyState.kind !== 'done' || packageId === null) return;
    if (rememberedRef.current === packageId) return;
    rememberedRef.current = packageId;
    void shell.rememberPackage(packageId);
  }, [buyState.kind, packageId, shell.rememberPackage]);

  useFocusEffect(useCallback(() => {
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void machineRef.current?.poll();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, []));

  const pay = () => {
    if (packageId === null || method === null) return;
    if (method === 'mpesa' && !isKenyanPhone(phone)) return;
    void machineRef.current?.begin(packageId, method, method === 'mpesa' ? cleanPhoneInput(phone) : undefined);
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
        <Text variant="screen">{t.buyTitle}</Text>
        <Card>
          <View style={styles.stateIcon}><Icon name="wifi-outline" size={26} tint={color.muted} /></View>
          <Text variant="section">{phase.kind === 'no-credentials' ? t.passesNotJoined : t.passesUnauthorized}</Text>
          {phase.kind === 'no-credentials' ? <Text variant="supporting" tone="muted">{t.passesNotJoinedBody}</Text> : null}
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      {back}
      <Text variant="screen">{t.buyTitle}</Text>
      <Text variant="body" tone="muted">{t.buyBody}</Text>

      {phase.kind === 'loading' ? (
        <Card>
          <View style={styles.loading}>
            <ActivityIndicator color={color.ink} />
            <Text variant="supporting" tone="muted">{t.passesLoading}</Text>
          </View>
        </Card>
      ) : null}

      {phase.kind === 'failed' ? (
        <Card>
          <Text variant="section">{loadFailureText(phase.reason, t)}</Text>
          <Button testID="buy-reload" label={t.tryAgain} kind="secondary" onPress={() => void load()} />
        </Card>
      ) : null}

      {phase.kind === 'ready' && catalog ? renderBuy() : null}
    </Screen>
  );

  function renderBuy() {
    if (buyState.kind === 'waiting') {
      return renderWaiting(buyState);
    }
    if (buyState.kind === 'done') {
      return (
        <Card>
          <View style={styles.stateIcon}><Icon name="checkmark-circle" size={26} tint={color.forest} /></View>
          <Text variant="section">{buyState.access === 'active' ? t.buyDoneActive : t.buyDonePending}</Text>
          <Button testID="buy-done" label={t.buyBackToPasses} onPress={() => router.back()} />
        </Card>
      );
    }
    if (buyState.kind === 'failed') {
      return (
        <Card>
          <Text variant="section">{buyFailureText(buyState.reason, t)}</Text>
          <Button testID="buy-retry" label={t.tryAgain} kind="secondary" onPress={() => void machineRef.current?.retry()} />
        </Card>
      );
    }
    return renderSelection(buyState.kind === 'paying');
  }

  function renderSelection(paying: boolean) {
    const live = catalog as MeshCatalog;
    const methodsEnabled = live.mpesaEnabled || live.bitcoinEnabled;
    const canPay = packageId !== null && method !== null && (method !== 'mpesa' || isKenyanPhone(phone));
    return (
      <>
        <Text variant="section">{t.buyChoosePackage}</Text>
        <Card>
          {live.packages.length === 0 ? <Text variant="supporting" tone="muted">{t.buyNotFound}</Text> : null}
          {live.packages.map((pkg, index) => (
            <Fragment key={pkg.id}>
              {index > 0 ? <Divider /> : null}
              <Choice
                testID={`buy-package-${pkg.id}`}
                label={pkg.name}
                detail={packageDetail(pkg, live.bitcoinEnabled, t)}
                selected={packageId === pkg.id}
                onPress={() => setPackageId(pkg.id)}
              />
            </Fragment>
          ))}
        </Card>

        {!methodsEnabled ? (
          <Card>
            <Text variant="section">{t.buyPaused}</Text>
          </Card>
        ) : (
          <>
            <Text variant="section">{t.buyChooseMethod}</Text>
            <Card>
              {live.mpesaEnabled ? (
                <Choice
                  testID="buy-method-mpesa"
                  label={t.buyMethodMpesa}
                  selected={method === 'mpesa'}
                  onPress={() => setMethod('mpesa')}
                />
              ) : null}
              {live.bitcoinEnabled ? (
                <Choice
                  testID="buy-method-wallet"
                  label={t.buyMethodWallet}
                  selected={method === 'lightning'}
                  onPress={() => setMethod('lightning')}
                />
              ) : null}
            </Card>
            {method === 'mpesa' ? (
              <Card>
                <Text variant="supporting" tone="muted">{t.buyPhoneLabel}</Text>
                <TextInput
                  testID="buy-phone"
                  value={phone}
                  onChangeText={(value) => setPhone(cleanPhoneInput(value))}
                  placeholder={t.buyPhonePlaceholder}
                  placeholderTextColor={color.inputBoundary}
                  keyboardType="phone-pad"
                  autoComplete="off"
                  importantForAutofill="no"
                  accessibilityLabel={t.buyPhoneLabel}
                  style={[styles.input, typo.body]}
                />
                <Text variant="supporting" tone="muted">{t.buyPhoneHint}</Text>
              </Card>
            ) : null}
            <Button testID="buy-pay" label={t.buyPay} busy={paying} disabled={!canPay} onPress={pay} />
          </>
        )}
      </>
    );
  }

  function renderWaiting(state: Extract<MeshBuyState, { kind: 'waiting' }>) {
    let body: string;
    let fallback = false;
    if (state.method === 'mpesa') {
      body = t.buyMpesaPrompt;
    } else {
      switch (state.wallet.kind) {
        case 'paying':
          body = t.buyWalletOpening;
          break;
        case 'unavailable':
          body = t.buyWalletUnavailable;
          fallback = true;
          break;
        case 'denied':
          body = t.buyWalletDenied;
          fallback = true;
          break;
        case 'failed':
          body = t.buyWalletFailed;
          fallback = true;
          break;
        case 'none':
        case 'opened':
          body = t.buyWaiting;
          break;
      }
    }
    return (
      <Card>
        <View style={styles.loading}>
          <ActivityIndicator color={color.ink} />
          <Text variant="supporting" tone="muted">{body}</Text>
        </View>
        {fallback ? (
          <Button
            testID="buy-browser"
            label={t.buyOpenBrowser}
            kind="secondary"
            onPress={() => void WebBrowser.openBrowserAsync(meshPayUrl(state.paymentId))}
          />
        ) : null}
      </Card>
    );
  }
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
