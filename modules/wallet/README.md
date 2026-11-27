# Afribit Wallet

The wallet inside the Afribit app. It is the Blink mobile wallet (MIT, see `LICENSE`), forked as
`Afribit-Africa/afribit-os-wallet` and pruned in W1 step 1 (no Map, Learn, Card, price history or
Circles). Imported here from that fork at commit `0fda4c6`.

It is first-party and class A: the shell renders it directly (`WalletMount`), so it is not a sandboxed
feature app and the feature admission scan does not apply. See `docs/ONE_APP_PLAN.md`, W1.

- `app/`: the wallet source, imported as `@app/...`.
- `shims/`: local stand-ins for Firebase, `react-native-config` and `react-native-bootsplash`.
- `__tests__/`, `__mocks__/`: the wallet's Jest suite.

Checks: `npm run check:wallet` at the repo root runs the wallet's own typecheck (TypeScript 5.4, as in
the fork) and its Jest suite. The shell's `npm run check` does not include them.

Hook tests use `renderHook` from `@testing-library/react-native`, because `@testing-library/react-hooks`
supports React 16 and 17 only.

Not carried over from the fork:

- The fork's ESLint config and its colour-token guards (`no-restricted-syntax` for legacy names,
  `no-restricted-properties` for `static*` tokens) and their `colors-lint` test. The fork ran
  ESLint 8, which is end of life; the guards need porting to the monorepo's flat config.
- Tests of fork-only files: its `metro.config.js`, CI scripts and the native `android/` and `ios/`
  projects. The shell generates the native projects, so the Google services and font checks read the
  shell's config and the wallet's `app/assets/fonts` instead.
