import { dark, light } from "@app/rne-theme/colors"

/** Afribit brand v1.0 values (packages/design/tokens.ts in afribit-os). A revert of the palette
 *  must fail here even when the derived expectations change with it. */
describe("palette contract", () => {
  it("paints static surfaces with the approved surfaceStatic", () => {
    expect(light.surfaceStatic).toBe("#F7F8F7")
    expect(dark.surfaceStatic).toBe("#151816")
  })

  it("keeps the brand light textMuted", () => {
    expect(light.textMuted).toBe("#626963")
  })

  it("dims behind modals and sheets with a black scrim in both modes", () => {
    expect(light.scrim).toBe("rgba(0, 0, 0, 0.5)")
    expect(dark.scrim).toBe("rgba(0, 0, 0, 0.5)")
  })
})
