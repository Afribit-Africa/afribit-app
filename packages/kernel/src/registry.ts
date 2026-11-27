import type { ConnectivitySnapshot } from '@afribit/feature-sdk';
import type { Capability } from './capabilities';
import { validateManifest, type FeatureManifest, type ModuleClass } from './manifest';

/**
 * The shell's release policy is the authority: it is compiled into the signed app
 * and says which features may exist, at which class, with which capabilities.
 * A manifest cannot grant itself anything the policy does not allow.
 */
export interface ReleasePolicyEntry {
  readonly classification: ModuleClass;
  readonly allowedCapabilities: readonly Capability[];
  readonly enabled: boolean;
  /**
   * Required for isolation.process 'builtin': first-party class A code shipped inside the app
   * (S-17). Only the compiled policy can set it, so a manifest cannot move itself in-process.
   */
  readonly builtIn?: boolean;
}

export type ReleasePolicy = Readonly<Record<string, ReleasePolicyEntry>>;

export interface RegisteredFeature {
  readonly manifest: FeatureManifest;
  readonly effectiveCapabilities: ReadonlySet<Capability>;
  readonly enabled: boolean;
}

export interface RejectedFeature {
  readonly id: string | undefined;
  readonly errors: readonly string[];
}

export interface Registry {
  readonly features: readonly RegisteredFeature[];
  readonly rejected: readonly RejectedFeature[];
  get(id: string): RegisteredFeature | undefined;
}

export interface HostCapabilities {
  /** True once the native host can run a feature in its own OS process (isolation I-2). */
  readonly dedicatedProcess: boolean;
}

export function createRegistry(manifests: readonly unknown[], policy: ReleasePolicy): Registry {
  const features: RegisteredFeature[] = [];
  const rejected: RejectedFeature[] = [];
  const byId = new Map<string, RegisteredFeature>();

  for (const raw of manifests) {
    const rawId = typeof (raw as { id?: unknown })?.id === 'string' ? (raw as { id: string }).id : undefined;
    const result = validateManifest(raw);
    if (!result.ok) { rejected.push({ id: rawId, errors: result.errors }); continue; }
    const m = result.manifest;
    const errors: string[] = [];
    const entry = Object.prototype.hasOwnProperty.call(policy, m.id) ? policy[m.id] : undefined;
    if (!entry) errors.push(`"${m.id}" is not in the release policy`);
    else if (entry.classification !== m.classification) {
      errors.push(`"${m.id}" declares class ${m.classification} but the release policy says ${entry.classification}`);
    }
    if (m.classification === 'A' && m.isolation.process === 'shell') {
      errors.push(`"${m.id}" is class A and must declare a dedicated process or a built-in process`);
    }
    if (m.isolation.process === 'builtin') {
      if (m.classification !== 'A') errors.push(`"${m.id}" is built in, which is only for class A`);
      if (m.kind !== 'native') errors.push(`"${m.id}" is built in and must be kind "native"`);
      if (entry?.builtIn !== true) errors.push(`"${m.id}" declares a built-in process but the release policy does not build it in`);
    } else if (entry?.builtIn) {
      errors.push(`"${m.id}" is built in by the release policy but does not declare a built-in process`);
    }
    if (byId.has(m.id)) errors.push(`duplicate feature id "${m.id}"`);
    if (errors.length > 0 || !entry) { rejected.push({ id: m.id, errors }); continue; }

    const allowed = new Set<Capability>(entry.allowedCapabilities);
    const effective = new Set<Capability>(m.requestedCapabilities.filter((c) => allowed.has(c)));
    const feature: RegisteredFeature = { manifest: m, effectiveCapabilities: effective, enabled: entry.enabled };
    features.push(feature);
    byId.set(m.id, feature);
  }

  return { features, rejected, get: (id) => byId.get(id) };
}

export type AvailabilityReason =
  | 'disabled'
  | 'quarantined'
  | 'coming-later'
  | 'isolation-pending'
  | 'mesh-required'
  | 'internet-required'
  | 'network-required'
  | 'degraded'
  | 'account-required'
  | 'preview';

export type AvailabilityResult =
  | { readonly status: 'available' }
  | { readonly status: 'limited'; readonly reason: AvailabilityReason }
  | { readonly status: 'unavailable'; readonly reason: AvailabilityReason };

export interface AvailabilityContext {
  readonly connectivity: ConnectivitySnapshot;
  readonly quarantined: ReadonlySet<string>;
  readonly hasAccount: boolean;
  readonly host: HostCapabilities;
}

const ONLINE = new Set(['INTERNET', 'DEGRADED']);

/** Truthful readiness for one feature. The shell never shows a feature as usable when it is not. */
export function availability(feature: RegisteredFeature, ctx: AvailabilityContext): AvailabilityResult {
  const m = feature.manifest;
  if (!feature.enabled) return { status: 'unavailable', reason: 'disabled' };
  if (ctx.quarantined.has(m.id)) return { status: 'unavailable', reason: 'quarantined' };
  if (m.readiness === 'coming-later') return { status: 'unavailable', reason: 'coming-later' };
  if (m.isolation.process === 'dedicated' && !ctx.host.dedicatedProcess) {
    return { status: 'unavailable', reason: 'isolation-pending' };
  }

  const { state, meshTrust } = ctx.connectivity;
  const onMesh = meshTrust !== 'none';
  const online = ONLINE.has(state);
  switch (m.requires.network) {
    case 'mesh':
      if (!onMesh) return { status: 'unavailable', reason: 'mesh-required' };
      break;
    case 'internet':
      if (!online) return { status: 'unavailable', reason: 'internet-required' };
      break;
    case 'internet-or-mesh':
      if (!online && !onMesh) return { status: 'unavailable', reason: 'network-required' };
      break;
    case 'none':
      break;
  }

  if (m.requires.account && !ctx.hasAccount) return { status: 'limited', reason: 'account-required' };
  if (m.readiness === 'preview') return { status: 'limited', reason: 'preview' };
  if (m.requires.network === 'internet' && state === 'DEGRADED') return { status: 'limited', reason: 'degraded' };
  return { status: 'available' };
}
