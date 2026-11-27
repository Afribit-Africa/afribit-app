import { Linking } from "react-native"

import { PREFIX_LINKING } from "@app/config"

/**
 * Inside Afribit the Wallet shares the app's links with the shell. The OS hands the app
 * every link it opens (`afribit://connect/join?...` among them), so the Wallet takes only its
 * own prefixes from the OS. The shell hands it payment links (`lightning:`, `bitcoin:`) from
 * other apps; from the Wallet's own screens they open in its navigator. Its own links also never
 * leave the app: no app on the phone owns `blink:` for Afribit, and the separate Blink or
 * Afribit Wallet app, if installed, must not receive them. So they are dispatched straight
 * to the Wallet's navigator instead of through `Linking.openURL`.
 */

const WALLET_SCHEMES = ["bitcoin:", "lightning:", "lapp:", "lnurlw:", "lnurlp:", "lnurl:"]

/** `blink://` also covers `blink:/settings`: React Navigation matches any slashes. */
const schemeOf = (prefix: string): string => prefix.slice(0, prefix.indexOf(":") + 1)

const hasOwnPrefix = (lower: string): boolean =>
  PREFIX_LINKING.some((prefix) => {
    const candidate = prefix.toLowerCase()
    return candidate.startsWith("https://")
      ? lower === candidate || lower.startsWith(`${candidate}/`)
      : lower.startsWith(schemeOf(candidate))
  })

/**
 * One of the Wallet's own prefixes (`afribitwallet://`, `blink://`, its pay pages). These are
 * the only links the Wallet takes from the OS. A payment link from another app (`lightning:`,
 * `bitcoin:`) reaches Afribit's shell, which checks it and hands it to the Wallet behind the
 * PIN (`WalletHandoff`); taking it from the OS as well would open the payment twice.
 */
export const isWalletOwnUrl = (url: string | null | undefined): url is string =>
  !!url && hasOwnPrefix(url.toLowerCase())

/** A link the Wallet's navigator opens from its own screens: its prefixes and the payment schemes. */
export const isWalletUrl = (url: string | null | undefined): url is string => {
  if (!url) return false
  const lower = url.toLowerCase()
  return hasOwnPrefix(lower) || WALLET_SCHEMES.some((scheme) => lower.startsWith(scheme))
}

type Dispatch = (url: string) => void
let dispatch: Dispatch | null = null

/** The navigator registers how it takes a Wallet link; null when it unmounts. */
export const setWalletLinkDispatcher = (next: Dispatch | null): void => {
  dispatch = next
}

export const hasWalletLinkDispatcher = (): boolean => dispatch !== null

/**
 * Opens a link from the Wallet's own screens: a Wallet link goes to the Wallet's navigator,
 * anything else (a website, mail, a store page) to the OS.
 */
export const openWalletUrl = (url: string): Promise<void> => {
  if (dispatch && isWalletUrl(url)) {
    dispatch(url)
    return Promise.resolve()
  }
  // Not async: a caller's try/catch still sees an openURL that throws straight away.
  return Linking.openURL(url)
}
