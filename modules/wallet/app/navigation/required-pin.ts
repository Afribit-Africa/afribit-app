import { MFA_REQUIRED } from "@app/config/mfa"
import { PinScreenPurpose } from "@app/utils/enum"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

/**
 * The compulsory PIN (W-D11): a self-custodial wallet is not opened until the device
 * holds a PIN. Every way into the home screen for a wallet that was just created, just
 * restored or found on the device at start goes through here, so none can skip it.
 *
 * Only a read that answers "no" sends the user to set one. A read that failed says
 * nothing about the PIN, and setting a new one there could replace a PIN that exists;
 * the gate already treats that read as a lock and routes to it.
 */
export const readIsRequiredPinMissing = async (): Promise<boolean> => {
  if (!MFA_REQUIRED) return false
  const read = await KeyStoreWrapper.readIsPinEnabled()
  return read.status === "no"
}

/** The SetPin screen in its required form: no way back, and home once the PIN is set. */
export const REQUIRED_SET_PIN_ROUTE = {
  name: "pin",
  params: { screenPurpose: PinScreenPurpose.SetPin, isRequired: true },
} as const

const HOME_ROUTE = { name: "Primary" } as const

/** Where a flow that has finished with a wallet goes: home, or the PIN in front of it. */
export const readWalletHomeRoute = async (): Promise<
  typeof REQUIRED_SET_PIN_ROUTE | typeof HOME_ROUTE
> => ((await readIsRequiredPinMissing()) ? REQUIRED_SET_PIN_ROUTE : HOME_ROUTE)
