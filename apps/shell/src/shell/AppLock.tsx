import { Button, Screen, Text, space } from '@afribit/design';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Image, StyleSheet, View } from 'react-native';
import { strings } from '../i18n';
import { useShell } from './ShellProvider';

const RELOCK_AFTER_MS = 60_000;

/** Device-authentication gate. App unlock is NOT authorization to sign or pay (Product Flow §6). */
export function AppLock({ children }: { children: ReactNode }) {
  const { setup } = useShell();
  const t = strings[setup.locale];
  const enabled = setup.completed && setup.protection;
  const [locked, setLocked] = useState(enabled);
  const [failed, setFailed] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    setFailed(false);
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: t.protectPrompt, disableDeviceFallback: false });
    if (r.success) setLocked(false);
    else setFailed(true);
  }, [t.protectPrompt]);

  useEffect(() => {
    if (!enabled) { setLocked(false); return; }
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') backgroundedAt.current = Date.now();
      if (s === 'active' && backgroundedAt.current !== null && Date.now() - backgroundedAt.current > RELOCK_AFTER_MS) setLocked(true);
    });
    return () => sub.remove();
  }, [enabled]);

  useEffect(() => {
    if (enabled && locked) void unlock();
  }, [enabled, locked, unlock]);

  if (!enabled || !locked) return <>{children}</>;
  return (
    <Screen scroll={false} footer={<Button testID="unlock" label={t.unlock} onPress={() => void unlock()} />}>
      <View style={styles.center}>
        <Image source={require('../../assets/images/afribit-symbol.png')} style={styles.logo} accessibilityIgnoresInvertColors />
        <Text variant="section">{t.locked}</Text>
        {failed ? <Text variant="supporting" tone="error">{t.protectFailed}</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.m },
  logo: { width: 72, height: 72 },
});
