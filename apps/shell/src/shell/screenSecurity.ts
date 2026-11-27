import type * as ScreenCapture from 'expo-screen-capture';
import { createScreenSecurity } from './screenSecurityCore';

let screenCapture: typeof ScreenCapture | undefined;

// Loaded on first use: importing `expo-screen-capture` pulls in the Expo runtime,
// which the host module graph must stay free of (C1).
async function loadScreenCapture(): Promise<typeof ScreenCapture> {
  screenCapture ??= await import('expo-screen-capture');
  return screenCapture;
}

/** The shell's screen-protection gate, keyed by feature id, over Expo ScreenCapture (CR-8b). */
export const screenSecurity = createScreenSecurity({
  prevent: async (key) => (await loadScreenCapture()).preventScreenCaptureAsync(key),
  allow: async (key) => (await loadScreenCapture()).allowScreenCaptureAsync(key),
});
