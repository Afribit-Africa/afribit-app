# Afribit

**One app for money, messages and community internet.** Afribit puts a self-custodial Bitcoin wallet, end-to-end encrypted chat and a community Wi-Fi mesh connection into one Android and iPhone app, built for low-connectivity communities, starting in Kenya.

> **Status: preview.** It works end to end in testing but has not been security-audited. Use small amounts only. See [docs/OVERVIEW.md](docs/OVERVIEW.md) for where the project stands and where it's going.

## What's inside

| Part | What it does | Built on |
|---|---|---|
| **Wallet** (`modules/wallet`) | Self-custodial Lightning and on-chain Bitcoin. Keys stay on the phone behind a compulsory PIN or biometrics. Optional custodial provider through a replaceable interface. | [Breez SDK (Spark)](https://github.com/breez/spark-sdk), derived from the [Blink](https://github.com/blinkbitcoin/blink-mobile) wallet |
| **Chat** (`features/chat`) | End-to-end encrypted messaging with no phone number or legal identity. Emoji/QR contact verification, encrypted photos with location removed, screenshot protection. | [Matrix](https://matrix.org) via [matrix-rust-sdk](https://github.com/matrix-org/matrix-rust-sdk) |
| **Connect** (`apps/shell`) | Detects the Afribit Mesh, warns about impostor hotspots, buys internet passes with M-Pesa or Lightning, and lists what works when the internet is down. | The mesh service in the Afribit Wi-Fi project |
| **Shell** (`apps/shell`, `packages/*`) | Home, onboarding, permissions and the broker that keeps the parts apart. Only the Wallet can move money, after its own confirmation. | React Native 0.88, Expo SDK 58, TypeScript |

English and Kiswahili throughout. No analytics on messages, balances or transactions.

## Download

Android builds are on the [Releases](../../releases) page. Each release lists the SHA-256 checksum of its APK.

## Build from source

See [docs/BUILDING.md](docs/BUILDING.md). In short:

```sh
npm ci          # Node 24
npm run check   # typecheck and unit tests
```

## Repository map

```
apps/shell          the app: screens, onboarding, routing, native config
packages/kernel     the module registry, permission broker, mesh and identity logic
packages/design     design tokens and shared UI components
packages/feature-sdk  the contract a feature module is given
features/chat       the Chat module
modules/wallet      the Wallet module (derived from Blink, MIT)
services/chat-gate  the small server that admits app identities to the Matrix homeserver
tools/admission-check  the scan every feature module must pass
docs/               product requirements (PRD.md), decision logs and the project overview
```

## Licence and security

- MIT, see [LICENSE](LICENSE). Third-party notices are in [NOTICE.md](NOTICE.md).
- To report a vulnerability, follow [SECURITY.md](SECURITY.md).
- To contribute, start with [CONTRIBUTING.md](CONTRIBUTING.md).

Made by [Afribit Africa](https://afribit.africa) · [Blog](https://afribit.africa/blog) · connect@afribit.africa
