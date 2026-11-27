/**
 * Afribit OS brand tokens v1.0 (Afribit brand tokens, approved 2026-10-11).
 * Editorial Light. Do not hard-code colours or sizes outside this file.
 */
export const color = {
  ink: '#111312',
  white: '#FFFFFF',
  paper: '#F7F8F7',
  gold: '#FAAB00',
  forest: '#146B3A',
  forestTint: '#F0F5F1',
  muted: '#626963',
  divider: '#E0E4E0',
  inputBoundary: '#7C847E',
  warning: '#8A5400',
  warningTint: '#FBF3E6',
  error: '#B42318',
  errorTint: '#FBEDEC',
} as const;

/** Static font instances cut from the approved variable fonts (Android cannot select variable weights). */
export const font = {
  regular: 'Manrope-Regular',
  medium: 'Manrope-Medium',
  semibold: 'Manrope-SemiBold',
  reading: 'NotoSans-Regular',
} as const;

export const type = {
  display: { fontFamily: font.medium, fontSize: 56, lineHeight: 62 },
  welcome: { fontFamily: font.medium, fontSize: 32, lineHeight: 40 },
  screen: { fontFamily: font.semibold, fontSize: 24, lineHeight: 32 },
  balance: { fontFamily: font.regular, fontSize: 40, lineHeight: 48, fontVariant: ['tabular-nums'] as 'tabular-nums'[] },
  section: { fontFamily: font.semibold, fontSize: 18, lineHeight: 26 },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 24 },
  button: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  supporting: { fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: font.medium, fontSize: 12, lineHeight: 16 },
} as const;

export type TypeVariant = keyof typeof type;

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32, x3: 48, x4: 64 } as const;
export const radius = { control: 8, card: 12, pill: 999 } as const;
export const touchTarget = 48;
export const sidePadding = 24;
export const motion = { fastMs: 120, normalMs: 200 } as const;
