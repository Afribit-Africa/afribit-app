export type Crashlytics = {
  readonly isCrashlyticsCollectionEnabled: boolean
  log(message: string): void
  recordError(error: Error, jsErrorName?: string): void
  crash(): void
  setUserId(id: string): Promise<null>
  setAttribute(name: string, value: string): Promise<null>
  setAttributes(values: { [key: string]: string }): Promise<null>
  setCrashlyticsCollectionEnabled(enabled: boolean): Promise<null>
  checkForUnsentReports(): Promise<boolean>
  deleteUnsentReports(): Promise<void>
  sendUnsentReports(): void
  didCrashOnPreviousExecution(): Promise<boolean>
}
declare const crashlytics: () => Crashlytics
export default crashlytics
