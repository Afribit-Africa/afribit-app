import { existsSync, readFileSync } from "fs"
import { join } from "path"

/**
 * Afribit builds ship no Firebase or Google services (docs/WALLET_PLAN.md W-D4).
 * In the monorepo the native projects are generated from the shell's app config,
 * so the guard reads that config instead of android/ files.
 */
const WALLET_ROOT = join(__dirname, "../..")
const SHELL_ROOT = join(WALLET_ROOT, "../../apps/shell")
const appConfig = readFileSync(join(SHELL_ROOT, "app.config.ts"), "utf8")

describe("Google services in the app build", () => {
  it("configures no Firebase or Google services plugin or file", () => {
    expect(appConfig).not.toMatch(
      /googleServicesFile|google-services|@react-native-firebase|com\.google\.gms|com\.google\.firebase/,
    )
  })

  it("ships no Google services config files", () => {
    for (const file of [
      "google-services.json",
      "GoogleService-Info.plist",
      "android/app/google-services.json",
    ]) {
      expect(existsSync(join(SHELL_ROOT, file))).toBe(false)
    }
  })

  it("resolves every @react-native-firebase package to a local stand-in", () => {
    const pkg = JSON.parse(readFileSync(join(WALLET_ROOT, "package.json"), "utf8"))
    const deps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies }
    const firebase = Object.entries(deps).filter(([name]) =>
      name.startsWith("@react-native-firebase/"),
    )
    expect(firebase.length).toBeGreaterThan(0)
    firebase.forEach(([, spec]) => expect(spec).toMatch(/^file:(\.\/)?shims\//))
  })
})
