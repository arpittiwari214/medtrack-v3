/**
 * Design tokens, mirroring the web app so the two feel like one product.
 *
 * Sizes lean large for the same reason as on the web: many people managing
 * several medications are older or unwell, and a 12px label is a barrier.
 * Minimum touch target is 44pt throughout.
 */

import { Appearance } from 'react-native';

const light = {
  bg: '#F6F8FB',
  surface: '#FFFFFF',
  surface2: '#F1F5F9',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  text: '#0F1B33',
  textMuted: '#5A6B85',
  textSubtle: '#8494A8',
  navy: '#1B2B4B',
  navySoft: '#E8ECF4',
  ok: '#12805C',
  okBg: '#E3F5EE',
  warn: '#A1620A',
  warnBg: '#FDF1DD',
  danger: '#C0392F',
  dangerBg: '#FDECEB',
  info: '#2563A8',
  infoBg: '#E6F0FA',
  onDark: '#FFFFFF',
};

const dark: typeof light = {
  bg: '#0D1420',
  surface: '#151F30',
  surface2: '#1C2839',
  border: '#27344A',
  borderStrong: '#3A4A66',
  text: '#EEF2F8',
  textMuted: '#9FB0C7',
  textSubtle: '#7386A0',
  navy: '#7DB4EC',
  navySoft: '#1E2C46',
  ok: '#4ECF9F',
  okBg: '#102F26',
  warn: '#E0A944',
  warnBg: '#33260F',
  danger: '#F08379',
  dangerBg: '#331917',
  info: '#7DB4EC',
  infoBg: '#12263C',
  onDark: '#0D1420',
};

export function palette() {
  return Appearance.getColorScheme() === 'dark' ? dark : light;
}

export const colors = palette();

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const type = {
  display: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, fontWeight: '600' as const },
  label: { fontSize: 14, fontWeight: '500' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  eyebrow: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.8 },
} as const;

/** Minimum tappable size. Below this, misses become common. */
export const MIN_TOUCH = 44;
