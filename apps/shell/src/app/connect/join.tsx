import { Button, Card, Icon, Screen, StatusPill, Text, color, space } from '@afribit/design';
import { parseAppJoinResponse, parseJoinLink } from '@afribit/kernel';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { strings } from '../../i18n';
import { loadMeshCredentials, saveMeshCredentials } from '../../shell/meshCredentials';
import { useShell } from '../../shell/ShellProvider';

/**
 * Captive-portal hand-off: afribit://connect/join?ticket=…&session=…
 * The link is validated, then the user confirms; nothing happens automatically (PRD §3.3).
 * Redemption posts to the mesh service's app endpoint and keeps the session and device key it
 * returns, so later mesh calls can present this phone. If the router cannot take app sign-in,
 * the user is sent to the browser join flow, which already works.
 */
const APP_JOIN_URL = 'https://wifi.afribit.africa/api/mesh/app/join';
const JOIN_TIMEOUT_MS = 10_000;
const MAX_ERROR_CHARS = 200;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Reads the mesh service's `{ error }` text, if it sent one, and trims it for the card. */
async function serverErrorText(r: Response): Promise<string | null> {
  let body: unknown;
  try {
    body = await r.json();
  } catch {
    return null;
  }
  if (!isRecord(body) || typeof body.error !== 'string' || !body.error.trim()) return null;
  return body.error.trim().slice(0, MAX_ERROR_CHARS);
}

type JoinState = 'review' | 'busy' | 'done' | 'restored' | 'not-ready' | 'denied';

export default function Join() {
  const params = useLocalSearchParams<{ ticket?: string; session?: string }>();
  const shell = useShell();
  const t = strings[shell.setup.locale];
  const link = parseJoinLink(`afribit://connect/join?ticket=${encodeURIComponent(String(params.ticket ?? ''))}&session=${encodeURIComponent(String(params.session ?? ''))}`);
  const [state, setState] = useState<JoinState>('review');
  const [serverError, setServerError] = useState<string | null>(null);

  const confirm = async () => {
    if (!link) return;
    setState('busy');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), JOIN_TIMEOUT_MS);
    try {
      const stored = await loadMeshCredentials();
      const body: { ticket: string; session: string; deviceKey?: string } = { ticket: link.ticket, session: link.session };
      if (stored) body.deviceKey = stored.deviceKey;
      const r = await fetch(APP_JOIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (r.ok) {
        const raw: unknown = await r.json().catch(() => null);
        const joined = parseAppJoinResponse(raw);
        if (!joined) {
          // A success we cannot read is a failure, never a stored credential.
          setState('not-ready');
          return;
        }
        await saveMeshCredentials({ session: link.session, deviceKey: joined.deviceKey });
        shell.markMeshAttested();
        setState(joined.restored || joined.grantId !== null ? 'restored' : 'done');
        return;
      }
      if (r.status === 400 || r.status === 403) {
        setServerError(await serverErrorText(r));
        setState('denied');
        return;
      }
      setState('not-ready');
    } catch {
      setState('not-ready');
    } finally {
      clearTimeout(timer);
    }
  };

  const browser = () => {
    if (!link) return;
    void WebBrowser.openBrowserAsync(`https://wifi.afribit.africa/api/mesh/join?ticket=${link.ticket}&session=${link.session}`);
  };

  if (!link) {
    return (
      <Screen footer={<Button label={t.goHome} onPress={() => router.replace('/')} />}>
        <Text variant="screen">{t.joinTitle}</Text>
        <Text variant="body" tone="error">{t.joinInvalid}</Text>
      </Screen>
    );
  }

  const done = state === 'done' || state === 'restored';
  return (
    <Screen
      footer={done
        ? <Button label={t.goHome} onPress={() => router.replace('/')} />
        : state === 'not-ready' || state === 'denied'
          ? <Button label={t.joinBrowser} onPress={browser} />
          : <Button testID="join-confirm" label={t.joinConfirm} busy={state === 'busy'} onPress={() => void confirm()} />}
    >
      <View style={styles.hero}>
        <Icon name="git-network-outline" size={40} tint={color.forest} />
      </View>
      <Text variant="screen">{t.joinTitle}</Text>
      <Text variant="body" tone="muted">{t.joinBody}</Text>
      {state === 'done' ? <StatusPill label={t.joinDone} tone="positive" icon="shield-checkmark" /> : null}
      {state === 'restored' ? <StatusPill label={t.joinRestored} tone="positive" icon="shield-checkmark" /> : null}
      {state === 'not-ready' ? (
        <Card><Text variant="supporting" tone="warning">{t.joinNotReady}</Text></Card>
      ) : null}
      {state === 'denied' ? (
        <Card><Text variant="supporting" tone="warning">{serverError ?? t.joinDenied}</Text></Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { width: 72, height: 72, borderRadius: 20, backgroundColor: color.forestTint, alignItems: 'center', justifyContent: 'center', marginTop: space.l },
});
