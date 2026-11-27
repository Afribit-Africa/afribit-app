const done = () => Promise.resolve()
const instance = {
  isCrashlyticsCollectionEnabled: false,
  log() {},
  recordError() {},
  crash() {},
  setUserId: done,
  setAttribute: done,
  setAttributes: done,
  setCrashlyticsCollectionEnabled: done,
  checkForUnsentReports: () => Promise.resolve(false),
  deleteUnsentReports: done,
  sendUnsentReports() {},
  didCrashOnPreviousExecution: () => Promise.resolve(false),
}
const crashlytics = () => instance
module.exports = crashlytics
module.exports.default = crashlytics
