import { Button, Screen, Text, color, radius, space, type as typo } from '@afribit/design';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { strings } from '../../i18n';
import { useShell } from '../../shell/ShellProvider';
import { StepDots } from '../../shell/StepDots';

/** A nickname, not a legal name (Product Flow §3). Stays local. */
export function cleanNickname(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
}

export default function Nickname() {
  const { setup, updateSetup } = useShell();
  const t = strings[setup.locale];
  const [value, setValue] = useState(setup.nickname);
  const clean = cleanNickname(value);
  const valid = clean.length >= 2;

  const next = async () => {
    await updateSetup({ nickname: clean });
    router.push('/onboarding/mesh');
  };

  return (
    <Screen footer={<Button testID="nickname-continue" label={t.continue} disabled={!valid} onPress={() => void next()} />}>
      <StepDots step={2} />
      <Text variant="screen">{t.nicknameTitle}</Text>
      <Text variant="body" tone="muted">{t.nicknameBody}</Text>
      <TextInput
        testID="nickname-input"
        defaultValue={setup.nickname}
        onChangeText={setValue}
        placeholder={t.nicknamePlaceholder}
        placeholderTextColor={color.inputBoundary}
        autoCapitalize="words"
        autoCorrect={false}
        autoComplete="off"
        importantForAutofill="no"
        maxLength={32}
        returnKeyType="next"
        onSubmitEditing={() => valid && void next()}
        accessibilityLabel={t.nicknamePlaceholder}
        style={styles.input}
      />
      <Text variant="supporting" tone="muted">{t.nicknameHint}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { ...typo.body, minHeight: 56, borderWidth: 1, borderColor: color.inputBoundary, borderRadius: radius.control, paddingHorizontal: space.l, backgroundColor: color.white, color: color.ink },
});
