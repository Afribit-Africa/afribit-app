import type { CapabilityIntent, CapabilityOutcome, ConnectivitySnapshot, Locale } from '@afribit/feature-sdk';
import {
  availability, createBroker, createConnectivityDrainTrigger, createRegistry, deriveConnectivity, parseCrashRecord, recordCrash, releaseQuarantine,
  EMPTY_CRASH_RECORD, type AvailabilityResult, type Broker, type CrashRecord, type HostCapabilities, type IntentMeta, type Probes, type Registry,
} from '@afribit/kernel';
import NetInfo from '@react-native-community/netinfo';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, AppState } from 'react-native';
import { strings } from '../i18n';
import { DIAGNOSTICS_BUILD, FEATURE_MANIFESTS, RELEASE_POLICY } from '../release-policy';
import { walletHandoff } from '../wallet/handoff';
import { changedDeviceRefusal, walletHandoffFor } from '../wallet/handoffCore';
import { appendAlert, parseAlertLog, serializeAlertLog, type AlertEntry } from './alertLogCore';
import { probeInternet, probeMeshBeacon, wifiAddress, type MeshAlert } from './connectivity';
import { wipeAllFeatureData } from './featureData';
import { ensureIdentity as createDeviceIdentity, resetIdentity, type IdentityFailure, type IdentityResult } from './identity';
import { MAX_LAST_PACKAGE_ID, serializeLastPackage } from './lastPackageCore';
import { deviceRevocations, identityLifecycle } from './lifecycle';
import { clearMeshCredentials } from './meshCredentials';
import { meshSectionRoute } from './meshSections';
import { pendingRoute, setupStatus } from './pendingRoute';
import { showLocalNotification } from './notify';
import { kvStorage, wipeNamespace } from './storage';
import { wipeAllVaults } from './vault';

export interface SetupState {
  readonly version: 1;
  readonly completed: boolean;
  readonly locale: Locale;
  readonly nickname: string;
  readonly notifications: 'allowed' | 'declined' | null;
  readonly protection: boolean;
}

const DEFAULT_SETUP: SetupState = { version: 1, completed: false, locale: 'en', nickname: '', notifications: null, protection: false };

/** Isolation level the native host currently provides (I-2 flips this once the wallet process exists). */
const HOST: HostCapabilities = { dedicatedProcess: false };
const SHELL_NS = 'shell';
const PROBE_INTERVAL_MS = 60_000;
const IDENTITY_END_TIMEOUT_MS = 5_000;

interface ShellValue {
  readonly ready: boolean;
  readonly setup: SetupState;
  /** The device npub, once the identity key exists (SH-8). */
  readonly npub: string | null;
  /** Why the device key is missing, when it could not be created or read. */
  readonly identityError: IdentityFailure | null;
  /** Creates the device key once (idempotent) and publishes its npub. */
  ensureIdentity(): Promise<IdentityResult>;
  updateSetup(patch: Partial<SetupState>): Promise<void>;
  resetSetup(): Promise<void>;
  readonly connectivity: ConnectivitySnapshot;
  readonly probing: boolean;
  /** Set when the current Wi-Fi claims to be Afribit Mesh and cannot prove it, or the phone clock is off. */
  readonly meshAlert: MeshAlert;
  refreshConnectivity(): Promise<void>;
  markMeshAttested(): void;
  readonly simulatedMesh: boolean;
  setSimulatedMesh(on: boolean): void;
  readonly registry: Registry;
  readonly broker: Broker;
  /**
   * Hands a Lightning payment request to the built-in Wallet (CR-11, S-17). The shell never pays;
   * the Wallet shows the payment behind its own lock. Shell screens use it directly, since
   * `clientFor` takes features only.
   */
  payFromWallet(paymentRequest: string, purpose: 'merchant' | 'manual' | 'mesh_pass'): Promise<CapabilityOutcome>;
  availabilityOf(id: string): AvailabilityResult;
  readonly crashes: CrashRecord;
  reportCrash(id: string): Promise<boolean>;
  releaseApp(id: string): Promise<void>;
  readonly lastAppId: string | null;
  setLastApp(id: string): void;
  /** The stored last-bought package, read by `rememberedPackage` to preselect Buy (M1). */
  readonly lastPackageStored: string | null;
  rememberPackage(packageId: string): Promise<void>;
  /** Notifications the shell has shown, newest first (PRD P02). */
  readonly alerts: readonly AlertEntry[];
  clearAlerts(): Promise<void>;
}

const ShellContext = createContext<ShellValue | null>(null);

export function useShell(): ShellValue {
  const v = useContext(ShellContext);
  if (!v) throw new Error('useShell outside ShellProvider');
  return v;
}

function parseSetup(json: string | null): SetupState {
  if (!json) return DEFAULT_SETUP;
  try {
    const v = JSON.parse(json) as Partial<SetupState>;
    if (v.version !== 1) return DEFAULT_SETUP;
    return {
      version: 1,
      completed: v.completed === true,
      locale: v.locale === 'sw' ? 'sw' : 'en',
      nickname: typeof v.nickname === 'string' ? v.nickname.slice(0, 24) : '',
      notifications: v.notifications === 'allowed' || v.notifications === 'declined' ? v.notifications : null,
      protection: v.protection === true,
    };
  } catch {
    return DEFAULT_SETUP;
  }
}

export function ShellProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => kvStorage(SHELL_NS), []);
  const registry = useMemo(() => createRegistry(FEATURE_MANIFESTS, RELEASE_POLICY), []);
  const [ready, setReady] = useState(false);
  const [setup, setSetup] = useState<SetupState>(DEFAULT_SETUP);
  const [npub, setNpub] = useState<string | null>(null);
  const [identityError, setIdentityError] = useState<IdentityFailure | null>(null);
  const [crashes, setCrashes] = useState<CrashRecord>(EMPTY_CRASH_RECORD);
  const [lastAppId, setLastAppId] = useState<string | null>(null);
  const [lastPackageStored, setLastPackageStored] = useState<string | null>(null);
  const [probes, setProbes] = useState<Probes>({ internet: 'unknown', meshBeacon: 'unknown', meshAttested: false, internetVia: 'none', cellularOptIn: false, checkedAt: 0 });
  const [probing, setProbing] = useState(false);
  const [meshAlert, setMeshAlert] = useState<MeshAlert>(null);
  const [simulatedMesh, setSimulatedMesh] = useState(false);
  const [alerts, setAlerts] = useState<readonly AlertEntry[]>([]);
  const networkKey = useRef<string | null>(null);
  const alertsRef = useRef<readonly AlertEntry[]>([]);

  const setAlertLog = useCallback((next: readonly AlertEntry[]) => {
    alertsRef.current = next;
    setAlerts(next);
  }, []);

  const recordAlert = useCallback((entry: AlertEntry) => {
    if (alertsRef.current.some((e) => e.id === entry.id)) return;
    const next = appendAlert(alertsRef.current, entry);
    setAlertLog(next);
    // Best effort: the notification is already shown, so a failed write must not fail the request.
    void store.setItem('alertLog', serializeAlertLog(next));
  }, [store, setAlertLog]);

  const ensureIdentity = useCallback(async (): Promise<IdentityResult> => {
    const result = await createDeviceIdentity();
    setNpub(result.ok ? result.npub : null);
    setIdentityError(result.ok ? null : result.reason);
    return result;
  }, []);

  useEffect(() => {
    void (async () => {
      const [s, c, l, log, lastPackage] = await Promise.all([
        store.getItem('setup'),
        store.getItem('crashes'),
        store.getItem('lastApp'),
        store.getItem('alertLog'),
        store.getItem('lastPackage'),
      ]);
      const parsed = parseSetup(s);
      setupStatus.set(parsed.completed);
      // With setup complete, a link opens its screen directly; one kept before setup was read
      // (a cold launch from a link) must not open a second time from Home.
      if (parsed.completed) pendingRoute.take();
      setSetup(parsed);
      setCrashes(parseCrashRecord(c));
      setLastAppId(l && registry.get(l) ? l : null);
      setAlertLog(parseAlertLog(log, (id) => registry.get(id) !== undefined));
      setLastPackageStored(lastPackage);
      setReady(true);
      // Setup is complete, so the key must exist. A read/write failure is kept in
      // identityError (shown in Profile) rather than swallowed; it must not block boot.
      if (parsed.completed) await ensureIdentity();
    })();
  }, [store, registry, ensureIdentity, setAlertLog]);

  const refreshConnectivity = useCallback(async () => {
    setProbing(true);
    try {
      const wifiIp = wifiAddress(await NetInfo.fetch());
      const [internet, mesh] = await Promise.all([probeInternet(), probeMeshBeacon(wifiIp)]);
      setProbes((p) => ({ ...p, internet, meshBeacon: mesh.beacon, checkedAt: Date.now() }));
      setMeshAlert(mesh.alert);
    } finally {
      setProbing(false);
    }
  }, []);

  useEffect(() => {
    void refreshConnectivity();
    const unsubscribe = NetInfo.addEventListener((state) => {
      const key = `${state.type}:${JSON.stringify(state.details ?? {})}`;
      if (networkKey.current !== null && networkKey.current !== key) {
        // A router attestation belongs to one network session. Leaving the network clears it.
        setProbes((p) => ({ ...p, meshAttested: false }));
      }
      networkKey.current = key;
      void refreshConnectivity();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refreshConnectivity();
    }, PROBE_INTERVAL_MS);
    return () => { unsubscribe(); clearInterval(timer); };
  }, [refreshConnectivity]);

  const connectivity = useMemo(() => {
    const real = deriveConnectivity(probes);
    if (DIAGNOSTICS_BUILD && simulatedMesh) return { ...real, meshTrust: 'attested' as const };
    return real;
  }, [probes, simulatedMesh]);

  // Drain on start-up and on every transition into an online state. The trigger
  // re-arms when connectivity drops, so INTERNET → OFFLINE → INTERNET retries.
  const drainTrigger = useMemo(() => createConnectivityDrainTrigger(), []);
  useEffect(() => {
    if (!ready) return;
    if (drainTrigger(connectivity.state)) void deviceRevocations.drain();
  }, [ready, connectivity.state, drainTrigger]);

  const quarantined = useMemo(() => new Set(crashes.quarantined), [crashes]);

  const availabilityOf = useCallback((id: string): AvailabilityResult => {
    const f = registry.get(id);
    if (!f) return { status: 'unavailable', reason: 'disabled' };
    return availability(f, { connectivity, quarantined, hasAccount: false, host: HOST });
  }, [registry, connectivity, quarantined]);

  const availabilityRef = useRef(availabilityOf);
  availabilityRef.current = availabilityOf;

  // The broker is created once; these refs give its handlers the latest host state.
  const setupRef = useRef(setup);
  setupRef.current = setup;
  const npubRef = useRef(npub);
  npubRef.current = npub;

  /**
   * Hands a Wallet request to the built-in Wallet (S-17, W1). The shell only chooses the Wallet
   * screen and leaves the hand-off where the Wallet reads it; the Wallet shows the payment and
   * asks for its own PIN, biometrics and confirmation (S-12).
   */
  const handOffToWallet = useCallback((intent: CapabilityIntent, meta: IntentMeta): CapabilityOutcome => {
    if (intent.kind === 'wallet.payContact') {
      const refusal = changedDeviceRefusal(intent.contact.verification);
      if (refusal) return { requestId: meta.requestId, status: 'denied', reason: refusal };
    }
    if (availabilityRef.current('wallet').status === 'unavailable') {
      return { requestId: meta.requestId, status: 'unavailable', reason: 'no-wallet' };
    }
    const handoff = walletHandoffFor(intent);
    if (!handoff) return { requestId: meta.requestId, status: 'failed', code: 'unsupported-request' };
    walletHandoff.put(handoff, Date.now());
    router.push({ pathname: '/app/[id]', params: { id: 'wallet' } });
    return { requestId: meta.requestId, status: 'opened' };
  }, []);

  const broker = useMemo(() => createBroker({
    registry,
    isAvailable: (id) => availabilityRef.current(id).status !== 'unavailable',
    handlers: {
      shell: async (intent, meta) => {
        if (intent.kind === 'app.openService') {
          router.push({ pathname: '/service/[id]', params: { id: intent.serviceId } });
          return { requestId: meta.requestId, status: 'opened' };
        }
        if (intent.kind === 'shell.openMesh') {
          router.navigate(meshSectionRoute(intent.section));
          return { requestId: meta.requestId, status: 'opened' };
        }
        if (intent.kind === 'profile.read') {
          const nickname = setupRef.current.nickname;
          if (!nickname) return { requestId: meta.requestId, status: 'unavailable', reason: 'no-profile' };
          return { requestId: meta.requestId, status: 'profile', profile: { nickname, npub: npubRef.current } };
        }
        if (intent.kind === 'notify.local') {
          // The user's onboarding choice wins over a permission granted some other way.
          if (setupRef.current.notifications !== 'allowed') {
            return { requestId: meta.requestId, status: 'unavailable', reason: 'notifications-off' };
          }
          const sender = registry.get(meta.caller)?.manifest.displayName[setupRef.current.locale] ?? meta.caller;
          try {
            const shown = await showLocalNotification(sender, intent.title, intent.body, { open: 'app', id: meta.caller });
            if (shown !== 'shown') return { requestId: meta.requestId, status: 'unavailable', reason: 'notifications-off' };
            recordAlert({
              id: typeof meta.requestId === 'string' ? meta.requestId : randomUUID(),
              at: Date.now(),
              sender,
              title: intent.title,
              target: { open: 'app', id: meta.caller },
            });
            return { requestId: meta.requestId, status: 'completed' };
          } catch {
            return { requestId: meta.requestId, status: 'failed', code: 'notify-failed' };
          }
        }
        return { requestId: meta.requestId, status: 'failed', code: 'unsupported' };
      },
      // CR-11: the Wallet is built in (S-17). The shell only hands the request over; the Wallet
      // shows the payment and asks for its own PIN, biometrics and confirmation.
      wallet: async (intent, meta) => handOffToWallet(intent, meta),
    },
  }), [registry, handOffToWallet, recordAlert]);

  const payFromWallet = useCallback(
    async (paymentRequest: string, purpose: 'merchant' | 'manual' | 'mesh_pass') =>
      handOffToWallet({ kind: 'wallet.preparePayment', paymentRequest, purpose }, { requestId: randomUUID(), caller: 'shell' }),
    [handOffToWallet],
  );

  const persistSetup = useCallback(async (next: SetupState) => {
    setupStatus.set(next.completed);
    setSetup(next);
    await store.setItem('setup', JSON.stringify(next));
  }, [store]);

  const rememberPackage = useCallback(async (packageId: string) => {
    // Ids come from the catalog; one too long to read back is not kept at all.
    if (packageId.length === 0 || packageId.length > MAX_LAST_PACKAGE_ID) return;
    const value = serializeLastPackage(packageId);
    setLastPackageStored(value);
    await store.setItem('lastPackage', value);
  }, [store]);

  const value: ShellValue = {
    ready,
    setup,
    npub,
    identityError,
    ensureIdentity,
    updateSetup: (patch) => persistSetup({ ...setup, ...patch }),
    resetSetup: async () => {
      const { failed } = await identityLifecycle.end({ timeoutMs: IDENTITY_END_TIMEOUT_MS });
      try {
        await Promise.all([
          store.removeItem('setup'),
          store.removeItem('lastApp'),
          store.removeItem('crashes'),
          store.removeItem('alertLog'),
          store.removeItem('lastPackage'),
          resetIdentity(),
          clearMeshCredentials(),
        ]);
        await Promise.all(registry.features.map((f) => wipeNamespace(f.manifest.isolation.storageNamespace)));
        await wipeAllVaults();
        await wipeAllFeatureData();
      } finally {
        setupStatus.set(false);
        pendingRoute.take();
        setSetup(DEFAULT_SETUP);
        setCrashes(EMPTY_CRASH_RECORD);
        setLastAppId(null);
        setLastPackageStored(null);
        setAlertLog([]);
        setNpub(null);
        setIdentityError(null);
      }
      if (failed.length > 0) {
        Alert.alert(strings[setup.locale].dataNotCleared);
      }
    },
    connectivity,
    probing,
    meshAlert,
    refreshConnectivity,
    markMeshAttested: () => setProbes((p) => ({ ...p, meshAttested: true })),
    simulatedMesh: DIAGNOSTICS_BUILD && simulatedMesh,
    setSimulatedMesh: (on) => { if (DIAGNOSTICS_BUILD) setSimulatedMesh(on); },
    registry,
    broker,
    payFromWallet,
    availabilityOf,
    crashes,
    reportCrash: async (id) => {
      const next = recordCrash(crashes, id, Date.now());
      setCrashes(next);
      await store.setItem('crashes', JSON.stringify(next));
      return next.quarantined.includes(id);
    },
    releaseApp: async (id) => {
      const next = releaseQuarantine(crashes, id);
      setCrashes(next);
      await store.setItem('crashes', JSON.stringify(next));
    },
    lastAppId,
    setLastApp: (id) => {
      setLastAppId(id);
      void store.setItem('lastApp', id);
    },
    lastPackageStored,
    rememberPackage,
    alerts,
    clearAlerts: async () => {
      setAlertLog([]);
      await store.removeItem('alertLog');
    },
  };

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}
