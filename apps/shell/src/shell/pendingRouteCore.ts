/**
 * The route a deep link leaves while onboarding runs, and the rule for what may open before it
 * finishes. Pure: no React Native or expo-router imports, so the boot gate is testable.
 */

/** The routes that may open before onboarding is finished: onboarding itself, and nothing else. */
export function allowedBeforeOnboarding(segments: readonly string[]): boolean {
  return segments[0] === 'onboarding';
}

/** A kept route is a shell path; anything longer was not produced here. */
const MAX_ROUTE_LENGTH = 2048;

/** The params as a query string, skipping any whose value is already a segment of the path. */
function queryString(segments: readonly string[], params: Readonly<Record<string, string | string[] | undefined>>): string {
  const inPath = new Set(segments);
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (typeof value === 'string') {
      // A dynamic segment ([id]) is already in the path, so it is not repeated as a query param.
      if (inPath.has(value)) continue;
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    } else {
      for (const item of value) parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(item)}`);
    }
  }
  return parts.join('&');
}

/**
 * A route kept while onboarding runs. Only a shell path starting with `/`, at most 2048
 * characters, and never an onboarding path.
 */
export function pendingRouteFor(pathname: string, params: Readonly<Record<string, string | string[] | undefined>>): string | null {
  if (!pathname.startsWith('/') || pathname === '/') return null;
  const segments = pathname.split('/').filter((segment) => segment.length > 0);
  if (allowedBeforeOnboarding(segments)) return null;
  const query = queryString(segments, params);
  const route = query ? `${pathname}?${query}` : pathname;
  return route.length > MAX_ROUTE_LENGTH ? null : route;
}

const SHELL_SCHEME = /^afribit:\/\//i;
const SEGMENT = /^(?:[A-Za-z0-9._~-]|%[0-9A-Fa-f]{2})+$/;
const QUERY = /^(?:[A-Za-z0-9._~=&+-]|%[0-9A-Fa-f]{2})*$/;

/**
 * The shell route a system link asks for (`afribit://connect/passes`, or a bare path), or null
 * for any other scheme, Home itself, an onboarding path, or anything malformed. A link that
 * arrives while onboarding runs cannot open its screen yet (it waits for setup), so the shell
 * keeps this route instead; only plain path segments and query characters pass.
 */
export function shellRouteForLink(link: string): string | null {
  let rest: string;
  if (SHELL_SCHEME.test(link)) rest = link.replace(SHELL_SCHEME, '');
  else if (link.startsWith('/') && !link.startsWith('//')) rest = link.slice(1);
  else return null;
  const queryStart = rest.indexOf('?');
  const path = queryStart === -1 ? rest : rest.slice(0, queryStart);
  const query = queryStart === -1 ? '' : rest.slice(queryStart + 1);
  const segments = path.split('/').filter((segment) => segment.length > 0);
  if (segments.length === 0 || allowedBeforeOnboarding(segments)) return null;
  if (!segments.every((segment) => SEGMENT.test(segment) && segment !== '.' && segment !== '..')) return null;
  if (!QUERY.test(query)) return null;
  const route = `/${segments.join('/')}${query ? `?${query}` : ''}`;
  return route.length > MAX_ROUTE_LENGTH ? null : route;
}

/**
 * Keeps a link's route unless setup is known to be complete: then the link opens its screen
 * directly. `null` (setup not read yet, at a cold launch) keeps it; the shell drops it once it
 * reads a completed setup.
 */
export function keepLinkRoute(slot: PendingRoute, route: string | null, setupCompleted: boolean | null): void {
  if (route && setupCompleted !== true) slot.put(route);
}

export interface PendingRoute {
  put(route: string): void;
  take(): string | null;
}

/** One route slot: a newer put replaces the older one, and a take consumes it. */
export function createPendingRoute(): PendingRoute {
  let pending: string | null = null;
  return {
    put(route) { pending = route; },
    take() {
      const route = pending;
      pending = null;
      return route;
    },
  };
}
