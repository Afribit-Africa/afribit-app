import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text as RNText, View, type TextProps as RNTextProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, radius, sidePadding, space, touchTarget, type, type TypeVariant } from './tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 24, tint = color.ink }: { name: IconName; size?: number; tint?: ComponentProps<typeof Ionicons>['color'] }) {
  return <Ionicons name={name} size={size} color={tint} accessibilityElementsHidden importantForAccessibility="no" />;
}

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  tone?: 'ink' | 'muted' | 'forest' | 'warning' | 'error' | 'white';
}

export function Text({ variant = 'body', tone = 'ink', style, ...rest }: TextProps) {
  return <RNText maxFontSizeMultiplier={1.6} {...rest} style={[type[variant], { color: color[tone] }, style]} />;
}

export function Screen({ children, scroll = true, footer, edges = ['top', 'bottom'], refreshControl }: {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  edges?: ('top' | 'bottom')[];
  refreshControl?: ReactElement;
}) {
  const body = scroll
    ? <ScrollView contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>{children}</ScrollView>
    : <View style={[styles.scrollBody, styles.fill]}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {body}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function Button({ label, onPress, kind = 'primary', disabled, busy, icon, testID }: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'quiet';
  disabled?: boolean;
  busy?: boolean;
  icon?: IconName;
  testID?: string;
}) {
  const fg = kind === 'primary' ? color.white : color.ink;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        kind === 'primary' && styles.primary,
        kind === 'secondary' && styles.secondary,
        kind === 'quiet' && styles.quiet,
        (disabled || busy) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={20} tint={fg} /> : null}
          <Text variant="button" style={{ color: fg }}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export type PillTone = 'positive' | 'neutral' | 'warning' | 'error' | 'accent';

const pillColors: Record<PillTone, { bg: string; fg: string }> = {
  positive: { bg: color.forestTint, fg: color.forest },
  neutral: { bg: color.paper, fg: color.muted },
  warning: { bg: color.warningTint, fg: color.warning },
  error: { bg: color.errorTint, fg: color.error },
  accent: { bg: '#FFF4D6', fg: color.ink },
};

export function StatusPill({ label, tone = 'neutral', icon }: { label: string; tone?: PillTone; icon?: IconName }) {
  const c = pillColors[tone];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg, borderColor: tone === 'neutral' ? color.divider : c.bg }]}>
      {icon ? <Icon name={icon} size={14} tint={c.fg} /> : null}
      <Text variant="label" style={{ color: c.fg }}>{label}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** App tile for the Home grid. Each app keeps its own glyph and accent; the frame is shared. */
export function AppTile({ title, subtitle, icon, accent, status, onPress, testID }: {
  title: string;
  subtitle: string;
  icon: IconName;
  accent: string;
  status?: { label: string; tone: PillTone };
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}${status ? `. ${status.label}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={[styles.tileIcon, { backgroundColor: accent }]}>
        <Icon name={icon} size={26} tint={color.white} />
      </View>
      <View style={styles.tileText}>
        <Text variant="section" numberOfLines={1}>{title}</Text>
        <Text variant="supporting" tone="muted" numberOfLines={2}>{subtitle}</Text>
      </View>
      {status ? <StatusPill label={status.label} tone={status.tone} /> : null}
    </Pressable>
  );
}

export function ListRow({ title, detail, icon, onPress, trailing, testID }: {
  title: string;
  detail?: string;
  icon?: IconName;
  onPress?: () => void;
  trailing?: ReactNode;
  testID?: string;
}) {
  const content = (
    <View style={styles.listRow}>
      {icon ? <View style={styles.listIcon}><Icon name={icon} size={22} /></View> : null}
      <View style={styles.fill}>
        <Text variant="body">{title}</Text>
        {detail ? <Text variant="supporting" tone="muted">{detail}</Text> : null}
      </View>
      {trailing ?? (onPress ? <Icon name="chevron-forward" size={20} tint={color.muted} /> : null)}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function Choice({ label, detail, selected, onPress, testID }: {
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <View style={styles.fill}>
        <Text variant="button">{label}</Text>
        {detail ? <Text variant="supporting" tone="muted">{detail}</Text> : null}
      </View>
      <Icon name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} tint={selected ? color.ink : color.inputBoundary} />
    </Pressable>
  );
}

export function Stack({ gap = space.l, children, style }: { gap?: number; children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  fill: { flex: 1 },
  scrollBody: { paddingHorizontal: sidePadding, paddingTop: space.xl, paddingBottom: space.xxl, gap: space.l },
  footer: { paddingHorizontal: sidePadding, paddingBottom: space.l, paddingTop: space.s, gap: space.s },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  button: { minHeight: touchTarget, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  primary: { backgroundColor: color.ink },
  secondary: { backgroundColor: color.white, borderWidth: 1, borderColor: color.inputBoundary },
  quiet: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: space.m, paddingVertical: space.xs, borderWidth: 1 },
  card: { backgroundColor: color.white, borderRadius: radius.card, borderWidth: 1, borderColor: color.divider, padding: space.l, gap: space.m },
  tile: { backgroundColor: color.white, borderRadius: radius.card, borderWidth: 1, borderColor: color.divider, padding: space.l, gap: space.m, minHeight: 156, flex: 1 },
  tileIcon: { width: 48, height: 48, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center' },
  tileText: { gap: 2 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 56, paddingVertical: space.s },
  listIcon: { width: 40, height: 40, borderRadius: radius.control, backgroundColor: color.paper, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: color.divider },
  choice: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 64, paddingHorizontal: space.l, paddingVertical: space.m, borderRadius: radius.card, borderWidth: 1, borderColor: color.divider, backgroundColor: color.white },
  choiceSelected: { borderColor: color.ink, borderWidth: 2 },
});
