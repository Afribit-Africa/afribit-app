import Config from "react-native-config"

/**
 * Lightning Address / LNURL hosts, in one place.
 *
 * Afribit runs on Blink's Spark LNURL server for now (address registration and
 * liquidity), so the defaults are Blink's hosts. A build points at another server by
 * setting these in `.env`, with no code change:
 *
 *   AFRIBIT_LNURL_DOMAIN               mainnet address domain       (default blink.sv)
 *   AFRIBIT_LNURL_DOMAIN_REGTEST       regtest address domain       (default staging.blink.sv)
 *   AFRIBIT_LNURL_PAY_DOMAIN_REGTEST   regtest point-of-sale host   (default pay.staging.blink.sv)
 *   AFRIBIT_LNURL_ALIASES              comma-separated mainnet hosts that also name our
 *                                      accounts (default: Blink's aliases with the Blink
 *                                      domain, otherwise just AFRIBIT_LNURL_DOMAIN)
 *
 * A value that is set but is not a plain host name stops the app at startup rather than
 * silently registering addresses on the wrong server.
 */

const HOST =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/

const BLINK_MAINNET = "blink.sv"
const BLINK_ALIASES = ["blink.sv", "pay.blink.sv", "pay.bbw.sv"]

export const parseHost = (
  name: string,
  value: string | undefined,
  fallback: string,
): string => {
  if (value === undefined || value.trim() === "") return fallback
  const host = value.trim().toLowerCase()
  if (!HOST.test(host))
    throw new Error(`${name} is not a host name: ${JSON.stringify(value)}`)
  return host
}

export const parseHostList = (
  name: string,
  value: string | undefined,
  fallback: readonly string[],
): string[] => {
  if (value === undefined || value.trim() === "") return [...fallback]
  return value
    .split(",")
    .map((part) => parseHost(name, part, ""))
    .filter(Boolean)
}

export const LNURL_DOMAIN_MAINNET = parseHost(
  "AFRIBIT_LNURL_DOMAIN",
  Config.AFRIBIT_LNURL_DOMAIN,
  BLINK_MAINNET,
)
export const LNURL_DOMAIN_REGTEST = parseHost(
  "AFRIBIT_LNURL_DOMAIN_REGTEST",
  Config.AFRIBIT_LNURL_DOMAIN_REGTEST,
  "staging.blink.sv",
)
export const LNURL_PAY_DOMAIN_REGTEST = parseHost(
  "AFRIBIT_LNURL_PAY_DOMAIN_REGTEST",
  Config.AFRIBIT_LNURL_PAY_DOMAIN_REGTEST,
  "pay.staging.blink.sv",
)

/** Mainnet hosts that name one of our own accounts; the address domain comes first. */
export const LNURL_DOMAIN_ALIASES: readonly string[] = (() => {
  const aliases = parseHostList(
    "AFRIBIT_LNURL_ALIASES",
    Config.AFRIBIT_LNURL_ALIASES,
    LNURL_DOMAIN_MAINNET === BLINK_MAINNET ? BLINK_ALIASES : [LNURL_DOMAIN_MAINNET],
  )
  return [
    LNURL_DOMAIN_MAINNET,
    ...aliases.filter((host) => host !== LNURL_DOMAIN_MAINNET),
  ]
})()
