import type { CapabilityIntent, CapabilityOutcome } from '@afribit/feature-sdk';
import { INTENT_ROUTES } from './capabilities';
import type { Registry } from './registry';

/**
 * Capability broker (PRD §15). It routes requests to enter trusted workflows;
 * it holds no financial authority itself.
 *
 * - The caller is bound by the host when it creates a client (`clientFor`),
 *   never read from the request.
 * - Intents are re-validated here because feature code is untrusted.
 * - Effective capability = manifest request ∩ release policy (computed by the registry).
 */

export interface IntentMeta {
  readonly requestId: string;
  readonly caller: string;
}

export type IntentHandler = (intent: CapabilityIntent, meta: IntentMeta) => Promise<CapabilityOutcome>;

export interface BrokerOptions {
  readonly registry: Registry;
  /** Handlers keyed by destination: 'shell' or a feature id. */
  readonly handlers: Readonly<Record<string, IntentHandler>>;
  /** Live check that a destination feature can currently be opened. */
  readonly isAvailable: (featureId: string) => boolean;
  readonly now?: () => number;
  readonly newRequestId?: () => string;
  /** General per-caller limit applied to every intent kind. */
  readonly rateLimit?: { readonly max: number; readonly windowMs: number };
  /** Separate, tighter per-caller limit for notify.local so Chat cannot spam the tray. */
  readonly notifyRateLimit?: { readonly max: number; readonly windowMs: number };
  /** Separate per-caller limit shared by the payment prompts (prepare, payContact, createRequest). */
  readonly paymentRateLimit?: { readonly max: number; readonly windowMs: number };
}

export interface BrokerClient {
  request(intent: unknown): Promise<CapabilityOutcome>;
}

export interface Broker {
  clientFor(featureId: string): BrokerClient;
}

const MAX_PAYMENT_REQUEST = 4096;
const MAX_NICKNAME = 64;
const PAYMENT_PURPOSES = new Set(['merchant', 'manual', 'mesh_pass']);
const MESH_SECTIONS = new Set(['settings', 'identity', 'packages']);
const MAX_NOTIFY_TITLE = 40;
const MAX_NOTIFY_BODY = 120;
const MAX_DISPLAY_NAME = 64;
const MAX_PAYMENT_ADDRESS = 2048;
const MAX_NOTE = 140;
const MAX_BTC_SATS = 2_100_000_000_000_000;
const MAX_KES = 1_000_000;
const CONTACT_VERIFICATIONS = new Set(['verified', 'unverified', 'changed-device']);
/** Intents that prompt the user to move or request money; they share one per-caller limit. */
const PAYMENT_PROMPTS: ReadonlySet<string> = new Set(['wallet.preparePayment', 'wallet.payContact', 'wallet.createRequest']);
/** Control characters (including newlines and tabs) and Unicode line separators. */
const CONTROL_OR_LINEBREAK = /[\u0000-\u001F\u007F\u2028\u2029]/;
const SERVICE_ID = /^[a-z][a-z0-9-]{1,30}$/;

type Amount = { currency: 'KES' | 'BTC'; value: number };
type Contact = { displayName: string; paymentAddress: string; verification: 'verified' | 'unverified' | 'changed-device' };

function exactKeys(o: Record<string, unknown>, keys: readonly string[]): boolean {
  const k = Object.keys(o);
  return k.length === keys.length && keys.every((x) => k.includes(x));
}

/** Every key present is in `keys`. Unlike exactKeys, keys may also be absent (optional fields). */
function onlyKeys(o: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(o).every((k) => keys.includes(k));
}

function isRecord(o: unknown): o is Record<string, unknown> {
  return typeof o === 'object' && o !== null && !Array.isArray(o);
}

/** True when `value` has no more than two decimal places (KES is stored in cents). */
function isAtMostTwoDecimals(value: number): boolean {
  return Math.round(value * 100) / 100 === value;
}

function parseAmount(raw: unknown): Amount | null {
  if (!isRecord(raw) || !exactKeys(raw, ['currency', 'value'])) return null;
  const currency = raw.currency;
  if (currency !== 'KES' && currency !== 'BTC') return null;
  const value = raw.value;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  if (currency === 'BTC') {
    if (!Number.isInteger(value) || value > MAX_BTC_SATS) return null;
  } else if (value > MAX_KES || !isAtMostTwoDecimals(value)) {
    return null;
  }
  return { currency, value };
}

function parseNote(raw: unknown): string | null {
  return typeof raw === 'string' && raw.length <= MAX_NOTE && !CONTROL_OR_LINEBREAK.test(raw) ? raw : null;
}

function parseContact(raw: unknown): Contact | null {
  if (!isRecord(raw) || !exactKeys(raw, ['displayName', 'paymentAddress', 'verification'])) return null;
  const { displayName, paymentAddress, verification } = raw;
  if (typeof displayName !== 'string' || displayName.length < 1 || displayName.length > MAX_DISPLAY_NAME || CONTROL_OR_LINEBREAK.test(displayName)) return null;
  if (typeof paymentAddress !== 'string' || paymentAddress.length < 1 || paymentAddress.length > MAX_PAYMENT_ADDRESS || /\s/.test(paymentAddress)) return null;
  if (typeof verification !== 'string' || !CONTACT_VERIFICATIONS.has(verification)) return null;
  return { displayName, paymentAddress, verification: verification as Contact['verification'] };
}

/** Parses untrusted input into a typed intent, or returns null. */
export function parseIntent(raw: unknown): CapabilityIntent | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  switch (o.kind) {
    case 'app.openService':
      return exactKeys(o, ['kind', 'serviceId']) && typeof o.serviceId === 'string' && SERVICE_ID.test(o.serviceId)
        ? { kind: 'app.openService', serviceId: o.serviceId }
        : null;
    case 'wallet.showReceive':
      return exactKeys(o, ['kind']) ? { kind: 'wallet.showReceive' } : null;
    case 'wallet.preparePayment':
      return exactKeys(o, ['kind', 'paymentRequest', 'purpose'])
        && typeof o.paymentRequest === 'string'
        && o.paymentRequest.length > 0 && o.paymentRequest.length <= MAX_PAYMENT_REQUEST
        && !/\s/.test(o.paymentRequest)
        && typeof o.purpose === 'string' && PAYMENT_PURPOSES.has(o.purpose)
        ? { kind: 'wallet.preparePayment', paymentRequest: o.paymentRequest, purpose: o.purpose as 'merchant' | 'manual' | 'mesh_pass' }
        : null;
    case 'wallet.payContact': {
      if (!onlyKeys(o, ['kind', 'contact', 'amount', 'note']) || !('contact' in o)) return null;
      const contact = parseContact(o.contact);
      if (!contact) return null;
      const amount = 'amount' in o ? parseAmount(o.amount) : undefined;
      if (amount === null) return null;
      const note = 'note' in o ? parseNote(o.note) : undefined;
      if (note === null) return null;
      return {
        kind: 'wallet.payContact',
        contact,
        ...(amount ? { amount } : {}),
        ...(note !== undefined ? { note } : {}),
      };
    }
    case 'wallet.createRequest': {
      if (!onlyKeys(o, ['kind', 'amount', 'note']) || !('amount' in o)) return null;
      const amount = parseAmount(o.amount);
      if (!amount) return null;
      const note = 'note' in o ? parseNote(o.note) : undefined;
      if (note === null) return null;
      return { kind: 'wallet.createRequest', amount, ...(note !== undefined ? { note } : {}) };
    }
    case 'shell.openMesh':
      if (exactKeys(o, ['kind'])) return { kind: 'shell.openMesh' };
      return exactKeys(o, ['kind', 'section'])
        && typeof o.section === 'string' && MESH_SECTIONS.has(o.section)
        ? { kind: 'shell.openMesh', section: o.section as 'settings' | 'identity' | 'packages' }
        : null;
    case 'profile.read':
      return exactKeys(o, ['kind']) ? { kind: 'profile.read' } : null;
    case 'notify.local':
      return exactKeys(o, ['kind', 'title', 'body'])
        && typeof o.title === 'string' && o.title.length >= 1 && o.title.length <= MAX_NOTIFY_TITLE
        && !CONTROL_OR_LINEBREAK.test(o.title)
        && typeof o.body === 'string' && o.body.length >= 1 && o.body.length <= MAX_NOTIFY_BODY
        && !CONTROL_OR_LINEBREAK.test(o.body)
        ? { kind: 'notify.local', title: o.title, body: o.body }
        : null;
    default:
      return null;
  }
}

let counter = 0;
function defaultRequestId(): string {
  counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
  return `req-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function createBroker(options: BrokerOptions): Broker {
  const now = options.now ?? Date.now;
  const newRequestId = options.newRequestId ?? defaultRequestId;
  const limit = options.rateLimit ?? { max: 10, windowMs: 10_000 };
  const notifyLimit = options.notifyRateLimit ?? { max: 5, windowMs: 60_000 };
  const paymentLimit = options.paymentRateLimit ?? { max: 3, windowMs: 60_000 };
  const recent = new Map<string, number[]>();
  const recentNotify = new Map<string, number[]>();
  const recentPayment = new Map<string, number[]>();

  function exceeded(map: Map<string, number[]>, caller: string, l: { readonly max: number; readonly windowMs: number }): boolean {
    const t = now();
    const kept = (map.get(caller) ?? []).filter((x) => t - x < l.windowMs);
    if (kept.length >= l.max) { map.set(caller, kept); return true; }
    kept.push(t);
    map.set(caller, kept);
    return false;
  }

  return {
    clientFor(featureId: string): BrokerClient {
      // The caller identity is captured here, by the host, and cannot be changed by the feature.
      const caller = featureId;
      return {
        async request(raw: unknown): Promise<CapabilityOutcome> {
          const requestId = newRequestId();
          const feature = options.registry.get(caller);
          if (!feature || !feature.enabled) return { requestId, status: 'denied', reason: 'unknown-caller' };

          const intent = parseIntent(raw);
          if (!intent) return { requestId, status: 'denied', reason: 'invalid-intent' };

          const route = INTENT_ROUTES[intent.kind];
          if (!feature.effectiveCapabilities.has(route.capability)) {
            return { requestId, status: 'denied', reason: 'capability-not-granted' };
          }
          // notify.local and the payment prompts each get their own counter so a burst
          // cannot eat into, or be hidden behind, another family's per-caller budget.
          if (intent.kind === 'notify.local' ? exceeded(recentNotify, caller, notifyLimit)
            : PAYMENT_PROMPTS.has(intent.kind) ? exceeded(recentPayment, caller, paymentLimit)
            : exceeded(recent, caller, limit)) {
            return { requestId, status: 'denied', reason: 'rate-limited' };
          }

          if (intent.kind === 'app.openService') {
            if (!options.registry.get(intent.serviceId)) return { requestId, status: 'failed', code: 'unknown-service' };
          }
          if (route.destination !== 'shell' && !options.isAvailable(route.destination)) {
            return { requestId, status: 'unavailable', reason: 'destination-unavailable' };
          }

          const handler = options.handlers[route.destination];
          if (!handler) return { requestId, status: 'unavailable', reason: 'no-handler' };
          try {
            const outcome = await handler(intent, { requestId, caller });
            // A profile is rebuilt from the two fields the contract allows, so a
            // handler cannot smuggle keys or identity through the outcome.
            if (outcome.status === 'profile') {
              const raw = (outcome as { profile?: unknown }).profile;
              const profile = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
              const nickname = profile.nickname;
              const npub = profile.npub ?? null;
              if (typeof nickname !== 'string' || nickname.length > MAX_NICKNAME || (npub !== null && typeof npub !== 'string')) {
                return { requestId, status: 'failed', code: 'bad-profile' };
              }
              return { requestId, status: 'profile', profile: { nickname, npub } };
            }
            // The outcome is always correlated to the host's request id.
            return { ...outcome, requestId };
          } catch {
            return { requestId, status: 'failed', code: 'handler-error' };
          }
        },
      };
    },
  };
}
