import React from "react"
import { ActivityIndicator } from "react-native"

import { makeStyles, useTheme } from "@rn-vui/themed"

import { Screen } from "@app/components/screen"
import { MFA_REQUIRED } from "@app/config/mfa"
import {
  useAuthGateFailureHandler,
  useLocalAuthGate,
} from "@app/hooks/use-local-auth-gate"
import { testProps } from "@app/utils/testProps"

type Props = {
  /** Shown in the OS biometric prompt. */
  description: string
  children: React.ReactNode
}

/**
 * W-D11: with MFA required, every sensitive action (revealing the recovery phrase,
 * exporting a backup, confirming a send) asks for the PIN or biometrics again, on
 * every visit, and fails closed when no factor can be satisfied. The compulsory PIN
 * (required-pin.ts) means a wallet always has a factor to ask with.
 *
 * Nothing under the gate mounts until it has passed, so a hook that reads the
 * mnemonic, loads the bundle or prepares a payment cannot run first. A refusal
 * removes the gated screen (useAuthGateFailureHandler) and the action never happens.
 *
 * With MFA off the children render exactly as before: no prompt, no extra frame.
 */
export const SensitiveActionGate: React.FC<Props> = ({ description, children }) => {
  if (!MFA_REQUIRED) return children
  return <RequiredAuthGate description={description}>{children}</RequiredAuthGate>
}

const RequiredAuthGate: React.FC<Props> = ({ description, children }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const onFailure = useAuthGateFailureHandler()
  const isAuthenticated = useLocalAuthGate({ description, onFailure, required: true })

  if (isAuthenticated) return children
  return (
    <Screen preset="fixed">
      <ActivityIndicator
        style={styles.loader}
        color={colors.accent}
        {...testProps("sensitive-action-gate-pending")}
      />
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
}))
