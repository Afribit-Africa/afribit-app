import { WalletCurrency } from "@app/graphql/generated"
import {
  HANDOFF_PREFILL_TTL_MS,
  clearHandoffPrefill,
  prefillMoneyAmount,
  putHandoffPrefill,
  takeHandoffPrefill,
} from "@app/navigation/handoff-prefill"
import { DisplayCurrency } from "@app/types/amounts"

describe("handoff prefill", () => {
  beforeEach(() => clearHandoffPrefill())

  it("gives the amount and note to a send to the same destination, once", () => {
    putHandoffPrefill("friend@afribit.africa", { note: "Lunch" }, 1000)
    expect(takeHandoffPrefill("Friend@Afribit.Africa ", 2000)).toEqual({ note: "Lunch" })
    expect(takeHandoffPrefill("friend@afribit.africa", 2000)).toBeNull()
  })

  it("gives nothing to a send to another destination, and drops what was kept", () => {
    putHandoffPrefill("friend@afribit.africa", { note: "Lunch" }, 1000)
    expect(takeHandoffPrefill("someone@else.africa", 2000)).toBeNull()
    expect(takeHandoffPrefill("friend@afribit.africa", 2000)).toBeNull()
  })

  it("gives nothing after the TTL", () => {
    putHandoffPrefill("friend@afribit.africa", { note: "Lunch" }, 1000)
    expect(
      takeHandoffPrefill("friend@afribit.africa", 1000 + HANDOFF_PREFILL_TTL_MS),
    ).toBeNull()
  })

  it("gives nothing without a destination", () => {
    putHandoffPrefill("friend@afribit.africa", { note: "Lunch" }, 1000)
    expect(takeHandoffPrefill(undefined, 1000)).toBeNull()
  })

  it("a newer hand-off replaces the older one", () => {
    putHandoffPrefill("a@afribit.africa", { note: "one" }, 1000)
    putHandoffPrefill("b@afribit.africa", { note: "two" }, 1000)
    expect(takeHandoffPrefill("a@afribit.africa", 1000)).toBeNull()
  })
})

describe("prefillMoneyAmount", () => {
  it("uses whole sats in any display currency", () => {
    expect(prefillMoneyAmount({ currency: "BTC", value: 2100 }, "USD", 2)).toEqual(
      { amount: 2100, currency: WalletCurrency.Btc, currencyCode: WalletCurrency.Btc },
    )
  })

  it("refuses fractional sats", () => {
    expect(prefillMoneyAmount({ currency: "BTC", value: 1.5 }, "KES", 2)).toBeNull()
  })

  it("uses shillings only when KES is the display currency", () => {
    expect(prefillMoneyAmount({ currency: "KES", value: 50.5 }, "KES", 2)).toEqual(
      { amount: 5050, currency: DisplayCurrency, currencyCode: "KES" },
    )
    expect(prefillMoneyAmount({ currency: "KES", value: 50 }, "USD", 2)).toBeNull()
  })

  it("refuses zero, negative and non-finite amounts", () => {
    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(prefillMoneyAmount({ currency: "BTC", value }, "KES", 2)).toBeNull()
    }
  })
})
