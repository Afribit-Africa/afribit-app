/**
 * Typed client for the Afribit Mesh service (https://wifi.afribit.africa).
 *
 * The router-attested session and this phone's device key travel in headers only,
 * never in a URL, an error or a log. Every response is checked field by field, so
 * the app never acts on a shape the service did not promise.
 */

export type MeshPassStatus = 'pending' | 'active' | 'expired' | 'failed';

/** The fields the app needs from a pass; the rest of the server's object is ignored. */
export interface MeshPass {
  readonly id: string;
  readonly status: MeshPassStatus;
  readonly expiresAt: string | null;
  readonly label: string;
  readonly devices: number;
}

export interface MeshAccess {
  readonly status: MeshPassStatus;
  readonly expiresAt: string | null;
}

export type MeshPassFailure =
  | 'offline'
  | 'timeout'
  | 'not-found'
  | 'unauthorized'
  | 'rejected'
  | 'server'
  | 'invalid-response';

export type MeshPassResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: MeshPassFailure; readonly message?: string };

export interface MeshRedeemInput {
  readonly code: string;
  readonly replaceDeviceId?: string;
  readonly label?: string;
}

export type MeshPackageKind = 'personal' | 'household' | 'tv';

/** A pass on sale. `bitcoinKes` is the discounted Lightning price, or null when bitcoin is not accepted for it. */
export interface MeshPackage {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly priceKes: number;
  readonly durationMinutes: number;
  readonly dataLimitMb: number | null;
  readonly kind: MeshPackageKind;
  readonly deviceLimit: number;
  readonly bitcoinKes: number | null;
}

export interface MeshCatalog {
  readonly packages: readonly MeshPackage[];
  readonly bitcoinEnabled: boolean;
  readonly mpesaEnabled: boolean;
}

/** `mpesa` lets the service pick whichever M-Pesa provider is ready. */
export type MeshPaymentProvider = 'lightning' | 'mpesa';

export interface MeshPurchaseInput {
  readonly packageId: string;
  readonly provider: MeshPaymentProvider;
  /** A caller-made UUID v4, so a retry with the same id is idempotent. The client never makes it. */
  readonly requestId: string;
  /** Required for mpesa. Never echoed in an error or a log. */
  readonly phone?: string;
  readonly forDeviceCode?: string;
}

export interface MeshPurchaseStarted {
  readonly paymentId: string;
}

export type MeshPaymentStatus = 'new' | 'processing' | 'settled' | 'expired' | 'invalid' | 'refunded';

export interface MeshLightningInvoice {
  readonly paymentRequest: string;
  readonly satoshis: number;
  readonly expiresAt: string | null;
}

export interface MeshPayment {
  readonly status: MeshPaymentStatus;
  readonly nativeAccess: MeshAccess | null;
  /** Present only for an unpaid Lightning purchase owned by this session. */
  readonly lightning?: MeshLightningInvoice;
}

export type MeshPurchaseFailure = MeshPassFailure | 'earlier-payment' | 'reference-closed';

/** `earlier-payment` carries the still-open payment so the UI can resume it; `reference-closed` means the caller needs a new requestId. */
export type MeshPurchaseResult =
  | { readonly ok: true; readonly value: MeshPurchaseStarted }
  | { readonly ok: false; readonly reason: Exclude<MeshPurchaseFailure, 'earlier-payment'>; readonly message?: string }
  | { readonly ok: false; readonly reason: 'earlier-payment'; readonly paymentId: string };

export interface MeshPassClient {
  listPasses(): Promise<MeshPassResult<readonly MeshPass[]>>;
  redeemCode(input: MeshRedeemInput): Promise<MeshPassResult<{ readonly grantId: string }>>;
  accessStatus(grantId: string): Promise<MeshPassResult<MeshAccess>>;
  listPackages(): Promise<MeshPassResult<MeshCatalog>>;
  startPurchase(input: MeshPurchaseInput): Promise<MeshPurchaseResult>;
  paymentStatus(paymentId: string): Promise<MeshPassResult<MeshPayment>>;
}

export interface MeshPassConfig {
  readonly baseUrl: string;
  /** X-Afribit-Mesh-Session: `<uuid>.<43 base64url>`, minted when the phone joins the mesh. */
  readonly session: string;
  /** X-Afribit-Mesh-Device: this phone's 32-byte key, base64url. */
  readonly deviceKey: string;
  readonly fetch: typeof fetch;
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_MESSAGE_CHARS = 200;
const CODE = /^[\d\s-]{10,16}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/i;
const DEVICE_KEY = /^[A-Za-z0-9_-]{43}$/;
/** Mainnet BOLT11: `lnbc`, amount, the `1` separator, then bech32 data (chars `1`, `b`, `i` and `o` are not used). */
const BOLT11 = /^lnbc[0-9]*[munp]?1[02-9ac-hj-np-z]{6,}$/i;
const STATUSES: readonly MeshPassStatus[] = ['pending', 'active', 'expired', 'failed'];
const PACKAGE_KINDS: readonly MeshPackageKind[] = ['personal', 'household', 'tv'];
const PAYMENT_STATUSES: readonly MeshPaymentStatus[] = ['new', 'processing', 'settled', 'expired', 'invalid', 'refunded'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function failure<T>(reason: MeshPassFailure, message?: string): MeshPassResult<T> {
  return message === undefined ? { ok: false, reason } : { ok: false, reason, message };
}

function isExpiresAt(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && !Number.isNaN(Date.parse(value)));
}

function parsePass(raw: unknown): MeshPass | null {
  if (!isRecord(raw)) return null;
  const { id, status, expiresAt, label, devices } = raw;
  if (typeof id !== 'string' || id.length === 0 || id.length > 64) return null;
  if (!oneOf(status, STATUSES)) return null;
  if (!isExpiresAt(expiresAt)) return null;
  if (typeof label !== 'string' || label.length < 1 || label.length > 24) return null;
  if (typeof devices !== 'number' || !Number.isSafeInteger(devices) || devices < 0) return null;
  return { id, status, expiresAt, label, devices };
}

function parseAccess(raw: unknown): MeshAccess | null {
  if (!isRecord(raw)) return null;
  const { status, expiresAt } = raw;
  if (!oneOf(status, STATUSES)) return null;
  if (expiresAt === undefined) return { status, expiresAt: null };
  if (!isExpiresAt(expiresAt)) return null;
  return { status, expiresAt };
}

/** A nullable number the service may leave out; a wrong type still fails the check. */
function optionalNumber(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return null;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parsePackage(raw: unknown): MeshPackage | null {
  if (!isRecord(raw)) return null;
  const { id, name, description, priceKes, durationMinutes, dataLimitMb, kind, deviceLimit, bitcoinKes } = raw;
  if (typeof id !== 'string' || !UUID.test(id)) return null;
  if (typeof name !== 'string' || name.length < 1 || name.length > 64) return null;
  if (description !== undefined && description !== null && typeof description !== 'string') return null;
  if (typeof priceKes !== 'number' || !Number.isFinite(priceKes) || priceKes < 0) return null;
  if (typeof durationMinutes !== 'number' || !Number.isFinite(durationMinutes) || durationMinutes <= 0) return null;
  const data = optionalNumber(dataLimitMb);
  if (data === undefined || (data !== null && data < 0)) return null;
  if (!oneOf(kind, PACKAGE_KINDS)) return null;
  if (typeof deviceLimit !== 'number' || !Number.isSafeInteger(deviceLimit) || deviceLimit < 0) return null;
  const bitcoin = optionalNumber(bitcoinKes);
  if (bitcoin === undefined || (bitcoin !== null && bitcoin < 0)) return null;
  return {
    id,
    name,
    description: description ?? null,
    priceKes,
    durationMinutes,
    dataLimitMb: data,
    kind,
    deviceLimit,
    bitcoinKes: bitcoin,
  };
}

/** Validates the invoice; the payment keeps its other fields when this returns null. */
function parseLightning(raw: unknown): MeshLightningInvoice | null {
  if (!isRecord(raw)) return null;
  const { paymentRequest, satoshis, expiresAt } = raw;
  if (typeof paymentRequest !== 'string' || !BOLT11.test(paymentRequest)) return null;
  if (typeof satoshis !== 'number' || !Number.isSafeInteger(satoshis) || satoshis <= 0) return null;
  if (!isExpiresAt(expiresAt)) return null;
  return { paymentRequest, satoshis, expiresAt };
}

function parsePayment(raw: unknown): MeshPayment | null {
  if (!isRecord(raw)) return null;
  const { status, nativeAccess, lightning } = raw;
  if (!oneOf(status, PAYMENT_STATUSES)) return null;

  let native: MeshAccess | null;
  if (nativeAccess === undefined || nativeAccess === null) native = null;
  else {
    native = parseAccess(nativeAccess);
    if (native === null) return null;
  }

  // A malformed invoice is dropped; the rest of the payment is still usable.
  const invoice = lightning === undefined || lightning === null ? null : parseLightning(lightning);
  if (invoice === null) return { status, nativeAccess: native };
  return { status, nativeAccess: native, lightning: invoice };
}

function buildRedeemBody(input: MeshRedeemInput): { code: string; replaceDeviceId?: string; label?: string } | null {
  const { code, replaceDeviceId, label } = input;
  if (typeof code !== 'string' || !CODE.test(code)) return null;
  if (label !== undefined && (typeof label !== 'string' || label.length < 1 || label.length > 24)) return null;
  if (replaceDeviceId !== undefined && (typeof replaceDeviceId !== 'string' || !UUID.test(replaceDeviceId))) return null;
  const body: { code: string; replaceDeviceId?: string; label?: string } = { code };
  if (replaceDeviceId !== undefined) body.replaceDeviceId = replaceDeviceId;
  if (label !== undefined) body.label = label;
  return body;
}

interface PurchaseBody {
  packageId: string;
  provider: MeshPaymentProvider;
  requestId: string;
  phone?: string;
  forDeviceCode?: string;
}

function buildPurchaseBody(input: MeshPurchaseInput): PurchaseBody | null {
  const { packageId, provider, requestId, phone, forDeviceCode } = input;
  if (typeof packageId !== 'string' || !UUID.test(packageId)) return null;
  if (provider !== 'lightning' && provider !== 'mpesa') return null;
  if (typeof requestId !== 'string' || !UUID.test(requestId)) return null;
  if (phone !== undefined && (typeof phone !== 'string' || !/^\+?[0-9]{9,15}$/.test(phone))) return null;
  if (provider === 'mpesa' && phone === undefined) return null;
  if (forDeviceCode !== undefined && (typeof forDeviceCode !== 'string' || forDeviceCode.length < 1 || forDeviceCode.length > 64)) {
    return null;
  }
  const body: PurchaseBody = { packageId, provider, requestId };
  if (phone !== undefined) body.phone = phone;
  if (forDeviceCode !== undefined) body.forDeviceCode = forDeviceCode;
  return body;
}

interface ServerError {
  readonly message?: string;
  readonly code?: string;
  readonly paymentId?: string;
}

/** The `error`, `code` and `paymentId` a 4xx or a 503 may carry; empty when the body is not that shape. */
function parseServerError(text: string | null): ServerError {
  if (text === null) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {};
  }
  if (!isRecord(parsed)) return {};
  const error: { message?: string; code?: string; paymentId?: string } = {};
  if (typeof parsed.error === 'string') error.message = parsed.error.slice(0, MAX_MESSAGE_CHARS);
  if (typeof parsed.code === 'string') error.code = parsed.code;
  if (typeof parsed.paymentId === 'string') error.paymentId = parsed.paymentId;
  return error;
}

// Built on first use: the kernel index loads this module on every screen, and a missing
// global must not crash start-up. RN's fetch returns no stream body, so Hermes takes the
// res.text() path and never needs the decoder.
const utf8Bytes = (text: string): number => new TextEncoder().encode(text).byteLength;
const decodeUtf8 = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

type BodyRead =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly reason: 'too-large' | 'timeout' | 'unreadable' };

type ReadOutcome =
  | { readonly kind: 'chunk'; readonly result: ReadableStreamReadResult<Uint8Array> }
  | { readonly kind: 'aborted' }
  | { readonly kind: 'error' };

function concatChunks(chunks: readonly Uint8Array[], total: number): Uint8Array {
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

/** One read that also settles when the request's signal aborts, so a stalled or dripping body cannot hang the call. */
function readWithAbort(reader: ReadableStreamDefaultReader<Uint8Array>, signal: AbortSignal): Promise<ReadOutcome> {
  return new Promise<ReadOutcome>((resolve) => {
    let settled = false;
    const finish = (outcome: ReadOutcome) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      resolve(outcome);
    };
    const onAbort = () => {
      void reader.cancel().catch(() => undefined);
      finish({ kind: 'aborted' });
    };
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }
    reader.read().then(
      (result) => finish({ kind: 'chunk', result }),
      () => finish({ kind: 'error' }),
    );
  });
}

/**
 * Reads the body in chunks so a chunked response cannot pass 64 KB in memory, and keeps
 * the request's signal live so a body that stalls or drips still times out.
 */
async function readBounded(res: Response, signal: AbortSignal): Promise<BodyRead> {
  const declared = res.headers.get('content-length');
  if (declared !== null) {
    const bytes = Number(declared);
    if (Number.isSafeInteger(bytes) && bytes > MAX_BODY_BYTES) {
      void res.body?.cancel().catch(() => undefined);
      return { ok: false, reason: 'too-large' };
    }
  }

  const body = res.body;
  if (body === null) {
    if (signal.aborted) return { ok: false, reason: 'timeout' };
    let text: string;
    try {
      text = await res.text();
    } catch {
      return { ok: false, reason: signal.aborted ? 'timeout' : 'unreadable' };
    }
    if (signal.aborted) return { ok: false, reason: 'timeout' };
    return utf8Bytes(text) > MAX_BODY_BYTES
      ? { ok: false, reason: 'too-large' }
      : { ok: true, text };
  }

  if (signal.aborted) {
    void body.cancel().catch(() => undefined);
    return { ok: false, reason: 'timeout' };
  }

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = body.getReader();
  } catch {
    return { ok: false, reason: 'unreadable' };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const outcome = await readWithAbort(reader, signal);
    if (outcome.kind === 'aborted') return { ok: false, reason: 'timeout' };
    if (outcome.kind === 'error') return { ok: false, reason: signal.aborted ? 'timeout' : 'unreadable' };
    const { done, value } = outcome.result;
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      void reader.cancel().catch(() => undefined);
      return { ok: false, reason: 'too-large' };
    }
    chunks.push(value);
  }

  return { ok: true, text: decodeUtf8(concatChunks(chunks, total)) };
}

function httpsOrigin(baseUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') return null;
  return url.origin;
}

interface RequestSpec {
  readonly method: 'GET' | 'POST';
  readonly body?: string;
  /** The payments API answers 503 with "The internet line is down…"; only that call keeps 5xx text. */
  readonly keepServerMessage?: boolean;
}

type CallFailure = {
  readonly ok: false;
  readonly reason: MeshPassFailure;
  readonly message?: string;
  /** Only set for a rejected 4xx; the public pass methods drop them. */
  readonly code?: string;
  readonly paymentId?: string;
};

type CallResult = { readonly ok: true; readonly value: unknown } | CallFailure;

/** Drops the internal error detail when a method only needs the reason and message. */
function callFailure(res: CallFailure): MeshPassResult<never> {
  return failure(res.reason, res.message);
}

export function createMeshPassClient(config: MeshPassConfig): MeshPassClient {
  const { baseUrl, session, deviceKey, fetch: doFetch } = config;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const origin = httpsOrigin(baseUrl);
  const ready =
    origin !== null &&
    SESSION.test(session) &&
    DEVICE_KEY.test(deviceKey) &&
    Number.isSafeInteger(timeoutMs) &&
    timeoutMs > 0;

  async function call(path: string, spec: RequestSpec): Promise<CallResult> {
    if (!ready || origin === null) return failure('invalid-response');

    const headers: Record<string, string> = {
      'X-Afribit-Mesh-Session': session,
      'X-Afribit-Mesh-Device': deviceKey,
      Accept: 'application/json',
      'Cache-Control': 'no-store',
    };
    if (spec.body !== undefined) headers['Content-Type'] = 'application/json';

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const init: RequestInit = { method: spec.method, headers, redirect: 'manual', signal: ctrl.signal };
      if (spec.body !== undefined) init.body = spec.body;

      let res: Response;
      try {
        res = await doFetch(`${origin}${path}`, init);
      } catch {
        return failure(ctrl.signal.aborted ? 'timeout' : 'offline');
      }

      if (res.type === 'opaqueredirect' || res.redirected || (res.status >= 300 && res.status < 400)) {
        return failure('invalid-response');
      }
      if (res.status >= 400) {
        if (res.status >= 500) {
          if (spec.keepServerMessage !== true) return failure('server');
          const body = await readBounded(res, ctrl.signal);
          if (!body.ok && body.reason === 'timeout') return failure('timeout');
          return failure('server', body.ok ? parseServerError(body.text).message : undefined);
        }
        const body = await readBounded(res, ctrl.signal);
        if (!body.ok && body.reason === 'timeout') return failure('timeout');
        const detail = body.ok ? parseServerError(body.text) : {};
        if (res.status === 401) return failure('unauthorized', detail.message);
        if (res.status === 404) return failure('not-found', detail.message);
        return {
          ok: false,
          reason: 'rejected',
          ...(detail.message !== undefined ? { message: detail.message } : {}),
          ...(detail.code !== undefined ? { code: detail.code } : {}),
          ...(detail.paymentId !== undefined ? { paymentId: detail.paymentId } : {}),
        };
      }
      if (!res.ok) return failure('invalid-response');

      const body = await readBounded(res, ctrl.signal);
      if (!body.ok) return failure(body.reason === 'timeout' ? 'timeout' : 'invalid-response');
      let parsed: unknown;
      try {
        parsed = JSON.parse(body.text);
      } catch {
        return failure('invalid-response');
      }
      return { ok: true, value: parsed };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async listPasses() {
      const res = await call('/api/mesh/pass', { method: 'GET' });
      if (!res.ok) return callFailure(res);
      if (!isRecord(res.value) || !isArray(res.value.passes)) return failure('invalid-response');
      const passes: MeshPass[] = [];
      for (const raw of res.value.passes) {
        const pass = parsePass(raw);
        if (pass === null) return failure('invalid-response');
        passes.push(pass);
      }
      return { ok: true, value: passes };
    },

    async redeemCode(input) {
      const body = buildRedeemBody(input);
      if (body === null) return failure('invalid-response');
      const res = await call('/api/mesh/pass/code', { method: 'POST', body: JSON.stringify(body) });
      if (!res.ok) return callFailure(res);
      if (!isRecord(res.value) || typeof res.value.grantId !== 'string' || !UUID.test(res.value.grantId)) {
        return failure('invalid-response');
      }
      return { ok: true, value: { grantId: res.value.grantId } };
    },

    async accessStatus(grantId) {
      if (typeof grantId !== 'string' || !UUID.test(grantId)) return failure('invalid-response');
      const res = await call(`/api/mesh/access/status?grant=${grantId}`, { method: 'GET' });
      if (!res.ok) return callFailure(res);
      const access = parseAccess(res.value);
      if (access === null) return failure('invalid-response');
      return { ok: true, value: access };
    },

    async listPackages() {
      const res = await call('/api/mesh/app/packages', { method: 'GET' });
      if (!res.ok) return callFailure(res);
      if (!isRecord(res.value)) return failure('invalid-response');
      const { packages, bitcoinEnabled, mpesaEnabled } = res.value;
      if (!isArray(packages)) return failure('invalid-response');
      if (typeof bitcoinEnabled !== 'boolean' || typeof mpesaEnabled !== 'boolean') {
        return failure('invalid-response');
      }
      const parsed: MeshPackage[] = [];
      for (const raw of packages) {
        const item = parsePackage(raw);
        if (item !== null) parsed.push(item);
      }
      return { ok: true, value: { packages: parsed, bitcoinEnabled, mpesaEnabled } };
    },

    async startPurchase(input) {
      const body = buildPurchaseBody(input);
      if (body === null) return failure('invalid-response');
      const res = await call('/api/payments', {
        method: 'POST',
        body: JSON.stringify(body),
        keepServerMessage: true,
      });
      if (res.ok) {
        if (!isRecord(res.value) || typeof res.value.paymentId !== 'string' || !UUID.test(res.value.paymentId)) {
          return failure('invalid-response');
        }
        return { ok: true, value: { paymentId: res.value.paymentId } };
      }
      if (res.reason !== 'rejected') return callFailure(res);
      if (res.code === 'earlier_payment') {
        if (typeof res.paymentId !== 'string' || !UUID.test(res.paymentId)) return failure('invalid-response');
        return { ok: false, reason: 'earlier-payment', paymentId: res.paymentId };
      }
      if (res.code === 'reference_closed') return { ok: false, reason: 'reference-closed' };
      return failure('rejected', res.message);
    },

    async paymentStatus(paymentId) {
      if (typeof paymentId !== 'string' || !UUID.test(paymentId)) return failure('rejected');
      const res = await call(`/api/payments/${paymentId}`, { method: 'GET' });
      if (!res.ok) return callFailure(res);
      const payment = parsePayment(res.value);
      if (payment === null) return failure('invalid-response');
      return { ok: true, value: payment };
    },
  };
}
