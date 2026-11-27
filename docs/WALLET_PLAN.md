# Afribit Wallet: build plan

Status: active · 2026-11-24.

## 1. Starting point (measured 2026-11-24)

Upstream: `blinkbitcoin/blink-mobile` at commit `a2d5f75` (2026-11-23, "make send and conversion retries idempotent"). MIT licence. Actively maintained; the self-custodial path gets fixes weekly.

| Fact | Value |
|---|---|
| Stack | Bare React Native **0.85.3**, React 19.2.3, new architecture, Hermes, yarn, Node 24 |
| Self-custodial engine | `@breeztech/breez-sdk-spark-react-native` **0.27.1** (latest 0.28.6). API key via `BREEZ_API_KEY` env |
| Size | 109 deps, 92 devDeps. TS lines: screens 66k, i18n 34k, components 27k, **self-custodial 19.5k**, graphql 17.6k, custodial 3.4k |
| Tests | 958 spec files (jest), plus Detox e2e |
| Coupling | Self-custodial is **not** a separable module: it sits behind a wallet adapter used by shared screens (send, receive, history, settings). 22 of its files touch GraphQL types or Apollo, and 3 touch Firebase |
| Google/Firebase | analytics, app, app-check, crashlytics, messaging, remote-config |
| Blink backend use | GraphQL (custodial, price), LNURL server (`blink.sv`) |

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| W-D1 | **Fork and prune, keeping the upstream link.** We do not transplant files. The fork is its own repo (`afribit-wallet`) with `upstream` = blink-mobile. We merge upstream self-custodial fixes regularly. | Transplanting 19.5k lines that are woven through shared screens means rewriting a maintained wallet and losing its fixes and its 958 tests. |
| W-D2 | **Self-custodial only.** Custodial accounts, Blink account login, account migration, and Blink-backend-only features are switched off at the navigation level first (soft prune), then deleted once upstream merges are routine (hard prune). | The owner's scope: the wallet is self-custodial on Breez Spark. A soft prune keeps merges cheap while we learn the code. |
| W-D3 | **The fork follows the shell's runtime: Expo SDK 58 / RN 0.88.1.** Overlapping native modules use the versions in Expo 58's `bundledNativeModules.json`. | One APK has one native runtime. Owner rule: stable versions with no documented vulnerability. Older-SDK apps get upgraded, not the shell held back. |
| W-D4 | **No Firebase, no Google services.** Crash reports go to our own logging later; push is decided with Chat's notification design. | Privacy, the no-legal-identity product principle, and no Google dependency on the mesh. |
| W-D5 | **Price from Breez `listFiatRates`.** LNURL server mode is off until Afribit runs its own. | Removes the dependency on Blink's backend. |
| W-D6 | **Branding:** Blink and Galoy names and logos are removed. The UI is re-themed with `@afribit/design` tokens (colours, type, buttons), keeping Blink's flows. The MIT licence and a NOTICE crediting Galoy/Blink are kept. | Owner: restyle, keep the proven UX. Trademark hygiene. |
| W-D7 | **Isolation I-2:** the wallet runs in its own Android process (`:wallet`) with its own React host and JS bundle inside the Afribit APK. It talks to the shell only through Android intents carrying the broker's typed `wallet.*` intents. Its keys live under a separate Keystore alias. | Class A (money and keys). A shell or other-app crash or compromise cannot touch the wallet's memory. |
| W-D8 | **The Breez API key is never in git.** It is injected at build time from a root-only secret file on the build host, like the Expo token. | Secret hygiene. |
| W-D9 | **Pay and request from other apps (Chat first)** (owner, 2026-11-25). The Wallet serves `wallet.preparePayment` (to an invoice, or to a chat contact's payment address) and `wallet.createRequest`. It shows its own confirmation every time (S-12): recipient name and verification state from the caller, an extra warning if the contact is unverified or changed devices recently, amount in KES and sats, fee, slide to confirm, then a biometric or device-credential check unlocking a Wallet Keystore key. Above a threshold the user sets, it adds a delay and a second confirmation. It returns only an outcome (`completed / pending / cancelled / failed / unavailable / denied`), never keys or balances. | Class A. The caller can't fake the confirmation or learn the balance. Passkeys are for identity, not payments (S-12). |
| W-D10 | **Payments need an internet uplink; they are never queued** (owner, 2026-11-25). Lightning and Spark settle through online services (Spark operators, Breez). On a mesh with no uplink the Wallet reports `unavailable` with "Payments need the Afribit network to be online". It does not hold a payment to send later. Payment traffic uses the mesh uplink by default and mobile data only with the user's opt-in (S-11). | An honest offline state. A payment queued silently would send at a moment the user didn't choose. |
| W-D11 | **Multi-factor protection is compulsory on every account** (owner, 2026-11-25). **Blink accounts** (custodial, server-side) must hold an authenticator (TOTP) before the home opens: the enforced tier applies from a zero balance, with no dismissals, and the only ways forward are "Set up authenticator" or "Move to a self-custodial wallet". **Self-custodial wallets** have no server account, so the second factor is the device itself (the key never leaves its Keystore) plus a compulsory app PIN: a PIN is set before the first wallet screen opens, the PIN switch cannot be turned off (only changed), biometrics are optional on top, and revealing the recovery phrase, sending and exporting always re-ask. Build flag `AFRIBIT_MFA_REQUIRED` defaults on; it exists for the regtest test lane only. | Blink reported that in its breach no account with 2FA was taken over. A wallet on a lost or shared phone is the most common real-world loss for our users. |
| W-D12 | **Blink is a replaceable provider, not a dependency** (owner, 2026-11-25; amends W-D2 and W-D5). Blink accounts stay available as an account type (behind W-D11), and Lightning Addresses are registered on Blink's LNURL server for now. Every Blink host comes from build-time config (`app/config/service-domains.ts`, `AFRIBIT_LNURL_DOMAIN`), never from a literal. Moving to an Afribit LNURL server is a config change plus that server. | Blink provides liquidity and the address server today; the owner wants no permanent lock-in. |

## 3. Slices

| Slice | Deliverable | Done when |
|---|---|---|
| **W-0 Fork** | `afribit-wallet` repo (full history, `upstream` remote), working copy on the build host. Baseline: upstream builds and its jest suite runs **before** any change. | Baseline APK and test numbers recorded |
| **W-1 Runtime upgrade** | RN 0.85.3 → 0.88.1 (React 19.3) via the upgrade-helper diffs. Native modules aligned to Expo 58 versions. Breez Spark 0.27.1 → 0.28.6. Expo modules core added so shell and wallet share one module system. | Standalone debug and release APKs build; jest suite at baseline or better; the app creates a wallet and receives on the emulator against Breez **regtest/testnet** |
| **W-2 Prune** | Firebase removed. Custodial, login and migration flows switched off. GraphQL removed from the self-custodial path (types moved local, price via Breez). LNURL server mode off. Blink branding out. | No network calls to Blink or Google hosts (verified with a proxy capture on the emulator) |
| **W-3 Restyle** | Afribit tokens in the RNE theme, Manrope fonts, app icon, English plus Kiswahili later | Screenshots reviewed by the owner |
| **W-4 Embed (I-2)** | An Expo config plugin in the shell adds `WalletActivity` in `android:process=":wallet"`, a second React host, and a `wallet.android.bundle` asset. The native dependency union is checked by the admission check (new native allow-list for class A). Broker-to-wallet intent bridge: `wallet.showReceive`, `wallet.preparePayment` and `wallet.createRequest` (W-D9). The user confirms in the Wallet, and the outcome goes back to the caller. `HostCapabilities.dedicatedProcess = true` makes the Wallet tile available. | The emulator shows two processes. Killing `:wallet` leaves the shell running. A Chat payment intent opens the Wallet confirmation (slide, then biometric) and returns the outcome. With no uplink the outcome is `unavailable`. |
| **W-5 Security** | Threat model; key storage review (Keystore alias, no seed in shell storage or the shell vault); backup and restore drill; screenshot blocking on seed screens; dependency audit clean (owner rule) | Review notes plus tests |
| **W-6 Release** | EAS profiles, Play internal track (Afribit Africa account), mainnet switch behind a release-policy flag | Owner sign-off |

## 3a. W-0 baseline (recorded 2026-11-23, upstream a2d5f75, unchanged)

| Check | Result |
|---|---|
| `yarn install --frozen-lockfile` (yarn 1.22.22) | OK, 581 s |
| `tsc --noEmit` | 0 errors |
| jest (`--ci --maxWorkers=2`) | 957 suites; **14,549 passed, 1 failed, 1 skipped**; 567 s |
| Known failure | `__tests__/screens/transaction-history-dates.spec.tsx`: expects "30 hours ago". It depends on clock and timezone (it ran at 15:55 PST). An upstream fragility, not a code defect. Later runs pin `TZ=UTC` and a fixed clock |

Fork: branch `afribit` at `a2d5f75`, remote `upstream` = blink-mobile (5,246 commits, full history).

## 3b. W-1 working notes (fork: private repo `Afribit-Africa/afribit-os-wallet`, `main` = Afribit mainline)

- **Firebase removal moved forward from W-2.** RN 0.88 needs Gradle 9.4.1 / AGP 9, and the Firebase Gradle plugins and native SDKs would have to be made to work there only to be deleted afterwards. Instead, the six `@react-native-firebase/*` names in `package.json` point at local stand-in packages in `shims/rnfb-*`. These have no native code, so autolinking adds nothing. Upstream code keeps importing the same names, so merges stay cheap.
  - analytics and crashlytics are no-ops, and crash collection reports itself as off.
  - Push is off: permission is "denied" and `getToken` rejects. Both call sites already catch the rejection.
  - remote-config answers with the defaults the app registers, so feature flags take their baked-in values.
  - app-check `getToken` rejects, which callers treat as "no token".
  - Jest still uses `__mocks__/@react-native-firebase`.
  - The Firebase Gradle plugins, `google-services.json` (Blink's), the Firebase BoM, and the crashlytics patch are removed. `MainActivity`'s framework-bug report goes to `Log.w`.
- **Android template changes for RN 0.88.1:**
  - Gradle 9.4.1, Kotlin 2.2.0, compileSdk and build-tools 37, `proguard-android-optimize`.
  - `edgeToEdgeEnabled=true` and the AGP 9 opt-outs.
  - `MainApplication.kt` uses the 0.88 template (`loadReactNative`, lazy `getDefaultReactHost`).
  - NDK `27.1.12297006`, the same as the template and the shell (upstream used 27.3).
  - **R8 full mode (AGP 9) + Room/WorkManager.** AGP 9 makes R8 full mode the default and no longer accepts `getDefaultProguardFile('proguard-android.txt')` (it carries `-dontoptimize`), so the optimize profile is mandatory. Under it, R8 strips the no-arg constructor that Room instantiates by reflection for `WorkDatabase_Impl` (WorkManager is pulled in via `react-native-maps`), which crashes `androidx.startup.InitializationProvider` at process start. Fixed with two keep rules in `proguard-rules.pro` — `-keepclassmembers class * extends androidx.room.RoomDatabase { public <init>(); }` and `-keep class androidx.work.impl.WorkDatabase_Impl` — no `-dontoptimize` needed. Also `-dontwarn` for the deprecated `android.hardware.fingerprint.FingerprintManager*` stubs (gone from compileSdk 37), and `@color/black` added to `colors.xml` for the price widget.
  - **jcenter removed in Gradle 9.** `react-native-push-notification` was removed (nothing imports it; push goes through the Firebase shim). Four modules had `jcenter()` repatched to `mavenCentral()`: `react-native-secure-key-store`, `react-native-securerandom`, `react-native-text-size-latest`, `rn-qr-generator`. The text-size patch also replaces the removed `DisplayMetricsHolder.getWindowDisplayMetrics().density` with `mReactContext.getResources().getDisplayMetrics().density`.
- **Patches:**
  - `react-native-maps+1.27.2` is dropped, because 1.29.11 contains the same fix upstream (react-native-maps#5977).
  - The other 9 patches are unchanged (their packages keep their versions).
  - New, both reported upstream later:
    - `react-native-webview+14.0.1` fixes `declare class WebView<P = undefined>`, which types every prop as `never`; the patch makes it `P = {}`.
    - `react-native-gesture-handler+3.3.0` gives the v3 root-view guard and the UI-runtime binding install the same `isTestEnv()` exemption the v2 paths already have. It is jest-only; nothing changes at runtime.
  - `react-native-modal+13.0.2` is regenerated, because RN 0.88 removed `InteractionManager` (just touching it throws). The interaction-handle calls become no-ops.
- **RN 0.88 API changes in app code:**
  - `InteractionManager.runAfterInteractions` is replaced by `app/utils/run-after-interactions.ts`. It uses `requestIdleCallback` with a 500 ms timeout and falls back to a microtask. It is used in transaction history and the self-custodial fragments hook.
  - StatusBar `backgroundColor` is gone; edge-to-edge draws behind it.
  - `ColorSchemeName` no longer has `"unspecified"`, and BackHandler handlers now receive an event (test types only).
  - Breez 0.28.6 `Bolt11Invoice` needs `preimage` (`undefined` for receive).
- **Types and tests:**
  - `tsconfig.json` adds `customConditions: ["react-native", "react-native-legacy-deep-imports"]`, which keeps the hand-written RN types; the new strict `types_generated` raised about 1,000 errors. It also adds `moduleSuffixes: [".native", ""]`, so Reanimated 4.7 resolves to its native types rather than the web stubs. Moving to the generated types is a separate cleanup.
  - Jest uses Reanimated's own resolver and transforms RNGH 3 (ESM). Specs with hand-written Reanimated mocks now spread the official mock first.
  - Specs that pinned Firebase or the maps patch now assert the replacements. They check: no Firebase in Gradle, `file:./shims/` specs, and the upstream maps fix present. The crashlytics patch spec is removed. The text-scaling contract points at the iOS file's new location in ReactCommon.
- **iOS:** only the Firebase lines in `AppDelegate.mm` are removed. iOS gets its template upgrade when a macOS build host exists.
- **MeaWallet card push provisioning** (`scripts/install-meawallet-mpp.sh`) skips itself without credentials, and W-2 removes it (custodial card).
- **To revisit in W-2:**
  - The home-screen price widget (`BitcoinPriceWidget.kt`) fetches from `api.blink.sv`; move it to a Breez fiat-rate snapshot written by JS, or remove it.
  - `release.keystore` with the debug password is upstream's; the Afribit release key comes with W-6.

- **Emulator verification (x86_64 release, AVD api-36).** Release APK builds (`BUILD SUCCESSFUL`, ~118 MB), installs, and launches clean: `Displayed com.galoyapp/.MainActivity +4s`, `ReactNativeJS: Running "GaloyApp"`, `NavigationContainer onReady`, Apollo client created (`uri: https://api.blink.sv/graphql` — still Blink, pruned in W-2). No fatal. Peak TOTAL PSS ~183 MB. Benign noise only: `App Check is not available in this build` (expected without Play attestation) and a `com.android.systemui` ANR (the OS shell, not the app). Debug APK builds too (x86_64 156 MB, universal 290 MB). Build with `--no-daemon --max-workers=1`, ninja `-j1` (`/root/cmake-j1`) under a memcg to avoid clang OOM; release runs at `-Xmx2048m`/5 GB, but **debug needs `-Xmx3584m`/6 GB** — the debug `react-android-0.88.1-debug.aar` re-runs `JetifyTransform` (release's copy is cached), which OOMs the Gradle JVM at 2 GB heap; AVD needs a `-wipe-data` cold boot after repeated install cycles corrupt its data partition (the "Activity class does not exist" symptom).

- **Mainnet acceptance (2026-11-24). W-1 accepted.** The owner chose a real-funds test capped at 100 KES in place of regtest. Result:
  - The release APK (x86_64) ran on the `Main` instance in incognito/self-custodial mode.
  - The Breez Spark SDK initialised on **Mainnet**, authenticated with the Lightspark SSP, and synced in about 5 s.
  - **Receive:** a 385-sat bolt11 (about $0.23 / 30 KES) was paid from the owner's Blink account. It shows as `payment_type: Receive, status: Completed, fees: 0`.
  - **Send:** 300 sats went to the owner's Lightning address (LNURL-pay) with `status: Completed, fees: 4`. The 81-sat balance stays as a float for later tests.
  - Build inputs come from `.env`, which react-native-config bakes into BuildConfig: `BREEZ_API_KEY`, plus `SPARK_TOKEN_IDENTIFIER`. Mainnet requires the latter, so we use the public USDB token `btkn1xgrvjwey5ngcagvap2dzzvsy4uk8ua9x69k82dwvt5e7ef9drm9qztux87`. The network follows the instance (`Main` means mainnet), not an env var. `BREEZ_NETWORK` is unused.
- **Findings carried into W-2/W-3:**
  - The send confirm screen quoted a **3 SAT** fee, and the receipt said 3 SAT, but the SDK recorded **4 SAT**. Show the SDK's final fee on the receipt, and label the quote as an estimate.
  - The receipt shows **"Sender: Blink User"** for a self-custodial send. That's Blink branding plus a custodial assumption; W-2/W-3.
  - Apollo still queries `api.blink.sv` (`[GraphQL error]: Not authorized, Path: me` in incognito). This gets pruned in W-2.
  - Emulator stability: under load the system process ANRs ("Process system isn't responding"). The test AVD sets `hide_error_dialogs=1`. It's not an app issue.

## 4. Upstream tracking

- A weekly `git fetch upstream`. Self-custodial fixes are cherry-picked or merged on a branch, then the jest suite and the emulator flow are run.
- Our changes stay in clearly separated commits (upgrade, prune, theme, embed) so conflicts stay small.
- If upstream moves to a newer RN, we follow the shell's SDK, not upstream's.

## 5. Open items for the owner

- ~~Where the Afribit Breez API key lives~~: resolved 2026-11-24. It lives in the workspace `.env.local`, and is copied to the fork's `.env` on the build host (mode 600, never printed).
- Whether Afribit runs its own LNURL server (Lightning address `name@afribit.africa`) — W-2 turns Blink's off either way.
- Network for the first tests: the owner chose real-funds mainnet tests capped at 100 KES per test (2026-11-24). Bigger amounts wait for W-5.
- **Passkey-derived wallet seed (new in Breez 0.28.6).** The SDK ships a `PasskeyProvider` (Android Credential Manager, API 34+; iOS 18+). It derives 32-byte seeds from a passkey's PRF using a configurable relying party, so ours could be `afribit.africa`, the same as S-09.
  - Option A: keep recovery words as the wallet's only backup (upstream's flow).
  - Option B: offer "back up with your Afribit passkey". The `:wallet` process asks the passkey for a wallet-specific salt, so the seed never passes through the shell.
  - B gives one-tap restore on a new phone. It needs Android 14+ and assetlinks on `afribit.africa`, and recovery words stay the fallback.
  - Recommended: B as an option after W-5, A as the default until then.

## 6. Dependency triage (scanned 2026-11-24 against Expo 58 `bundledNativeModules.json`)

**Align to Expo 58 in W-1 (16 overlap).** Major jumps are marked ⚠ and need their changelogs read:
react 19.2.3→19.3.0 · react-native 0.85.3→0.88.1 · reanimated 4.3→4.7.1 · worklets 0.8→0.13.0 · screens 4.25→4.30.1 · safe-area 5.6→5.11.1 · svg 15.15→15.16.0 · skia 2.6→2.14.0 · maps 1.27→1.29.11 · async-storage 2.2.0 (same) · ⚠ gesture-handler 2.31→3.3 · ⚠ bootsplash 5→6.3 · ⚠ view-shot 5→6.1 · ⚠ webview 13→14.0 · ⚠ datetimepicker 8→9.2.

**Remove in W-2** (Google services, Blink-account or custodial-only features, or legacy):
all 6 `@react-native-firebase/*` · `@react-native-google-signin/google-signin` · `react-native-push-notification` · `react-native-country-picker-modal` (phone login) · `react-native-fingerprint-scanner` (**unpinned git dependency, a supply-chain risk**; biometrics move to keychain access control) · `react-native-cloud-storage` (cloud backup; check what the recovery flow uses first) · `react-native-maps` + `@react-native-community/geolocation` (BTC map; out of scope for now).

**Review before deciding (W-1/W-2):**
`react-native-quick-crypto` 1.0.18 + `react-native-nitro-modules` (crypto used by the self-custodial path?) · `react-native-credentials-manager` 0.8.1 (Android Credential Manager: possibly reusable for the shell's passkeys, but the shell owns identity) · `react-native-keychain` vs `react-native-secure-key-store` (two secret stores: keep one) · `react-native-nfc-manager` (boltcard/NFC pay) · `react-native-screenguard` 2.0.0-**beta5** (keep the function, but a beta is not "stable"; replace with FLAG_SECURE via Expo's screen-capture module) · `react-native-config` (keep for build-time `BREEZ_API_KEY`) · `react-native-webln`, `react-native-inappbrowser-reborn`.

**Rule for W-4 (the embed):** every native module that remains must either match the shell's version exactly or be wallet-only. The shell's admission check gets a class-A native allow-list that lists them with pinned versions.
