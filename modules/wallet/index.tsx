import { NavigationIndependentTree } from "@react-navigation/native"
import * as React from "react"

import { App } from "./app/app"
import {
  WalletHandoffContext,
  type WalletHandoffSource,
} from "./app/navigation/wallet-handoff"

export type { WalletHandoff, WalletHandoffSource } from "./app/navigation/wallet-handoff"
export type { HandoffAmount } from "./app/navigation/handoff-prefill"

export interface WalletRootProps {
  /** Requests the shell hands over (open Receive, start a payment). Optional. */
  readonly handoff?: WalletHandoffSource
}

/**
 * The Wallet's root for the shell (ONE_APP_PLAN W1). It keeps its own providers and its own
 * navigation tree: the independent tree stops it from attaching to the shell's router, so the
 * wallet's screens, back stack and deep links stay its own.
 */
export default function WalletRoot({ handoff }: WalletRootProps): React.JSX.Element {
  return (
    <WalletHandoffContext.Provider value={handoff ?? null}>
      <NavigationIndependentTree>
        <App />
      </NavigationIndependentTree>
    </WalletHandoffContext.Provider>
  )
}
