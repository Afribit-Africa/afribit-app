import type { WalletHandoff } from '@afribit/wallet-app';
import { BASE58_ADDRESS, BOLT11, LIGHTNING_FORMS, SEGWIT_ADDRESS } from './handoffCore';

/** The OS schemes Afribit registers for payments. */
export const PAYMENT_SCHEMES = ['lightning', 'bitcoin', 'lnurl'] as const;

const PAYMENT_SCHEME_SET: ReadonlySet<string> = new Set(PAYMENT_SCHEMES);
/** A payment link is short; anything this long is not one. */
const MAX_URL_LENGTH = 4096;
const MAX_BIP21_TEXT_LENGTH = 200;
const AMOUNT = /^\d{1,8}(\.\d{1,8})?$/;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;
const BIP21_KEYS: ReadonlySet<string> = new Set(['amount', 'label', 'message', 'lightning']);
const LINK = /^([a-z][a-z0-9+.-]*):(?:\/\/)?([\s\S]*)$/i;

interface Link {
  readonly scheme: string;
  readonly body: string;
}

/** Splits `scheme:` or `scheme://` from the rest, or null when the URL has no scheme. */
function parseLink(url: string): Link | null {
  const match = LINK.exec(url);
  const scheme = match?.[1];
  const body = match?.[2];
  if (scheme === undefined || body === undefined) return null;
  return { scheme: scheme.toLowerCase(), body };
}

function isPaymentScheme(scheme: string): boolean {
  return PAYMENT_SCHEME_SET.has(scheme);
}

/** True when the URL uses one of the schemes Afribit registers for payments, whether or not it is refused. */
export function usesPaymentScheme(url: string): boolean {
  const link = parseLink(url);
  return link !== null && isPaymentScheme(link.scheme);
}

/** The decoded text, or null when it is malformed, too long or carries a control character. */
function decodeText(value: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  return decoded.length <= MAX_BIP21_TEXT_LENGTH && !CONTROL_CHARACTER.test(decoded) ? decoded : null;
}

/** Every BIP21 key is known, appears once, and its value is well formed. */
function validBip21Query(query: string): boolean {
  const seen = new Set<string>();
  for (const part of query.split('&')) {
    const separator = part.indexOf('=');
    const key = separator === -1 ? part : part.slice(0, separator);
    const value = separator === -1 ? '' : part.slice(separator + 1);
    if (!BIP21_KEYS.has(key) || seen.has(key)) return false;
    seen.add(key);
    if (key === 'amount' && !AMOUNT.test(value)) return false;
    if (key === 'lightning' && !BOLT11.test(value)) return false;
    if ((key === 'label' || key === 'message') && decodeText(value) === null) return false;
  }
  return true;
}

function bitcoinHandoff(body: string): WalletHandoff | null {
  const queryStart = body.indexOf('?');
  const address = queryStart === -1 ? body : body.slice(0, queryStart);
  if (!SEGWIT_ADDRESS.test(address) && !BASE58_ADDRESS.test(address)) return null;
  if (queryStart === -1) return { kind: 'send', destination: address };
  const query = body.slice(queryStart + 1);
  if (!validBip21Query(query)) return null;
  return { kind: 'send', destination: `bitcoin:${address}?${query}` };
}

/**
 * The Wallet hand-off a system link stands for, or null when it is not a payment link the Wallet
 * may open. The Wallet shows its own confirmation and asks for its own PIN (S-12); the link only
 * chooses the first screen.
 */
export function walletHandoffForLink(url: string): WalletHandoff | null {
  if (url.length > MAX_URL_LENGTH) return null;
  const link = parseLink(url);
  if (link === null || !isPaymentScheme(link.scheme)) return null;
  if (link.scheme === 'bitcoin') return bitcoinHandoff(link.body);
  return LIGHTNING_FORMS.some((form) => form.test(link.body))
    ? { kind: 'send', destination: link.body }
    : null;
}
