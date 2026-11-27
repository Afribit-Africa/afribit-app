/**
 * One pending contact-QR scan request at a time. The shell owns the camera; Chat
 * asks through its host and awaits the scanned string, or `null` when the user
 * cancels or a new request supersedes the old one.
 */
export interface QrBridge {
  request(): Promise<string | null>;
  resolve(value: string | null): void;
  pending(): boolean;
}

export function createQrBridge(): QrBridge {
  let pendingResolve: ((value: string | null) => void) | undefined;
  return {
    request() {
      // A fresh scan supersedes any earlier one: the earlier caller sees a cancel.
      pendingResolve?.(null);
      return new Promise<string | null>(resolve => { pendingResolve = resolve; });
    },
    resolve(value) {
      const settle = pendingResolve;
      if (!settle) return;
      pendingResolve = undefined;
      settle(value);
    },
    pending: () => pendingResolve !== undefined,
  };
}
