type ProviderOptions = { provider?: string; debugToken?: string }
export type AppCheckProvider = {
  configure(options: { android?: ProviderOptions; apple?: ProviderOptions; web?: ProviderOptions }): void
}
export type AppCheck = {
  newReactNativeFirebaseAppCheckProvider(): AppCheckProvider
  initializeAppCheck(options: { provider: AppCheckProvider; isTokenAutoRefreshEnabled?: boolean }): Promise<void>
  activate(...args: unknown[]): Promise<void>
  setTokenAutoRefreshEnabled(enabled: boolean): void
  getToken(forceRefresh?: boolean): Promise<{ token: string }>
  getLimitedUseToken(): Promise<{ token: string }>
}
declare const appCheck: () => AppCheck
export default appCheck
