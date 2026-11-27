import { color } from '@afribit/design';
import { useFonts } from 'expo-font';
import { Stack, useGlobalSearchParams, usePathname, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppLock } from '../shell/AppLock';
import { pendingRoute } from '../shell/pendingRoute';
import { allowedBeforeOnboarding, pendingRouteFor } from '../shell/pendingRouteCore';
import { ShellProvider, useShell } from '../shell/ShellProvider';
import { NotificationRouting } from '../shell/useNotificationRouting';

void SplashScreen.preventAutoHideAsync();

function Root() {
  const { ready, setup } = useShell();
  const segments = useSegments();
  const pathname = usePathname();
  const searchParams = useGlobalSearchParams();
  const [fontsLoaded, fontError] = useFonts({
    'Manrope-Regular': require('../../assets/fonts/Manrope-Regular.ttf'),
    'Manrope-Medium': require('../../assets/fonts/Manrope-Medium.ttf'),
    'Manrope-SemiBold': require('../../assets/fonts/Manrope-SemiBold.ttf'),
    'NotoSans-Regular': require('../../assets/fonts/NotoSans-Regular.ttf'),
  });
  // Boot never waits on the network, the wallet or remote config (PRD A01). Fonts are bundled.
  const booted = ready && (fontsLoaded || fontError !== null);

  useEffect(() => {
    if (booted) void SplashScreen.hideAsync();
  }, [booted]);

  if (!booted) return null;

  // Every screen but onboarding waits for setup (PRD A01). The root keeps its navigator mounted
  // (expo-router needs it on the first render) and protects the other screens until setup is
  // done; a link to one lands on onboarding. The route it asked for is kept and Home opens it once
  // setup finishes. Onboarding is only reachable before setup is done, so it never sits under Home.
  if (!setup.completed && !allowedBeforeOnboarding(segments)) {
    const route = pendingRouteFor(pathname, searchParams);
    if (route) pendingRoute.put(route);
  }

  return (
    <AppLock>
      <NotificationRouting />
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.paper } }}>
        <Stack.Protected guard={!setup.completed}>
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={setup.completed}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="app/[id]" options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }} />
          <Stack.Screen name="service/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="connect/join" options={{ presentation: 'modal' }} />
          <Stack.Screen name="connect/passes" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="alerts" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="qr" options={{ presentation: 'fullScreenModal' }} />
        </Stack.Protected>
      </Stack>
    </AppLock>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ShellProvider>
        <Root />
      </ShellProvider>
    </SafeAreaProvider>
  );
}
