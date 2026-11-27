import React, { useEffect, useRef, useState } from "react"

import {
  CommonActions,
  useNavigation,
  useNavigationState,
} from "@react-navigation/native"

import { MFA_REQUIRED } from "@app/config/mfa"

import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import { useMigrationBlocker } from "@app/screens/account-migration/hooks/use-migration-blocker"
import { MigrationGate } from "@app/screens/account-migration/to-non-custodial/migration-gate"
import { TwoFactorProtectionRequiredScreen } from "@app/screens/two-factor-enforcement"

import { readIsRequiredPinMissing, REQUIRED_SET_PIN_ROUTE } from "./required-pin"
import { hasWorkingScreenAboveHome } from "./two-factor-remedy-routes"

type PinCheck = "checking" | "present" | "missing"

/**
 * W-D11: the home never shows without a PIN while MFA is required. The wallet flows
 * route through the required SetPin themselves (readWalletHomeRoute); this catches
 * every other way in: a custodial login (phone, email, Telegram, a device account), an
 * account switch, or a session from before the PIN was compulsory. Nothing is shown
 * while the read runs, and a missing PIN replaces the stack with the required SetPin,
 * which returns here once the PIN is set. A read that failed is not a missing PIN
 * (see readIsRequiredPinMissing).
 */
const useRequiredPinCheck = (): PinCheck => {
  const navigation = useNavigation()
  const [check, setCheck] = useState<PinCheck>(MFA_REQUIRED ? "checking" : "present")

  useEffect(() => {
    if (!MFA_REQUIRED) return
    let mounted = true
    readIsRequiredPinMissing().then(
      (isMissing) => {
        if (!mounted) return
        setCheck(isMissing ? "missing" : "present")
        if (isMissing) {
          navigation.dispatch(
            CommonActions.reset({ index: 0, routes: [REQUIRED_SET_PIN_ROUTE] }),
          )
        }
      },
      () => {
        if (mounted) setCheck("present")
      },
    )
    return () => {
      mounted = false
    }
  }, [navigation])

  return check
}

/**
 * What stands in for the home, in order of precedence: nothing, until the device is
 * known to hold the PIN that MFA requires (useRequiredPinCheck); the account-closed gate; then
 * nothing, for the frames the two-factor record read takes before the home has first
 * shown, so a cold start never shows the home before a prompt that replaces it, while
 * a switch to another account keeps the home up through that account's record read,
 * as it already is through the account's own load, rather than flash a blank between
 * the two; then the high-balance blocking screen. That screen arms only while the user
 * is on the home, with no screen of their own above it in the root stack; the tabs,
 * and whatever is open within them, are the home. A block that comes to be owed while
 * they are in a payment or a scan waits for them to come back, rather than tear the
 * screen down, and the frames of a record read after the home has shown are not
 * blanked either.
 */
export const HomeGate: React.FC<React.PropsWithChildren> = ({ children }) => {
  const pinCheck = useRequiredPinCheck()
  const migrationBlocker = useMigrationBlocker()
  const twoFactor = useTwoFactorEnforcement()
  const hasWorkingScreenAbove = useNavigationState((state) =>
    hasWorkingScreenAboveHome(state.routes),
  )
  const hasHomeShownRef = useRef(false)

  const isPreparingBeforeFirstShow =
    twoFactor.isPreparingSessionStart && !hasHomeShownRef.current
  const isGateArmed = twoFactor.isProtectionGateActive && !hasWorkingScreenAbove
  const isHomeShown =
    pinCheck === "present" &&
    !migrationBlocker.isVisible &&
    !isPreparingBeforeFirstShow &&
    !isGateArmed

  useEffect(() => {
    if (isHomeShown) hasHomeShownRef.current = true
  }, [isHomeShown])

  if (pinCheck !== "present") return null
  if (migrationBlocker.isVisible) return <MigrationGate />
  if (isPreparingBeforeFirstShow) return null
  if (isGateArmed) return <TwoFactorProtectionRequiredScreen />
  return <>{children}</>
}
