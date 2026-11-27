#!/usr/bin/env bash
# Tiered checks so small fixes never wait on an APK build.
#   0  typecheck only                                   (~20 s)
#   1  typecheck + vitest (kernel, features, admission)  (~1 min)   <- every agent task
#   2  native-impact check vs base: exits 0 when JS-only (no rebuild needed),
#      exits 3 when the change needs a native rebuild (tier 3 on the build lane)
#   3  release APK build: runs only on the build lane
#   4  visual QA (Maestro on the stable release APK): build lane only
set -euo pipefail
TIER="${1:-1}"; BASE="${BASE_REF:-origin/main}"
cd "$(git rev-parse --show-toplevel)"

native_paths='^(package\.json|package-lock\.json|apps/shell/(app\.(json|config\.(js|ts))|eas\.json|plugins/|modules/|android/|ios/)|apps/shell/package\.json|packages/[^/]+/package\.json|features/[^/]+/package\.json|\.npmrc)'

case "$TIER" in
  0) npm run -s typecheck ;;
  1) npm run -s check ;;
  2)
    npm run -s check
    changed=$(git diff --name-only "$BASE"...HEAD; git diff --name-only; git diff --name-only --cached)
    hits=$(printf '%s\n' "$changed" | sort -u | grep -E "$native_paths" || true)
    if [ -n "$hits" ]; then
      echo "NATIVE-IMPACT: rebuild required (tier 3). Files:"; printf '  %s\n' $hits; exit 3
    fi
    echo "JS-ONLY: no APK rebuild needed; verify on the stable APK via Metro/OTA." ;;
  3|4)
    if [ "${AFRIBIT_BUILD_LANE:-}" != 1 ]; then
      echo "tier $TIER runs only on the build lane (set AFRIBIT_BUILD_LANE=1 there)."; exit 4
    fi
    if [ "$TIER" = 3 ]; then
      (cd apps/shell && APP_VARIANT=preview npx expo prebuild -p android --clean >/dev/null \
        && cd android && ./gradlew --max-workers=2 assembleRelease -x lintVitalRelease)
    else
      maestro test tools/visual-qa/
    fi ;;
  *) echo "usage: $0 {0|1|2|3|4}"; exit 2 ;;
esac
