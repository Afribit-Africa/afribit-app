import React, { useCallback, useEffect, useRef } from "react"

import { makeStyles, Text } from "@rn-vui/themed"
import {
  CommonActions,
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native"

import { Screen } from "@app/components/screen"
import { SuccessScreenLayout } from "@app/components/success-screen-layout"
import { useI18nContext } from "@app/i18n/i18n-react"
import { readWalletHomeRoute, REQUIRED_SET_PIN_ROUTE } from "@app/navigation/required-pin"
import { reportError } from "@app/utils/error-logging"
import { isBackwardAction, RootStackParamList } from "@app/navigation/stack-param-lists"

type SuccessRouteProp = RouteProp<RootStackParamList, "selfCustodialBackupSuccess">

const NAVIGATE_HOME_DELAY_MS = 2000

export const BackupSuccessScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const navigation = useNavigation()
  const params = useRoute<SuccessRouteProp>().params
  const reBackup = params?.reBackup ?? false
  const customMessage = params?.message
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  /** Never clears the migration checkpoint: a standalone backup by another account must
   *  not wipe a pending migration, and a completed migration already cleared its own.
   *  Every create, restore and backup ends here, so this is also where the compulsory
   *  PIN (W-D11) is put in front of the home screen. */
  const navigateToHome = useCallback(() => {
    const goTo = (homeRoute: { name: "Primary" } | typeof REQUIRED_SET_PIN_ROUTE) =>
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [homeRoute] }))
    /** The read reports a keystore failure rather than throwing one; should it throw,
     *  home is still right, and the next start's gate asks for the PIN again. */
    readWalletHomeRoute()
      .then(goTo)
      .catch((err: unknown) => {
        reportError("Backup success home route", err)
        goTo({ name: "Primary" })
      })
  }, [navigation])

  const handleAnimationComplete = useCallback(() => {
    holdTimerRef.current = setTimeout(navigateToHome, NAVIGATE_HOME_DELAY_MS)
  }, [navigateToHome])

  useEffect(() => () => clearTimeout(holdTimerRef.current), [])

  /** Every way here lands with the work done and only this screen's reset to Primary
   *  ahead, which leaving clears. So the user's back goes home at once rather than back
   *  into a flow that is over: a restore's terms, with the account already active. The
   *  swipe, which the native stack cannot refuse, is switched off in the route options. */
  useEffect(
    () =>
      navigation.addListener("beforeRemove", (event) => {
        if (!isBackwardAction(event.data.action)) return
        event.preventDefault()
        navigateToHome()
      }),
    [navigation, navigateToHome],
  )

  const fallbackMessage = reBackup
    ? LL.common.success()
    : LL.BackupScreen.ManualBackup.Success.title()

  const message = customMessage ?? fallbackMessage

  return (
    <Screen preset="fixed" headerShown={false}>
      <SuccessScreenLayout onAnimationComplete={handleAnimationComplete}>
        <Text style={styles.message}>{message}</Text>
      </SuccessScreenLayout>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  message: {
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center",
    width: 264,
  },
}))
