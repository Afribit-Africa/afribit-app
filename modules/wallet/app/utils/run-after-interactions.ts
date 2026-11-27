/**
 * React Native 0.88 removed InteractionManager. This keeps its intent for the few
 * call sites that used `runAfterInteractions`: run the task once the JS thread is
 * idle, bounded so it never waits indefinitely (the same approach as the legacy
 * store sweep in app/store/persistent-state). Falls back to a microtask where
 * the idle callbacks are unavailable.
 */
export const RUN_AFTER_INTERACTIONS_TIMEOUT_MS = 500

export type CancellableTask = { cancel: () => void }

export const runAfterInteractions = (task: () => void): CancellableTask => {
  if (
    typeof requestIdleCallback === "function" &&
    typeof cancelIdleCallback === "function"
  ) {
    const handle = requestIdleCallback(() => task(), {
      timeout: RUN_AFTER_INTERACTIONS_TIMEOUT_MS,
    })
    return { cancel: () => cancelIdleCallback(handle) }
  }
  let cancelled = false
  Promise.resolve().then(() => {
    if (!cancelled) task()
  })
  return {
    cancel: () => {
      cancelled = true
    },
  }
}
