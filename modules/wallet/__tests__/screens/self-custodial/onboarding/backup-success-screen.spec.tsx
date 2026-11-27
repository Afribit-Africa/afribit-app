import { it } from "@jest/globals"
import React from "react"
import { render, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { BackupSuccessScreen } from "@app/screens/self-custodial/onboarding/backup-success-screen"
import { ContextForScreen } from "../../helper"
import { flushEffects } from "../../../helpers/flush-effects"

jest.mock("@app/components/success-animation/success-icon-animation", () => {
  const { View } = jest.requireActual("react-native")
  return {
    SuccessIconAnimation: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
  }
})

jest.mock("@app/components/success-animation/success-text-animation", () => {
  const { useEffect } = jest.requireActual("react")
  const { View } = jest.requireActual("react-native")
  const CompletedTextAnimation = ({
    children,
    onComplete,
  }: {
    children: React.ReactNode
    onComplete?: () => void
  }) => {
    /** Firing from an effect keeps the callback inside React's act() scope. */
    useEffect(() => {
      onComplete?.()
    }, [onComplete])
    return <View>{children}</View>
  }
  return { CompletedTextAnimation }
})

const mockClearCheckpoint = jest.fn()
jest.mock("@app/screens/account-migration/hooks", () => ({
  ...jest.requireActual("@app/screens/account-migration/hooks"),
  useMigrationCheckpoint: () => ({
    clearCheckpoint: mockClearCheckpoint,
  }),
}))

const mockDispatch = jest.fn()
type BeforeRemoveEvent = {
  data: { action: { type: string } }
  preventDefault: () => void
}
let mockBeforeRemove: ((event: BeforeRemoveEvent) => void) | null = null
const mockAddListener = jest.fn(
  (_name: string, listener: (event: BeforeRemoveEvent) => void) => {
    mockBeforeRemove = listener
    return () => {
      mockBeforeRemove = null
    }
  },
)
const mockRouteParams = jest.fn<
  { reBackup?: boolean; message?: string } | undefined,
  []
>()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ dispatch: mockDispatch, addListener: mockAddListener }),
  useRoute: () => ({ params: mockRouteParams() }),
  CommonActions: {
    reset: (config: { index: number; routes: Array<{ name: string }> }) => ({
      type: "RESET",
      payload: config,
    }),
  },
}))

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

loadLocale("en")
const LL = i18nObject("en")

describe("BackupSuccessScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRouteParams.mockReturnValue(undefined)
    mockBeforeRemove = null
    mockMfaRequired = true
    pinIsSet(true)
  })

  it("renders success message", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <BackupSuccessScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.BackupScreen.ManualBackup.Success.title())).toBeTruthy()
    await flushEffects()
  })

  it("renders generic success copy when reBackup param is true", async () => {
    mockRouteParams.mockReturnValue({ reBackup: true })

    const { getByText, queryByText } = render(
      <ContextForScreen>
        <BackupSuccessScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.common.success())).toBeTruthy()
    expect(queryByText(LL.BackupScreen.ManualBackup.Success.title())).toBeNull()
    await flushEffects()
  })

  it("uses the caller-supplied message when provided, regardless of reBackup", async () => {
    mockRouteParams.mockReturnValue({
      reBackup: true,
      message: LL.BackupScreen.ManualBackup.Success.testSuccess(),
    })

    const { getByText, queryByText } = render(
      <ContextForScreen>
        <BackupSuccessScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.BackupScreen.ManualBackup.Success.testSuccess())).toBeTruthy()
    expect(queryByText(LL.common.success())).toBeNull()
    await flushEffects()
  })

  it("falls back to onboarding copy when neither reBackup nor message are set", async () => {
    mockRouteParams.mockReturnValue({})

    const { getByText } = render(
      <ContextForScreen>
        <BackupSuccessScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.BackupScreen.ManualBackup.Success.title())).toBeTruthy()
    await flushEffects()
  })

  it("renders without crashing", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <BackupSuccessScreen />
      </ContextForScreen>,
    )

    expect(toJSON()).toBeTruthy()
    await flushEffects()
  })

  it("holds the screen after the animation and then navigates home", async () => {
    jest.useFakeTimers({ doNotFake: ["setImmediate"] })
    render(
      <ContextForScreen>
        <BackupSuccessScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    act(() => {
      jest.advanceTimersByTime(0)
    })
    expect(mockDispatch).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(2000)
    })
    jest.useRealTimers()
    await flushEffects()

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "RESET",
        payload: { index: 0, routes: [{ name: "Primary" }] },
      }),
    )
  })

  it("leaves any pending migration checkpoint untouched", async () => {
    jest.useFakeTimers({ doNotFake: ["setImmediate"] })
    render(
      <ContextForScreen>
        <BackupSuccessScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    act(() => {
      jest.advanceTimersByTime(2000)
    })
    jest.useRealTimers()

    expect(mockClearCheckpoint).not.toHaveBeenCalled()
  })
  /** Leaving clears the reset to Primary this screen holds, and every way here lands
   *  with the flow already over: a restore's terms behind it, the account already
   *  active. So the user's back goes home at once instead. */
  describe("on the user's back", () => {
    const HOME_RESET = expect.objectContaining({
      type: "RESET",
      payload: { index: 0, routes: [{ name: "Primary" }] },
    })

    const removeWith = (type: string) => {
      const preventDefault = jest.fn()
      act(() => {
        mockBeforeRemove?.({ data: { action: { type } }, preventDefault })
      })
      return preventDefault
    }

    it.each(["GO_BACK", "POP"])("goes home at once on %s", async (type) => {
      render(
        <ContextForScreen>
          <BackupSuccessScreen />
        </ContextForScreen>,
      )
      await flushEffects()
      mockDispatch.mockClear()

      const preventDefault = removeWith(type)
      await flushEffects()

      expect(preventDefault).toHaveBeenCalledTimes(1)
      expect(mockDispatch).toHaveBeenCalledTimes(1)
      expect(mockDispatch).toHaveBeenCalledWith(HOME_RESET)
    })

    /** The reset it dispatches is a removal too, and so is a logout or a gate: those
     *  go through untouched, or going home would refuse itself. */
    it("lets a removal the app dispatched through", async () => {
      render(
        <ContextForScreen>
          <BackupSuccessScreen />
        </ContextForScreen>,
      )
      await flushEffects()
      mockDispatch.mockClear()

      const preventDefault = removeWith("RESET")
      await flushEffects()

      expect(preventDefault).not.toHaveBeenCalled()
      expect(mockDispatch).not.toHaveBeenCalled()
    })

    /** Every create and restore ends on this screen, so this is where the PIN stands. */
    it("sets the compulsory PIN instead when none is set", async () => {
      pinIsSet(false)
      render(
        <ContextForScreen>
          <BackupSuccessScreen />
        </ContextForScreen>,
      )
      await flushEffects()
      mockDispatch.mockClear()

      removeWith("GO_BACK")
      await flushEffects()

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "RESET",
          payload: { index: 0, routes: [REQUIRED_SET_PIN] },
        }),
      )
    })

    it("stops listening once the screen is gone", async () => {
      const { unmount } = render(
        <ContextForScreen>
          <BackupSuccessScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      unmount()

      expect(mockBeforeRemove).toBeNull()
    })
  })
})
