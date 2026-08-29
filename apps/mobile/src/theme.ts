/**
 * Design tokens, mirroring the web app so the two read as one product.
 *
 * Two constraints, same as the web:
 *
 *  1. Many people using this manage several medications, which correlates with
 *     being older, tired or unwell. Defaults lean large: 16pt base text, 44pt
 *     minimum touch targets, real hierarchy.
 *  2. It is a medical tool, so it should read as an instrument you trust —
 *     hairlines over shadows, restrained radii, tabular numerals, uppercase
 *     micro-labels, colour spent only where it carries meaning.
 *
 * The palette is the same validated set as the web (OKLab lightness band,
 * chroma floor, CVD separation, contrast). Where a fill carries text, the ink
 * is chosen by the fill's luminance rather than defaulting to white — white on
 * the status green measures 3.35:1 in light and 2.34:1 in dark, both under AA.
 *
 * Dark mode is *selected*, not flipped: the brand and action steps are
 * re-chosen for the dark surface, not the light hue lightened.
 */

import { useColorScheme } from 'react-native';

export interface Palette {
  brand: string;
  brandStrong: string;
  brandSoft: string;
  brandInk: string;

  bg: string;
  surface: string;
  surface2: string;
  surface3: string;
  border: string;
  borderStrong: string;

  text: string;
  text2: string;
  text3: string;
  onBrand: string;

  ok: string;
  okBg: string;
  okInk: string;
  warn: string;
  warnBg: string;
  warnInk: string;
  danger: string;
  dangerBg: string;
  dangerInk: string;
  info: string;
  infoBg: string;
  infoInk: string;

  /** Primary-action fill and its ink, chosen together for contrast. */
  actionFill: string;
  actionInk: string;
  /** Solid danger fill (badges), with luminance-matched ink. */
  dangerSolid: string;
  dangerSolidInk: string;
}

const light: Palette = {
  brand: '#0891a8',
  brandStrong: '#06758a',
  brandSoft: '#e2f3f7',
  brandInk: '#05505f',

  bg: '#fbfaf8',
  surface: '#ffffff',
  surface2: '#f4f3f0',
  surface3: '#ebe9e5',
  border: '#e6e3de',
  borderStrong: '#d3cfc8',

  text: '#12181b',
  text2: '#55636b',
  // 4.6:1 on white. The obvious lighter grey (#8a9299) is 3.16 and fails AA.
  text3: '#6b7379',
  onBrand: '#ffffff',

  ok: '#0ca30c',
  okBg: '#e6f6e6',
  okInk: '#05620a',
  warn: '#b8730a',
  warnBg: '#fdf2dd',
  warnInk: '#7a4a03',
  danger: '#d03b3b',
  dangerBg: '#fbeaea',
  dangerInk: '#8c2020',
  info: '#2a78d6',
  infoBg: '#e7f0fc',
  infoInk: '#14477f',

  actionFill: '#0a7d0a',
  actionInk: '#ffffff',
  dangerSolid: '#c0342f',
  dangerSolidInk: '#ffffff',
};

const dark: Palette = {
  brand: '#22a6c0',
  brandStrong: '#3dbcd4',
  brandSoft: '#10323b',
  brandInk: '#8fd8e6',

  bg: '#101619',
  surface: '#171f23',
  surface2: '#1e282d',
  surface3: '#263238',
  border: '#263238',
  borderStrong: '#384750',

  text: '#f2f5f6',
  text2: '#a7b4bb',
  text3: '#93a1a8',
  onBrand: '#06222a',

  ok: '#3cc23c',
  okBg: '#102c12',
  okInk: '#8fe08f',
  warn: '#e8a838',
  warnBg: '#33260f',
  warnInk: '#f5cf88',
  danger: '#ef6b6b',
  dangerBg: '#331919',
  dangerInk: '#f8a9a9',
  info: '#6aa5ea',
  infoBg: '#12253c',
  infoInk: '#a9caf3',

  actionFill: '#3cc23c',
  actionInk: '#0a1418',
  dangerSolid: '#ef6b6b',
  dangerSolidInk: '#2a0f0f',
};

/**
 * The palette for the current appearance.
 *
 * A hook, not a module-level constant. The previous version resolved the
 * scheme once at import time via `Appearance.getColorScheme()`, so switching
 * the system theme left the app in whatever mode it launched in until it was
 * killed and relaunched.
 */
export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

/** For the few places outside React that need a colour (e.g. notification tint). */
export const staticPalette = { light, dark };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Restrained: large soft corners read friendly-consumer, not clinical. */
export const radius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 12,
  full: 999,
} as const;

/**
 * Type scale — seven steps, each with a job. Mirrors the web scale so a screen
 * looks the same weight on both.
 */
export const type = {
  display: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.8 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.4 },
  lg: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.2 },
  base: { fontSize: 16, fontWeight: '400' as const },
  sm: { fontSize: 14, fontWeight: '400' as const },
  xs: { fontSize: 13, fontWeight: '400' as const },
  micro: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.1 },
} as const;

/** Minimum tappable size. Below this, misses become common. */
export const MIN_TOUCH = 44;

/** Tabular figures, so times and counts line up in a column. */
export const TABULAR = { fontVariant: ['tabular-nums' as const] };
