// The wallet reads build settings as `Config.NAME`. In the one app they come from the shell's
// app config (`extra.wallet`, filled from the build environment), so no native module is needed.
let values = {}
try {
  const Constants = require("expo-constants").default
  const extra = Constants && Constants.expoConfig && Constants.expoConfig.extra
  if (extra && extra.wallet && typeof extra.wallet === "object") values = extra.wallet
} catch (e) {
  values = {}
}

const Config = Object.freeze({ ...values })
module.exports = Config
module.exports.default = Config
module.exports.Config = Config
