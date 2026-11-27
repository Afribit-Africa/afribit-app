import { createPendingRoute } from './pendingRouteCore';

/** The route a link left while onboarding ran; Home opens it once setup finishes. */
export const pendingRoute = createPendingRoute();

let setupCompleted: boolean | null = null;

/**
 * Whether setup is complete, for code that runs outside React (`+native-intent`). `null` until
 * the shell has read the stored setup.
 */
export const setupStatus = {
  get: (): boolean | null => setupCompleted,
  set(completed: boolean): void {
    setupCompleted = completed;
  },
};
