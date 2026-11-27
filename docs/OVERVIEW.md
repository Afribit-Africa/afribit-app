# Afribit: money, messages and community internet in one app

*Project overview: what we are building, where it stands technically (27 November 2026), and what comes next.*

Website: [afribit.africa](https://afribit.africa) · Blog: [afribit.africa/blog](https://afribit.africa/blog) · Contact: connect@afribit.africa

---

## 1. In one paragraph

Afribit is a single mobile app for Android and iPhone. It gives people in low-connectivity communities three tools that work together:

- a **self-custodial Bitcoin wallet**, where the user holds their own keys;
- **end-to-end encrypted chat** that needs no phone number or legal identity;
- access to a **community Wi-Fi mesh network** that keeps local services working when the internet is down or unaffordable.

We start in Kenya, with prices in KES, M-Pesa top-ups, and English and Kiswahili throughout. Everything ships inside one installed app, but each part keeps its own keys, data and security boundary. No single account, server or company holds everyone's money or messages.

## 2. The problem

- **Money.** In our communities, money mostly moves through mobile money and bank accounts. Accounts are tied to a legal identity. Every transaction is visible to the operator. Accounts can be frozen, and fees are high for small amounts. Bitcoin offers an alternative, but most Bitcoin apps are custodial, built for English speakers with good connectivity, or too hard for first-time users.
- **Communication.** Popular messengers need a phone number tied to an ID and a working internet connection. Kenya has seen internet disruption during periods of unrest, and data is expensive for low-income users.
- **Connectivity.** Many people buy internet in small, expensive bundles. When the connection drops, everything stops, including local services that don't need the global internet.
- **Fragmentation.** Wallet, chat and Wi-Fi access are usually separate apps with separate sign-ups. Each one is something else for a new user to install, learn and trust.

## 3. What Afribit is

One app, three built-in parts, and a shell that keeps them apart.

### Wallet: self-custodial Bitcoin
- Lightning and on-chain Bitcoin through the open-source Breez SDK (Spark). **Keys are created and kept on the phone.** Afribit cannot move or freeze anyone's funds.
- Unlocking the wallet always requires a PIN, with biometrics where available. This is compulsory.
- An optional connection to a custodial Lightning provider (currently Blink) for people who want it. It goes through a provider interface rather than being built in, so the app does not depend on any one company.
- `bitcoin:` and `lightning:` payment links, QR codes, NFC payment cards, and paying a chat contact. Money only moves after the Wallet's own confirmation screen. No other part of the app can approve a payment.
- The Wallet is based on the open-source Blink mobile wallet (MIT licence), adapted for self-custody, Afribit's design, and life inside the super app.

### Chat: private messaging
- Built on **Matrix** with end-to-end encryption (Megolm, via matrix-rust-sdk, whose encryption library vodozemac has been independently audited). The server stores only ciphertext.
- No phone number or legal identity: a person picks a nickname, and the app creates a device key.
- Contact verification by comparing emoji or scanning a QR code, and a warning when a contact's device changes.
- Encrypted photos, with location data stripped before sending. Screenshots can be blocked. Notifications show no message content.
- Runs on a community-operated Matrix server (Tuwunel). Serving it from the mesh itself, so chat works with no internet uplink, is a next step (section 6).

### Mesh / Connect: community internet
- The app detects the Afribit Mesh and checks that the network is genuine rather than an impostor hotspot.
- Users buy internet passes in the app, paying with M-Pesa or with Lightning from their own wallet. The app shows remaining time, reminds the user 30 minutes before a pass ends, and offers "buy again" in one tap.
- When the internet uplink is down, the app lists what still works on the local network.

### The shell that holds it together
- A navigation-first Home that never shows wallet balances.
- Modules talk to each other only through a permission broker with an allow-list. Chat can *ask* the Wallet to pay a contact, but only the Wallet can carry out the payment, after the user confirms it there.
- On Android, the Wallet runs in its own process. On iPhone it runs in its own isolated runtime.
- English and Kiswahili, offline and local-only states on every screen, and no analytics on messages, balances or transactions.
- No legal identity is required anywhere in the app.

## 4. Why this fits human-rights-focused Bitcoin funding

| Need | How Afribit answers it |
|---|---|
| Financial self-sovereignty | Self-custodial keys on the user's device. Afribit never holds user funds and can't freeze or confiscate them. |
| Privacy | No identity documents. Encrypted chat where the server sees only ciphertext. No tracking of transactions or messages. |
| Resistance to censorship and shutdowns | A community-run mesh network and community-run chat infrastructure, so communities don't depend on one ISP or one platform. |
| Accessibility | One app instead of several. Kiswahili alongside English. Designed for entry-level Android phones and poor connectivity. |
| Open, auditable building blocks | Built on Breez SDK, matrix-rust-sdk and React Native. The wallet fork is MIT-licensed, and the mesh software is public. |

**Open source.** The full app is public at [github.com/Afribit-Africa/afribit-app](https://github.com/Afribit-Africa/afribit-app) under the MIT License, so anyone can review it, build it, or reuse it for their own community.

## 5. Where we are technically (27 November 2026)

### Summary

| Area | Status |
|---|---|
| **Android app** | **Preview 0.2.0 is released** on [GitHub Releases](https://github.com/Afribit-Africa/afribit-app/releases/tag/v0.2.0): a downloadable APK (about 95 MB, arm64) with Wallet, Chat and Mesh inside, built from the tagged commit, with its SHA-256 checksum. Tested end to end on the Android emulator (details below). The standalone Afribit Wallet 1.0.1 is also released. **Not yet done:** a test with real funds inside the one app, and a field test on physical phones. |
| **iPhone app** | Same codebase. **The full app now builds for the iOS simulator** in the cloud (27 November), after fixing native-library conflicts between the Bitcoin and Matrix SDKs and two packaging issues. These fixes go into the next public release. **Open:** a walk-through on the simulator, then real iPhones and TestFlight, which need the Afribit Apple Developer account. |
| **Wallet** | Integrated inside the app. Verified on the emulator: create a self-custodial account behind the PIN, receive (a real mainnet Lightning invoice), send up to the fee and confirmation step, add and switch accounts, and relock after inactivity. Payment links and payments started from Chat are done. **Open:** a small real-money send and receive test (capped at about 100 KES). |
| **Chat** | The Matrix encryption engine is proven on a phone: an encrypted message from a second device was decrypted, an encrypted reply was sent, and the server held only ciphertext. The UI, contact verification, encrypted images, screen protection, QR contacts and Kiswahili are done. **In progress:** paying and requesting money in a chat. **Open:** an in-app two-device verification test, running chat from the mesh, and policy decisions on message retention and abuse reporting. |
| **Mesh / Connect** | Pass status, buying passes (M-Pesa or Lightning), reminders, "buy again" and the "what works now" list are done in the app. The matching mesh-service API is written. **Open:** routers that cryptographically sign their identity so phones can trust them, the Wi-Fi login page handing over to the app, and deploying to the live mesh. |
| **Quality** | About 680 automated tests for the app shell and about 4,100 for the wallet run on every change. Every change is reviewed before it merges. |

### Technology
- **App:** React Native 0.88 (New Architecture), Expo SDK 58 and TypeScript. One codebase for Android and iOS.
- **Bitcoin:** Breez SDK (Spark), Rust underneath, for self-custodial Lightning and on-chain payments.
- **Chat:** Matrix through matrix-rust-sdk's React Native bindings, with a Tuwunel homeserver.
- **Mesh:** community Wi-Fi routers plus a mesh service that issues passes and payments (M-Pesa, and Lightning invoices).
- **Process:** a small core team working with AI coding agents. The agents write changes and open pull requests. People review and merge them; agents never merge.

## 6. The way forward

### Phase 1: finish the first complete release (next 4–6 weeks)
1. iPhone: a walk-through on the simulator, then a TestFlight build.
2. A real-money wallet test (small amounts), then testers on physical Android phones.
3. Payments inside chat: pay a contact and request money.
4. Keep development in the open: public issues, a public roadmap, and releases built from tagged commits.

### Phase 2: community field pilot (2–4 months)
1. Pilot on real, entry-level Android phones with a first community on the Afribit Mesh.
2. Routers that sign their identity, so phones know they are on the genuine mesh. The Wi-Fi login page opens the app instead of a web page.
3. Chat served from the mesh, so messages keep flowing when the internet uplink is down.
4. Kiswahili content review, usability testing with first-time Bitcoin users, and wallet backup and recovery rehearsals.

### Phase 3: hardening and wider release (4–8 months)
1. Independent security review of the wallet integration, the chat encryption and the permission broker.
2. Reproducible builds, then distribution through Google Play and the App Store, with a direct APK download kept for people without store access.
3. Policies for message retention, media expiry and abuse reporting, set with the community.
4. Further modules once the core is stable, starting with community treasuries and grants (Clans).

### What support would fund
- **Security audit** of the wallet integration and chat.
- **Field pilot:** mesh routers, test phones and community onboarding sessions.
- **Engineering time** for the iPhone release and the mesh trust work.
- **Localisation and Bitcoin education** in Kiswahili.

*(Amounts and timelines to be filled in by the applicant.)*

## 7. Risks and how we handle them

| Risk | Mitigation |
|---|---|
| Users lose funds by losing their phone | Wallet backup and recovery built in and rehearsed in the pilot. Clear warnings that Afribit cannot recover keys. |
| Fake hotspots that pretend to be the mesh | Impostor detection is already in the app. Cryptographically signed routers come in Phase 2. |
| A bug in one part breaks the rest | Each module is isolated. The permission broker and the Wallet's own confirmation screen mean no other module can move money. |
| Regulatory pressure on custodial services | The core wallet is self-custodial. Custodial providers are optional and replaceable. |
| App size on entry-level phones | Measured on every build (about 95 MB for arm64 today). Size reduction is part of hardening. |

---

*Prepared by Afribit Africa. Status reflects the codebase on 27 November 2026.*
