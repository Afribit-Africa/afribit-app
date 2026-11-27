# Firebase stand-ins

Afribit builds ship no Firebase or Google services (WALLET_PLAN W-D4). Upstream code still
imports `@react-native-firebase/*`, so `modules/wallet/package.json` points those names at these local
packages. They have no native code, so autolinking adds nothing, and upstream merges keep
compiling. Jest keeps using `__mocks__/@react-native-firebase/*`.

- analytics, crashlytics: no-ops. Crash collection reports itself as off.
- messaging: push is off. Permission is "denied", `getToken` rejects.
- remote-config: `getValue` returns the defaults the app registered with `setDefaults`.
- app-check: `getToken` rejects (callers treat that as "no token").

# Other stand-ins

- react-native-config: `Config.NAME` reads `extra.wallet` from the shell's app config. Values are set at
  build time from the environment, so nothing secret is committed.
- react-native-bootsplash: the shell owns the launch screen; `hide` resolves straight away.
