import type { ConnectivitySnapshot } from '@afribit/feature-sdk';
import type { AvailabilityResult, NetworkRequirement, RegisteredFeature } from '@afribit/kernel';

/** What a feature needs from the network, in the app's own words (PRD M01). */
export type NetworkNeed = 'offline' | 'internet' | 'mesh' | 'internet-or-mesh';

export interface NetworkService {
  readonly id: string;
  readonly need: NetworkNeed;
  readonly usable: boolean;
}

export interface NetworkServicesResult {
  /** Enabled features, usable ones first, registry order within each group (PRD M01). */
  readonly services: readonly NetworkService[];
  /** True when public Lightning payments may not settle (PRD J-05). */
  readonly paymentNotice: boolean;
}

function needOf(network: NetworkRequirement): NetworkNeed {
  return network === 'none' ? 'offline' : network;
}

/**
 * What works on the current network: each enabled app with what it needs and whether it
 * can run now. Also flags the state where a public Lightning payment may not settle —
 * a mesh-only network, or a mesh whose router has no uplink (PRD M01, J-05).
 */
export function networkServices(
  features: readonly RegisteredFeature[],
  availabilityOf: (id: string) => AvailabilityResult,
  connectivity: ConnectivitySnapshot,
): NetworkServicesResult {
  const services: NetworkService[] = [];
  for (const feature of features) {
    if (!feature.enabled) continue;
    const { id, requires } = feature.manifest;
    services.push({ id, need: needOf(requires.network), usable: availabilityOf(id).status !== 'unavailable' });
  }
  const ordered = [...services.filter((s) => s.usable), ...services.filter((s) => !s.usable)];
  const onMesh = connectivity.meshTrust !== 'none';
  const paymentNotice = connectivity.state === 'LOCAL_ONLY' || (onMesh && connectivity.uplink === 'none');
  return { services: ordered, paymentNotice };
}
