import { Button, Screen, Text } from '@afribit/design';
import { router } from 'expo-router';

/** Unknown deep links land here; they never trigger an action. */
export default function NotFound() {
  return (
    <Screen footer={<Button label="Afribit Home" onPress={() => router.replace('/')} />}>
      <Text variant="screen">Page not found</Text>
      <Text variant="body" tone="muted">This link does not open anything in Afribit.</Text>
    </Screen>
  );
}
