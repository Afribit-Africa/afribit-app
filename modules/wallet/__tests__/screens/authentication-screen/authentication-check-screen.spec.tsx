import React from "react"
import { render, screen } from "@testing-library/react-native"

import { AuthenticationCheckScreen } from "@app/screens/authentication-screen/authentication-check-screen"
import { updateDeviceSessionCount } from "@app/graphql/client-only-query"
import BiometricWrapper from "@app/utils/biometricAuthentication"
import { AuthenticationScreenPurpose, PinScreenPurpose } from "@app/utils/enum"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"
import type { SecureExists } from "@app/utils/storage/secure-store"

import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

const mockReplace = jest.fn()
const mockGoBack = jest.fn()
const mockSetAppUnlocked = jest.fn()

let mockRouteParams: { isResume?: boolean } | undefined

/** Off unless a test turns it on, so the routing below is the one it always was; the
 *  compulsory PIN (W-D11) has its own cases. */
let mockMfaRequired = false
jest.mock("@app/config/mfa", () => ({
  get MFA_REQUIRED() {
    return mockMfaRequired
  },
}))

/** One object across renders, as the real navigation prop is: the gate's effect depends
 *  on it, and a new one per render would run the gate again on every rerender. */
const mockNavigation = { replace: mockReplace, goBack: mockGoBack }

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams }),
}))

jest.mock("@app/navigation/navigation-container-wrapper", () => ({
  useAuthenticationContext: () => ({ setAppUnlocked: mockSetAppUnlocked }),
}))

jest.mock("@app/graphql/client-only-query", () => ({
  updateDeviceSessionCount: jest.fn(),
}))

let mockIsAuthed = true
const mockListSelfCustodialAccounts = jest.fn()

jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => mockIsAuthed,
}))

jest.mock("@app/self-custodial/storage/account-index", () => ({
  ...jest.requireActual("@app/self-custodial/storage/account-index"),
  listSelfCustodialAccounts: () => mockListSelfCustodialAccounts(),
  /** Mirrors the real mapping over the stubbed read above: the presence call reads the
   *  index through the module itself, so overriding the exported read alone would not
   *  reach it. The mapping is covered in the account-index spec. */
  readStoredWalletPresence: async () => {
    const wallets = await mockListSelfCustodialAccounts()
    if (wallets.status === "read-failed") return "unknown"
    return wallets.entries.length > 0 ? "present" : "absent"
  },
}))

const storedWallets = (ids: ReadonlyArray<string>) => ({
  status: "ok",
  entries: ids.map((id) => ({ id, lightningAddress: null })),
})

/**
 * What the device has to show once the gate is passed. A session is known at once; with
 * none, the wallets the device stores are read.
 */
const deviceHolds = ({
  session = false,
  storedWalletIds = [],
}: {
  session?: boolean
  storedWalletIds?: ReadonlyArray<string>
}) => {
  mockIsAuthed = session
  mockListSelfCustodialAccounts.mockResolvedValue(storedWallets(storedWalletIds))
}

jest.mock("@app/utils/biometricAuthentication", () => ({
  __esModule: true,
  default: { isSensorAvailable: jest.fn() },
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    readIsPinEnabled: jest.fn(),
    readIsBiometricsEnabled: jest.fn(),
    /** Read by the account registry the screen renders under. */
    getSessionProfiles: jest.fn().mockResolvedValue([]),
  },
}))

const mockedKeyStore = jest.mocked(KeyStoreWrapper)
const mockedBiometrics = jest.mocked(BiometricWrapper)

/** The screen fails closed, so a lock is "off" only on a definite `no`. */
const enablement = (isEnabled: boolean): SecureExists =>
  isEnabled ? { status: "yes" } : { status: "no" }

const renderScreen = () =>
  render(
    <ContextForScreen>
      <AuthenticationCheckScreen />
    </ContextForScreen>,
  )

const setLock = ({
  pin,
  biometrics,
  sensor = true,
}: {
  pin: boolean
  biometrics: boolean
  sensor?: boolean
}) => {
  mockedKeyStore.readIsPinEnabled.mockResolvedValue(enablement(pin))
  mockedKeyStore.readIsBiometricsEnabled.mockResolvedValue(enablement(biometrics))
  mockedBiometrics.isSensorAvailable.mockResolvedValue(sensor)
}

describe("AuthenticationCheckScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRouteParams = undefined
    mockMfaRequired = false
    setLock({ pin: true, biometrics: false })
    deviceHolds({ session: true })
  })

  /** A storage fault must send the user to a lock they can pass, never past a
   *  lock they cannot see. */
  it("routes to the screen that has a way out when the store cannot say whether a lock is set", async () => {
    mockedKeyStore.readIsPinEnabled.mockResolvedValue({
      status: "failed",
      err: new Error("keystore locked"),
    })
    mockedKeyStore.readIsBiometricsEnabled.mockResolvedValue({
      status: "failed",
      err: new Error("keystore locked"),
    })
    mockedBiometrics.isSensorAvailable.mockResolvedValue(false)

    renderScreen()
    await flushEffects()

    // Never the bare keypad: it would compare against a secret it cannot read
    // either, and it offers no logout.
    expect(mockReplace).toHaveBeenCalledWith(
      "authentication",
      expect.objectContaining({ isPinEnabled: true }),
    )
  })

  describe("carrying the resume flag to the unlock screen", () => {
    it("marks the biometric screen as a resume", async () => {
      setLock({ pin: true, biometrics: true })
      mockRouteParams = { isResume: true }
      renderScreen()
      await flushEffects()

      expect(mockReplace).toHaveBeenCalledWith("authentication", {
        screenPurpose: AuthenticationScreenPurpose.Authenticate,
        isPinEnabled: true,
        isResume: true,
      })
    })

    it("marks the pin screen as a resume", async () => {
      mockRouteParams = { isResume: true }
      renderScreen()
      await flushEffects()

      expect(mockReplace).toHaveBeenCalledWith("pin", {
        screenPurpose: PinScreenPurpose.AuthenticatePin,
        isResume: true,
      })
    })

    it("leaves a cold start unmarked", async () => {
      renderScreen()
      await flushEffects()

      expect(mockReplace).toHaveBeenCalledWith("pin", {
        screenPurpose: PinScreenPurpose.AuthenticatePin,
        isResume: false,
      })
    })
  })

  describe("the compulsory PIN (W-D11), with no PIN set", () => {
    beforeEach(() => {
      mockMfaRequired = true
      setLock({ pin: false, biometrics: false })
    })

    /** An install from before the PIN was compulsory. The lock stays up: the required
     *  SetPin finishes the unlock itself, so nothing parked behind it gets through. */
    it("sends a device that stores a wallet to set one, keeping the lock up", async () => {
      deviceHolds({ storedWalletIds: ["stored-wallet-id"] })
      renderScreen()
      await flushEffects()

      expect(mockReplace).toHaveBeenCalledTimes(1)
      expect(mockReplace).toHaveBeenCalledWith("pin", {
        screenPurpose: PinScreenPurpose.SetPin,
        isRequired: true,
      })
      expect(mockSetAppUnlocked).not.toHaveBeenCalled()
    })

    it("still lands a device with no wallet on the landing screen", async () => {
      deviceHolds({})
      renderScreen()
      await flushEffects()

      expect(mockReplace).toHaveBeenCalledWith("getStarted")
    })

    it("opens the home screen with the requirement off", async () => {
      mockMfaRequired = false
      deviceHolds({ storedWalletIds: ["stored-wallet-id"] })
      renderScreen()
      await flushEffects()

      expect(mockReplace).toHaveBeenCalledWith("Primary")
    })
  })

  describe("with no lock configured", () => {
    it("opens the home screen and counts the session on a cold start", async () => {
      setLock({ pin: false, biometrics: false })
      renderScreen()
      await flushEffects()

      expect(mockSetAppUnlocked).toHaveBeenCalledTimes(1)
      expect(updateDeviceSessionCount).toHaveBeenCalledTimes(1)
      expect(mockReplace).toHaveBeenCalledWith("Primary")
    })

    it("steps back on a resume whose lock was turned off, opening no session", async () => {
      setLock({ pin: false, biometrics: false })
      mockRouteParams = { isResume: true }
      renderScreen()
      await flushEffects()

      expect(mockSetAppUnlocked).toHaveBeenCalledTimes(1)
      expect(mockGoBack).toHaveBeenCalledTimes(1)
      expect(updateDeviceSessionCount).not.toHaveBeenCalled()
      expect(mockReplace).not.toHaveBeenCalled()
    })

    it("lands on the landing screen, counting no session, on a device with no account", async () => {
      /** Every launch starts here now, so this is where a device that holds nothing is
       *  sent on to the screen it used to start on. */
      setLock({ pin: false, biometrics: false })
      deviceHolds({})
      renderScreen()
      await flushEffects()

      expect(mockSetAppUnlocked).toHaveBeenCalledTimes(1)
      expect(mockReplace).toHaveBeenCalledWith("getStarted")
      expect(updateDeviceSessionCount).not.toHaveBeenCalled()
    })

    it("opens the home screen, counting the session, for a wallet stored with no session", async () => {
      /** What a logout leaves behind on a device that stores a wallet. Sending it to the
       *  landing screen would show its owner an app that looks empty. */
      setLock({ pin: false, biometrics: false })
      deviceHolds({ storedWalletIds: ["stored-wallet-id"] })
      renderScreen()
      await flushEffects()

      expect(mockReplace).toHaveBeenCalledTimes(1)
      expect(mockReplace).toHaveBeenCalledWith("Primary")
      expect(updateDeviceSessionCount).toHaveBeenCalledTimes(1)
    })

    it("lands once when a session turns up while the stored wallets are being read", async () => {
      /** The session is one of the gate's own dependencies, so its arrival runs the gate
       *  again while the first run's landing is still owed. Two landings would replace
       *  the screen a second time, from a gate that has already left. */
      setLock({ pin: false, biometrics: false })
      mockIsAuthed = false
      let settleRead: (read: ReturnType<typeof storedWallets>) => void = () => {}
      mockListSelfCustodialAccounts.mockReturnValue(
        new Promise((resolve) => {
          settleRead = resolve
        }),
      )
      const { rerender } = renderScreen()
      await flushEffects()

      expect(mockReplace).not.toHaveBeenCalled()

      mockIsAuthed = true
      rerender(
        <ContextForScreen>
          <AuthenticationCheckScreen />
        </ContextForScreen>,
      )
      await flushEffects()
      settleRead(storedWallets([]))
      await flushEffects()

      expect(mockReplace).toHaveBeenCalledTimes(1)
      expect(mockReplace).toHaveBeenCalledWith("Primary")
      expect(updateDeviceSessionCount).toHaveBeenCalledTimes(1)
    })
  })

  describe("the logo it waits behind", () => {
    it("is the Afribit symbol", async () => {
      renderScreen()
      await flushEffects()

      expect(screen.getByLabelText("Afribit")).toBeTruthy()
    })
  })

  describe("a device with a lock and no account", () => {
    /** The launch that used to skip the gate: with no account the app opened on the
     *  landing screen, in front of a lock that was still set, and a new account opened
     *  from there lists every wallet the device stores. */
    it("is sent to its lock, never to the landing screen", async () => {
      deviceHolds({})
      renderScreen()
      await flushEffects()

      expect(mockReplace).toHaveBeenCalledTimes(1)
      expect(mockReplace).toHaveBeenCalledWith("pin", {
        screenPurpose: PinScreenPurpose.AuthenticatePin,
        isResume: false,
      })
      expect(mockSetAppUnlocked).not.toHaveBeenCalled()
    })

    it("is sent to its lock without waiting on what the device stores", async () => {
      /** Where the launch lands is the unlock screen's question, asked once the lock is
       *  answered. A lock that waited on it would stay down for as long as the read ran. */
      mockIsAuthed = false
      mockListSelfCustodialAccounts.mockReturnValue(new Promise(() => {}))
      renderScreen()
      await flushEffects()

      expect(mockReplace).toHaveBeenCalledWith("pin", {
        screenPurpose: PinScreenPurpose.AuthenticatePin,
        isResume: false,
      })
    })
  })

  it("keeps the pin screen when the sensor is unavailable, even with biometrics on", async () => {
    setLock({ pin: true, biometrics: true, sensor: false })
    renderScreen()
    await flushEffects()

    expect(mockReplace).toHaveBeenCalledWith("pin", {
      screenPurpose: PinScreenPurpose.AuthenticatePin,
      isResume: false,
    })
  })
})
