import { Linking } from "react-native"

import { handoffUrl } from "@app/navigation/wallet-handoff"
import {
  isWalletOwnUrl,
  isWalletUrl,
  openWalletUrl,
  setWalletLinkDispatcher,
} from "@app/navigation/wallet-links"

describe("isWalletUrl", () => {
  it.each([
    "blink:/settings",
    "blink://account-migration",
    "afribitwallet://receive",
    "lightning:lnbc1payment",
    "LIGHTNING:LNBC1PAYMENT",
    "lightning://lnbc1payment",
    "bitcoin:bc1qexample",
    "lnurlw://example.com/withdraw",
    "https://pay.blink.sv/alice",
  ])("takes %s", (url) => {
    expect(isWalletUrl(url)).toBe(true)
  })

  it.each([
    "afribit://connect/join?ticket=t&session=s",
    "afribit://app/wallet",
    "https://pay.blink.sv.example.com/alice",
    "https://example.com",
    "mailto:connect@afribit.africa",
    "",
    null,
    undefined,
  ])("leaves %s to the shell or the OS", (url) => {
    expect(isWalletUrl(url)).toBe(false)
  })
})

describe("isWalletOwnUrl", () => {
  it.each([
    "blink:/settings",
    "afribitwallet://receive",
    "AFRIBITWALLET://lnbc1payment",
    "https://pay.blink.sv/alice",
  ])("takes %s from the OS", (url) => {
    expect(isWalletOwnUrl(url)).toBe(true)
  })

  it.each([
    "lightning:lnbc1payment",
    "lightning://lnbc1payment",
    "bitcoin:bc1qexample",
    "lnurlw://example.com/withdraw",
    "afribit://app/wallet",
    "",
    null,
  ])("leaves %s to the shell", (url) => {
    expect(isWalletOwnUrl(url)).toBe(false)
  })
})

describe("openWalletUrl", () => {
  it("still opens a payment link from the Wallet's own screens in its navigator", async () => {
    const dispatch = jest.fn()
    setWalletLinkDispatcher(dispatch)

    await openWalletUrl("lightning:lnbc1payment")

    expect(dispatch).toHaveBeenCalledWith("lightning:lnbc1payment")
    setWalletLinkDispatcher(null)
  })

  afterEach(() => {
    setWalletLinkDispatcher(null)
    jest.mocked(Linking.openURL).mockClear()
  })

  it("hands a Wallet link to the Wallet's navigator, not the OS", async () => {
    const dispatch = jest.fn()
    setWalletLinkDispatcher(dispatch)

    await openWalletUrl("blink:/settings")

    expect(dispatch).toHaveBeenCalledWith("blink:/settings")
    expect(Linking.openURL).not.toHaveBeenCalled()
  })

  it("sends any other link to the OS", async () => {
    const dispatch = jest.fn()
    setWalletLinkDispatcher(dispatch)

    await openWalletUrl("https://example.com")

    expect(dispatch).not.toHaveBeenCalled()
    expect(Linking.openURL).toHaveBeenCalledWith("https://example.com")
  })

  it("falls back to the OS before the navigator is up", async () => {
    await openWalletUrl("blink:/settings")

    expect(Linking.openURL).toHaveBeenCalledWith("blink:/settings")
  })
})

describe("handoffUrl", () => {
  it("opens Receive", () => {
    expect(handoffUrl({ kind: "receive" })).toBe("afribitwallet://receive")
  })

  it("starts a payment to the destination, escaped as one path segment", () => {
    expect(handoffUrl({ kind: "send", destination: "lnbc1payment" })).toBe(
      "afribitwallet://lnbc1payment",
    )
    expect(handoffUrl({ kind: "send", destination: "alice@example.com" })).toBe(
      "afribitwallet://alice%40example.com",
    )
  })
})
