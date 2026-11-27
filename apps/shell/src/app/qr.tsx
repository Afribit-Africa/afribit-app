import { Button, Screen, Text, color, radius, space } from '@afribit/design';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { strings } from '../i18n';
import { useShell } from '../shell/ShellProvider';

const MAX_DATA = 2048;

/** Shows one contact QR the shell was asked to display. The payload is never logged. */
export default function Qr() {
  const { setup } = useShell();
  const t = strings[setup.locale];
  const params = useLocalSearchParams<{ data?: string; caption?: string }>();
  const raw = typeof params.data === 'string' ? params.data : '';
  const data = raw.length > 0 && raw.length <= MAX_DATA ? raw : undefined;
  const caption = typeof params.caption === 'string' ? params.caption : '';
  return (
    <Screen scroll={false}>
      <View style={styles.center}>
        {data ? (
          <>
            <View testID="contact-qr" style={styles.card}>
              <QRCode value={data} size={240} color={color.ink} backgroundColor={color.white} />
            </View>
            {caption ? <Text variant="section" style={styles.caption}>{caption}</Text> : null}
          </>
        ) : null}
        <Button label={t.back} kind="quiet" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.l, paddingHorizontal: space.xl },
  card: { backgroundColor: color.white, borderRadius: radius.card, padding: space.l },
  caption: { textAlign: 'center' },
});
