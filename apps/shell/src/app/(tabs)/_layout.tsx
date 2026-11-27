import { Icon, color, font, type IconName } from '@afribit/design';
import { Redirect, Tabs, router } from 'expo-router';
import { useEffect } from 'react';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { strings } from '../../i18n';
import { pendingRoute } from '../../shell/pendingRoute';
import { useShell } from '../../shell/ShellProvider';

export default function TabsLayout() {
  const { setup } = useShell();
  const insets = useSafeAreaInsets();
  // A route kept while onboarding ran (a link, or the Wallet step's "Set up") opens on top of
  // Home once Home is up, so Back from it goes Home. Completing setup turns the onboarding
  // screen into a redirect to Home; a push made before that redirect lands is lost, so the push
  // waits for Home and then for the next turn, after the navigator has settled.
  useEffect(() => {
    if (!setup.completed) return;
    const timer = setTimeout(() => {
      const route = pendingRoute.take();
      if (route) router.push(route);
    }, 0);
    return () => clearTimeout(timer);
  }, [setup.completed]);
  // The root layout already redirects every non-onboarding screen before setup; this keeps the
  // tabs safe on their own, e.g. if they are ever reached without the root gate.
  if (!setup.completed) return <Redirect href="/onboarding" />;
  const t = strings[setup.locale];
  const icon = (name: IconName, focusedName: IconName) => ({ focused, color: c }: { focused: boolean; color: ColorValue }) => (
    <Icon name={focused ? focusedName : name} size={24} tint={typeof c === 'string' ? c : color.ink} />
  );
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.ink,
        tabBarInactiveTintColor: color.muted,
        tabBarStyle: { backgroundColor: color.white, borderTopColor: color.divider, height: 64 + insets.bottom, paddingBottom: insets.bottom },
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 12 },
        sceneStyle: { backgroundColor: color.paper },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t.tabHome, tabBarIcon: icon('home-outline', 'home'), tabBarButtonTestID: 'tab-home' }} />
      <Tabs.Screen name="apps" options={{ title: t.tabApps, tabBarIcon: icon('grid-outline', 'grid'), tabBarButtonTestID: 'tab-apps' }} />
      <Tabs.Screen name="connect" options={{ title: t.tabConnect, tabBarIcon: icon('wifi-outline', 'wifi'), tabBarButtonTestID: 'tab-connect' }} />
      <Tabs.Screen name="profile" options={{ title: t.tabProfile, tabBarIcon: icon('person-circle-outline', 'person-circle'), tabBarButtonTestID: 'tab-profile' }} />
    </Tabs>
  );
}
