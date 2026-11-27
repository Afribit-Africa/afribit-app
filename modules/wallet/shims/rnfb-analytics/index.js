const done = () => Promise.resolve()
const instance = new Proxy({}, { get: (_t, prop) => (prop === "then" ? undefined : done) })
const analytics = () => instance
module.exports = analytics
module.exports.default = analytics
