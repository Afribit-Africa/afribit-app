// The SDK's native module is not in the jest binary; the config only needs the enum.
jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  Network: { Mainnet: 0, Regtest: 1 },
}))

type Domains = typeof import("@app/config/service-domains")

const loadWith = (env: Record<string, string | undefined>): Domains => {
  let mod: Domains | undefined
  jest.isolateModules(() => {
    jest.doMock("react-native-config", () => ({ __esModule: true, default: env, ...env }))
    mod = jest.requireActual<Domains>("@app/config/service-domains")
  })
  jest.dontMock("react-native-config")
  if (!mod) throw new Error("module did not load")
  return mod
}

describe("service domains", () => {
  it("defaults to Blink's LNURL hosts when nothing is configured", () => {
    const d = loadWith({})
    expect(d.LNURL_DOMAIN_MAINNET).toBe("blink.sv")
    expect(d.LNURL_DOMAIN_REGTEST).toBe("staging.blink.sv")
    expect(d.LNURL_PAY_DOMAIN_REGTEST).toBe("pay.staging.blink.sv")
    expect(d.LNURL_DOMAIN_ALIASES).toEqual(["blink.sv", "pay.blink.sv", "pay.bbw.sv"])
  })

  it("takes another server from the build config, without Blink's aliases", () => {
    const d = loadWith({ AFRIBIT_LNURL_DOMAIN: " Pay.Afribit.Africa " })
    expect(d.LNURL_DOMAIN_MAINNET).toBe("pay.afribit.africa")
    expect(d.LNURL_DOMAIN_ALIASES).toEqual(["pay.afribit.africa"])
  })

  it("puts the address domain first in a configured alias list", () => {
    const d = loadWith({
      AFRIBIT_LNURL_DOMAIN: "afribit.africa",
      AFRIBIT_LNURL_ALIASES: "pay.afribit.africa, afribit.africa",
    })
    expect(d.LNURL_DOMAIN_ALIASES).toEqual(["afribit.africa", "pay.afribit.africa"])
  })

  it("refuses a configured value that is not a host name", () => {
    for (const value of [
      "https://afribit.africa",
      "afribit",
      "evil.com/path",
      "a b.com",
      "user@host.com",
    ]) {
      expect(() => loadWith({ AFRIBIT_LNURL_DOMAIN: value })).toThrow(
        /AFRIBIT_LNURL_DOMAIN/,
      )
    }
  })

  it("feeds the configured domain to the self-custodial LNURL config and the scanner list", () => {
    let lnurlDomainFor: ((n: unknown) => string) | undefined
    let lnurlDomains: string[] | undefined
    jest.isolateModules(() => {
      const env = { AFRIBIT_LNURL_DOMAIN: "afribit.africa" }
      jest.doMock("react-native-config", () => ({
        __esModule: true,
        default: env,
        ...env,
      }))
      const config = jest.requireActual("@app/self-custodial/config")
      lnurlDomainFor = (n) => config.lnurlDomainFor(n ?? 0)
      lnurlDomains = jest.requireActual("@app/config/appinfo").LNURL_DOMAINS
    })
    jest.dontMock("react-native-config")
    expect(lnurlDomainFor?.(undefined)).toBe("afribit.africa")
    expect(lnurlDomains).toEqual(["afribit.africa"])
  })
})
