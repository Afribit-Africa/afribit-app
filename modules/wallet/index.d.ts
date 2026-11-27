import type { JSX } from "react"

/**
 * Hand-written so the shell's typecheck sees only this entry point. The wallet's own
 * sources are checked by `npm run check:wallet` with the fork's compiler settings.
 * Keep these types in step with app/navigation/wallet-handoff.tsx.
 */

/** An amount a payment starts at: whole sats (`BTC`), or Kenyan shillings (`KES`). */
export interface HandoffAmount {
  readonly currency: "BTC" | "KES"
  readonly value: number
}

/**
 * Open Receive, or start a payment to a destination the shell checked. A send's amount and
 * note only fill in the send details screen: the user can change them, and the Wallet's
 * review shows them before paying. A receive's amount and note start the request the same
 * way. A KES amount is used only when KES is the display currency.
 */
export type WalletHandoff =
  | {
      readonly kind: "receive"
      readonly amount?: HandoffAmount
      readonly note?: string
    }
  | {
      readonly kind: "send"
      readonly destination: string
      readonly amount?: HandoffAmount
      readonly note?: string
    }

export interface WalletHandoffSource {
  /** The pending hand-off, once; null when there is none or it is too old. */
  take(now: number): WalletHandoff | null
  /** Called after each new hand-off. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void
}

export interface WalletRootProps {
  readonly handoff?: WalletHandoffSource
}

export default function WalletRoot(props: WalletRootProps): JSX.Element
