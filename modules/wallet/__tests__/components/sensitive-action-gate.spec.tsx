import React from "react"
import { Text } from "react-native"

import { act, render, waitFor } from "@testing-library/react-native"

import { SensitiveActionGate } from "@app/components/sensitive-action-gate"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import { ContextForScreen } from "../screens/helper"

const mockPush = jest.fn()
const mockDispatch = jest.fn()
/** One object for every render, like the real hook: the gate's effect is keyed on it. */
const mockNavigation = {
  push: mockPush,
  dispatch: mockDispatch,
  getState: () => ({ key: "stack-key" }),
}
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => mockNavigation,
  useRoute: () => ({ key: "gated-route-key" }),
}))

const mockIsSensorAvailable = jest.fn()
const mockAuthenticate = jest.fn()
jest.mock("@app/utils/biometricAuthentication", () => ({
  __esModule: true,
  default: {
    isSensorAvailable: (...args: unknown[]) => mockIsSensorAvailable(...args),
    authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  },
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: unknown[]) => mockToastShow(...args),
}))

let mockMfaRequired = true
jest.mock("@app/config/mfa", () => ({
  get MFA_REQUIRED() {
    return mockMfaRequired
  },
}))

/** Stands in for a screen whose hooks read a secret or start a payment: it must not
 *  mount, not even once, before the gate has passed. */
const mockSecretMounted = jest.fn()
const Secret: React.FC = () => {
  mockSecretMounted()
  return <Text>secret</Text>
}

const renderGate = () =>
  render(
    <ContextForScreen>
      <SensitiveActionGate description="Authenticate to test">
        <Secret />
      </SensitiveActionGate>
    </ContextForScreen>,
  )

const challengeParams = () =>
  mockPush.mock.calls.find(([routeName]) => routeName === "pin")?.[1]

const expectBounced = () => {
  expect(mockDispatch).toHaveBeenCalledTimes(1)
  expect(mockDispatch.mock.calls[0][0].source).toBe("gated-route-key")
}

describe("SensitiveActionGate (W-D11)", () => {
  let readPin: jest.SpyInstance
  let readBiometrics: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    mockMfaRequired = true
    readPin = jest
      .spyOn(KeyStoreWrapper, "readIsPinEnabled")
      .mockResolvedValue({ status: "yes" })
    readBiometrics = jest
      .spyOn(KeyStoreWrapper, "readIsBiometricsEnabled")
      .mockResolvedValue({ status: "no" })
    mockIsSensorAvailable.mockResolvedValue(true)
  })

  it("renders the screen as before when MFA is off: no prompt, no keystore read", () => {
    mockMfaRequired = false

    const { getByText } = renderGate()

    expect(getByText("secret")).toBeTruthy()
    expect(readPin).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("challenges the PIN and mounts nothing until it passes", async () => {
    const { getByText, queryByText, getByTestId } = renderGate()

    await waitFor(() => expect(challengeParams()).toBeDefined())
    expect(challengeParams().screenPurpose).toBe("ChallengePin")
    expect(getByTestId("sensitive-action-gate-pending")).toBeTruthy()
    expect(queryByText("secret")).toBeNull()
    expect(mockSecretMounted).not.toHaveBeenCalled()

    await act(async () => challengeParams().onChallengeSuccess())

    await waitFor(() => expect(getByText("secret")).toBeTruthy())
  })

  it("removes the screen when the PIN challenge is declined, so the action never runs", async () => {
    const { queryByText } = renderGate()

    await waitFor(() => expect(challengeParams()).toBeDefined())
    await act(async () => challengeParams().onChallengeFailure())

    expectBounced()
    expect(mockToastShow).not.toHaveBeenCalled()
    expect(queryByText("secret")).toBeNull()
    expect(mockSecretMounted).not.toHaveBeenCalled()
  })

  it("fails closed when no factor is set", async () => {
    readPin.mockResolvedValue({ status: "no" })

    renderGate()

    await waitFor(() => expectBounced())
    expect(mockToastShow).toHaveBeenCalledTimes(1)
    expect(mockSecretMounted).not.toHaveBeenCalled()
  })

  it("opens on biometrics without asking for the PIN", async () => {
    readBiometrics.mockResolvedValue({ status: "yes" })
    mockAuthenticate.mockImplementation((_d: string, onSuccess: () => void) =>
      onSuccess(),
    )

    const { findByText } = renderGate()

    expect(await findByText("secret")).toBeTruthy()
    expect(mockAuthenticate.mock.calls[0][0]).toBe("Authenticate to test")
    expect(mockPush).not.toHaveBeenCalled()
  })
})
