import { Button, Card, Screen, Stack, Text } from '@afribit/design';
import type { FeatureProps } from '@afribit/feature-sdk';
import { useState } from 'react';

/**
 * Isolation diagnostics. Built only into diagnostic builds (EXPO_PUBLIC_DIAGNOSTICS=1).
 * - "Crash this app" throws during render: the shell must contain it and stay usable.
 * - Storage: writes its own key and shows that it can only see its own namespace.
 * - Broker: asks for something it is not granted and shows the denial.
 */
function Bomb(): never {
  throw new Error('Diagnostics: deliberate render crash');
}

export default function DiagnosticsApp({ ctx }: FeatureProps) {
  const [crash, setCrash] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const add = (line: string) => setLog((l) => [...l, line]);

  async function storageCheck() {
    await ctx.storage.setItem('probe', 'diagnostics-was-here');
    add(`own key: ${String(await ctx.storage.getItem('probe'))}`);
    // Keys are confined to this feature's namespace; these cannot reach another app's data.
    add(`"../chat/onboarding": ${String(await ctx.storage.getItem('../chat/onboarding').catch((e: Error) => `blocked (${e.message})`))}`);
    add(`"feature.chat.x": ${String(await ctx.storage.getItem('feature.chat.x').catch((e: Error) => `blocked (${e.message})`))}`);
  }

  async function brokerCheck() {
    const a = await ctx.request({ kind: 'wallet.preparePayment', paymentRequest: 'lnbc1diagnostic', purpose: 'manual' });
    add(`wallet.preparePayment -> ${a.status}${'reason' in a ? ` (${a.reason})` : ''}`);
    const b = await ctx.request({ kind: 'wallet.showReceive' });
    add(`wallet.showReceive -> ${b.status}${'reason' in b ? ` (${b.reason})` : ''}`);
  }

  return (
    <Screen edges={['bottom']}>
      {crash ? <Bomb /> : null}
      <Text variant="screen">Diagnostics</Text>
      <Text variant="body" tone="muted">Feature id from the shell: {ctx.featureId}</Text>
      <Stack gap={12}>
        <Button testID="diag-crash" label="Crash this app" kind="primary" onPress={() => setCrash(true)} />
        <Button testID="diag-storage" label="Check storage scope" kind="secondary" onPress={() => void storageCheck()} />
        <Button testID="diag-broker" label="Check broker permissions" kind="secondary" onPress={() => void brokerCheck()} />
      </Stack>
      {log.length > 0 ? (
        <Card>
          {log.map((l, i) => <Text key={i} variant="supporting">{l}</Text>)}
        </Card>
      ) : null}
    </Screen>
  );
}
