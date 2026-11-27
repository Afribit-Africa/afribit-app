import { renderHook, act } from "@testing-library/react-native"

import {
  CreationStatus,
  useCreateWallet,
} from "@app/screens/self-custodial/onboarding/hooks/use-create-wallet"
import { AccountMode } from "@app/types/account"

const mockProvision = jest.fn()
const mockUpdateState = jest.fn()
const mockDispatch = jest.fn()
const mockReportError = jest.fn()
const mockReinitSdk = jest.fn()
const mockToastShow = jest.fn()

const TEST_ACCOUNT_ID = "sc-account-1"

/** The compulsory PIN (W-D11): each test pins the switch and what the keystore holds. */
let mockMfaRequired = true
jest.mock("@app/config/mfa", () => ({
  get MFA_REQUIRED() {
    return mockMfaRequired
  },
}))
const mockPinRead = jest.fn()
jest.mock("@app/utils/storage/secureStorage", () => {
  const actual = jest.requireActual("@app/utils/storage/secureStorage")
  actual.default.readIsPinEnabled = () => mockPinRead()
  return actual
})
const pinIsSet = (isSet: boolean) =>
  mockPinRead.mockResolvedValue({ status: isSet ? "yes" : "no" })

const REQUIRED_SET_PIN = {
  name: "pin",
  params: { screenPurpose: "SetPin", isRequired: true },
}

jest.mock("@app/self-custodial/hooks/use-provision-self-custodial-account", () => ({
  useProvisionSelfCustodialAccount: () => ({ provision: mockProvision }),
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: { galoyAuthToken: "" },
    updateState: mockUpdateState,
  }),
}))

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    dispatch: mockDispatch,
  }),
}))

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({ retry: mockReinitSdk }),
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: readonly unknown[]) => mockReportError(...args),
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: unknown[]) => mockToastShow(...args),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      AccountTypeSelectionScreen: {
        createFailed: () => "Failed to create wallet. Please try again.",
      },
    },
  }),
}))

describe("useCreateWallet", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockProvision.mockResolvedValue(TEST_ACCOUNT_ID)
    mockMfaRequired = true
    pinIsSet(true)
  })

  it("starts with idle status", () => {
    const { result } = renderHook(() => useCreateWallet())

    expect(result.current.status).toBe(CreationStatus.Idle)
  })

  it("sets creating status during creation", async () => {
    let resolveProvision: () => void
    mockProvision.mockReturnValue(
      new Promise((resolve) => {
        resolveProvision = () => resolve(TEST_ACCOUNT_ID)
      }),
    )

    const { result } = renderHook(() => useCreateWallet())

    act(() => {
      result.current.create()
    })

    expect(result.current.status).toBe(CreationStatus.Creating)

    await act(async () => {
      resolveProvision!()
    })
  })

  it("activates the provisioned account id on success", async () => {
    const { result } = renderHook(() => useCreateWallet())

    await act(async () => {
      await result.current.create()
    })

    expect(mockProvision).toHaveBeenCalledTimes(1)
    expect(mockUpdateState).toHaveBeenCalledTimes(1)

    const updater = mockUpdateState.mock.calls[0][0]
    expect(updater(null)).toBeNull()
    expect(updater({ galoyAuthToken: "t" })).toEqual({
      galoyAuthToken: "t",
      activeAccountId: TEST_ACCOUNT_ID,
    })
  })

  it("stores the chosen mode against the provisioned account on success", async () => {
    const { result } = renderHook(() => useCreateWallet())

    await act(async () => {
      await result.current.create(AccountMode.Anon)
    })

    const updater = mockUpdateState.mock.calls[0][0]
    expect(updater({ galoyAuthToken: "t" })).toEqual({
      galoyAuthToken: "t",
      activeAccountId: TEST_ACCOUNT_ID,
      selfCustodialAccountModeByAccountId: { [TEST_ACCOUNT_ID]: AccountMode.Anon },
    })
  })

  it("reinits SDK on success", async () => {
    const { result } = renderHook(() => useCreateWallet())

    await act(async () => {
      await result.current.create()
    })

    expect(mockReinitSdk).toHaveBeenCalledTimes(1)
  })

  it("navigates to Primary on success", async () => {
    const { result } = renderHook(() => useCreateWallet())

    await act(async () => {
      await result.current.create()
    })

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "RESET",
        payload: expect.objectContaining({
          routes: [{ name: "Primary" }],
        }),
      }),
    )
  })

  describe("the compulsory PIN (W-D11)", () => {
    const createAndReadReset = async () => {
      const { result } = renderHook(() => useCreateWallet())
      await act(async () => {
        await result.current.create()
      })
      return mockDispatch.mock.calls[0][0].payload.routes
    }

    it("sets the PIN before the home screen when none is set", async () => {
      pinIsSet(false)
      expect(await createAndReadReset()).toEqual([REQUIRED_SET_PIN])
    })

    it("goes straight home when a PIN is already set", async () => {
      pinIsSet(true)
      expect(await createAndReadReset()).toEqual([{ name: "Primary" }])
    })

    it("changes nothing when the requirement is off", async () => {
      mockMfaRequired = false
      pinIsSet(false)
      expect(await createAndReadReset()).toEqual([{ name: "Primary" }])
    })

    /** A failed read says nothing about the PIN; setting one there could replace it. */
    it("does not ask for a new PIN when the keystore cannot say", async () => {
      mockPinRead.mockResolvedValue({ status: "failed", err: new Error("locked") })
      expect(await createAndReadReset()).toEqual([{ name: "Primary" }])
    })
  })

  it("sets error status, reports and toasts when provisioning fails", async () => {
    mockProvision.mockRejectedValue(new Error("creation failed"))

    const { result } = renderHook(() => useCreateWallet())

    await act(async () => {
      await result.current.create()
    })

    expect(result.current.status).toBe(CreationStatus.Error)
    expect(mockReportError).toHaveBeenCalledWith("Wallet creation", expect.any(Error))
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Failed to create wallet. Please try again.",
      }),
    )
  })

  it("does not update state on failure", async () => {
    mockProvision.mockRejectedValue(new Error("fail"))

    const { result } = renderHook(() => useCreateWallet())

    await act(async () => {
      await result.current.create()
    })

    expect(mockUpdateState).not.toHaveBeenCalled()
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(mockReinitSdk).not.toHaveBeenCalled()
  })

  it("ignores reentrant create while one is already in flight", async () => {
    let resolveFirst: (accountId: string) => void
    mockProvision.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveFirst = resolve
        }),
    )

    const { result } = renderHook(() => useCreateWallet())

    act(() => {
      result.current.create()
    })

    expect(result.current.status).toBe(CreationStatus.Creating)

    await act(async () => {
      await result.current.create()
    })

    expect(mockProvision).toHaveBeenCalledTimes(1)
    expect(mockUpdateState).not.toHaveBeenCalled()
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(mockReinitSdk).not.toHaveBeenCalled()

    await act(async () => {
      resolveFirst!(TEST_ACCOUNT_ID)
    })
  })
})
