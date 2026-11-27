# AFRIBIT OS
## Super App — Product Requirements Document, Reference Architecture & Bundled Module Standard

**Document ID:** AOS-PRD-001  
**Version:** 1.0 — implementation baseline for team review  
**Date:** 22 November 2026  
**Owner:** Afribit Africa — Product & Engineering  
**Status:** **Build-ready proposal**, not a certification of production financial readiness  
**Platforms:** Android and iOS  
**Audience:** Product, design, mobile, infrastructure, Wallet and Clans maintainers, security reviewers, contributors, AI coding agents  
**Canonical product name:** *Afribit OS*; consumer-facing name may simply be *Afribit*  
**First delivery:** A signed, installable, navigable Android build with real bundled modules and safe integrations; iOS built from the same application architecture.

> **One application. Many independently maintainable services. No shared financial trust by default.**
>
> Afribit OS is a community super app in which users can learn, earn, save, spend, govern shared funds, discover merchants, communicate, use Afribit AI and access local infrastructure from one installed application. It is an application platform, not a new mobile operating system, not an uncontrolled app marketplace and not a single custodial account containing everyone's money.

---

## 0. How to read and implement this document

This PRD is intended to be usable without rereading chat history. It unites product behavior, Android/iOS application composition, the mini-app/bundling mechanism, module interfaces, security requirements, test criteria and the first build sequence. It describes **what to build** and **how to include existing applications**, while preserving the separate Afribit OS living whitepaper as the higher-order constitution.

### 0.1 Authority and precedence

1. **Afribit OS Living Whitepaper v0.4 (11 October 2026)** — constitutional rules regarding keys, custody, sovereignty, permissions, privacy and provider admission. If this PRD conflicts with its non-negotiable safety principles, stop and resolve the conflict through an ADR and whitepaper amendment.
2. **This PRD** — intended product, minimum requirements, module integration standard, acceptance criteria and first implementation decisions.
3. **Architecture Baseline v0.3 / existing Product & Design Blueprint v0.1** — background decisions, retained unless replaced explicitly here.
4. **Wallet Evaluation Brief and Clans Briefing (5 November 2026)** — the supplied evidence of what was implemented as of that date; source status must be checked again against the actual repositories before merging.
5. **Versioned ADRs, integration contracts, repository tests and security reviews** — concrete engineering evidence. Source code does not silently overrule constitutional safety requirements.

The previous living whitepaper intentionally has no implementation roadmap. **This PRD contains a separate build sequence**; do not paste that schedule back into the constitutional whitepaper.

### 0.2 Requirement language

- **MUST / MUST NOT**: mandatory for the stated release or class of feature.
- **SHOULD / SHOULD NOT**: recommended default, exception documented in an ADR.
- **MAY**: optional.
- **P0**: required for an installable developer alpha, unless explicitly marked *post-financial-gate*.
- **P1**: next usable release after P0.
- **P2**: later capability.
- **Implemented / proven** is used only for what the 5 November briefs explicitly report. A module working in its original application does **not** mean it has been integrated into Afribit OS.
- **Bundled** means delivered as part of the signed Android/iOS installation, not merely rendered from a website at runtime.

### 0.3 Core decisions recorded here

| ID | Decision | State |
|---|---|---|
| D-001 | Shared React Native New Architecture app for Android/iOS | Accepted project direction |
| D-002 | Expo tooling + Expo Router; native development builds, not Expo Go for wallet integration | Recommended baseline |
| D-003 | Home is a **service launcher/navigation directory**, not an overloaded activity dashboard | Accepted product direction |
| D-004 | Class A privileged compiled modules; B first-party compiled modules; C packaged, sandboxed web modules | Accepted architecture direction |
| D-005 | Package approved modules **at build time** into APK/AAB and iOS IPA | Proposed implementation standard |
| D-006 | Personal wallet uses existing Breez SDK/Spark implementation behind an Afribit Wallet interface; Blink is a UX reference, not an assumed fork | Based on newer Wallet brief |
| D-007 | Clans remains a distinct treasury/backend and signing authority, including its own custody disclosure | Required |
| D-008 | Infrastructure-operated mesh; phones consume local services, not form the permanent network backbone | Accepted |
| D-009 | App identity, personal wallet keys and clan signing keys are separate security domains | Required |
| D-010 | Begin with a modular app and existing backends; do not launch a new general-purpose plugin execution platform or rewrite services | Recommended |
| D-011 | Start with Android physical-device testing and iOS compatibility in the same repository | Recommended |
| D-012 | Rust is the long-term portable trusted-core option; **do not rewrite working Breez Rust-backed code or TypeScript core without a demonstrated need** | Clarification |

---

# PART I — PRODUCT

## 1. Product definition

### 1.1 Problem

Afribit's capabilities live in different web applications, wallet prototypes, tools, services and community infrastructure. People must know distinct URLs, maintain multiple identities, switch experiences and learn multiple interfaces. Teams also duplicate navigation, onboarding, styling, permissions, authentication and release practices. A successful web app is not automatically a coherent mobile feature. The fragmentation is especially expensive under poor connectivity and on entry-level Android phones.

### 1.2 Product promise

One installed app offers access to a coherent Afribit ecosystem. A user can open a navigation-first Home, select Wallet or Clans, take a lesson, find a microtask, ask Afribit AI, discover a merchant or connect to local services, all while understanding exactly who controls their funds and what works without internet.

**A single installation does not require a single backend, a single balance, a single password or a single custody model.** The shell provides consistent experience, not a universal privileged account.

### 1.3 Primary users

| User | Job to be done | Primary destination |
|---|---|---|
| New community member | Understand what Afribit offers without financial setup | Home, Learn, Nearby |
| Bitcoin user | Create/restore personal wallet and spend/receive | Wallet |
| Clan member | Join a group, view balance/activity, vote, request/repay grants | Clans |
| Clan signatory | Review exactly what is being signed, approve or reject | Clans / Trusted signatory flow |
| Microtask worker | Discover work, submit evidence, track payment | Earn |
| Merchant | Receive payments, appear in discovery, access tools | Wallet / Nearby / Merchant tools |
| Learner | Learn Bitcoin in simple language online or from a local cache | Learn |
| Mesh-network visitor | Reach locally hosted educational/communication services without public internet | Connect / Local |
| Afribit operator | Maintain service health, not seize users' funds | Separate operator systems |
| Contributor | Add one capability with predictable build, testing and permission boundaries | Module SDK / repository |

### 1.4 User promise / non-promises

Afribit OS **will**: give users one dependable starting point; disclose service availability; avoid duplicate setup where possible; preserve module autonomy; provide coherent navigation; protect private wallet material; support localized language and constrained connectivity.

Afribit OS **will not promise**: free mobile internet, magical offline Bitcoin settlement, guaranteed conversion rates, unrestricted exchange/fiat services, instant cross-wallet transfers, lossless wallet recovery without backups, or universal access to every service on every platform.

### 1.5 Success definition

An alpha is successful when a new developer can install and navigate the app; Home reliably opens real approved modules; at least one existing web capability is demonstrably packaged in the binary and works without fetching its UI from the network; Clans can be reached without losing custody disclosures; Wallet can be launched through a reviewed interface and accurately shows testing limitations; a module failure cannot prevent Home or unrelated modules from functioning.

Later product success should be measured by task completion and comprehension, not by the number of features on Home. Example measures: median time to reach Wallet, user success finding Clans, lesson opens without internet, app crash-free sessions, module startup latency, recovery rehearsal completion, user understanding of custody boundaries and contribution PR lead time. No private financial history is required for these measures.

## 2. Product scope and priorities

### 2.1 Scope by release

| Capability | Developer Alpha (P0) | Controlled Beta (P1) | Subsequent (P2) |
|---|---|---|---|
| Signed Android build and matching iOS project | Yes | Field-tested on both | Continuous |
| Home launcher and All Services | Real | Personalization/favorites | More discovery |
| Design system, navigation, empty/offline states | Real | Refined | Extended |
| Learn | One genuine packaged lesson module | More downloadable/local content | Curriculum tracking |
| Clans | Safe entry and read-only overview / approved PWA route | Native screens, reviewed payment intents | Native signatory path after audit |
| Wallet | Integration harness, test-network UI, transparent availability | Funded recovery and controlled real-value proof before beta funds | Broader wallet features |
| Earn / MicroTasks | Directory entry, permitted API/web integration if ready | Real submissions and payouts | Greater program depth |
| AI | Placeholder or privacy-isolated demonstration | Approved Q&A integration | Local inference where feasible |
| Merchant discovery | One read-only screen if data is available | Search/map/filter | Merchant payment tools |
| Mesh / Connect | Detect local network state; locally served content demo | Local service discovery, chat pilot | Wider mesh services |
| Fiat on/off-ramp | Disabled explainer only | Provider/legal gates, sandbox | Approved provider rollouts |
| Fedimint/federation | Not bundled as personal wallet | Separate lab | Optional community custody module with separate approval |

**P0 is an actual application**, not an image gallery. Dummy values are permitted only in explicitly marked demo fixtures. No fake balances are to be presented as real funds.

### 2.2 Explicit exclusions from the first financial release

Do not introduce stablecoin assets, Afribit-held liquidity, an exchange, omnibus balances, background signing, automatic grant approval, a custodial recovery key, an unreviewed P2P escrow, or live fiat ramps simply because they are reachable in a provider API. Do not combine the Clans operator-controlled Lightning funds with a personal Spark wallet balance.

## 3. Information architecture and navigation

### 3.1 Navigation philosophy

The Home screen exists primarily to answer **“What do you want to do?”** It is not a feed of everything happening in every service. Show a small number of prominent destinations, then a searchable All Services directory. Each module has a focused landing screen. Do not nest repeated bottom tab bars inside modules.

**Recommended persistent navigation:** Home · Wallet · Clans · Explore · You. Home is the service launcher. Explore is the complete service directory and discovery entry; Wallet and Clans receive direct destinations because they are core. Earn, Learn, AI, Nearby and Connect are reachable through Home/Explore without needing separate permanent tabs. Final labels and icons are user-testable and may change without restructuring security boundaries.

```text
AFRIBIT OS
├── Home (navigation hub)
│   ├── Wallet
│   ├── Clans
│   ├── Earn
│   ├── Learn
│   ├── Ask AI
│   ├── Nearby
│   ├── Connect / Mesh
│   └── All Services → Explore
├── Wallet (personal financial domain)
├── Clans (group governance / treasury domain)
├── Explore (search + categories + service detail)
│   ├── Learning & Education
│   ├── Work & Earning
│   ├── Money & Groups
│   ├── Community & Communication
│   ├── Local Network
│   └── Merchant & Tools
└── You (preferences / security / connected accounts / support)
```

### 3.2 Home composition: specification

1. Compact brand/app header; search and profile entry. If a connectivity indicator is visible it must say something meaningful, not just “online.”
2. A single prompt, such as “What would you like to do?” No overloaded announcements.
3. **Essentials:** up to four distinct, generously sized destinations, initially Wallet, Clans, Earn, Learn. Use understandable titles and short supporting phrases; avoid identical tiny cards with dense metadata.
4. **Explore more:** up to four lighter shortcuts, initially AI, Nearby, Connect, Community, selected according to actual module readiness.
5. **All Services:** opens the complete category/search directory. Services that are not available remain clearly marked Preview, Coming later or Unavailable; do not fabricate functionality.
6. Optional lightweight “Continue” shortcut only when relevant (for example resume a lesson), with no financial data exposure without unlock.
7. The Home shell must remain usable even when Wallet, Clans, AI, map services or the internet are unavailable.

### 3.3 Navigation behavior

- Every module has a stable internal route ID (`/wallet`, `/clans`, `/learn`, etc.).
- Android system Back and iOS navigation gestures work predictably. Exiting a module returns to the previous location or Home, not an arbitrary login page.
- Sensitive screens (seed words, sign, approval) must not appear in browser history, unrestricted deep links or recent-app screenshots where protections are supported.
- Modules MAY present nested flow screens, but they MUST not replace the primary app's identity, tab bar, OS permission experience or global emergency/security controls.
- Deep links MUST parse/validate input and open a review screen. They MUST NOT auto-sign, auto-pay, auto-vote or auto-consent.

## 4. First-run and account model

### 4.1 Progressive onboarding

A user should access Learn, the service directory and public local information without creating a Bitcoin wallet or signing up for every Afribit service.

**First launch:** splash/integrity → language → concise welcome → privacy/terms summary → Home (“Explore first”) or optional Afribit account sign-in. The wallet asks for setup only when Wallet is first used; Clans authenticates only when the person enters an authenticated Clans route; camera permission appears when the person scans; location is requested only for nearby features requiring it.

### 4.2 Identity is not custody

- **Afribit profile identity:** optional, for settings/participation and module linking.
- **Personal wallet identity:** user-controlled financial recovery/signing material; may exist without a central Afribit profile.
- **Clans identity:** existing passkey/account/recovery policy and clan membership rules; may be linked for navigation, never silently merged.
- **Federation identity:** if ever introduced, its own operator and custody disclosures.

The app may offer a unified visual profile, but the backend must not imply that signing in with an Afribit account restores a self-custodial wallet. Account deletion must not be described as destruction of on-chain funds; recovery must remain possible independently of Afribit service availability where the wallet design supports it.

### 4.3 Accessibility/localization

English and Kiswahili are first-class content and interface targets; Sheng can be supported thoughtfully in learning and AI copy without making financial disclosures ambiguous. All financial amounts must support clear localized formatting and units. Dynamic text, minimum touch target sizes, screen-reader labels, contrast, reduced motion and low-literacy workflows belong in the acceptance criteria.

## 5. Screen catalogue — minimum product behavior

Each screen below must have loading, empty, error, offline and unauthorized states where meaningful. The table states intent, not existing completion.

| ID | Screen | Primary action | Critical rule |
|---|---|---|---|
| A01 | Splash / boot | Open shell | Start without waiting indefinitely for remote config or Wallet |
| A02 | Welcome | Explore / sign in | Never force wallet creation for education |
| A03 | Language / privacy | Choose locale, review policy | Persist locally; no manipulative defaults |
| H01 | Home | Launch a service | Navigation-first; no leaked financial balances |
| H02 | All Services | Search/filter modules | Display provenance, readiness and offline status |
| H03 | Service details | Learn what a module does | Show permissions and whether it requires internet |
| W01 | Wallet entry | Create / restore / unlock | Clear self-custodial label and demo/test environment |
| W02 | Wallet setup | Generate wallet | Recovery model must match actual SDK capabilities |
| W03 | Recovery / backup | Verify recoverability | Never upload recovery words or show them in logs |
| W04 | Wallet overview | See sats, KES reference, history | Distinguish settled/pending balances and quote age |
| W05 | Receive | Show request/address | Amount, network and expiry are explicit |
| W06 | Send | Scan/paste recipient, enter amount | Validate payee, fees, network and payment type |
| W07 | Trusted review | Confirm exact transaction | No remote mini-app is allowed to bypass |
| W08 | Status/receipt | View settled/pending/unknown | Unknown is not failed and must not be resent blindly |
| W09 | Security center | Backup, session lock, diagnostics | No secret in telemetry, clipboard warnings |
| C01 | Clans entry | Authenticate/open clans | Existing custody disclosure preserved |
| C02 | My clans | Select a group | No blending with personal wallet balance |
| C03 | Clan overview | See treasury / activity | Show wallet type, signatory policy, age of data |
| C04 | Grant detail | Request/accept/repay | Respect existing grant governance rules |
| C05 | Vote | Approve/reject in group governance | Vote ≠ financial signature |
| C06 | Contribution | Prepare personal wallet payment | Cross-custody handoff always explicit |
| C07 | Signatory review | Approve exact transaction | Privileged native flow only after security gate |
| E01 | Earn / tasks | Browse tasks | Real availability or clear demo state |
| E02 | Task detail / submission | Apply or submit | No false payout guarantee |
| L01 | Learn library | Select lesson | Packaged content should load offline |
| L02 | Lesson | Read/listen/complete | Save progress locally, sync only with consent |
| I01 | Ask Afribit AI | Ask a question | Never receive wallet seed, payment authorization or Clans signing power |
| N01 | Nearby/merchants | Discover services | Location optional; no invented “open now” claims |
| M01 | Connect / local network | List local services | Clearly distinguish Internet, Local-only, Offline |
| M02 | Local service detail | Open locally hosted content | Mark locally trusted vs external providers |
| P01 | You / settings | Language, accounts, security | Separate account connections and recovery |
| P02 | Notifications | View service alerts | No seeds, private transaction details in push payloads |
| P03 | Help / feedback | Report issue | Safely redact user-sensitive data |

### 5.1 Core user journeys

**Journey J-01, first-time visitor:** install → choose language → Explore → Learn → cached lesson → Home. No login, wallet or connectivity requirement to display a previously bundled lesson.

**J-02, personal wallet:** Home → Wallet → create/restore in approved test environment → backup → receive → send → review → pending/settled history. No “funded production wallet” label before independent readiness gates.

**J-03, clan:** Home → Clans → authenticated clan overview → view vote → accept/reject a grant proposal → return Home. If a payout signature is required, transition to the separately approved privileged signing surface; a governance vote is not a key signature.

**J-04, contribute to a clan:** Clans → contribution amount → server-issued request/address → wallet reviews recipient and custody change → local approval → submit payment → Clans independently verifies settlement → clan ledger reflects confirmed payment. The personal wallet UI must not book the clan credit itself.

**J-05, local network:** Home → Connect → connectivity status `LOCAL_NETWORK_ONLY` → open cached Learn or approved local service → clearly indicate that normal public Lightning payments may not settle without an upstream network path.

**J-06, failed provider:** Wallet or ramp provider down → clear unavailable state in its module → other services open normally → no accidental retry of unknown payment.

---

# PART II — HOW APPS ARE INCLUDED IN THE INSTALLED APPLICATION

## 6. The meaning of “bundled with the APK”

### 6.1 Deliverable formats

On Android, Afribit builds an **Android App Bundle (`.aab`) for Google Play** and an installable **APK** for internal distribution/testing. Google Play can generate device-specific APK splits from the AAB. The user sees one Afribit application and one launcher icon. On iOS, the analogous signed application bundle is distributed as an **IPA** through the applicable Apple distribution mechanism. There is no universal “APK” format across both platforms.

A bundled module is one of the following:

1. **Native React Native module:** TypeScript/React Native screens compiled into the app's JS bundle, with required approved native libraries linked into the signed binary.
2. **Bundled Web Module:** a static HTML/CSS/JavaScript build (for example from Vite) copied into the signed Android/iOS app as assets, rendered by a restricted local WebView. Backend APIs, authentication and live data may still require network access.
3. **Bundled content pack:** lessons, images, audio, maps or documents included as assets, opened by native components or a sandboxed renderer.

**Not supported:** placing an unrelated third-party APK inside Afribit and expecting it to become a seamlessly installed feature, embedding an arbitrary iOS application inside another app, silently injecting code into installed apps, or running unknown app binaries with privileged permissions. External apps can be linked by deep link or opened in a browser, but then they are not bundled features.

### 6.2 Delivery policies

- P0 uses **install-time, signed** module inclusion. A module included in release `0.1.0-alpha.1` is audited and built with that release.
- UI and approved static content MAY be updated through carefully governed release mechanisms, but **native permission expansion, new financial authority and core signing changes require a reviewed signed app release**. Do not treat OTA updates as a method of bypassing store review or security checks.
- Android Play Feature Delivery is a later option for large install-time or on-demand features. It is not necessary to build the first Afribit release, and an on-demand feature is not actually “fully installed from day one.”
- Remote websites remain an exception for features that cannot reasonably be packaged, and are explicitly labelled network-dependent.

### 6.3 Module admission classes

| Class | Example | Delivery | Allowed powers | Prohibited powers |
|---|---|---|---|---|
| **A — privileged compiled** | Wallet signing/recovery; future native Clans signer; secure storage; trusted payment review | Built/signed in native app | Explicit native APIs under local policy | Remote control of raw signers, web-origin key access |
| **B — first-party compiled** | Home, Learn native, AI UI, Merchant directory, Earn UI, Clans native read-only screens | Compiled React Native packages | Narrow capability requests, own nonsecret local state | Private keys or autonomous financial signing |
| **C — packaged sandboxed web** | Existing React/Vite Learn or approved Clans read-only front-end, static MicroTasks content | Hashed static assets in signed app | Restricted network fetch; specific app broker messages if approved | Direct access to native wallet signer, arbitrary file system, unrestricted bridge |
| **D — external service/link** | A vendor app without reusable source/SDK or unapproved remote web page | Not bundled | User-directed browser/deep link | Claiming to be integrated/offline/first-party |

Class D is a directory link, **not** a mini-app class. Classes A/B/C correspond to the previously agreed security model.

## 7. Integration choices for any existing application

### 7.1 Decision tree

```text
Candidate application
  |
  +-- Own source or explicit redistribution license?
  |      |-- No --> External link / provider API only (Class D)
  |      +-- Yes
  |
  +-- Needs key material, signing or trusted device APIs?
  |      +-- Yes --> Class A native facade; security review; no generic WebView
  |
  +-- React Native UI / reusable business logic available?
  |      +-- Yes --> Extract module into RN (Class B)
  |
  +-- Static web build (HTML/JS/CSS) feasible?
  |      +-- Yes --> Package assets + constrained WebView (Class C)
  |
  +-- Backend-only service / cannot package UI?
         +-- Yes --> Create thin native client via its approved API

Every path: licensing → threat model → dependency scan → accessibility → QA → module approval → signed release.
```

### 7.2 When to choose native vs packaged web

**Prefer native React Native for** primary navigation, frequently used financial screens, camera/QR flow, accessibility-sensitive flows, secure key interaction, native biometrics, background-sensitive mobile behavior, and long-lived app-core capabilities. It is not automatically necessary to rewrite every service in native code.

**Prefer bundled WebView for** an existing first-party web interface that exports a static client, has modest device permissions, needs quick reuse, has proven mobile layout and whose backend remains independently hosted. Packaged HTML is still a web runtime, not magically equivalent to native rendering.

**Prefer API-only native client for** a server product with useful services but a web frontend that depends heavily on browser auth, service workers, unsupported plugins, cookie context or desktop UX. Clans may benefit from this for its most important screens.

**Prefer external link for** third-party applications with no source license, incompatible terms or security requirements, or any service that cannot pass module admission.

### 7.3 React/HTML does not become React Native automatically

A React/Vite web app renders DOM elements (`div`, `button`, browser CSS). React Native uses native views (`View`, `Text`, `Pressable`), platform layout and native navigation. A Vite `dist/` directory can be packaged as WebView assets; its React DOM source cannot simply be copied into an RN screen and expected to render. Shared **business logic/types/validators** may be extracted if browser and platform assumptions are removed. Recreating a module natively is a separate workstream, not a bundling flag.

### 7.4 Backend boundary

Bundling a web UI **does not bundle** its FastAPI server, PostgreSQL database, BTCPay node, AI inference service, merchant API, M-PESA infrastructure or cloud authentication provider. These remain reachable through approved network endpoints, and must expose explicit offline and failure behavior. Never run the existing production backend inside the mobile app by copying server secrets or database credentials.

## 8. Build-time module registry

Every module in the OS MUST have machine-readable metadata and a reviewed release classification. The registry is built into the signed application; remote discovery can affect **visibility/availability**, not grant new privileges.

### 8.1 Suggested manifest

```json
{
  "id": "learn",
  "displayName": "Learn",
  "releaseVersion": "0.1.0",
  "schemaVersion": 1,
  "owner": "afribit-education",
  "kind": "bundled-web",
  "classification": "C",
  "entryRoute": "/learn",
  "assetEntry": "modules/learn/index.html",
  "offline": { "ui": true, "content": "packaged", "transactions": false },
  "requiresAccount": false,
  "networkDomains": ["learn.afribit.africa"],
  "requestedCapabilities": ["app.locale.read"],
  "platforms": ["android", "ios"],
  "license": "internal-owned",
  "bundleSha256": "BUILD_PIPELINE_GENERATED_SHA256",
  "minimumHostContract": "1.0"
}
```

This is a **reference schema**, not an authenticated capability grant. `bundleSha256` must be generated from the actual deterministic artifact, not manually typed; an asset hash proves integrity relative to the release manifest, **not** the trustworthiness of its author. Signing/review of the host release remains mandatory.

### 8.2 Registry fields and enforcement

- `id`: lowercase, unique, stable across releases; no mutable module ID impersonation.
- `classification`: reviewed A/B/C class, not supplied by a remotely hosted module.
- `entryRoute` and `assetEntry`: build-validated, no `../` traversal or remote code substitution.
- `offline`: a truthful capability matrix, verified by tests.
- `networkDomains`: exact host allowlist, no `*` or arbitrary redirects for privileged contexts.
- `requestedCapabilities`: document what the module may request; effective permission is the intersection of host policy, release allowlist and explicit user consent where appropriate.
- `minimumHostContract`: reject incompatible modules with a graceful error, not silent fallback to untyped bridge commands.
- `owner`/`license`: required provenance for legal, copyright and incident accountability.
- `bundleSha256`: part of reproducible release evidence; do not allow remotely supplied manifests to override a signed packaged module.

### 8.3 Example module contract (host-side)

```ts
export type ModuleKind = 'native' | 'bundled-web' | 'external';
export type ModuleClass = 'A' | 'B' | 'C' | 'D';

export interface RegisteredModule {
  id: string;
  title: string;
  route: `/${string}`;
  kind: ModuleKind;
  classification: ModuleClass;
  version: string;
  requiresAccount: boolean;
  offlineUI: boolean;
  permissions: readonly string[];
  isAvailable(ctx: Readonly<AvailabilityContext>): AvailabilityResult;
}

export type AvailabilityResult =
  | { status: 'available' }
  | { status: 'limited'; reason: string }
  | { status: 'unavailable'; reason: string };
```

No `any`, dynamic `eval`, arbitrary remote import URL or broad `native.invoke(methodName, args)` is permitted in the public module contract.

## 9. Bundled web app implementation specification

### 9.1 Build pipeline

```text
First-party web repository (e.g. Learn/Clans web UI)
    |  lockfile + source review + license
    v
Static production build (Vite/React output)
    |  strip service worker assumptions; check asset paths
    v
Integration adapter (auth + API config + bridge schema)
    |  lints, tests, dependency/SBOM scan
    v
Module packager (manifest, assets, SHA-256, size reports)
    |  compile-time registry + app assets
    v
React Native host / restricted local WebView
    |  Android APK/AAB and iOS IPA are signed
    v
Installed Afribit OS (UI assets available without internet)
```

### 9.2 Android serving design

For local web content, the preferred native approach is **`androidx.webkit.WebViewAssetLoader`** exposing packaged assets under a controlled synthetic HTTPS origin, e.g. `https://appassets.androidplatform.net/...`, rather than enabling permissive `file://` access. Define a native facade if the stock React Native WebView does not expose the required asset-loader configuration. Disallow universal file access, unsafe mixed content and unbounded navigation; use per-module path mapping and strict request interception.

### 9.3 iOS serving design

Use `WKWebView` and a restricted local-bundle loading strategy, e.g. `loadFileURL(_:allowingReadAccessTo:)` with a narrow asset directory, or a reviewed custom scheme handler if same-origin needs demand it. Verify fetch/storage/URL behavior explicitly. Do **not** assume that Android's `appassets.androidplatform.net` technique transfers unchanged to iOS.

### 9.4 App portability requirements

For each web app to be packaged:

1. Export a **static client**; no runtime SSR dependency for rendering the initial frame. Backend calls may follow.
2. Use relative/versioned asset URLs and a defined base path; confirm that JS chunks, CSS, fonts and images resolve inside the signed bundle.
3. Avoid reliance on service-worker install events, public-domain cookies or local storage that disappears when changing origins.
4. Use an explicit API base URL and session adaptation strategy; **never embed a production API secret or authorization token in the web asset bundle**.
5. Disable arbitrary external navigation in the module WebView; use approved browser handoff for external sites, and distinguish OAuth/passkey flows from local bundled screens.
6. All HTML/JS/CSS packages must have a content security policy as restrictive as practical; require TLS for network APIs, and reject unsafe script injection where feasible.
7. Define the exact offline behavior: bundled page can load; personalized content/API actions may not.
8. Test Android low-memory WebView process termination and iOS web content process termination; show recoverable UI without re-executing financial commands.
9. Every postMessage bridge command must be versioned, validated, origin/context-bound and rate-limited; there is **no default bridge**.
10. Package and audit any static material that must remain accessible in local-only or fully offline mode.

### 9.5 Why not use `file://` with broad access?

The Android documentation warns that `file://` and `data:` URLs have opaque origins and may not support normal `fetch`/XHR behavior, and that enabling cross-file/universal access weakens security. Using a supported asset-serving approach is more defensible and more predictable. The exact implementation must be verified on physical Android/iOS devices.

### 9.6 Worked example: package a Learn Vite module into the Android build

Assume Afribit owns a small React/Vite learning web frontend, with no privileged browser APIs. This is a **reference recipe**, not proof that the existing education repository currently supports this build without modification.

```text
modules/learn-web/
  src/
  index.html
  vite.config.ts
  package.json
  dist/                      # generated at build time

apps/mobile/android/app/src/main/assets/modules/learn/
  index.html
  assets/*.js
  assets/*.css
```

A deterministic packager should run the locked install and production build with a relative base path, inspect the output, and then copy it to native assets. Simplified local illustration:

```bash
# From the module directory, after a locked install:
npx vite build --base=./

# The build-time packager then validates dist/ and copies it:
mkdir -p ../../apps/mobile/android/app/src/main/assets/modules/learn
cp -R dist/. ../../apps/mobile/android/app/src/main/assets/modules/learn/

# IMPORTANT: Production builds should automate the copy in a reviewed
# script/config plugin and preserve it across Expo native regeneration.
```

The Android native asset handler must then serve that location through a controlled HTTPS-like local URL, for example:

```text
https://appassets.androidplatform.net/assets/modules/learn/index.html
```

This illustrative URL assumes the native loader maps `/assets/` to the Android APK's asset directory. Configure that mapping explicitly; it does not happen just because a React Native `WebView` component exists. `dist/index.html` should resolve its chunk paths beneath `./assets/`, not attempt to fetch JavaScript from the original production website. Treat local asset hash verification as part of the signed-app build report.

On iOS, copy the same reviewed `dist` files into the app's resources using a **build-phase/config plugin** that survives clean native regeneration, then load them with a `WKWebView` local-bundle policy. Do not assume the same Android URL or cookie origin. Validate iOS navigation, storage and API requests separately.

**Proof that it is truly bundled:** install the resulting APK; disconnect from Wi-Fi and cellular data; force-close the app; reopen; enter Learn; verify the lesson and its assets load while a deliberately disabled external web host is unreachable. Inspect the APK contents/build artifact to confirm the actual HTML/JS/CSS are present. A previously cached remote PWA page is **not** sufficient evidence of app packaging.

### 9.7 Worked example: what not to copy from Clans

Clans' React/Vite UI can in principle generate static HTML/JS/CSS, but a locally packaged page uses a **new origin**. Existing passkey/WebAuthn relying-party configuration, same-site cookies, CSRF checks, redirects and service-worker logic must be reassessed. Copying the `dist/` folder alone will not transplant authentication. For P0, the documented safe choices remain system-browser authentication with a deliberate return contract or thin native views over the existing authenticated API. Payment signing must not be moved into that web asset bundle as a shortcut.

### 9.8 Worked example: adding an external/partner service

A partner offers a mobile application but no permitted source code or SDK. Afribit cannot simply embed its APK as a feature inside the iOS/Android binary. Offer an approved URL/deep link and document that it opens an external application, or negotiate an API/SDK/license for a future integrated module. If redistribution rights are later granted, the candidate still passes dependency, permission, privacy and security review. The **single app experience is a product objective, not a reason to disregard platform distribution limits or intellectual property.**

## 10. Native module inclusion specification

A first-party React Native module is a package that exports its routes/screens and capabilities but does not create another top-level RN application, navigation root or payment authority. In the signed binary it uses the same React Native runtime and shared design system. Where a module needs native libraries (e.g. Breez), those libraries must be linked and version-compatible with the **one native app**.

- Only approved native dependencies are allowed; no duplicate conflicting versions of a native module.
- Use Expo development builds/config plugins or reviewed Kotlin/Swift changes; Expo Go is not the acceptance environment for the wallet.
- Keep privileged financial operations inside feature-owned native/SDK boundaries. Importing the SDK package from a random module MUST fail static boundary checks.
- React Native code splitting is not a security boundary; the effective protection comes from deliberately narrow capability APIs, proper key isolation and trusted user confirmation.
- A native module can ship in the initial APK even if its feature flag is disabled; disabled means unavailable, not uninstalled.

## 11. Third-party and partner application admission

The platform can eventually support external partner integrations, but **not as an open third-party runtime in v1**. Any request to “add an app” goes through:

1. **Ownership and permission:** exact rights to source, logos, fonts, content, dependencies and redistribution; AGPL/GPL obligations considered separately from MIT/Apache licenses.
2. **Product fit:** user need, module category, permissions, accessibility, localization and offline value.
3. **Security classification:** what data it sees, whether it needs privileged device APIs, transaction capability, identity handoff or wallet adjacency.
4. **Technical assessment:** source code or documented API, support lifecycle, native compatibility, WebView packaging feasibility, bundle weight, data retention.
5. **Compliance:** Kenya-specific rules, Apple/Google store policy, privacy, consumer protection and contractual issues.
6. **Engineering contract:** manifest, version, stable API, tests, contact owner, kill switch, rollback and incident response.
7. **Acceptance:** build integrity, adversarial cases, physical-device proof, signed release.

A provider might have an excellent UI but unacceptable key custody or licensing. A native app may have excellent functionality but no legal right to repackage it. In both cases the correct integration may be a **provider API or an external link**, not bundling.

---
# PART III — REFERENCE ARCHITECTURE

## 12. Platform architecture overview

### 12.1 Logical diagram

```text
                             USER DEVICE
  ┌────────────────────────────────────────────────────────────────┐
  │                    AFRIBIT OS SIGNED APP                      │
  │  React Native + Expo Router + Afribit Design System           │
  │                                                                │
  │  Home | Explore | You | Module Registry | Connectivity         │
  │                     │                                          │
  │           ┌─────────▼──────────┐                               │
  │           │ Capability Broker  │  policy, intent validation    │
  │           └──────┬─────────────┘                               │
  │                  │                                             │
  │  ┌───────────────┼─────────────────────────────────────────┐   │
  │  │ CLASS B       │             CLASS C                     │   │
  │  │ Learn native  │       Bundled HTML/CSS/JS              │   │
  │  │ Earn native   │       Clans read-only PWA surface       │   │
  │  │ AI UI         │       Lessons / other approved apps     │   │
  │  │ Nearby        │       local, sandboxed WebView          │   │
  │  └───────────────┼─────────────────────────────────────────┘   │
  │                  │                                             │
  │  ┌───────────────▼─────────────────────────────────────────┐   │
  │  │ CLASS A: privileged, signed mobile capabilities         │   │
  │  │ Wallet adapter | Native confirmation | Keystore/Keychain│   │
  │  │ Future Clans signer | Native connectivity when needed    │   │
  │  │ Existing Breez/Spark native Rust-backed engine          │   │
  │  └──────────────────────┬──────────────────────────────────┘   │
  │                         │                                      │
  │  Encrypted local stores, app assets, nonsecret offline cache  │
  └─────────────────────────┼──────────────────────────────────────┘
                            │
          ┌─────────────────┼──────────────────────┐
          │                 │                      │
      INTERNET         AFRIBIT LOCAL            OFFLINE
          │           INFRA MESH                packaged
   ┌──────▼──────┐     ┌────▼──────┐             content
   │ Clans API   │     │ Local DNS │
   │ Tasks       │     │ Local HTTP│
   │ Education   │     │ AI/cache  │
   │ AI gateway  │     │ Chat pilot│
   │ Merchant API│     └───────────┘
   │ Ramp adapters│
   └──────┬──────┘
          │
   BTC/Lightning/Spark and separate approved payment infrastructure
```

**Important:** the network and backend are not inside the APK. The graphic shows relationships, not a permission grant between every box. A WebView cannot directly call the Class A signer.

### 12.2 Trust zones

| Zone | Content/process | Trust assumption | Requirement |
|---|---|---|---|
| Z0 | Internet, external links, provider APIs, remote prompts | Untrusted | Strict input validation, TLS, error isolation |
| Z1 | Bundled HTML/JS WebViews | Signed at release but potentially exploitable | No direct key/device authority; restricted navigation/bridge |
| Z2 | Ordinary RN shell and native feature UI | Application code, potentially exposed to bugs/dependency compromise | Minimum permissions; no indiscriminate secret access |
| Z3 | Feature-owned privileged SDK/native adapters | Reviewed and audited boundary | Narrow methods; explicit user confirmation; lifecycle tests |
| Z4 | OS-backed protected key/credential storage | Device/OS trust, with device-specific limitations | Secure recovery; no backend copies; protected backups |
| Z5 | Independent Clans signatories and oversight | Separate group trust domain | Do not equate with personal wallet keys or login |

The word **Rust** does not automatically create a trust boundary. A Rust library called by untrusted JavaScript without authorization checks is still vulnerable to unauthorized invocation. Likewise, an Expo secure-storage API does not guarantee every device has hardware-backed protection. Implementation must reflect actual platform security and device capabilities.

### 12.3 Runtime responsibilities

- **Shell:** boot, routing, appearance, module registry, locale, network state, accessibility, help, safe analytics, nonprivileged notifications.
- **Module:** own screens, data fetching, validation and domain state; must not rewrite shell navigation or secretly take over another module's storage.
- **Capability broker:** receives a declared intent, identifies the real calling module from host registration, authorizes request type, routes to trusted UI/feature, correlates response.
- **Wallet adapter:** maps SDK events and commands to stable product-facing models; owns SDK lifecycle and network-specific wallet state.
- **Clans adapter:** authenticates against existing Clans service, maps governance/ledger views, never impersonates signatories.
- **Connectivity layer:** reports Internet, local-only, degraded and offline states, validated by actual reachable service checks rather than Wi-Fi icon alone.
- **Infrastructure:** independently operated existing services, not a new monolithic backend created solely for the super app.

## 13. Technology and reusable libraries

### 13.1 Baseline comparison and rationale

| Concern | Recommendation | Why | Alternative / reason not first |
|---|---|---|---|
| Shared mobile framework | React Native New Architecture | Aligns with existing Wallet and TypeScript team; Android/iOS share product UI | Fully native doubles product UI work; Flutter brings separate Dart stack |
| Build/tooling | Expo SDK 58 **for fresh shell evaluation**, with physical-device SDK compatibility spike | Current supported Expo/RN line as of 22 Nov 2026 | Wallet existing Expo SDK 57 must not be blindly upgraded |
| Navigation | Expo Router | File routes, nested stacks, deep linking; one coherent shell | Custom navigation framework adds needless work |
| UI styling | Afribit tokens + NativeWind / React Native Reusables candidate | Copy reusable components into owned design system; avoid hand-coding generic controls | Tamagui, gluestack, React Native Paper all viable; do not mix all of them |
| Icons | One vetted icon set (e.g. Lucide React Native) | Consistency, small contributor cost | Mixed icon fonts cause bloat/inconsistent appearance |
| Data fetching | TanStack Query | Cache/retry/status with explicit domain policies | Raw fetch in every screen gives uneven behavior |
| Local UI state | Zustand or simple React state, by feature | Minimal boilerplate for nonsecret UI state | Heavy global state store unnecessary at P0 |
| Validation | Zod or equivalent explicit schemas | Validate module manifests, API payloads and intents | Blind casts to TypeScript types are insufficient |
| Native secure storage | expo-secure-store / explicit Kotlin-Swift interfaces as appropriate | Leverage OS facilities with device security review | Plain AsyncStorage for seeds is prohibited |
| SQLite/local DB | expo-sqlite or reviewed equivalent | Durable offline lessons, manifests and nonsecret state | Do not store secrets/ledger as unrestricted plaintext |
| Web modules | react-native-webview + reviewed native asset-loading facade | Local packaged HTML, explicit sandbox | A generic `source={{uri: liveUrl}}` is not bundled/offline |
| Localized copy | i18next or established localization layer | Clear English/Kiswahili keys and pluralization | Strings scattered across screens |
| E2E | Maestro/Detox or equivalent after smoke spike | Repeatable device flows | Homegrown large automation framework as first deliverable |
| Native core | Existing Breez SDK native engine first; selective Rust/UniFFI when justified | Avoid unnecessary security rewrite | Adding a second massive Rust stack before launch |

The exact dependency set and versions must be pinned **after** verifying that NativeWind, WebView, Breez Spark, Expo and RN versions compile together. One RN application cannot safely carry two conflicting native copies of the same SDK. Start with one component system; do not adopt every library in this table simultaneously.

### 13.2 Expo 57 vs 58 decision gate

The Wallet evaluation brief reports RN `0.86.3`, Expo `57.0.30`, Breez SDK Spark RN binding `0.26.1`, and a demonstrated Android native build. Expo SDK 58 (released October 2026) targets RN `0.88` and React `19.3`. For a new super app, the current stable is attractive; for an existing native wallet, a forced upgrade might burn time or break integration.

**Engineering decision sequence:**

1. Create a clean Expo 58 shell branch with only navigation/design system.
2. Build a minimal Breez initialization/import spike against the same Expo 58 native project, using a **test-only wallet**, checking Android compile/link/start/stop and iOS build where possible.
3. If this fails materially, run the whole P0 shell on the proven Expo 57 line and record a tracked upgrade ADR. Do not mix Expo 57 in one feature and Expo 58 in another inside a single native binary.
4. No version gets production approval solely because it is newest or because a demo booted.

As of documentation checked 22 November 2026, Expo SDK 58 documentation states Android 7+ and iOS 16.4+ as technical SDK lower bounds. Afribit's **product support floor**, defined later, is deliberately narrower for testability, and individual native dependencies may raise the effective minimum.

### 13.3 Native build requirement

Use a **development build** on real devices from the start. Expo Go does not represent the native runtime that includes Breez, locally implemented WebView asset handlers, custom key protection or any future native signer. Both Android and iOS project configuration should be source-controlled or reproducibly generated with reviewed config plugins.

## 14. Repository and workspace structure

The long-term target is one app workspace with independent packages and connections to existing backend repositories, **not** one giant imported repository with duplicate infrastructure.

```text
afribit-os/
├── README.md                        # what this repo does / fast startup
├── AGENTS.md                        # AI agent scope/safety instructions
├── package.json                     # pinned workspace commands
├── pnpm-workspace.yaml              # or npm workspaces; select exactly one
├── pnpm-lock.yaml                   # example: reproducible lockfile
├── apps/
│   └── mobile/
│       ├── app/                      # Expo Router routes/layouts
│       │   ├── _layout.tsx
│       │   ├── (tabs)/
│       │   │   ├── index.tsx         # Home
│       │   │   ├── wallet.tsx
│       │   │   ├── clans.tsx
│       │   │   ├── explore.tsx
│       │   │   └── you.tsx
│       │   ├── service/[moduleId].tsx
│       │   └── wallet/...
│       ├── src/
│       │   ├── shell/                # registry, boot, navigation, layouts
│       │   ├── security/             # capability broker, authorization
│       │   ├── connectivity/         # internet / local / offline probes
│       │   └── fixtures/             # clearly demo/test-only data
│       ├── assets/
│       │   ├── icons/
│       │   └── modules/              # generated, reviewed web assets
│       ├── android/                  # reviewed/generated native config
│       ├── ios/
│       ├── app.config.ts
│       └── eas.json
├── modules/
│   ├── wallet/                      # RN wallet screens + feature boundary
│   ├── clans/                       # RN views and Clans API client
│   ├── learn/                       # native/client or web module source
│   ├── earn/
│   ├── ai/
│   ├── nearby/
│   └── connect/
├── packages/
│   ├── design-system/               # owned components and tokens
│   ├── contracts/                   # manifest, intents, typed results
│   ├── module-sdk/                  # scoped host access for A/B modules
│   ├── web-module-sdk/              # bounded Class C message protocol
│   ├── module-registry/             # static registry, no arbitrary imports
│   ├── storage/                     # per-module namespaces
│   ├── api-clients/
│   ├── localization/
│   └── test-fixtures/
├── adapters/
│   ├── wallet-breez-spark/          # own SDK imports here
│   ├── clans-api/                  # existing FastAPI contracts
│   ├── merchant-data/
│   └── local-services/
├── tools/
│   ├── pack-module/               # deterministic static asset build
│   ├── verify-bundle/             # manifest/hash/size checks
│   └── verify-boundaries/         # forbidden imports / privileges
├── docs/
│   ├── PRD.md                      # this document / pointer
│   ├── ADR/
│   ├── security/
│   ├── integrations/
│   └── release/
└── .github/workflows/             # or equivalent CI
```

### 14.1 Repository rules

- Pick **one** package manager and lockfile. CI uses frozen/locked installs and prevents accidental floating native dependencies.
- Do not copy Wallet's lab APK tooling, privileged ADB test modules or real seed fixtures into the production mobile package.
- Do not transplant Clans' FastAPI/PostgreSQL/BTCPay services into mobile source; consume contracts through a dedicated API adapter.
- Avoid broad “shared-utils” packages. A package exists only when two real consumers require it, or the trust boundary requires it.
- Feature PRs must keep `main` installable. Accepted work should merge after integration tests rather than remain indefinitely in reviewed branches.
- Native dependency additions, changes to WebView bridging and financial API contracts require security owner review.
- Maintain a software bill of materials and third-party license inventory for each release.

## 15. Module SDK and capability broker

### 15.1 Why a broker?

Clans might want to pay a user or ask the personal wallet for a contribution; Earn may want to display a Lightning destination; a merchant screen may want to ask for a QR. Without a broker, every module would import the Breez SDK directly or pass secrets through a global state store. That would make a simple UI bug or compromised WebView a financial incident.

The broker handles **requests to enter trusted workflows**, not financial authority itself.

### 15.2 Capability API example

```ts
export type CapabilityIntent =
  | {
      kind: 'wallet.preparePayment';
      requestId: string;
      paymentRequest: string;
      purpose: 'clan_contribution' | 'merchant' | 'manual';
      contextId?: string;
    }
  | {
      kind: 'wallet.showReceive';
      requestId: string;
    }
  | {
      kind: 'clans.openGrant';
      requestId: string;
      clanId: string;
      grantId: string;
    }
  | {
      kind: 'app.openService';
      requestId: string;
      serviceId: string;
    };

export type CapabilityOutcome =
  | { requestId: string; status: 'opened' }
  | { requestId: string; status: 'cancelled' }
  | { requestId: string; status: 'pending'; correlationId: string }
  | { requestId: string; status: 'completed'; receiptReference?: string }
  | { requestId: string; status: 'unavailable'; reason: string }
  | { requestId: string; status: 'failed'; code: string };
```

The **host** derives the caller from its module registry/context; it MUST NOT trust a client-supplied `callerId` string as authorization. `opened` is only navigation success, not a settled payment. `completed` must be based on the authoritative feature, not a WebView claiming success. A `pending` operation cannot be retried blindly.

### 15.3 Cross-module permissions

For P0, the only cross-module requests necessary are open service, read locale/theme, navigate to a safe route and request payment preparation through a trusted Wallet review. More expansive APIs must be introduced one at a time, with typed schemas and explicit allowed source/destination pairs.

**No public API:** `signRawTransaction`, `getSeed`, `exportPrivateKey`, `arbitraryNativeCall`, `webviewExecuteNativeCode`, `sendWithoutReview`, `approveClanVoteAsSignature`, or `getAllUserData`.

### 15.4 Class C bridge protocol

The packaged WebView bridge is disabled by default. If it must exist:

```json
{
  "protocol": "afribit.web-bridge/1",
  "requestId": "uuid-generated-by-host-context",
  "type": "app.openService",
  "payload": { "serviceId": "learn" }
}
```

The host must associate a bridge event with the **specific instance and registered module**, validate maximum message length, schema, freshness, route and origin where available, and apply per-module throttles. On Android and iOS, `postMessage` itself is **not** a secure authentication primitive. Never treat a client-side origin string or claimed `requestId` as proof of identity. A WebView may request navigation; its bridge cannot receive private keys or a raw wallet SDK object.

### 15.5 User confirmation authority

Payment preparation can originate from a service module, but the amount, destination, asset/network, fees, payee attribution and total spend must be revalidated inside Wallet. The final approval should occur through a feature-controlled confirmation UI with appropriate device authorization. A screen rendered by the requesting web mini-app is **not** trusted confirmation.

## 16. Wallet integration profile

### 16.1 Current evidence (5 November Wallet brief)

- React Native `0.86.3` / Expo `57.0.30`.
- Breez SDK Spark React Native binding `0.26.1`.
- Native SDK loads and creates/restores wallet on an Android test phone using REGTEST.
- Approx. 1,900 TypeScript tests across wallet domain logic; Welcome/Home/Send previews.
- Mainnet, meaningful Lightning proof, funded new-device recovery, security audit and external users **not proven** in the supplied brief.
- Multiple accepted changes remain unmerged; this integration must start with source/release inventory.
- Blink and Glow are **design references**, not implemented forks according to the newer brief. The older architecture baseline named Blink upstream; this PRD follows the newer implementation reality until repository inspection says otherwise.

### 16.2 Target extraction

Extract the smallest feature that actually runs within Afribit OS:

```text
WalletScreen → WalletFeatureService → AfribitWalletEngine port
                                       │
                                       └─ BreezSparkAdapter → Breez SDK (native)
```

**Keep:** tested SDK binding, explicit payment states, recoverability policy, amount validation, lifecycle ownership and interface. **Examine for duplication:** custom parser, local history ledger, SDK state mirrors and overbroad background coordinator. **Do not rewrite:** proven SDK cryptography or large domain packages merely to replace TypeScript with Rust.

### 16.3 Wallet contract responsibilities

At minimum, the adapter exposes `initialize`, `createOrRestore`, `getBalance`, `listPayments`, `prepareReceive`, `prepareSend`, `sendAfterAuthorization`, `getStatus`, `stop` and diagnostic state through an opaque, typed interface. Actual method names are implementation-owned, not promises that Breez exposes identical SDK calls. Map SDK statuses to a canonical wallet state without inventing confirmations or normalizing an unknown result to failure.

SDK seed/recovery access must follow the chosen onboarding model. The current prototype's TypeScript mnemonic utilities mean we cannot simply claim “the seed never enters JavaScript.” We **can** require no secret leakage to generic React context, WebViews, storage logs, telemetry, screenshots or other modules, and design the eventual privileged native boundary around the actual SDK and recovery requirements. Do not assert hardware-enforced non-exportability unless verified on the device and SDK pathway.

### 16.4 Wallet availability states

`NOT_CREATED`, `LOCKED`, `INITIALIZING`, `READY`, `SYNCING`, `DEGRADED`, `UNAVAILABLE`, `RESTORE_REQUIRED`, `UNSUPPORTED_DEVICE`. The UI should not show a fake zero balance on failure to initialize; it should show why funds cannot currently be displayed and what can safely be done.

### 16.5 Recovery requirements

- An unbacked wallet holding real funds is a critical risk. Backup guidance, verification and recoverability testing are release gates, not styling tasks.
- Test one-device restore, second-device restore after funding, interrupted restore, wrong recovery input and unavailable service.
- Document Spark-specific dependency on operator/exit state; successful seed recovery with healthy Spark infrastructure is **not automatically proof of complete independent emergency exit**.
- Security review must cover secret handling during RN runtime, memory, native bindings, screen capture, clipboard, backup transport and crash reports.
- No Wallet integration grants Afribit backend unilateral spending authority.

### 16.6 Payment policy

- All payment inputs are parsed and displayed as **untrusted requests**.
- Exact amount, currency/network, destination, fees and total are disclosed before confirmation.
- Recheck expiry, prepared quote and balance at authorization time.
- Avoid duplicate payment on timeout; reconcile by stable identifier / SDK state.
- Explicit pending and unknown states; no optimistic “success” for a submitted-but-unsettled payment.
- Clans, AI, Earn and any web module cannot bypass the wallet's review screen.

### 16.7 First production boundary

Use REGTEST/signet/test fixtures for a developer build. Tiny-value mainnet experiments require a deliberate human-approved security and recovery gate, followed by an external review before broad public balances. Ramps are **not** part of initial wallet integration.

## 17. Clans integration profile

### 17.1 What already exists (5 November Clans brief)

The Clans web app (`clans.afribit.africa`) supports real accounts, clan governance, votes, circular grants, Lightning deposits/payouts/repayments and a group ledger. Its reported stack is React/Vite frontend, FastAPI, PostgreSQL, WebAuthn and BTCPay/Lightning backend. **The live fund custody is operator-controlled**, and the UI must continue stating that clearly.

A separate branch develops per-clan on-chain Taproot multisig with signatory keys on phones, watch-only server and an Afribit oversight signature, plus a timelocked recovery path. The brief reports code and tests, not a completed signet pilot or security audit. It cannot be silently promoted into mainnet or given the same trust description as a unilateral personal wallet.

### 17.2 Integration approach

**Step 1: preserve the existing service.** Clans FastAPI/PostgreSQL remains authoritative for membership, governance, grants, activity, deposits and settlement. Afribit OS creates an entry and status display; do not migrate backend data in order to show a mobile UI.

**Step 2: package a permitted frontend slice or write thin native read-only screens.** Some Clans pages depend on browser-origin passkeys and session cookies. A locally bundled WebView has a different origin from `clans.afribit.africa`, so **existing passkey/RP-ID and session assumptions will not simply work by copying Vite `dist/`**. The preferred P0 integration is either: (A) authenticated external-browser/Custom Tabs/ASWebAuthenticationSession entry with clean return, or (B) native read-only screens using explicit API/token handoff after a designed authentication bridge. A packaged read-only web frontend may follow once its auth design is proven.

**Step 3: native feature screens.** Convert My Clans, Clan Overview, Vote Status, Activity and Grant Detail into focused RN screens using a typed Clans API client. Keep existing grant validation server-side.

**Step 4: approved payment request.** Clans issues a verifiable payment request; the personal wallet prepares/authorizes; Clans verifies settlement. No shared ledger or balance mutation in the shell.

**Step 5: privileged signer (later).** Review and port the separate Taproot signing functionality into a security-controlled, native-supported feature only after wallet-code and recovery-path tests; do not expose a raw signer through the generic WebView bridge.

### 17.3 Custody and signing disclosures

- **Personal:** “Your wallet; you control its recovery credentials,” subject to actual engine security model.
- **Clans live Lightning:** “The clan funds are currently operated through an operator-controlled payment node.” Show this before contribution and within treasury detail, not buried in a terms page.
- **Clans multisig pilot:** “Clan signatories control a threshold policy; Afribit oversight is part of normal approvals; delayed recovery is separate.” Do not call this equivalent to personal unilateral self-custody.
- Voting approval and blockchain signing are two different actions with different authentication needs.

### 17.4 Clans critical tests

- Member can see only clans they belong to; revoked membership invalidates access.
- The same vote cannot be cast twice; governance snapshot rules respected.
- Clans continues functioning on the PWA while OS native client is developed.
- Wallet→Clans payment may show pending; no clan credit before authoritative verified settlement.
- Signatory key is never copied into general Afribit profile data.
- Lost phone, roster change, wrong recipient, higher fee, time lock, backup and recovery are exercised in signet before any production multisig funds.
- Very small grant economics and on-chain fee spikes are tested; never imply a Lightning-style fee/latency for a Taproot on-chain payout.

## 18. Other Afribit and partner modules

| Module | Existing direction | P0 composition | Authentication/data boundary | Offline expectation |
|---|---|---|---|---|
| Learn / Bitcoin education | Community education content and learning program | Package a static lesson library plus native directory | Local progress; optional later sync | **Fully available for included lessons** |
| MicroTasks / Earn | `tasks.insats.org` small neighborhood/phone jobs | Bundled directory UI or scoped remote client | Task backend owns approvals and payouts | Browse cached task descriptions; submission requires service |
| Afribit AI | `ai.afribit.africa` project | Native Q&A screen behind approved API or honest preview | No wallet seed/history by default; explicit consent for shared context | Not inherently offline; local model is separate project |
| Nearby / Merchants | BTC Map/OSM and community merchant data | Lightweight read-only client | No payment authority | Only previously cached map/list data |
| Mesh / Connect | `wifi.afribit.africa`, local gateways | Native connectivity/status + bundled local service directory | Local network service allowlist, explicit consent | Local-only operation when gateway reachable |
| Chat / Community | Proposed communications | Informational entry or constrained pilot | Message encryption/retention decision required | Local chat only if actual mesh service exists |
| Insats | Read-only price pulse/purchasing power data | API client / safe preview | Never becomes source of wallet truth or secret transactions | Last-synced data labelled as stale |
| Vukia / ramps | Separate liquidity/provider direction | Disabled service description | Provider legal classification + onboarding + APIs | Conversion requires network/settlement |
| Fedimint/Fedi | Umbrel/federation lab | Not in P0 | Separate federated custody; guardian control | No implied offline settlement |

For each module, the team MUST answer: **What is already deployed? Who owns it? Can its client be legally redistributed? What static assets can be bundled? What server/API is still necessary? Which account/session is required? What does it do offline? What personal/financial data can it see? What happens if it fails?** Document answers in an integration profile before implementing.

## 19. Backend and service architecture

### 19.1 Principle: no backend rewrite required

Afribit OS is an aggregation and user-experience layer over independently operated services. The mobile shell should not become the database of record for every product.

```text
Mobile App
  ├── Identity/session coordinator (optional, never wallet custody)
  ├── Clans API → FastAPI / PostgreSQL / separate payment infrastructure
  ├── Earn API → existing MicroTasks service
  ├── Learn API/content → packaged content + education publishing service
  ├── AI endpoint → approved provider or Afribit-hosted inference
  ├── Merchant data → map/merchant backend
  ├── Connect → local gateway / local service discovery
  └── Wallet → local SDK/Bitcoin network (not Afribit account ledger)
```

### 19.2 API conventions

Use versioned endpoints or explicit API capability negotiation. Each service defines JSON schema, cursor/pagination, request correlation IDs, error codes, request cancellation, authentication lifetime, rate limiting and minimum compatible client version. The shell should not catch all failures and return fake successes. Each API client has a narrow typed surface with contract tests.

### 19.3 Identity and session bridging

Do **not** solve “one app” by taking Clans' HttpOnly browser cookies and putting them in AsyncStorage, or extracting a passkey private key. Prefer native system authentication surfaces, a documented OAuth-style authorization handoff where supported, or a purpose-built short-lived exchange authorized by the existing backend. One identity experience may link accounts; it cannot remove the server's membership checks.

### 19.4 Remote configuration

Remote config MAY disable a compromised module or provider, change safe presentation content, publish service health or restrict an unapproved jurisdictional feature. It MUST be signed/verified where it makes security-sensitive availability decisions and MUST NOT grant a new class of device API, permit private key export, lower confirmation requirements or prevent a user from recovering funds under the wallet's supported recovery model. Failures should favor safe core access and fail-closed risky functions.

### 19.5 Multi-environment separation

Maintain `development`, `test/signet`, `staging` and `production` as distinct configurations, with clear visual badges in nonproduction **financial** screens. Never connect a test environment to a production account or production payout key accidentally. CI should reject production builds containing test-only ADB native modules, debug wallet secrets, public development endpoints or demo settlement banners masquerading as real.

## 20. Infrastructure mesh and offline model

### 20.1 Infrastructure, not smartphone backbone

The Afribit/Kibera Mesh is operated by access points, radios, gateways and servers. Phones join the network as clients. Devices should not be expected to maintain a permanent peer network in the background. The OS can later support selected direct P2P interactions, but those do not replace the infrastructure architecture.

### 20.2 Connectivity states

| State | Meaning | Allowed example behavior |
|---|---|---|
| `INTERNET` | Required external endpoints reachable | Normal services subject to own health checks |
| `LOCAL_ONLY` | Approved local Afribit gateway/services reachable; public internet absent | Local lessons, directory, local chat/AI if hosted |
| `DEGRADED` | Unreliable or partial reachability | Cached screens, transparent loading, bounded retry |
| `OFFLINE` | No reachable network | Packaged Learn, locally saved preferences and safe read-only state |
| `UNTRUSTED_PORTAL` | Captive portal or unknown Wi-Fi impersonates local service | Show verification warning; no credentials, seeds or sensitive POSTs |

Wi-Fi association is not proof that Afribit services are available. Connectivity logic should probe an expected authenticated local endpoint and its certificate/public identity, not simply ping a gateway IP and call it trusted.

### 20.3 Local service security

- Define a local service registry with stable names, metadata, API version and authentication requirements.
- Use HTTPS with appropriate certificate and name validation wherever sensitive traffic traverses local networks; avoid a global “ignore TLS errors” switch.
- Consider DNS collision and hostile captive portals; a local hostname is not proof of operator identity.
- Do not copy the wallet seed, Clans signing keys or global login token into local network storage.
- Community chat and local AI require independent privacy/data handling before activation.
- Log local service failures without capturing user messages, seeds, balances or unnecessary precise location.

### 20.4 Offline financial truth

Packaged pages can render without internet. Normal Bitcoin network settlement cannot be assured merely because a mesh gateway exists. Payment preparation MAY show an unsent draft, but an offline action MUST NOT display “Paid” or queue a raw signed transaction for silent broadcast later without a separately approved design. The UI must distinguish “locally saved,” “broadcast,” “pending confirmation” and “settled.”

---
# PART IV — MINIMUM REQUIREMENTS, SECURITY, RELEASE & OPERATIONS

## 21. Minimum requirements

The following are **proposed product requirements** for a first alpha. They are **not** a claim that Breez/Spark, Clans WebAuthn or every other plugin has already been tested on the stated device. The supported-device policy must be finalized from a device matrix and compiled native SDK constraints.

### 21.1 Mobile-device requirements

| Requirement | Android Developer Alpha | iOS Developer Alpha | Notes |
|---|---|---|---|
| Minimum product OS | **Android 10 / API 29** proposed | **iOS 16.4+** proposed | Expo SDK 58 technical Android baseline is older, but product floor is deliberately more conservative; SDK and feature requirements may raise it |
| Supported architecture | arm64-v8a; additional architectures only if native SDK build proven | Apple-supported iPhone target architectures | Confirm SDK ABIs, not assumed |
| RAM | **2 GB minimum test target**, 3 GB recommended | Device-supported by iOS version | 2 GB is a validation goal, not guaranteed good performance |
| Free storage | **At least 400 MB** recommended for install/update/cache testing | Similar headroom | Exact installer/runtime requirements must be measured |
| Screen | Small Android phone ~360dp width; notched iPhone | Compact and larger iPhones | Dynamic text, safe areas, landscape exclusion policy documented |
| Camera | Optional except QR scan feature | Optional | Manual paste alternatives required |
| Biometrics | Optional, device dependent | Optional, device dependent | PIN/passcode/recovery fallback policy reviewed; never fake hardware support |
| Network | 2G/3G-like latency, intermittent 4G and Wi-Fi; offline scenarios | Same behavior model | Public and local-only modes are separate |
| Required OS services | Android System WebView updated and compatible | WKWebView via iOS | Test local bundled modules |
| Store distribution | Signed APK for internal tests; AAB for Play | Signed IPA/TestFlight/App Store as appropriate | No third-party APK embedding |

**Clans signing caveat:** the existing Clans passkey-PRF design has stronger platform/authenticator requirements than the shell itself; the supplied briefing specifically discusses iOS 18+ PRF paths and PIN fallback. The iOS 16.4 shell floor does **not** imply every phone at that version can act as a multisig signatory. A signing-capability compatibility screen and security review are required before exposing that role. The reported six-digit PIN fallback carries offline brute-force risk and must not become a default native mainnet solution without separate approval.

**Android 9/API 28 support** is a possible expansion after the P0 compatibility tests, not a promise. Android 11 on one low-end phone is already reported as tested by the Wallet brief; the other rows require evidence. App stores and native dependencies may impose platform-specific requirements that supersede these proposed floors.

### 21.2 Minimum product performance targets

These are **engineering targets to measure**, not preexisting benchmarks:

| Metric | Proposed target / rule | Method |
|---|---|---|
| Cold launch to usable Home | Prefer **≤ 4 s** on target 3 GB Android; track 2 GB separately | 20 runs, release build, warm/cold data separated |
| Home usable without network | **100% of tested offline launches** after install | Airplane-mode launch |
| Navigation to bundled lesson | Prefer **≤ 2 s** once app is open | Offline physical-device test |
| App unresponsive | No sustained main-thread block over 1 s on ordinary navigation | Profiling / manual reproduction |
| Memory | No repeatable OS kill moving Home → Learn → Clans preview on 2 GB test phone | Low-memory QA |
| Initial download | Track by architecture/ABI and installed assets; establish **soft budget of 120 MB download** before committing large packs | Actual signed artifact measurement |
| Local module payload | Prefer **≤ 10 MB compressed per ordinary packaged web module**; explicit exception for content packs | Build report |
| Offline cache | Bounded quota and user controls; no unbounded media growth | Storage stress test |
| Network usage | No surprise background downloads of large packs over mobile data | Metered-network QA |

The 120 MB and 10 MB numbers are **initial budgets**, not guarantees. The Breez native library, RN runtime and additional bundled clients may require revising them using measured tradeoffs. Do not compromise key safety to meet an arbitrary download number.

### 21.3 Minimum engineering workstation/toolchain

- Current maintained Node LTS line compatible with the chosen Expo SDK (Expo 58 documents Node 22.13+; use a pinned compatible Node 24 release if verified).
- One locked workspace package manager; TypeScript strict mode and consistent lint/format.
- Android Studio/SDK, supported JDK and NDK versions from the selected React Native/Expo template, and at least two physical Android test devices (one entry-level).
- macOS/Xcode build capacity or appropriately controlled iOS build service; local iOS builds require Apple platform toolchain. Expo SDK 58 documentation identifies Xcode 26.4+ for its reference line.
- Signing credentials owned by Afribit organization with least privilege and recovery procedures; not kept in the repository.
- Secure CI with build artifacts, provenance, audit logs, dependency checks and immutable release tags.
- Test-only Breez credentials and dedicated network environment. No meaningful funds required to build the first shell.

### 21.4 Minimum module requirements

To enter a signed alpha, a module MUST have: unique ID and owner; reproducible build; license review; Android/iOS loading proof for applicable module type; manifest; network domain allowlist; clear auth handoff; empty/offline/error behavior; accessibility labels; analytics minimization; versioned API; threat classification; test fixture; bounded bundle size; a disable/rollback procedure; support contact or team owner.

**A new module does not need its own Android package name or iOS bundle identifier.** It is part of Afribit OS unless it remains a separately distributed product.

### 21.5 Minimum backend requirements

The shell can function without a new central backend. For any active server integration, require HTTPS, versioned API contracts, scoped authentication, request/response limits, operational ownership, uptime/health monitoring, backups, incident route and explicit data retention. The service—not the shell—remains responsible for authoritative data and settlement.

## 22. Data privacy, separation and retention

### 22.1 Data classes

| Data | Classification | Storage and access rule |
|---|---|---|
| Wallet recovery seed/private signing material | Critical secret | Feature-owned protected storage; never remote module/telemetry |
| Clans signatory key | Critical secret, separate from personal wallet | Its own protected lifecycle and recovery rules |
| Session tokens/passkey material | Sensitive | Platform/session secure store; no copying from HttpOnly browser cookies into plain JS storage |
| Transaction details, group membership, payout proofs | Sensitive financial/community data | Least privilege; separate domains; encrypted where appropriate |
| Lesson progress and bookmarks | Personal but low sensitivity | Local by default; optional sync by consent |
| AI prompts, messages, uploads | Potentially highly sensitive | Explicit purpose/retention policy, no implicit wallet context |
| Location and nearby searches | Personal | Approximate by default; explicit location permission only when needed |
| Crash/usage telemetry | Minimally identifying operational data | No seeds, invoice secrets, raw chats, transaction history or precise location by default |
| Packaged module files and public lessons | Public static content | Signed bundle, integrity/provenance checks |

### 22.2 Cross-module data sharing

Shared navigation state (`module route`, `locale`, `theme`) is acceptable. Private wallet activity, complete clan ledgers, task earnings, AI prompts and chat records are **not** global app state. A service requesting context from another module needs a purpose-specific contract and consent when appropriate. A shared email/username does not authorize sharing a ledger.

### 22.3 Storage namespaces

Each module owns its local data and migration lifecycle. `wallet/*`, `clans/*`, `learn/*`, `ai/*` are conceptual namespaces, not security guarantees by themselves. More sensitive material requires OS/native separation beyond namespacing. On logout, remove only data whose deletion is safe and authorized; never accidentally delete the sole remaining recovery data for user-owned funds.

## 23. Security baseline and threat model

### 23.1 Threat assumptions

Assume a malicious web page, compromised mini-app dependency, hostile Wi-Fi, stolen unlocked device, malicious deep link, counterfeit QR, compromised backend operator, corrupted cached assets, expired authentication, malicious AI prompt, excessive financial retries and an upstream SDK/provider outage are all plausible.

### 23.2 Non-negotiable policies

**SEC-001:** A Class C module MUST NOT receive private keys, seed words, decrypted signing material or a generic native bridge.

**SEC-002:** A Class B module MUST NOT import wallet/native signer SDK APIs or access their private storage. Static import boundaries are enforced in CI.

**SEC-003:** The app MUST distinguish personal self-custody, Clans operator custody, multisig community custody and any later federation custody in user-facing language and accounting.

**SEC-004:** Payment approval MUST occur in a trusted Wallet-owned flow; requesting module cannot submit authorization on behalf of a user.

**SEC-005:** Unknown payment outcomes MUST be reconciled rather than retried blindly. Duplicate taps/idempotency are mandatory tests.

**SEC-006:** Production distributions MUST exclude test wallets, ADB testing modules, debug menus capable of altering settlement, hardcoded secrets and unreviewed log collectors.

**SEC-007:** A compromised provider may be disabled without disabling users' supported fund recovery/exits. Remote feature flags do not grant new signing powers.

**SEC-008:** All code/artifacts entering the APK/IPA MUST have source ownership, license approval, pinned dependency integrity and a reproducible build record.

**SEC-009:** App-store policies and Kenyan regulatory classification MUST be reviewed before releasing virtual-asset conversion, custody, merchant processing or task-to-crypto reward experiences. A non-custodial claim alone is not a universal licensing exemption.

**SEC-010:** No AI component may initiate payments, export seeds, alter clan approvals or act as an unattended financial agent merely because it can call tools in the UI.

### 23.3 Attack scenario → required behavior

| Attack or failure | Required response |
|---|---|
| Bundled web lesson posts `wallet.sign()` | No API; schema rejects; log safe violation event |
| Malicious deep link contains payment request | Open parsed recipient and amount for user review; no auto-pay |
| Rogue mesh captive portal claims `wifi.afribit.africa` | Reject sensitive access without correct trust verification; show network warning |
| Clans API compromised | Personal wallet remains spendable/isolated; no keys sent to Clans |
| Wallet SDK unavailable | Shell and other modules operate; Wallet shows explicit degraded state |
| Network drops after broadcast | Preserve pending/unknown state, reconcile; never double-send |
| App crash during consent | Reopening must not reissue approval or sign automatically |
| Browser sign-in expiration | Return to deliberate reauthentication without exposing raw tokens |
| Client update introduces malicious static module | CI/provenance review, signed release, controlled rollout, rollback/disable |
| Phone stolen | Protected access, recoverability guidance, key rotation strategy where possible |
| CI signing key stolen | Revoke/rotate, block deployments, investigate release provenance |

### 23.4 Security review levels

- **Ordinary UI/copy:** lint, accessibility, screenshots, device smoke.
- **Network/module adapter:** contract tests, auth scope, URL and origin allowlists, input fuzzing, security review.
- **WebView bridge/native capability:** explicit security review, threat-model update, Android+iOS adversarial proof.
- **Wallet key/recovery/payment and Clans signer:** independent security review, exact transaction signing tests, funded recovery test, supply-chain review, incident runbook and release approval.

## 24. Platform, policy and regulatory gates

### 24.1 Kenya

Kenya's Virtual Asset Service Providers Act, 2025 and the Virtual Asset Service Providers Regulations, 2026 are listed by the Capital Markets Authority as part of the applicable framework. Classification must be based on **the actual activity**, including who controls private keys/funds, who routes or intermediates fiat/virtual-asset flows, who sets rates, who offers payments and which licensed entities act as providers. This PRD does not assert that software-only provision, a federation, P2P coordination, on/off-ramp referral or group treasury operations are categorically unregulated.

Before a financial provider is enabled, record a legal assessment, counterparty identity and licensing posture, Kenya data/protection obligations, complaints/refunds/reversals, AML/KYC allocation, fiat/Bitcoin funds flow diagram, fees/disclosures, incident responsibility and jurisdictional distribution policy. If an item remains unresolved, ship an unavailable state rather than a real-money workflow.

### 24.2 Apple App Store

As of review on 22 November 2026, Apple's guidelines distinguish wallet apps (organization developer requirement), exchanges (appropriate regional permissions) and cryptocurrency rewards for certain tasks. **The MicroTasks “earn sats” workflow needs a specific iOS policy review**, rather than assuming a working Android feature may ship unchanged to iOS. Apple also treats offered HTML5/JS mini apps under special rules, including restrictions on exposing native APIs, privacy consent, metadata/index and universal-link obligations. Bundling first-party content and carefully defined in-app features is preferable to marketing a generic third-party app store.

### 24.3 Google Play / Android

For Play distribution, build and submit an **AAB** (not just a sideload APK) and allow Play to distribute device-specific APKs. Play policy restricts downloading executable native code outside approved delivery, even though some interpreted WebView code is treated differently. A policy allowance for JavaScript does **not** mean any arbitrary remote code can obtain native wallet privileges.

### 24.4 Product implication

Financial and task-reward modules may require **platform and jurisdiction capability gates**. Gates should be transparent, narrow and reviewable. An iOS build without a regulated ramp should still provide safe nonfinancial features; disabling a ramp should not prevent withdrawal/recovery of user-controlled Bitcoin.

## 25. Provider integration standard (future ramps, AI, maps, wallets)

### 25.1 Provider adapter interface

Every provider is an untrusted external dependency until reviewed. Its adapter must state: jurisdiction, capabilities, rates and expiry, fee schedule, data retention, custody/funds flow, required KYC, dispute procedure, service health, dependency/credential model, rate limits and exit plan. Provider-specific user identifiers should not become the sole identity in Afribit OS.

### 25.2 On-ramp/off-ramp illustration

```text
User → Wallet → Add Money / Cash Out
                ↓
          Eligibility / legal gate
                ↓
          Provider selection / quote
                ↓
     Exact fee/rate/recipient review
                ↓
    Provider's compliant KES rail / settlement
                ↓
       Bitcoin arrives at user's own wallet
                ↓
       Reconciliation and receipt
```

The above is a **desired noncustodial product pattern, not a guarantee** that any given M-PESA provider can or will operate without custody, licensing or settlement risks. Never use a raw user confirmation button as proof that M-PESA was paid or irreversible. Reversals, expiry, fraud, dispute rules and duplicate events require their own design. Third-party account balances must not be represented as user-owned Bitcoin on the personal wallet home unless they genuinely are spendable through that wallet.

### 25.3 Provider kill switch and recovery

Disable only the unsafe integration, with explicit user-facing status. Preserve accessible exported statements, claim receipts, legitimate dispute paths and personal wallet recovery. Avoid an architectural dependency where turning off one provider crashes every module.

## 26. Quality assurance and acceptance

### 26.1 Testing layers

1. **Unit/contract:** manifest validation, route consistency, amount formatting, capability intent schema, permission policy, storage migration, offline classification.
2. **Module integration:** build static Vite assets, verify file hashes/path resolution, host WebView origin restrictions, API/auth session expiry, cancellation.
3. **Native build:** Android and iOS compile/link, true native SDK startup, bundled asset proof in signed release, proguard/minification, ABI/architecture verification.
4. **Device E2E:** two physical Android phones with different OS/RAM, at least one iPhone; navigation, orientation, safe-area, accessibility, keyboard, low-memory.
5. **Security:** malicious URLs, rogue bridge messages, forbidden imports, payment duplicate races, transport/network failures, secret redaction, tampered module assets.
6. **Finance gates:** funded restore, staged live payment once approved, uncertain settlement handling, genuine approval screen, signer and recovery independent verification.

### 26.2 P0 acceptance checklist

| ID | Test | Required evidence |
|---|---|---|
| AC-001 | Install signed debug/alpha APK on target phone | APK hash, screenshots, launch logs |
| AC-002 | Open Home without internet after installation | Airplane-mode recording |
| AC-003 | Move Home → Explore → Learn → Home with system Back | E2E trace |
| AC-004 | Packaged Learn lesson opens with API/network unavailable | Proof UI assets loaded from app package, not HTTP website |
| AC-005 | Module registry lists owner, status, offline support | Manifest validation/test |
| AC-006 | Rejected module cannot access wallet SDK or seed via import/bridge | Negative tests + boundary lint |
| AC-007 | Unavailable Clans API does not crash Home | Device offline/failure recording |
| AC-008 | Clans entry shows current custody disclosure | Screen capture + copy review |
| AC-009 | Wallet integration uses a clear test-network mode, if included | Real SDK event/provenance evidence |
| AC-010 | No financial secrets in production logs/telemetry | Automated redaction test + manual review |
| AC-011 | Second developer can clone, build and send small feature PR | Reproduction notes and merged CI |
| AC-012 | iOS project builds or blocker is documented with owner/date | Build log and target simulator/device test |
| AC-013 | One WebView process crash recovers without losing shell navigation | Device test |
| AC-014 | App displays `INTERNET`, `LOCAL_ONLY`, `OFFLINE` accurately | Controlled network tests |
| AC-015 | APK/AAB package asset inventory matches registered modules | Bundle inspection report |
| AC-016 | No raw backend keys, production wallet secrets or test-only native modules in release | Automated artifact scan |

### 26.3 P1 financial acceptance is separate

Neither `AC-001` nor successful navigation releases users' money. Before mainnet/public wallet beta: second-device funded recovery, SDK/engine failure scenarios, security audit, signed wallet confirmation, fee/reconciliation tests, precise supported device list and release approval. Before live Clans native signing: signet full-cycle rehearsals, timelocked recovery validation, key migration review and independent audit. Before a ramp: legal/provider acceptance and transaction-reversal/settlement tests.

## 27. Release engineering, signing, provenance and rollback

### 27.1 Version scheme

`Afribit OS 0.1.0-alpha.1` is the first named developer target. App semantic version is distinct from Android `versionCode` and iOS `CFBundleVersion` build numbers. Each module has its own source revision, contract version and packaged artifact hash. A module can be maintained independently even though consumers receive it inside one signed app update.

### 27.2 Release evidence bundle

Each release candidate should publish internally:

- signed Android artifact(s) and iOS build reference;
- source commit and dependencies/lockfile hash;
- module registry and static asset manifest with hashes;
- SBOM and third-party license report;
- build toolchain version and runner identity;
- unit/integration/E2E results and device list;
- known limitations and disabled functionality;
- security/financial sign-off for the capabilities actually enabled;
- rollback or last-known-good deployment plan.

### 27.3 Rollback strategy

A broken server-backed module can often be disabled remotely. A broken local packaged UI or native library generally requires a new signed app release, a store-controlled rollout halt, or an existing approved OTA mechanism where allowed and safe. Do **not** depend on silently changing financial code on deployed devices. Keep backend contract compatibility through phased rollout so old app versions do not break abruptly.

### 27.4 Organizational ownership

Afribit organization controls app signing, publishing, domain, DNS, certificates, CI credentials and module release permissions. At least two authorized maintainers have recovery/continuity procedures. Third-party or personal accounts may have delegated rights, but must not become the sole release authority.

## 28. Failure handling, support and observability

### 28.1 Standard error model

`OFFLINE`, `LOCAL_ONLY`, `UNAUTHORIZED`, `SESSION_EXPIRED`, `SERVICE_UNAVAILABLE`, `MODULE_INCOMPATIBLE`, `UPDATE_REQUIRED`, `VALIDATION_FAILED`, `PAYMENT_PENDING`, `PAYMENT_UNKNOWN`, `RETRY_SAFE`, `RETRY_UNSAFE`, `UNSUPPORTED_DEVICE`, `RESTORE_REQUIRED`.

All errors must use human-readable copy with action choices. “Something went wrong” is inadequate for a payment whose status may be unknown. A network error is not the same as a transaction being rejected or refunded.

### 28.2 Minimal event telemetry

Allowed product events: `home_opened`, `module_launched`, `module_failed_to_load`, `lesson_opened`, `auth_handoff_cancelled`, `network_state_changed`, `webview_process_restarted`, and crash stack traces after sensitive-field scrubbing. Financial payments should expose health metrics via non-identifying aggregates and explicit opt-in diagnostics, not uploaded raw histories. AI prompts and chat messages must not appear in debug analytics by default.

### 28.3 Support requirements

The app should offer Help/Report issue with an anonymized diagnostic code, module version and environment. Users must be able to submit a report without sending recovery words, screenshots of their seed or public financial logs. A support person is never entitled to demand the user's seed or an unsolicited signing action.

---

# PART V — IMMEDIATE IMPLEMENTATION REFERENCE

## 29. First implementation: a real app, not a new architecture laboratory

The first build target is **a runnable signed Afribit OS shell with bundled Learn, visible Wallet/Clans destinations and safe connectivity states**. That proves the critical super-app mechanic before integrating two complex financial systems.

### 29.1 Build slices and completion gates

#### Slice 00 — Source inventory (small, bounded)

**Inputs:** actual Wallet source, Clans source and current contracts. **Output:** `docs/integrations/INVENTORY.md` recording repo URLs, latest tested commits, current build commands, SDK versions, exports/API surfaces, authentication assumptions, licensing and migration blockers. Do not treat the 5 November briefs as current branch status on 22 November without checking source.

**Done:** another developer can identify which repository contains each piece and which artifact is safe to integrate.

#### Slice 01 — Signed shell

Create one Expo Router RN app with theme tokens, typed registry, Home, Explore, Wallet placeholder, Clans placeholder, You and error states. Build on real Android immediately. **Done:** APK installs, launches offline, navigates correctly and can be reproduced from locked dependencies.

#### Slice 02 — One truly bundled app

Create a small static Learn module (or port a suitable existing owned web lesson), produce `dist/` and package it as a Class C module in the signed Android/iOS application. Prove it loads while Airplane mode is on. **Done:** packaged asset paths/hash are inspected and a developer can change the lesson, rebuild the app and observe that change without any website deployment.

#### Slice 03 — Reusable module admission machinery

Implement module manifest validation, `ModuleHost`, `availability`, safe URL handling, disabled-by-default bridge and module error boundary. Add build-time asset packager and boundary tests. **Done:** one additional safe module can be added by following docs without touching wallet code.

#### Slice 04 — Clans connectivity

Create Clans entry, signed-out/open/read-only states, current custody notice and safe auth handoff. Use external system auth surface initially if the locally packaged web origin is incompatible with passkeys. **Done:** existing users can reach the correct Clans account or be asked to sign in, and production Clans is not rewritten.

#### Slice 05 — Wallet prototype integration

Use the Wallet's existing tested SDK adapter in the shell under test-network controls. Start/stop, state lifecycle, create/restore, receive/send preparation and history are verified from a real device; fake UI balance is never confused with actual SDK state. **Done:** wallet test journey works without exposing its SDK to Learn/Clans web clients.

#### Slice 06 — Cross-feature product journey

Wire a **test-only** Clans contribution request through `wallet.preparePayment` to trusted Wallet UI, then verify pending/settlement mapping. **Done:** no silent auto-pay, duplicate record or shared key material.

#### Slice 07 — Contributor alpha

`0.1.0-alpha.1` tag, release notes, known issues, two-device verification, second-developer setup, demo walkthrough and a reproducible APK/AAB build. **Done:** a new dev submits a minor UI fix and sees it in the installed alpha.

### 29.2 Suggested first 12 tickets

| Ticket | Owner type | Deliverable | Priority |
|---|---|---|---|
| OS-001 | Mobile | Expo workspace, lockfile, dev build, Android install | P0 |
| OS-002 | Design | Token set: typography, palette, spacing, icon rules | P0 |
| OS-003 | Mobile | Expo Router tab/stack navigation | P0 |
| OS-004 | Product/mobile | Home launcher, Explore directory, search/filter | P0 |
| OS-005 | Core | Static `ModuleRegistry` with manifest schema validation | P0 |
| OS-006 | Web/mobile | Build-time Vite asset packager and Learn module | P0 |
| OS-007 | Security/native | Android WebViewAssetLoader implementation + tests | P0 |
| OS-008 | iOS/native | WKWebView packaged asset loading + tests | P0 |
| OS-009 | Mobile | Offline/local-only/online capability indicator | P0 |
| OS-010 | Clans | Current API/auth mapping and read-only entry | P0 |
| OS-011 | Wallet | SDK 57→58 compatibility spike (or retain 57) | P0 |
| OS-012 | DevEx/security | CI checks, README, AGENTS.md, package/license scan | P0 |

Ticket ordering is a dependency guide, not permission to delay a running build while every policy package is completed. Integrate in small increments.

### 29.3 Shell boot contract

```text
1. Read embedded module registry and local preferences.
2. Render shell immediately; show a non-blocking boot state.
3. Determine platform/device constraints.
4. Load packaged module metadata.
5. Start connectivity checks asynchronously.
6. Initialize nonsecret session state as needed.
7. Launch Wallet SDK only when Wallet is entered or a clearly justified lifecycle requires it.
8. If service unavailable, show feature-level error; Home still works.
```

**Do not block initial app startup on AI, wallet network, Clans API, push notifications, remote config or public internet.**

## 30. Starter commands and scaffolding guidance

These are **illustrative local development steps** for a fresh shell. They do not claim to have built a repository or validated Breez against Expo 58. Use the exact project and toolchain versions agreed in the compatibility spike.

```bash
# New standalone shell prototype: creates an Expo SDK 58 starter.
npx create-expo-app@latest afribit-os --template default@sdk-58
cd afribit-os

# Check compatibility of dependency versions against Expo.
npx expo-doctor

# Install native dev-client for SDK integrations (not Expo Go).
npx expo install expo-dev-client

# Navigation comes with the default template; install extra
# packages only after verifying their SDK 58 compatibility.

# Produce a local Android development build when Android SDK is ready.
npx expo run:android

# iOS: run on macOS with compatible Xcode, after native dependencies are verified.
# npx expo run:ios
```

If integrating directly into the existing Wallet monorepo, **do not run the above as an excuse to replace its native project or lockfile**. Prefer a temporary shell proof repository, then choose one native version before moving Wallet code. For team CI/release, define reproducible scripts (`typecheck`, `lint`, `test`, `build:modules`, `verify:modules`, `build:android`, `build:ios`) using your selected workspace manager; do not embed production secrets in scripts.

### 30.1 First demo scenario

1. Install `Afribit OS 0.1.0-alpha.1` on entry-level Android.
2. Open Home with no sign-in and view clear service destinations.
3. Open All Services and inspect Learn/Wallet/Clans status.
4. Activate Airplane mode and open a truly packaged Learn lesson. It renders from the signed app assets.
5. Return to Home; show Clans' clear network-dependent state and current custody disclosure.
6. Open Wallet test mode (if its integration gate passed); display actual SDK state or a transparently marked preview, never a fake funded wallet.
7. Attempt an unauthorized Class C `wallet.sign` message; show rejection in test evidence without revealing a secret.
8. Restore connectivity; open Clans via safe auth pathway and demonstrate read-only clan data if credentials are available.
9. Show that the independent Clans web app still operates outside Afribit OS.
10. Have a second developer change an icon/copy, merge and build a new APK with the change.

This demonstrates one application and many controlled capabilities, rather than a permanently unfinished wallet lab.

## 31. Design system reference

### 31.1 Visual character

Afribit should be calm, approachable, premium enough for financial confidence, and easy for first-time mobile users. Avoid cramped cards, dense account dashboards, walls of microcopy and novelty animation. The balance view inside Wallet should use large readable numbers and prominent Send/Receive controls. Clans should look equally simple on the surface despite complex governance underneath.

### 31.2 Tokens (initial design proposal)

| Token | Suggested starting value | Notes |
|---|---|---|
| Primary accent | `#F7931A` | Bitcoin/Afribit orange; verify official brand assets |
| Light background | `#FFFFFF` / near-white surfaces | High readability |
| Dark background | `#101113` | Avoid pure black everywhere |
| Main light text | `#16181B` | WCAG contrast verified |
| Border | Neutral low-emphasis | Focus, avoid clutter |
| Spacing | 4-pt base scale | e.g. 4, 8, 12, 16, 24, 32 |
| Corner radius | 12–20 px for major surfaces | Avoid generic identical cards everywhere |
| Minimum touch target | At least 44×44 pt/dp equivalent | Larger for primary payment actions |
| Typography | Inter or licensed platform-friendly font | Do not distribute fonts without rights |

Token values are provisional. Official Afribit brand and accessibility testing can change them; component APIs remain stable.

### 31.3 Components to build once (or adapt from licensed library)

`AppHeader`, `ServiceTile`, `ServiceGrid`, `ServiceDirectory`, `BottomTabs`, `ModuleHost`, `ModuleErrorState`, `OfflineNotice`, `LoadingState`, `AmountDisplay`, `CurrencyReference`, `ActionButton`, `ConfirmSheet`, `QRScannerFrame`, `ReceiptStatus`, `SecurityDisclosure`, `ConnectivityBadge`, `FormField`, `EmptyState`, `AccessibleIconButton`, `LanguagePicker`, `PermissionPrimer`.

Do not build each component from primitive `View`/`Text` repeatedly across features. Copy/adapt vetted components from a licensed reusable library into the shared design system and own them. Avoid framework churn: choose a single styling and component approach after a small-device compatibility test.

### 31.4 UI acceptance

- One primary action per screen; secondary actions visible but not competing.
- Balances/fees/use of KES reference distinguished from spendable Bitcoin.
- All financial buttons disabled or clearly labeled in demo/unsupported states.
- Clear back navigation from any module to Home.
- No full-screen unavoidable sign-up before free educational content.
- Recovery words are never shown in screenshots, support flows or demo fixtures.
- Real localization, font scaling, screen reader and reduced-motion tests before beta.

## 32. AI developer / coding-agent instructions

Place the following contract, or a shorter pointer to this PRD, in `AGENTS.md`:

```text
AFRIBIT OS DEVELOPMENT RULES

1. Build a real, bootable Android/iOS React Native product incrementally.
2. The signed mobile shell owns navigation, module registry and capability gating.
3. Do not merge Wallet seed storage, Clans signer keys or profile credentials.
4. Do not expose raw signing APIs to web modules, AI, Earn or general UI.
5. Do not rewrite Breez crypto, Clans backend or existing service infrastructure
   unless an approved ADR and tests demonstrate necessity.
6. No wallet mainnet, off-ramp, custodial/federation launch or real funds
   through an unapproved prototype.
7. Do not claim a web UI is bundled if the application fetches its interface
   from a remote website at runtime.
8. Every new module must have manifest, owner, permissions, license, tests,
   offline and failure behavior, and signed-release evidence.
9. Fix bugs and merge validated small PRs frequently. Do not leave a
   growing backlog of accepted unmerged branches without explicit reason.
10. State what was built and tested on actual devices; never invent evidence.
11. When unsure about a financial authorization, fail closed and escalate.
12. Treat provided old briefing documents as snapshots, not live source truth.
```

Every AI coding task should include: exact feature request; files allowed; forbidden imports; target branch; acceptance tests; environment (mock/test/signet/prod); definition of done; expected screenshot or device evidence; and whether it touches a Class A trust boundary.

## 33. Definition of Done

### 33.1 Ordinary UI/module change

The app builds; screen is reachable from correct navigation; offline/empty/error states tested; accessible labels and small screens covered; module version and dependencies are recorded; no forbidden privileges; at least one physical device tested for user-facing behavior; the change merges to main with a passing pipeline.

### 33.2 Packaged Web Module

All above **plus** reproducible Vite/static build; license and asset inventory; module manifest; Android and iOS local-asset proof where supported; no remote UI dependency for bundled screens; safe origin and navigation; bridge disabled or schema-reviewed; network domain allowlist; no embedded credentials; WebView crash/restart recovery.

### 33.3 Financially sensitive feature

All above **plus** approval of actual transaction authority, seed storage review, failure/race conditions, reproducible SDK integration, backup/restore rehearsals, transaction signing destination/amount validation, independent review and platform/regulatory review for the enabled service.

## 34. Open decisions and ADR queue

| ADR candidate | Question | Default until resolved |
|---|---|---|
| ADR-024 | Shell baseline Expo 58 versus existing Wallet Expo 57 | Choose one after Breez native spike |
| ADR-025 | Bundled WebView asset loading facade Android/iOS | Implement Android AssetLoader and verified iOS local bundle loader |
| ADR-026 | Clans passkey/authentication handoff | Browser/system auth or native read-only client; no cookie copying |
| ADR-027 | Personal wallet recovery and signing boundary | Preserve existing proven flow; no production funds before review |
| ADR-028 | Final primary bottom navigation labels | Home · Wallet · Clans · Explore · You |
| ADR-029 | Static module size budget and content pack split | Small install-time core, no on-demand native modules in P0 |
| ADR-030 | Account linking and user deletion rules | Independent identities, explicit links |
| ADR-031 | Signed remote capability config and emergency disable | Only non-privilege-expanding availability changes |
| ADR-032 | iOS MicroTasks crypto reward compliance | Disabled or informational until reviewed |
| ADR-033 | Support floor Android 9/10 and iOS 16.4 | Alpha Android 10 + iOS 16.4; test and revise |
| ADR-034 | Clans native multisig signer implementation | Experimental signet only; separate wallet key domain |
| ADR-035 | First merchant map data provider/cache | Read-only, provenance-checked, no fabricated entries |

**These open decisions do not block Slice 01 and Slice 02.** The goal is to work immediately while containing unresolved risk at the relevant module boundary.

## 35. Reference sources and traceability

This document was assembled from existing Afribit planning records and public technical/platform documentation. Original app implementation claims come from user-supplied briefs, **not independent code inspection**.

### 35.1 Internal source snapshots

- `Afribit_OS_Whitepaper_v0.4_2026-10-11.docx` — governing constitutional architecture and custody principles.
- `Afribit_OS_Architecture_Baseline_v0.3.md` — accepted React Native/Rust/mesh/module direction, wallet/Blink reference and federation policy.
- `AFRIBIT_OS_SUPER_APP_PRODUCT_AND_DESIGN_BLUEPRINT_v0.1.md` — navigation-first product integration concept, original screen and component inventory.
- `Afribit_OS_MVP_Showcase_Specification_v0.2.md` — first-run, screens, security and offline demo patterns.
- `AFRIBIT-WALLET-EVALUATION-BRIEF.md` — **5 November 2026 status** of RN/Expo/Breez SDK, tests, unmerged branches and security limitations.
- `clans-briefing-2026-11-05.md` — **5 November 2026 status** of live operator custody, FastAPI/Vite app and proposed per-clan Taproot multisig.

### 35.2 Current official and project docs checked (22 November 2026)

- [Expo SDK 58 reference: RN 0.88, OS/toolchain support](https://docs.expo.dev/versions/v58.0.0/)
- [Expo SDK 58 release notes](https://expo.dev/changelog/sdk-58)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [Expo monorepo guide](https://docs.expo.dev/guides/monorepos/)
- [Breez Spark React Native integration](https://sdk-doc-spark.breez.technology/guide/install_react_native.html)
- [Breez Spark login and backup guide](https://sdk-doc-spark.breez.technology/guide/uxguide_login.html)
- [Breez SDK Spark source](https://github.com/breez/spark-sdk)
- [Android build-time local web content / WebViewAssetLoader guidance](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)
- [Android WebViewAssetLoader API](https://developer.android.com/reference/androidx/webkit/WebViewAssetLoader)
- [Apple WKWebView `loadFileURL` API](https://developer.apple.com/documentation/webkit/wkwebview/loadfileurl(_:allowingreadaccessto:))
- [React Native WebView documentation](https://github.com/react-native-webview/react-native-webview/blob/master/docs/Guide.md)
- [Expo app assets packaging](https://docs.expo.dev/develop/user-interface/assets/)
- [Android App Bundle format / Play-generated APKs](https://developer.android.com/guide/app-bundle/app-bundle-format)
- [Play Feature Delivery / install-time modules](https://developer.android.com/guide/playcore/feature-delivery/install-time)
- [Google Play Device and Network Abuse policy](https://support.google.com/googleplay/android-developer/answer/16559646)
- [Apple App Review Guidelines: crypto apps, mini apps, downloaded code](https://developer.apple.com/app-store/review/guidelines/)
- [Kenya Capital Markets Authority regulatory framework](https://www.cma.or.ke/regulatory-framework/)
- [NativeWind installation/compatibility guidance](https://www.nativewind.dev/docs/getting-started/installation)
- [React Native Reusables](https://reactnativereusables.com/docs/installation/manual)

### 35.3 Source discipline

Every version-specific fact in this document can age. Recheck sources when upgrading SDKs, releasing apps, changing providers, or enabling regulated features. Public documentation does not substitute for a compatible native build on Afribit's actual target devices.

---

# Final product and engineering mandate

**Build Afribit OS as a single signed Android/iOS application with a simple service-launcher Home, verified build-time packaged mini-apps, a coherent design system, and independent Wallet/Clans financial boundaries.** Begin with an installable shell and one genuine offline-packaged Learn module. Integrate the existing Clans service without rewriting it. Integrate Breez-backed Wallet from its tested adapter under explicit financial release gates. Preserve the freedom to add future first-party or partner modules by a repeatable manifest, packaging and security review process—**not** by installing arbitrary other applications inside the APK.

**The immediate deliverable is not a 100-page speculative architecture, a wallet test harness or a generic app marketplace. It is `Afribit OS 0.1.0-alpha.1`: a real application that other developers can install, navigate, extend, debug and safely improve.**
