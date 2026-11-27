import { createContext, useContext } from "react"

import type { HandoffAmount } from "./handoff-prefill"

/**
 * A request the shell hands to the Wallet (ONE_APP_PLAN W1 step 4): open Receive, or start a
 * payment to a destination the shell checked. The Wallet still shows its own confirmation and
 * asks for its own PIN (S-12); a hand-off only chooses the first screen.
 */
export type WalletHandoff =
  | {
      readonly kind: "receive"
      /** Where the request starts (a Chat payment request); the user can change it. */
      readonly amount?: HandoffAmount
      readonly note?: string
    }
  | {
      readonly kind: "send"
      readonly destination: string
      /** Where the send starts; the user can change it, and the review shows it. */
      readonly amount?: HandoffAmount
      /** The payment's note, when the destination does not set its own. */
      readonly note?: string
    }

/** The shell's single-slot hand-off: `take` returns the pending request once. */
export interface WalletHandoffSource {
  take(now: number): WalletHandoff | null
  /** Called after each new hand-off. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void
}

export const WalletHandoffContext = createContext<WalletHandoffSource | null>(null)

export const useWalletHandoff = (): WalletHandoffSource | null =>
  useContext(WalletHandoffContext)

/** The Wallet link a hand-off stands for, on the Wallet's own prefix. */
export const handoffUrl = (handoff: WalletHandoff): string =>
  handoff.kind === "receive"
    ? "afribitwallet://receive"
    : `afribitwallet://${encodeURIComponent(handoff.destination)}`
