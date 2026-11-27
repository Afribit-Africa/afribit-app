import { pendingRoute, setupStatus } from '../shell/pendingRoute';
import { keepLinkRoute, shellRouteForLink } from '../shell/pendingRouteCore';
import { walletHandoff } from '../wallet/handoff';
import { usesPaymentScheme, walletHandoffForLink } from '../wallet/systemLinkCore';

/**
 * expo-router calls this for every system path: the launch URL and each deep link. A payment link
 * becomes a Wallet hand-off and opens the Wallet; a refused payment link goes Home so the user
 * never sees the not-found screen; every other path is left for the shell's own routes. While
 * onboarding runs, the route a link asks for is kept, since its screen waits for setup, and Home
 * opens it once setup finishes. It never throws and never logs the link.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const handoff = walletHandoffForLink(path);
    if (handoff) {
      walletHandoff.put(handoff, Date.now());
      keepLinkRoute(pendingRoute, '/app/wallet', setupStatus.get());
      return '/app/wallet';
    }
    if (usesPaymentScheme(path)) return '/';
    keepLinkRoute(pendingRoute, shellRouteForLink(path), setupStatus.get());
    return path;
  } catch {
    return '/';
  }
}
