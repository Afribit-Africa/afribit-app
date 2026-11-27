import fs from "fs"
import path from "path"

import { light, dark } from "../colors"

// During the token migration (see app/rne-theme/colors.ts), every legacy color
// name is a deprecated alias of a semantic token. These tests guarantee the two
// name sets can never drift apart while both exist.

const aliasToSemantic: Record<string, string> = {
  white: "backgroundDefault",
  black: "textOnBackground",
  primary: "accent",
  grey0: "textPrimary",
  grey1: "textSecondary",
  grey2: "textMuted",
  grey3: "textDisabled",
  grey4: "neutral",
  grey5: "surfaceInteractive",
  grey6: "surfacePressed",
  grey7: "surfaceStatic",
  red: "error",
  error9: "errorBackground",
  backdropWhite: "backdrop",
  backdropWhiter: "backdropStrong",
  _white: "staticWhite",
  _black: "staticBlack",
  _lightGrey: "staticLightGrey",
  _lighterGrey: "staticLighterGrey",
  _darkGrey: "staticDarkGrey",
  _cardPill: "staticCardPill",
  _orange: "staticBrandOrange",
  _green: "staticSuccess",
  _primary1: "staticBrandYellow",
  _primary2: "staticBrandSunset",
  _warningLight: "staticWarningBackground",
  _blue: "staticBlue",
  _lightBlue: "staticBrightBlue",
  _sky: "staticPaleBlue",
}

// Role tokens share their source token's value until design gives them their own.
// Drop an entry here in the same change that gives that role a value of its own.
const roleToSource: Record<string, string> = {
  textOnAccent: "backgroundDefault",
  textOnAccentDisabled: "textMuted",
  textPlaceholder: "neutral",
  borderStrong: "textDisabled",
  surfaceInactive: "textDisabled",
  surfaceFocused: "surfacePressed",
  success: "staticSuccess",
}

describe("color token aliases", () => {
  const checkAliases = (palette: Record<string, string>) => {
    for (const [legacy, semantic] of Object.entries({
      ...aliasToSemantic,
      ...roleToSource,
    })) {
      expect(palette[legacy]).toBeDefined()
      expect(palette[semantic]).toBeDefined()
      expect(palette[legacy]).toEqual(palette[semantic])
    }
  }

  it("every legacy alias and role token matches its source in light mode", () => {
    checkAliases(light as unknown as Record<string, string>)
  })

  it("every legacy alias and role token matches its source in dark mode", () => {
    checkAliases(dark as unknown as Record<string, string>)
  })

  // darkStatic is lightStatic today, so this only bites if someone splits the two.
  it("static tokens are identical across modes", () => {
    for (const [key, value] of Object.entries(light)) {
      if (key.startsWith("static")) {
        expect(dark[key as keyof typeof dark]).toEqual(value)
      }
    }
  })

  it("keeps light and dark key sets identical", () => {
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort())
  })
})

// Field fills from Afribit brand v1.0 (packages/design/tokens.ts in afribit-os), set for
// contrast against backgroundDefault.
// The alias tests above only check names against each other, so pin the values.
describe("field fill values", () => {
  it("uses the ruled field fills in light mode", () => {
    expect(light.surfaceInteractive).toBe("#EDF0ED")
    expect(light.surfacePressed).toBe("#DFE3DF")
    expect(light.surfaceStatic).toBe("#F7F8F7")
  })

  it("uses the ruled field fills in dark mode", () => {
    expect(dark.surfaceInteractive.toUpperCase()).toBe("#1A1D1B")
    expect(dark.surfacePressed).toBe("#262A27")
    expect(dark.surfaceStatic).toBe("#151816")
  })

  // Design ruling (Nov 2026): the pressed and focused fill keeps the step it had
  // over the resting fill before surfaceInteractive darkened (#F2F2F4 → #E7E7E7).
  it("keeps the pressed fill at least 1.1:1 from the resting fill", () => {
    const channel = (hex: string, i: number) => {
      const v = parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    const luminance = (hex: string) =>
      0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2)
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
      return (hi + 0.05) / (lo + 0.05)
    }

    expect(
      contrast(light.surfaceInteractive, light.surfacePressed),
    ).toBeGreaterThanOrEqual(1.1)
    expect(contrast(dark.surfaceInteractive, dark.surfacePressed)).toBeGreaterThanOrEqual(
      1.1,
    )
    expect(light.surfaceFocused).toBe(light.surfacePressed)
    expect(dark.surfaceFocused).toBe(dark.surfacePressed)
  })

  it("keeps the legacy grey5, grey6 and grey7 aliases on the ruled values", () => {
    expect(light.grey5).toBe("#EDF0ED")
    expect(light.grey6).toBe("#DFE3DF")
    expect(light.grey7).toBe("#F7F8F7")
    expect(dark.grey7).toBe("#151816")
  })

  // Brand v1.0 review (2026-11-25): a disabled primary button is a solid
  // surfaceInteractive fill with a textMuted label, readable in both modes.
  it("keeps the disabled button label readable on its fill", () => {
    const channel = (hex: string, i: number) => {
      const v = parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    const luminance = (hex: string) =>
      0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2)
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
      return (hi + 0.05) / (lo + 0.05)
    }

    for (const palette of [light, dark]) {
      expect(
        contrast(palette.textOnAccentDisabled, palette.surfaceInteractive),
      ).toBeGreaterThanOrEqual(4.5)
      // White labels (staticWhite) on unselected currency pills.
      expect(contrast("#FFFFFF", palette.surfaceInactive)).toBeGreaterThanOrEqual(4.5)
    }
  })

  // Static fills sit between the background and the tappable fill in both modes.
  it("orders static fills between the background and the tappable fill", () => {
    const luminance = (hex: string) => parseInt(hex.slice(1, 3), 16)

    expect(luminance(light.surfaceStatic)).toBeLessThan(
      luminance(light.backgroundDefault),
    )
    expect(luminance(light.surfaceStatic)).toBeGreaterThan(
      luminance(light.surfaceInteractive),
    )
    expect(luminance(dark.surfaceStatic)).toBeGreaterThan(
      luminance(dark.backgroundDefault),
    )
    expect(luminance(dark.surfaceStatic)).toBeLessThan(luminance(dark.surfaceInteractive))
  })
})

// No semantic alias: flagged for design review in colors.ts.
const flagged = ["blue5"]

describe("legacy name inventory", () => {
  // colors.ts, themed.d.ts and the alias map above each list the legacy names;
  // this ties themed.d.ts to the alias map. The fork's ESLint guard is not ported
  // yet (see the README).
  const deprecated = [
    ...fs
      .readFileSync(path.resolve(__dirname, "../themed.d.ts"), "utf8")
      .matchAll(/\/\*\* @deprecated[^*]*\*\/\s*(?:readonly )?(\w+):/g),
  ].map(([, name]) => name)

  it("marks exactly the aliased and flagged names deprecated in themed.d.ts", () => {
    expect(deprecated.sort()).toEqual(
      [...Object.keys(aliasToSemantic), ...flagged].sort(),
    )
  })
})
