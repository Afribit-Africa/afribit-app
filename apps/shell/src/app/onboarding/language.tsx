import { Button, Choice, Screen, Stack, Text } from '@afribit/design';
import type { Locale } from '@afribit/feature-sdk';
import { router } from 'expo-router';
import { strings } from '../../i18n';
import { useShell } from '../../shell/ShellProvider';
import { StepDots } from '../../shell/StepDots';

const LOCALES: { id: Locale; detail: string }[] = [
  { id: 'en', detail: 'English' },
  { id: 'sw', detail: 'Swahili' },
];

export default function Language() {
  const { setup, updateSetup } = useShell();
  const t = strings[setup.locale];
  return (
    <Screen footer={<Button testID="language-continue" label={t.continue} onPress={() => router.push('/onboarding/nickname')} />}>
      <StepDots step={1} />
      <Text variant="screen">{t.languageTitle}</Text>
      <Text variant="body" tone="muted">{t.languageBody}</Text>
      <Stack gap={12}>
        {LOCALES.map((l) => (
          <Choice
            key={l.id}
            testID={`language-${l.id}`}
            label={t.langNames[l.id]}
            detail={l.id === 'sw' ? l.detail : undefined}
            selected={setup.locale === l.id}
            onPress={() => void updateSetup({ locale: l.id })}
          />
        ))}
      </Stack>
    </Screen>
  );
}
