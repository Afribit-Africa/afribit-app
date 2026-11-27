import { renderHook } from "@testing-library/react-native"

import {
  RECEIVE_PREFILL_KEY,
  clearHandoffPrefill,
  putHandoffPrefill,
} from "@app/navigation/handoff-prefill"
import { useReceivePrefill } from "@app/screens/receive-bitcoin-screen/hooks/use-receive-prefill"
import { PaymentRequestState } from "@app/screens/receive-bitcoin-screen/payment/index.types"

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({ displayCurrency: "KES", fractionDigits: 2 }),
}))

type Request = Parameters<typeof useReceivePrefill>[0]["request"]

const requestIn = (state: string, memoChangeText: string | null = null) =>
  ({
    state,
    memoChangeText,
    setMemoChangeText: jest.fn(),
  }) as unknown as Request

describe("useReceivePrefill", () => {
  beforeEach(() => clearHandoffPrefill())

  it("starts Receive at the hand-off's amount and commits its note", () => {
    putHandoffPrefill(
      RECEIVE_PREFILL_KEY,
      { amount: { currency: "KES", value: 150 }, note: "Rent share" },
      Date.now(),
    )
    const handleSetAmount = jest.fn()
    const handleMemoBlur = jest.fn()
    const request = requestIn(PaymentRequestState.Created)

    const { rerender } = renderHook(
      (props: { request: Request }) =>
        useReceivePrefill({ request: props.request, handleSetAmount, handleMemoBlur }),
      { initialProps: { request } },
    )

    expect(handleSetAmount).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 15000, currencyCode: "KES" }),
    )
    expect(request.setMemoChangeText).toHaveBeenCalledWith("Rent share")
    expect(handleMemoBlur).not.toHaveBeenCalled()

    // The memo text lands on the next render; only then is it applied.
    rerender({ request: { ...request, memoChangeText: "Rent share" } as Request })
    expect(handleMemoBlur).toHaveBeenCalledTimes(1)
  })

  it("waits until the request has finished loading", () => {
    putHandoffPrefill(
      RECEIVE_PREFILL_KEY,
      { amount: { currency: "BTC", value: 500 } },
      Date.now(),
    )
    const handleSetAmount = jest.fn()
    const { rerender } = renderHook(
      (props: { request: Request }) =>
        useReceivePrefill({ request: props.request, handleSetAmount, handleMemoBlur: jest.fn() }),
      { initialProps: { request: requestIn(PaymentRequestState.Loading) } },
    )
    expect(handleSetAmount).not.toHaveBeenCalled()

    rerender({ request: requestIn(PaymentRequestState.Created) })
    expect(handleSetAmount).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 500, currency: "BTC" }),
    )
  })

  it("does nothing without a receive hand-off, and ignores a send's", () => {
    putHandoffPrefill("friend@afribit.africa", { note: "Lunch" }, Date.now())
    const handleSetAmount = jest.fn()
    const request = requestIn(PaymentRequestState.Created)
    renderHook(() =>
      useReceivePrefill({ request, handleSetAmount, handleMemoBlur: jest.fn() }),
    )
    expect(handleSetAmount).not.toHaveBeenCalled()
    expect(request.setMemoChangeText).not.toHaveBeenCalled()
  })

  it("applies the hand-off once, not again on later renders", () => {
    putHandoffPrefill(
      RECEIVE_PREFILL_KEY,
      { amount: { currency: "BTC", value: 500 } },
      Date.now(),
    )
    const handleSetAmount = jest.fn()
    const { rerender } = renderHook(
      (props: { request: Request }) =>
        useReceivePrefill({ request: props.request, handleSetAmount, handleMemoBlur: jest.fn() }),
      { initialProps: { request: requestIn(PaymentRequestState.Created) } },
    )
    rerender({ request: requestIn(PaymentRequestState.Created) })
    expect(handleSetAmount).toHaveBeenCalledTimes(1)
  })
})
