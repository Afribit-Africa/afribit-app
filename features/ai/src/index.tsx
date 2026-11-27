import { Screen, Text } from '@afribit/design';
import type { FeatureProps } from '@afribit/feature-sdk';

/** Placeholder. Afribit AI is "coming later" in its manifest, so the shell does not open it yet. */
export default function AiApp({ ctx }: FeatureProps) {
  return (
    <Screen edges={['bottom']}>
      <Text variant="screen">Afribit AI</Text>
      <Text variant="body" tone="muted">{ctx.locale === 'sw' ? 'Inakuja hivi karibuni.' : 'Coming soon.'}</Text>
    </Screen>
  );
}
