const instance = {
  newReactNativeFirebaseAppCheckProvider: () => ({ configure() {} }),
  initializeAppCheck: () => Promise.resolve(),
  activate: () => Promise.resolve(),
  setTokenAutoRefreshEnabled() {},
  getToken: () => Promise.reject(new Error("App Check is not available in this build")),
  getLimitedUseToken: () => Promise.reject(new Error("App Check is not available in this build")),
}
const appCheck = () => instance
module.exports = appCheck
module.exports.default = appCheck
