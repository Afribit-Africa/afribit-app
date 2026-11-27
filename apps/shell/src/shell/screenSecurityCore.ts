/** The Expo ScreenCapture surface the shell needs, injected so Node tests can fake it. */
export interface ScreenCaptureApi {
  prevent(key: string): Promise<void>;
  allow(key: string): Promise<void>;
}

/**
 * Builds the shell's screen-protection gate (CR-8b). Each owner (a feature id)
 * is tracked separately, so one feature's disable never lifts another's. An
 * owner counts as protected only after `prevent` resolves, and stays protected
 * if `allow` rejects: the gate fails closed. Calls for one owner are chained so
 * an enable fired just before a disable still ends disabled.
 */
export function createScreenSecurity(api: ScreenCaptureApi): (owner: string, enabled: boolean) => Promise<void> {
  const protectedOwners = new Set<string>();
  const chains = new Map<string, Promise<void>>();

  return (owner, enabled) => {
    const run = (chains.get(owner) ?? Promise.resolve()).then(async () => {
      if (enabled === protectedOwners.has(owner)) return;
      if (enabled) {
        await api.prevent(owner);
        protectedOwners.add(owner);
      } else {
        await api.allow(owner);
        protectedOwners.delete(owner);
      }
    });
    // Keep the chain alive: a rejected call must not block the owner's next one.
    chains.set(owner, run.catch(() => undefined));
    return run;
  };
}
