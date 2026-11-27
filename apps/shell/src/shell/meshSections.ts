import type { CapabilityIntent } from '@afribit/feature-sdk';

/**
 * The mesh section a `shell.openMesh` intent names. Derived from the SDK intent so a new
 * section cannot be added without a route below.
 */
export type MeshSection = NonNullable<Extract<CapabilityIntent, { kind: 'shell.openMesh' }>['section']>;

export interface MeshRoute {
  readonly pathname: '/connect' | '/connect/passes';
}

// Every section needs an entry: a new one in the SDK union that is missing here fails to compile.
const MESH_SECTION_ROUTES = {
  settings: { pathname: '/connect' },
  identity: { pathname: '/connect' },
  packages: { pathname: '/connect/passes' },
} as const satisfies Record<MeshSection, MeshRoute>;

/**
 * The route to open for a `shell.openMesh` intent. Only `packages` has a dedicated destination
 * (My passes); the others open the top of Connect, as does an intent that names no section.
 */
export function meshSectionRoute(section: MeshSection | undefined): MeshRoute {
  return section ? MESH_SECTION_ROUTES[section] : { pathname: '/connect' };
}
