import { Screen, Text } from '@afribit/design';
import type { FeatureProps } from '@afribit/feature-sdk';

/**
 * Placeholder. The real Wallet is the Blink fork (self-custodial Breez Spark path)
 * and runs in its own Android process (isolation I-2). The registry keeps this
 * feature unavailable until the host supports a dedicated process, so this
 * component is never mounted in the shell process in production.
 */
export default function WalletApp({ ctx }: FeatureProps) {
  return (
    <Screen edges={['bottom']}>
      <Text variant="screen">{ctx.locale === 'sw' ? 'Pochi' : 'Wallet'}</Text>
      <Text variant="body" tone="muted">
        {ctx.locale === 'sw' ? 'Pochi inaandaliwa.' : 'Wallet is being prepared.'}
      </Text>
    </Screen>
  );
}
