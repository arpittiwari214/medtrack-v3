/**
 * Icon set — the same geometry as the web app.
 *
 * These are the identical path data used in `apps/web/src/components/icons.tsx`,
 * rendered through react-native-svg. Sharing the paths rather than reaching for
 * a glyph font is what makes the two platforms actually look like one product:
 * the same 24px grid, the same 1.75 stroke, the same round caps.
 *
 * Emoji previously did this job, which is the loudest possible signal that an
 * interface was generated rather than designed — they render differently on
 * every platform, carry a cartoon register that undercuts a medical tool, and
 * cannot inherit weight or colour.
 */

import Svg, { Circle, Path, Rect } from 'react-native-svg';

export interface IconProps {
  size?: number;
  color: string;
}

interface BaseProps extends IconProps {
  children: React.ReactNode;
}

function Base({ size = 20, color, children }: BaseProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

/* ── Actions ─────────────────────────────────────────────────────────────── */

export const Check = (p: IconProps) => (
  <Base {...p}>
    <Path d="M20 6 9 17l-5-5" />
  </Base>
);

export const Clock = (p: IconProps) => (
  <Base {...p}>
    <Circle cx="12" cy="12" r="9" />
    <Path d="M12 7v5l3 2" />
  </Base>
);

export const SkipForward = (p: IconProps) => (
  <Base {...p}>
    <Path d="M5 12h14" />
  </Base>
);

export const Undo = (p: IconProps) => (
  <Base {...p}>
    <Path d="M3 8h11a5 5 0 0 1 0 10H8" />
    <Path d="m7 4-4 4 4 4" />
  </Base>
);

export const Volume = (p: IconProps) => (
  <Base {...p}>
    <Path d="M11 5 6 9H2v6h4l5 4V5Z" />
    <Path d="M15.5 8.5a5 5 0 0 1 0 7" />
    <Path d="M19 5a10 10 0 0 1 0 14" />
  </Base>
);

export const ChevronRight = (p: IconProps) => (
  <Base {...p}>
    <Path d="m9 6 6 6-6 6" />
  </Base>
);

/* ── Status ──────────────────────────────────────────────────────────────── */

export const AlertTriangle = (p: IconProps) => (
  <Base {...p}>
    <Path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <Path d="M12 9v4M12 17h.01" />
  </Base>
);

export const Info = (p: IconProps) => (
  <Base {...p}>
    <Circle cx="12" cy="12" r="9" />
    <Path d="M12 11v5M12 8h.01" />
  </Base>
);

/* ── Domain ──────────────────────────────────────────────────────────────── */

/** A capsule on the diagonal — reads as medicine at 18px, unlike a pill bottle. */
export const Pill = (p: IconProps) => (
  <Base {...p}>
    <Path d="M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7Z" />
    <Path d="m8.5 8.5 7 7" />
  </Base>
);

export const Home = (p: IconProps) => (
  <Base {...p}>
    <Path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    <Path d="M9 21v-7h6v7" />
  </Base>
);

export const Settings = (p: IconProps) => (
  <Base {...p}>
    <Circle cx="12" cy="12" r="3" />
    <Path d="M12 2v3M12 19v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M2 12h3M19 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2" />
  </Base>
);

export const Package = (p: IconProps) => (
  <Base {...p}>
    <Path d="M21 8 12 3 3 8v8l9 5 9-5Z" />
    <Path d="m3 8 9 5 9-5M12 13v8" />
  </Base>
);

export const Calendar = (p: IconProps) => (
  <Base {...p}>
    <Rect x="3" y="5" width="18" height="16" rx="2" />
    <Path d="M3 10h18M8 3v4M16 3v4" />
  </Base>
);

export const Chart = (p: IconProps) => (
  <Base {...p}>
    <Path d="M3 3v16a2 2 0 0 0 2 2h16" />
    <Path d="m7 15 3.5-4 3 2.5L18 8" />
  </Base>
);
