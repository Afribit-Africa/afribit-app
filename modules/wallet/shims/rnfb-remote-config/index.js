const defaults = {}
const value = (key) => {
  const has = Object.prototype.hasOwnProperty.call(defaults, key)
  const raw = has ? defaults[key] : undefined
  return {
    getSource: () => (has ? "default" : "static"),
    asString: () => (raw === undefined || raw === null ? "" : String(raw)),
    asNumber: () => (raw === undefined || raw === null || raw === "" ? 0 : Number(raw)),
    asBoolean: () => raw === true || raw === "true" || raw === 1 || raw === "1",
  }
}
const instance = {
  setDefaults: (values) => {
    Object.assign(defaults, values || {})
    return Promise.resolve(null)
  },
  setConfigSettings: () => Promise.resolve(),
  fetch: () => Promise.resolve(),
  activate: () => Promise.resolve(false),
  fetchAndActivate: () => Promise.resolve(false),
  ensureInitialized: () => Promise.resolve(),
  getValue: value,
  getString: (key) => value(key).asString(),
  getNumber: (key) => value(key).asNumber(),
  getBoolean: (key) => value(key).asBoolean(),
  getAll: () => Object.fromEntries(Object.keys(defaults).map((key) => [key, value(key)])),
  onConfigUpdated: () => () => {},
  fetchTimeMillis: -1,
  lastFetchStatus: "no_fetch_yet",
}
const remoteConfig = () => instance
module.exports = remoteConfig
module.exports.default = remoteConfig
