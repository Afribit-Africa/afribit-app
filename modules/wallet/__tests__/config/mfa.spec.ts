type Mfa = typeof import("@app/config/mfa")

const loadMfa = (env: Record<string, string | undefined>): Mfa => {
  let mod: Mfa | undefined
  jest.isolateModules(() => {
    jest.doMock("react-native-config", () => ({ __esModule: true, default: env, ...env }))
    mod = jest.requireActual<Mfa>("@app/config/mfa")
  })
  jest.dontMock("react-native-config")
  if (!mod) throw new Error("module did not load")
  return mod
}

describe("MFA_REQUIRED", () => {
  it("requires MFA when nothing is configured", () => {
    expect(loadMfa({}).MFA_REQUIRED).toBe(true)
  })

  it("requires MFA when the flag is set but empty", () => {
    expect(loadMfa({ AFRIBIT_MFA_REQUIRED: "" }).MFA_REQUIRED).toBe(true)
  })

  it("turns MFA off only for the exact string false", () => {
    expect(loadMfa({ AFRIBIT_MFA_REQUIRED: "false" }).MFA_REQUIRED).toBe(false)
  })

  it("stops the app at import on any other value, naming the variable", () => {
    for (const value of ["no", "FALSE", "False", "0", "true"]) {
      expect(() => loadMfa({ AFRIBIT_MFA_REQUIRED: value })).toThrow(
        /AFRIBIT_MFA_REQUIRED/,
      )
    }
  })
})

export {}
