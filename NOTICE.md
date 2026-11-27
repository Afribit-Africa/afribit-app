# Notices

Afribit is released under the MIT License (see `LICENSE`), Copyright (c) 2026 Afribit Africa.

## Included third-party work

- **`modules/wallet`** is derived from the [Blink mobile wallet](https://github.com/blinkbitcoin/blink-mobile), MIT License, Copyright (c) 2021 Galoy Inc. Its original licence is kept at `modules/wallet/LICENSE`. Afribit's changes to it are also under the MIT License. Blink and Galoy names and logos are not used to brand this app.
- **Fonts:** Manrope, Noto Sans, DM Sans and Source Sans Pro, under the SIL Open Font License 1.1. The licence texts ship next to the font files.
- **Patches** in `patches/` modify third-party npm packages, each under its own licence.

## Main dependencies (not vendored; installed from npm)

| Component | Use | Licence |
|---|---|---|
| [Breez SDK (Spark)](https://github.com/breez/spark-sdk) | Self-custodial Lightning and on-chain wallet | MIT |
| [matrix-rust-sdk](https://github.com/matrix-org/matrix-rust-sdk) via `@unomed/react-native-matrix-sdk` | End-to-end encrypted chat | Apache-2.0 |
| [React Native](https://github.com/facebook/react-native) and [Expo](https://github.com/expo/expo) | App framework for Android and iOS | MIT |
| [nostr-tools](https://github.com/nbd-wtf/nostr-tools) | Device identity and request signing | Unlicense |

Run `npx license-checker --summary` after `npm ci` for the full list.
