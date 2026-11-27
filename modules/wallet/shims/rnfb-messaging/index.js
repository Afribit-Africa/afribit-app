const AuthorizationStatus = { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2, EPHEMERAL: 3 }
const off = () => () => {}
const disabled = () => Promise.reject(new Error("Push messaging is not available in this build"))
const instance = {
  isDeviceRegisteredForRemoteMessages: false,
  requestPermission: () => Promise.resolve(AuthorizationStatus.DENIED),
  hasPermission: () => Promise.resolve(AuthorizationStatus.DENIED),
  registerDeviceForRemoteMessages: () => Promise.resolve(),
  unregisterDeviceForRemoteMessages: () => Promise.resolve(),
  getToken: disabled,
  getAPNSToken: () => Promise.resolve(null),
  deleteToken: () => Promise.resolve(),
  onMessage: off,
  onTokenRefresh: off,
  onNotificationOpenedApp: off,
  getInitialNotification: () => Promise.resolve(null),
  setBackgroundMessageHandler() {},
  subscribeToTopic: () => Promise.resolve(),
  unsubscribeFromTopic: () => Promise.resolve(),
}
const messaging = () => instance
messaging.AuthorizationStatus = AuthorizationStatus
module.exports = messaging
module.exports.default = messaging
