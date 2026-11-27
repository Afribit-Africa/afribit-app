# Building Afribit

## Requirements

- Node 24 and npm.
- For Android: JDK 17, the Android SDK (platform 36, NDK and CMake), and at least 12 GB of RAM. Compiling the Matrix SDK's native bindings alone needs about 7 GB.
- For iPhone: a Mac with Xcode, or Expo's cloud build service (EAS).

## Checks

```sh
npm ci
npm run check          # shell, kernel, chat and admission tests, plus typecheck
npm run check:wallet   # the Wallet's own typecheck and Jest suite
```

## Build settings

The Wallet reads these at build time from environment variables. None of them is stored in the repository.

| Variable | Needed | What it is |
|---|---|---|
| `BREEZ_API_KEY` | Yes, for the self-custodial wallet | A Breez SDK API key. Request one free from Breez. |
| `SPARK_TOKEN_IDENTIFIER` | Optional | The Spark token shown alongside bitcoin, if any. |
| `APP_VARIANT` | Yes | `development`, `preview` or `production`. Each installs under its own app id. |

MFA is compulsory: a `production` build refuses to start the build if `AFRIBIT_MFA_REQUIRED` is set.

## Android release APK

```sh
cd apps/shell
export APP_VARIANT=preview BREEZ_API_KEY=...
npx expo prebuild -p android --clean
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
# output: app/build/outputs/apk/release/app-release.apk
```

On machines with less memory, add `--max-workers=1 -Pkotlin.compiler.execution.strategy=in-process`.

## iPhone

The `ios-simulator` profile in `apps/shell/eas.json` builds for the iOS simulator without Apple credentials:

```sh
cd apps/shell
npx eas-cli build -p ios --profile ios-simulator
```

A build for real iPhones needs an Apple Developer account.
