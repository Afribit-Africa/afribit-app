import { existsSync } from "fs"
import { join } from "path"

import { fonts } from "@app/rne-theme/fonts"

/**
 * A face the theme names but the app does not ship renders the system font, silently.
 * In the monorepo the shell bundles these files through expo-font; the shell's own test
 * ties its font list to this folder.
 */

const WALLET_ROOT = join(__dirname, "..", "..")

Object.values(fonts).forEach((face) => {
  const file = `${face}.ttf`

  describe(file, () => {
    it("is in the app's font assets", () => {
      expect(existsSync(join(WALLET_ROOT, "app/assets/fonts", file))).toBe(true)
    })
  })
})
