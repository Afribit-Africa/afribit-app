# One app: the plan (owner direction, 2026-11-26)

Afribit is **one installed app on Android and iPhone**. Wallet, Chat and Mesh are built into it, never shipped as separate apps for people to install (PRD §1.2, §6, D-005). Read `docs/PRD.md` before any task. This file says how we get there from today's code; `docs/SHELL_PLAN.md` keeps the decision log.

## Where we are

| Part | Today | Gap |
|---|---|---|
| Shell | Onboarding, tabs, registry, broker, crash quarantine, mesh detection (SH-11), notifications, Android + iPhone builds | Identity (SH-8, #34 in progress) |
| Wallet | Working Blink-fork wallet in `Afribit-Africa/afribit-os-wallet`, on the shell's exact runtime (RN 0.88.1, Expo 58), but shipped as a **separate app** (S-16, now reversed) | Build it into the app |
| Chat | UI, controller, encrypted outbox and gate in `features/chat`; Tuwunel server on Afribit infrastructure | No native Matrix engine, so it can't send yet |
| Mesh | Detection and impostor checks in the shell (SH-11a/b) | Router beacon, captive-portal hand-off to the app, buying passes in-app. Engine lives in the mesh repo (the public Afribit Wi-Fi repository) |

## Isolation: what each phone allows

| | Android | iPhone |
|---|---|---|
| Separate process per module in one app | **Yes.** Components declared with `android:process=":wallet"` run in their own Linux process with their own memory and their own React instance. A crash there doesn't take down the shell. | **No.** iOS doesn't let an app start processes. App extensions are separate processes but too limited to host a wallet. |
| Separate JavaScript runtime | Yes (follows from the process) | Yes: a second React instance in the same process |
| Web modules (Class C) | Out of process already (WebView renderer) | Out of process already (WKWebView) |
| Keys only usable with the user present | Keystore keys bound to biometrics/PIN | Keychain / Secure Enclave with user-presence access control |
| What a process can't do | Same app UID, so processes share the app's files and Keystore; per-use user authentication on wallet keys is what stops another module from using them | Everything shares one address space; the same per-use authentication is the key guard |

So the strongest model each OS allows: **Android: Wallet (and later Chat) in their own processes inside the one APK. iPhone: one process, Wallet in its own React instance. Both: wallet keys that only work with the user's biometrics/PIN, money only moves through the Wallet's own confirmation screen (S-12), modules talk only through the broker.**

## Phases

**W1. Wallet inside the app (in-process first, both platforms).**
1. Prune the fork to the money core: self-custodial (Breez Spark) and Blink custodial accounts, account switching, send, receive, history, PIN/biometrics, compulsory MFA (#24–#29), backup and restore, settings. Remove: map/BTC Map, card, learn/earn, circles, price charts, Firebase.
2. Bring the pruned `app/` into this repo as `modules/wallet` (class A, `process: "builtin"`, S-17) exporting one root component with its own navigation tree and providers. Blink's servers stay configurable, never hard-coded.
3. Add its native dependencies to `apps/shell`, build the APK and the iPhone simulator build, and walk through create → receive → send → switch account → lock on the emulator.
4. Remove the companion path (S-16 code: `companion` links, "Get the app") and stop publishing the separate Wallet APK.

**W2. Wallet in its own Android process.** A `WalletActivity` in `:wallet` with its own React instance and JS bundle; the shell talks to it only through the broker (intents/Binder). On iPhone, a second React instance for the Wallet.

**C1. Chat sends real messages.** Pick and integrate the native Matrix engine (C-0), wire the host contracts, point it at the Tuwunel server on the mesh.

**M1. Mesh built in.** From the mesh repo: the router-signed beacon (S-14), captive portal opening the app instead of a web page, buying passes in-app through the Wallet (M-Pesa → Lightning), mesh-only chat reachability.

Order: W1 → C1 → M1, with W2 after W1 proves out. Farm tasks are cut from these steps, size M or smaller.

## Work queue (2026-11-26)

The farm takes TypeScript tasks that unit tests can prove, size M or smaller, in this repo. Wallet-fork tasks go to the maintainers: the farm's attempts at #25 and #26 ran out of steps exploring the fork, which is far larger than this repo. Maintainers take native builds, server changes and anything that needs a device. Issues are on this repo's board; a task gets `agent:ready` only when the tasks it waits for are merged.

| Step | Task | Who | Waits for |
|---|---|---|---|
| Wallet MFA | #24, #25, #26, #28, #29: PIN that can't be turned off, PIN before any wallet screen, sensitive actions re-ask, authenticator always enforced, protection screen can't be dismissed. **All merged** (wallet #16, #18, #20, #21, #22) | Maintainers | |
| W1 | Step 1: Map, Learn, Card, price history and Circles removed from the fork. **Merged** (wallet #17, #23); the release APK builds and 12,709 tests pass | Maintainers | |
| W1 | Step 2: the pruned wallet into this repo as `modules/wallet`, mounted in the shell as a built-in class A app (S-17): natives (W1-2a), source and its 12,600 Jest tests (W1-2b), mount (W1-2c). Inside Afribit it acts only on its own links and opens them in its own navigator, and takes the shell's hand-offs (open Receive, start a payment) behind its PIN. **Merged** (#96, #101). The arm64 release APK builds, and `afribit://app/wallet` opens the Wallet on the emulator. The build needs minSdk 26, the fork's R8 rules, libraries raised to the app's compileSdk, and the Matrix bindings compiled alone (~6.3 GB in clang) | Maintainers | |
| W1 | Step 3: the emulator walk-through (create → receive → send → switch account → lock) and the iPhone simulator build. **Android done 2026-11-27** on the arm64 release APK: non-custodial account created behind the compulsory PIN, Receive shows a mainnet invoice, Send reaches amount and fee for an on-chain address, a second account added and switched, the PIN asked again after 70 s away. Open: a funded send and receive (real funds, at most 100 KES), and the iPhone simulator build | Maintainers | W1 step 2 |
| W1 | Step 4: the shell hands Wallet requests to the built-in Wallet; companion code and strings removed; onboarding's Wallet step opens it. No separate Wallet APK (#102). **Merged** (#106) | Agents | |
| W1 | Contact payments and payment requests in the Wallet (CR-11, #9), then Chat's payment cards | Maintainers + agents | W1 step 4 |
| W1 | Follow-up #108: `lightning:`, `bitcoin:` and `lnurl:` links from other apps open the Wallet. The shell registers the schemes, checks each link's shape (BIP21 keys allow-listed) and hands it over; the Wallet takes only its own prefixes from the OS, so a link never opens twice (Wallet side: maintainers) | Agents + maintainers | |
| W1 | Follow-up: the fork's colour-token ESLint guards on the monorepo's flat config (needs ESLint dependencies) | Maintainers | |
| C1 | #37, #38, #39, #34, #49, #57, #42, #58, #43, #65: host contracts, NIP-98 signing, data directories, `ChatHost` assembly, `shell.openMesh` sections. **All merged** (#51–#54, #59, #61, #63, #69–#71) | Agents | |
| C1 | #64 CR-3b the gateway's `afribit.mesh` proof on signed requests. The gate refuses requests without it | Agents | S-14 |
| C1 | **C-0 native Matrix engine: passed 2026-11-26.** `@unomed/react-native-matrix-sdk` 0.10.2 on Hermes: a Megolm message from a second device decrypted and an encrypted reply sent back, server holds only ciphertext | Maintainers | |
| C1 | `MatrixPort` native adapter part 1 (open, sync, rooms, send), #68. **Merged** | Maintainers | |
| C1 | `MatrixPort` part 2: emoji (SAS) verification, contact QR checked against the server's master key, encrypted images. **Merged** (#77). Native binaries pinned by SHA-256, iPhone xcframework included (#82) | Maintainers | |
| C1 | Chat mounted with the real host and engine, #75. **Merged** (#83; Chat's `profile.read` and `notify.local` grants added in review) | Agents | |
| C1 | #80 CR-8b screen protection (FLAG_SECURE, capture hiding on iPhone) through `expo-screen-capture` (added in #79) | Agents | |
| C1 | #81 pick, resize and re-encode images (drops location) for encrypted sending | Agents | |
| C1 | #80 and #81 **merged** (#86, #87) | Agents | |
| C1 | #90 Kiswahili for Chat, following the language chosen in Afribit | Agents | |
| C1 | #104 scan a contact QR with the camera and show my QR. The shell owns the camera and its permission; Chat asks through `ChatHost` (camera permission: #103). **Merged** (#107) | Agents | |
| C1 | Two-device proof of emoji verification and an encrypted image on the emulator; iPhone simulator build with the native engine | Maintainers | #80, #81 |
| M1 | #40, #41, #44: typed pass client, Mesh session and device key, My passes. **Merged** (#55, #56, #62) | Agents | |
| M1 | Mesh service app API: join and header credentials (Afribit-Wifi #1), passes on sale and the Lightning invoice for the app (Afribit-Wifi #2). **Both merged**; deploy to the mesh service is the mesh owner's | Maintainers | |
| M1 | #72 typed client for buying a pass (catalog, start purchase, payment status). **Merged** (#76) | Agents | |
| M1 | #73 buy a pass in Connect: M-Pesa, or Lightning through the Wallet hand-off. **Merged** (#85); the Lightning path answers "Wallet not available" until W1 step 4 | Agents | |
| M1 | #88 reminder 30 minutes before a pass ends (local notification). **Merged** (#89) | Agents | |
| Shell | #92 tapping a notification opens Chat or My passes (fixed targets only). **Merged** (#93) | Agents | |
| Shell | #94 P03 Help in Profile: report a problem by email (redacted by type), Afribit blog. **Merged** (#95) | Agents | |
| Shell | #99 P02 Notifications list in Profile (sender and title only, no message bodies). **Merged** (#100) | Agents | |
| M1 | **Signed beacon** (S-14): the gateway endpoint and node certificates. It runs on the mesh network itself, so it is planned with the owner and the mesh owner | Maintainers | |
| Shell | #111 every screen waits for onboarding; a link that arrives during onboarding opens after it, on top of Home. **Merged** (#112). Walked on the emulator 2026-11-27: a held `afribit://connect/passes` opens My passes after onboarding and Back goes Home; "Set up wallet" opens the Wallet the same way | Agents + maintainers | |
| W1 | A `bitcoin:` link's amount and label start a self-custodial on-chain send (#113, then the amount fixed so the details screen keeps it) | Maintainers | |
| CR-11 | Wallet side: a send hand-off can start at an amount and note, kept off URLs | Maintainers | |
| CR-11 | Shell side: Chat's "Pay" and "Request" open the Wallet (`wallet.payContact` → send hand-off, `wallet.createRequest` → Receive at its amount and note); changed-device contacts refused. **Merged** (#122) | Agents + maintainers | |
| Shell | #114 onboarding's Wallet step describes the built-in Wallet | Agents | |
| M1 | #115 Connect lists what works on this network (PRD M01, J-05), with the no-uplink payment notice | Agents | |
| W1 | Receive with an amount from a hand-off (for `wallet.createRequest`). **Merged** (#124) | Maintainers | |
| Apps | #121 search and a "Works now" filter (PRD H02). **Merged** (#123) | Agents | |
| Shell | #125 colours only from design tokens, with a test that keeps it so | Agents | |
| M1 | #126 Buy again from My passes, with the last package preselected | Agents | |
