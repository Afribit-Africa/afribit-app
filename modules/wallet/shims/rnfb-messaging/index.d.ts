export declare namespace FirebaseMessagingTypes {
  type AuthorizationStatus = -1 | 0 | 1 | 2 | 3
  interface Notification {
    title?: string
    body?: string
    [key: string]: unknown
  }
  interface RemoteMessage {
    messageId?: string
    from?: string
    collapseKey?: string
    sentTime?: number
    data?: { [key: string]: string | object }
    notification?: Notification
    [key: string]: unknown
  }
}
type Unsubscribe = () => void
export type Messaging = {
  readonly isDeviceRegisteredForRemoteMessages: boolean
  requestPermission(options?: object): Promise<FirebaseMessagingTypes.AuthorizationStatus>
  hasPermission(): Promise<FirebaseMessagingTypes.AuthorizationStatus>
  registerDeviceForRemoteMessages(): Promise<void>
  unregisterDeviceForRemoteMessages(): Promise<void>
  getToken(options?: object): Promise<string>
  getAPNSToken(): Promise<string | null>
  deleteToken(options?: object): Promise<void>
  onMessage(listener: (message: FirebaseMessagingTypes.RemoteMessage) => unknown): Unsubscribe
  onTokenRefresh(listener: (token: string) => unknown): Unsubscribe
  onNotificationOpenedApp(listener: (message: FirebaseMessagingTypes.RemoteMessage) => unknown): Unsubscribe
  getInitialNotification(): Promise<FirebaseMessagingTypes.RemoteMessage | null>
  setBackgroundMessageHandler(handler: (message: FirebaseMessagingTypes.RemoteMessage) => Promise<unknown>): void
  subscribeToTopic(topic: string): Promise<void>
  unsubscribeFromTopic(topic: string): Promise<void>
}
declare const messaging: {
  (): Messaging
  AuthorizationStatus: {
    NOT_DETERMINED: -1
    DENIED: 0
    AUTHORIZED: 1
    PROVISIONAL: 2
    EPHEMERAL: 3
  }
}
export default messaging
