import { requireOptionalNativeModule } from 'expo';

export interface WifiGetResult {
  /** HTTP status, or 0 when not on Wi-Fi or the request failed. */
  readonly status: number;
  readonly body: string;
  readonly onWifi: boolean;
  readonly tooLarge: boolean;
  /** iOS: no binding available; use fetch instead. */
  readonly unsupported?: boolean;
}

interface AfribitNetworkNative {
  wifiIpv4(): string | null;
  wifiGet(url: string, timeoutMs: number, maxBytes: number): Promise<WifiGetResult>;
}

/** Null when the native module is not in this binary (tests, older APKs). */
export const AfribitNetwork = requireOptionalNativeModule<AfribitNetworkNative>('AfribitNetwork');
