import type { LocalizedText } from '@afribit/feature-sdk';
import { FORBIDDEN_CAPABILITIES, isKnownCapability, type Capability } from './capabilities';

/**
 * Feature manifest (PRD §8). A manifest DESCRIBES a feature. It never grants
 * anything: effective powers are the intersection with the shell's release
 * policy (see registry.ts).
 */
export type ModuleClass = 'A' | 'B' | 'C' | 'D';
export type ModuleKind = 'native' | 'bundled-web' | 'external';
export type Readiness = 'available' | 'preview' | 'coming-later';
export type Category = 'money' | 'communication' | 'network' | 'learning' | 'work' | 'tools';
export type NetworkRequirement = 'none' | 'internet' | 'mesh' | 'internet-or-mesh';
/**
 * 'builtin': first-party class A code compiled into the app and mounted in the shell's
 * process until it gets its own (S-17, ONE_APP_PLAN W1 then W2). Only the release policy
 * can allow it, so a manifest cannot claim it.
 */
export type ProcessIsolation = 'shell' | 'dedicated' | 'builtin';

export interface FeatureManifest {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly displayName: LocalizedText;
  readonly tagline: LocalizedText;
  readonly version: string;
  readonly owner: string;
  readonly license: string;
  readonly classification: ModuleClass;
  readonly kind: ModuleKind;
  readonly readiness: Readiness;
  readonly category: Category;
  readonly requires: { readonly network: NetworkRequirement; readonly account: boolean };
  readonly requestedCapabilities: readonly Capability[];
  readonly networkDomains: readonly string[];
  readonly isolation: { readonly process: ProcessIsolation; readonly storageNamespace: string };
  readonly minimumHostContract: string;
}

export const HOST_CONTRACT = '1.0';

export type ManifestResult =
  | { readonly ok: true; readonly manifest: FeatureManifest }
  | { readonly ok: false; readonly errors: readonly string[] };

const ID = /^[a-z][a-z0-9-]{1,30}$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const CLASSES: readonly ModuleClass[] = ['A', 'B', 'C', 'D'];
const KINDS: readonly ModuleKind[] = ['native', 'bundled-web', 'external'];
const READINESS: readonly Readiness[] = ['available', 'preview', 'coming-later'];
const CATEGORIES: readonly Category[] = ['money', 'communication', 'network', 'learning', 'work', 'tools'];
const NETWORK: readonly NetworkRequirement[] = ['none', 'internet', 'mesh', 'internet-or-mesh'];
const PROCESS: readonly ProcessIsolation[] = ['shell', 'dedicated', 'builtin'];

const KNOWN_KEYS = new Set([
  'schemaVersion', 'id', 'displayName', 'tagline', 'version', 'owner', 'license', 'classification',
  'kind', 'readiness', 'category', 'requires', 'requestedCapabilities', 'networkDomains',
  'isolation', 'minimumHostContract',
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isLocalized(v: unknown): v is LocalizedText {
  return isRecord(v) && typeof v.en === 'string' && v.en.trim().length > 0
    && typeof v.sw === 'string' && v.sw.trim().length > 0 && Object.keys(v).length === 2;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): v is T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v);
}

/** Strictly validates untrusted manifest JSON. Unknown keys are errors, not ignored. */
export function validateManifest(raw: unknown): ManifestResult {
  const errors: string[] = [];
  if (!isRecord(raw)) return { ok: false, errors: ['manifest must be an object'] };

  for (const key of Object.keys(raw)) if (!KNOWN_KEYS.has(key)) errors.push(`unknown key "${key}"`);

  if (raw.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  const id = raw.id;
  if (typeof id !== 'string' || !ID.test(id)) errors.push('id must match ^[a-z][a-z0-9-]{1,30}$');
  if (!isLocalized(raw.displayName)) errors.push('displayName needs non-empty en and sw');
  if (!isLocalized(raw.tagline)) errors.push('tagline needs non-empty en and sw');
  if (typeof raw.version !== 'string' || !SEMVER.test(raw.version)) errors.push('version must be semver');
  if (typeof raw.owner !== 'string' || raw.owner.trim() === '') errors.push('owner is required');
  if (typeof raw.license !== 'string' || raw.license.trim() === '') errors.push('license is required');
  if (!oneOf(raw.classification, CLASSES)) errors.push('classification must be A, B, C or D');
  if (!oneOf(raw.kind, KINDS)) errors.push('kind is invalid');
  if (!oneOf(raw.readiness, READINESS)) errors.push('readiness is invalid');
  if (!oneOf(raw.category, CATEGORIES)) errors.push('category is invalid');

  const requires = raw.requires;
  if (!isRecord(requires) || !oneOf(requires.network, NETWORK) || typeof requires.account !== 'boolean'
    || Object.keys(requires).length !== 2) {
    errors.push('requires must be { network, account }');
  }

  const caps = raw.requestedCapabilities;
  if (!Array.isArray(caps)) {
    errors.push('requestedCapabilities must be an array');
  } else {
    const seen = new Set<string>();
    for (const c of caps) {
      if (typeof c !== 'string') { errors.push('capabilities must be strings'); continue; }
      if (FORBIDDEN_CAPABILITIES.has(c)) errors.push(`capability "${c}" is forbidden for every feature`);
      else if (!isKnownCapability(c)) errors.push(`capability "${c}" is not in the host catalogue`);
      if (seen.has(c)) errors.push(`capability "${c}" is listed twice`);
      seen.add(c);
    }
  }

  const domains = raw.networkDomains;
  if (!Array.isArray(domains)) {
    errors.push('networkDomains must be an array');
  } else {
    for (const d of domains) {
      if (typeof d !== 'string' || !HOST.test(d)) errors.push(`network domain "${String(d)}" must be an exact lowercase host (no wildcards, schemes or ports)`);
    }
  }

  const iso = raw.isolation;
  if (!isRecord(iso) || !oneOf(iso.process, PROCESS) || typeof iso.storageNamespace !== 'string'
    || Object.keys(iso).length !== 2) {
    errors.push('isolation must be { process, storageNamespace }');
  } else if (typeof id === 'string' && iso.storageNamespace !== `feature.${id}`) {
    errors.push(`isolation.storageNamespace must be "feature.${String(id)}"`);
  }

  if (raw.minimumHostContract !== HOST_CONTRACT) {
    errors.push(`minimumHostContract "${String(raw.minimumHostContract)}" is not supported by host ${HOST_CONTRACT}`);
  }

  // Class A (privileged) features must run in their own process once native isolation exists;
  // until then the registry refuses to call a class A feature "available" in-process (see registry).
  if (raw.kind === 'external' && raw.classification !== 'D') errors.push('external services must be class D');
  if (raw.classification === 'D' && raw.kind !== 'external') errors.push('class D is only for external services');

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, manifest: raw as unknown as FeatureManifest };
}
