import Config from "react-native-config"

/**
 * Multi-factor protection is compulsory (W-D11): the device holds the key and a
 * PIN is the second factor, so the PIN cannot be switched off in the UI. A build
 * may turn the requirement off for the regtest test lane, and only a build config
 * can:
 *
 *   AFRIBIT_MFA_REQUIRED   "false" disables the requirement; unset or empty means on
 *
 * Anything else stops the app at import rather than silently dropping the second
 * factor.
 */
export const parseMfaRequired = (value: string | undefined): boolean => {
  if (value === undefined || value.trim() === "") return true
  if (value === "false") return false
  throw new Error(
    `AFRIBIT_MFA_REQUIRED must be "false" or unset, not ${JSON.stringify(value)}`,
  )
}

export const MFA_REQUIRED: boolean = parseMfaRequired(Config.AFRIBIT_MFA_REQUIRED)
