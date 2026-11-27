import {
  MoneyAmount,
  WalletOrDisplayCurrency,
  toBtcMoneyAmount,
  toDisplayAmount,
} from "@app/types/amounts"

/** An amount the shell asks a payment to start at: whole sats, or Kenyan shillings. */
export type HandoffAmount = {
  readonly currency: "BTC" | "KES"
  readonly value: number
}

/** What a shell hand-off fills in on the send details screen. The user can change both. */
export type HandoffPrefill = {
  readonly amount?: HandoffAmount
  readonly note?: string
}

/** Counted from when the Wallet takes the hand-off, which is before the user unlocks it, so
 *  it leaves time for the PIN and biometrics. After this the user has moved on. */
export const HANDOFF_PREFILL_TTL_MS = 5 * 60_000

/** The key a receive hand-off is kept under; no payment destination looks like it. */
export const RECEIVE_PREFILL_KEY = "afribit-handoff:receive"

let pending: {
  readonly destination: string
  readonly prefill: HandoffPrefill
  readonly at: number
} | null = null

const normalize = (destination: string) => destination.trim().toLowerCase()

/**
 * Keeps a hand-off's amount and note for the send it starts. Held here rather than in a
 * route param, because the destination route is deep-linkable and a crafted link must not
 * be able to fill in an amount.
 */
export const putHandoffPrefill = (
  destination: string,
  prefill: HandoffPrefill,
  now: number,
): void => {
  pending = { destination, prefill, at: now }
}

export const clearHandoffPrefill = (): void => {
  pending = null
}

/**
 * The prefill for a send to `destination`, once. A send to any other destination, or one
 * started after the TTL, gets nothing and drops what was kept.
 */
export const takeHandoffPrefill = (
  destination: string | undefined,
  now: number,
): HandoffPrefill | null => {
  const current = pending
  pending = null
  if (!current || !destination) return null
  if (now - current.at >= HANDOFF_PREFILL_TTL_MS) return null
  if (normalize(current.destination) !== normalize(destination)) return null
  return current.prefill
}

/**
 * The money amount a hand-off amount stands for in this wallet, or null when it cannot be
 * shown without a conversion the Wallet did not quote: sats always, shillings only when the
 * display currency is KES. `fractionDigits` is the display currency's (useDisplayCurrency).
 */
export const prefillMoneyAmount = (
  amount: HandoffAmount,
  displayCurrency: string,
  fractionDigits: number,
): MoneyAmount<WalletOrDisplayCurrency> | null => {
  if (!Number.isFinite(amount.value) || amount.value <= 0) return null
  if (amount.currency === "BTC") {
    return Number.isInteger(amount.value) ? toBtcMoneyAmount(amount.value) : null
  }
  if (displayCurrency !== "KES") return null
  return toDisplayAmount({
    amount: Math.round(amount.value * 10 ** fractionDigits),
    currencyCode: "KES",
  })
}
