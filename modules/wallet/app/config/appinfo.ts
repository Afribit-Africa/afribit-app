import { AFRIBIT_LINKS } from "./afribit-links"
import { LNURL_DOMAIN_ALIASES } from "./service-domains"

// Links and addresses come from app/config/afribit-links.ts; an empty value means the
// owner has not published an Afribit one yet and the surface that would open it hides.
export const WHATSAPP_CONTACT_NUMBER = AFRIBIT_LINKS.whatsAppSupport
export const CONTACT_EMAIL_ADDRESS = AFRIBIT_LINKS.supportEmail
export const APP_STORE_LINK =
  "https://apps.apple.com/app/blink-bitcoin-beach-wallet/id1531383905"
export const PLAY_STORE_LINK =
  "https://play.google.com/store/apps/details?id=africa.afribit.wallet"
export const PREFIX_LINKING = [
  "https://pay.bbw.sv",
  "https://pay.blink.sv",
  "bitcoinbeach://",
  "blink://",
  // Afribit OS (the super app) opens the wallet with this scheme.
  "afribitwallet://",
]

// Configured in app/config/service-domains.ts (overridable per build in .env).
export const LNURL_DOMAINS: string[] = [...LNURL_DOMAIN_ALIASES]

export const getInviteLink = (_username: string | null | undefined) => {
  const username = _username ? `/${_username}` : ""
  return `https://get.blink.sv${username}`
}

/** Keychain slot of the self-custodial credential backup. A storage key, not a server:
 *  changing it would orphan existing backups. */
export const BLINK_DOMAIN = "blink.sv"

export const BLOCKED_COUNTRIES_FAQ_LINK = AFRIBIT_LINKS.blockedCountriesFaq

export const UNILATERAL_EXIT_CASE_STUDY_URL = AFRIBIT_LINKS.blog

export const getCloudBackupFilenamePrefix = (network: string) =>
  `blink-spark-backup-${network.toLowerCase()}-`

export const getCloudBackupFilename = (network: string, walletIdentifier: string) =>
  `${getCloudBackupFilenamePrefix(network)}${walletIdentifier}.json`

export const BLINK_DEEP_LINK_PREFIX = "blink:/"
export const TELEGRAM_CALLBACK_PATH = "auth/passport-callback"
export const APPROXIMATE_PREFIX = "~"
export const MASK_CHAR = "•"
