import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

// Self-custodial users see these six strings; the rest of the app still carries Blink
// copy on custodial-only screens that a later task hides.
const selfCustodialCopy = () => {
  loadLocale("en")
  const LL = i18nObject("en")

  return {
    "GetStartedScreen.headline": LL.GetStartedScreen.headline(),
    "MapScreen.navToSettingsText": LL.MapScreen.navToSettingsText(),
    "ThemeScreen.info": LL.ThemeScreen.info(),
    "BackupScreen.CloudBackup.importantMessage":
      LL.BackupScreen.CloudBackup.importantMessage({
        bold: LL.BackupScreen.CloudBackup.importantMessageBold(),
      }),
    "BackupScreen.BundleExport.body": LL.BackupScreen.BundleExport.body(),
    "BackupScreen.ManualBackup.Success.title":
      LL.BackupScreen.ManualBackup.Success.title(),
  }
}

describe("self-custodial English copy", () => {
  it("does not name Blink", () => {
    const branded = Object.entries(selfCustodialCopy()).filter(([, value]) =>
      value.includes("Blink"),
    )

    expect(branded).toEqual([])
  })
})
