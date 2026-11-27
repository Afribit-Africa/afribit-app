import { useEffect, useRef, useState } from "react"

import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import {
  RECEIVE_PREFILL_KEY,
  prefillMoneyAmount,
  takeHandoffPrefill,
} from "@app/navigation/handoff-prefill"
import { MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"

import { PaymentRequestState } from "../payment/index.types"
import type { ReceivePaymentRequestState } from "../payment/request-state.types"

type Params = {
  request: ReceivePaymentRequestState
  handleSetAmount: (amount: MoneyAmount<WalletOrDisplayCurrency>) => void
  handleMemoBlur: () => void
}

/**
 * Starts Receive at a shell hand-off's amount and note (a Chat payment request, CR-11).
 * Taken once, when the request is first ready; the user can still change both. The memo
 * is committed the way typing one is: its text first, then the blur that applies it.
 */
export const useReceivePrefill = ({
  request,
  handleSetAmount,
  handleMemoBlur,
}: Params): void => {
  const { displayCurrency, fractionDigits } = useDisplayCurrency()
  const takenRef = useRef(false)
  const [memoToCommit, setMemoToCommit] = useState<string | null>(null)
  const isReady = request.state !== PaymentRequestState.Loading

  useEffect(() => {
    if (takenRef.current || !isReady) return
    takenRef.current = true
    const prefill = takeHandoffPrefill(RECEIVE_PREFILL_KEY, Date.now())
    if (!prefill) return
    const amount =
      prefill.amount && prefillMoneyAmount(prefill.amount, displayCurrency, fractionDigits)
    if (amount) handleSetAmount(amount)
    if (prefill.note) {
      request.setMemoChangeText(prefill.note)
      setMemoToCommit(prefill.note)
    }
  }, [isReady, request, handleSetAmount, displayCurrency, fractionDigits])

  useEffect(() => {
    if (memoToCommit === null || request.memoChangeText !== memoToCommit) return
    setMemoToCommit(null)
    handleMemoBlur()
  }, [memoToCommit, request.memoChangeText, handleMemoBlur])
}
