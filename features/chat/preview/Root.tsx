/** Dedicated visual-review entry. This is not the production feature entry point. */
import { useEffect, useMemo, useState } from 'react';
import { useFonts } from 'expo-font';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { Icon, Text, color, space, touchTarget } from '@afribit/design';
import type { FeatureContext } from '@afribit/feature-sdk';
import { ChatApp } from '../src/ui/ChatApp';
import { createPreviewRuntime, type PreviewMode } from './runtime';
import { longCopy } from './long-copy';

function ReviewContent({ mode, onExit }: { mode: PreviewMode; onExit: () => void }) {
  const runtime = useMemo(() => mode === 'locked' ? undefined : createPreviewRuntime(mode), [mode]);
  const store = { async getItem() { return null; }, async setItem() {}, async removeItem() {} };
  const ctx: FeatureContext = { featureId: 'chat', locale: 'en', connectivity: runtime?.snapshot().connectivity ?? { state: 'LOCAL_ONLY', meshTrust: 'local-verified', uplink: 'none', checkedAt: Date.now() }, storage: store, secureStorage: store, paths: { dataDir: 'file:///test/features/chat/' }, exit: onExit, async request() { return { requestId: 'review', status: 'unavailable', reason: 'Design review' }; } };
  return <ChatApp ctx={ctx} runtime={runtime} strings={mode === 'long' ? longCopy : undefined} />;
}
export default function Root() {
  useEffect(() => {
    const engine = globalThis as unknown as Record<string, unknown>;
    console.info('AFRIBIT_CHAT_ENGINE', JSON.stringify({ hermes: !!engine.HermesInternal, webAssembly: typeof engine.WebAssembly }));
  }, []);
  const [generation, reset] = useState(0);
  const [home, setHome] = useState(false);
  const [mode, setMode] = useState<PreviewMode>('default');
  useEffect(() => {
    const apply = (url: string | null | undefined) => {
      const value = url?.match(/[?&]mode=([a-z]+)/)?.[1];
      if (value && ['default', 'locked', 'offline', 'states', 'stress', 'long', 'error', 'connecting'].includes(value)) { setHome(false); setMode(value as PreviewMode); reset(g => g + 1); }
    };
    void Linking.getInitialURL().then(apply);
    const listener = Linking.addEventListener('url', event => apply(event.url));
    return () => listener.remove();
  }, []);
  const [loaded] = useFonts({
    'Manrope-Regular': require('../../../apps/shell/assets/fonts/Manrope-Regular.ttf'),
    'Manrope-Medium': require('../../../apps/shell/assets/fonts/Manrope-Medium.ttf'),
    'Manrope-SemiBold': require('../../../apps/shell/assets/fonts/Manrope-SemiBold.ttf'),
    'NotoSans-Regular': require('../../../apps/shell/assets/fonts/NotoSans-Regular.ttf'),
  });
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: color.paper }} edges={['top', 'bottom']}>
    <View style={{ minHeight: touchTarget, paddingHorizontal: space.l, backgroundColor: color.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Pressable accessibilityRole="button" accessibilityLabel="Afribit Home" onPress={() => reset(g => g + 1)} style={{ minHeight: touchTarget, flexDirection: 'row', gap: space.s, alignItems: 'center' }}><Icon name="chevron-back" /><Text variant="button">Afribit Home</Text></Pressable><Text variant="label" tone="muted">Chat review</Text></View>
    {loaded ? home ? <View style={{ flex: 1, padding: space.xl, gap: space.l }}><Text variant="screen">Afribit Home</Text><Text>Isolated review host. No other Super App features are mounted.</Text><Pressable accessibilityRole="button" accessibilityLabel="Reopen Chat review" style={{ minHeight: touchTarget, justifyContent: 'center' }} onPress={() => { setHome(false); reset(g => g + 1); }}><Text tone="forest">Reopen Chat review</Text></Pressable></View> : <ReviewContent key={generation} mode={mode} onExit={() => setHome(true)} /> : <ActivityIndicator color={color.forest} />}
  </SafeAreaView></SafeAreaProvider>;
}
