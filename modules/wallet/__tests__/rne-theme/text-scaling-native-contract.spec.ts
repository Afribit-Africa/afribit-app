import fs from "fs"
import path from "path"

/**
 * The ceiling is a prop. Native applies it to both the font and an explicit lineHeight.
 * This pins that contract to the React Native we ship, so a later upgrade that stops
 * capping the line box fails here instead of clipping text in the app.
 */
const ROOT = path.join(__dirname, "..", "..")
const read = (relative: string) => fs.readFileSync(path.join(ROOT, relative), "utf8")
// React Native is a dependency of the shell, and npm hoists it to the monorepo root.
const MONOREPO_ROOT = path.join(ROOT, "..", "..")
const readRoot = (relative: string) =>
  fs.readFileSync(path.join(MONOREPO_ROOT, relative), "utf8")

const walk = (relative: string): string[] => {
  const dir = path.join(ROOT, relative)
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(relative, entry.name)
    if (entry.isDirectory()) return walk(entryPath)
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [entryPath] : []
  })
}

describe("pinned React Native line-height contract", () => {
  const version = JSON.parse(readRoot("apps/shell/package.json")).dependencies["react-native"]

  it("ships the React Native this contract was read against", () => {
    expect(version).toBe("0.88.1")
  })

  it("caps an Android line height with the same multiplier as the font", () => {
    const attributes = readRoot(
      "node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/views/text/TextAttributes.kt",
    )
    const pixel = readRoot(
      "node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/uimanager/PixelUtil.kt",
    )

    expect(attributes).toContain(
      "PixelUtil.toPixelFromSP(lineHeight, effectiveMaxFontSizeMultiplier)",
    )
    expect(pixel).toContain(
      "min(scaledValue, value * displayMetrics.density * maxFontScale)",
    )
  })

  it("caps an iOS line height with the effective font multiplier", () => {
    const attributes = readRoot(
      "node_modules/react-native/ReactCommon/react/renderer/textlayoutmanager/platform/ios/react/renderer/textlayoutmanager/RCTAttributedTextUtils.mm",
    )

    expect(attributes).toContain(
      "textAttributes.lineHeight * RCTEffectiveFontSizeMultiplierFromTextAttributes(textAttributes)",
    )
  })

  it("does not divide a line height down before native sees it", () => {
    const scaling = read("app/rne-theme/text-scaling.ts")
    const leftovers = walk("app").filter((file) =>
      read(file).includes("cappedLineHeight"),
    )

    expect(scaling).not.toContain("/ PixelRatio.getFontScale()")
    expect(leftovers).toEqual([])
  })
})
