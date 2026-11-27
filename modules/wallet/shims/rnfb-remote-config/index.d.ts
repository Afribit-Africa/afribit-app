export declare namespace FirebaseRemoteConfigTypes {
  type ValueSource = "remote" | "default" | "static"
  interface ConfigValue {
    getSource(): ValueSource
    asString(): string
    asNumber(): number
    asBoolean(): boolean
  }
  interface ConfigDefaults {
    [key: string]: number | string | boolean
  }
  interface ConfigSettings {
    minimumFetchIntervalMillis?: number
    fetchTimeMillis?: number
  }
}
export type RemoteConfig = {
  setDefaults(defaults: FirebaseRemoteConfigTypes.ConfigDefaults): Promise<null>
  setConfigSettings(settings: FirebaseRemoteConfigTypes.ConfigSettings): Promise<void>
  fetch(expirationDurationSeconds?: number): Promise<void>
  activate(): Promise<boolean>
  fetchAndActivate(): Promise<boolean>
  ensureInitialized(): Promise<void>
  getValue(key: string): FirebaseRemoteConfigTypes.ConfigValue
  getString(key: string): string
  getNumber(key: string): number
  getBoolean(key: string): boolean
  getAll(): { [key: string]: FirebaseRemoteConfigTypes.ConfigValue }
  onConfigUpdated(listener: (...args: unknown[]) => unknown): () => void
  readonly fetchTimeMillis: number
  readonly lastFetchStatus: string
}
declare const remoteConfig: () => RemoteConfig
export default remoteConfig
