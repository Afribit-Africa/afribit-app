import { color, space } from '@afribit/design';
import { StyleSheet, View } from 'react-native';

export const STEP_COUNT = 8;

/** Progress for the one-concern-per-screen setup. Decorative; each screen has its own title. */
export function StepDots({ step }: { step: number }) {
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: STEP_COUNT }, (_, i) => (
        <View key={i} style={[styles.dot, i <= step && styles.on, i === step && styles.current]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.xs },
  dot: { height: 4, flex: 1, borderRadius: 2, backgroundColor: color.divider },
  on: { backgroundColor: color.inputBoundary },
  current: { backgroundColor: color.ink },
});
