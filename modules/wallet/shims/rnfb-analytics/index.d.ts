type Params = { [key: string]: unknown }
export type Analytics = {
  logEvent(name: string, params?: Params): Promise<void>
  logScreenView(params: Params): Promise<void>
  logLogin(params: Params): Promise<void>
  logSignUp(params: Params): Promise<void>
  setUserId(id: string | null): Promise<void>
  setUserProperty(name: string, value: string | null): Promise<void>
  setUserProperties(properties: { [key: string]: string | null }): Promise<void>
  setAnalyticsCollectionEnabled(enabled: boolean): Promise<void>
  resetAnalyticsData(): Promise<void>
}
declare const analytics: () => Analytics
export default analytics
