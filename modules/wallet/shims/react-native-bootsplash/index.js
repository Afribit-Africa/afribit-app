// The shell shows and hides the launch screen (expo-splash-screen). The wallet opens inside the
// running shell, so its "hide the boot splash" call resolves straight away.
const RNBootSplash = {
  hide: () => Promise.resolve(),
  isVisible: () => Promise.resolve(false),
}
module.exports = RNBootSplash
module.exports.default = RNBootSplash
