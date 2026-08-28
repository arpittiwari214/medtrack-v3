/**
 * Icon set.
 *
 * Emoji were doing this job, which is the loudest possible signal that an
 * interface was generated rather than designed: they render differently on
 * every platform, carry a cartoon register that undercuts a medical tool, and
 * cannot inherit weight or colour.
 *
 * These are hand-drawn on a 24px grid with a 1.75 stroke, `currentColor`, and
 * round caps — so they inherit text colour, sit optically level with type, and
 * stay legible at 18px. No icon library, so no dependency and no 40 KB of
 * glyphs to ship for the twelve we use.
 */

interface IconProps {
  size?: number;
  className?: string;
  /** Icons are decorative by default; the adjacent label carries the meaning. */
  title?: string;
}

function Svg({
  size = 20,
  className,
  title,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

/* ── Actions ─────────────────────────────────────────────────────────────── */

export const Check = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
);

export const Clock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);

export const SkipForward = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);

export const Undo = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 8h11a5 5 0 0 1 0 10H8" />
    <path d="m7 4-4 4 4 4" />
  </Svg>
);

export const Plus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const ChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);

export const Close = (p: IconProps) => (
  <Svg {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Svg>
);

/* ── Status ──────────────────────────────────────────────────────────────── */

export const AlertTriangle = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </Svg>
);

export const Info = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Svg>
);

/* ── Domain ──────────────────────────────────────────────────────────────── */

/** A capsule on the diagonal — reads as medicine at 18px, unlike a pill bottle. */
export const Pill = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7Z" />
    <path d="m8.5 8.5 7 7" />
  </Svg>
);

export const Home = (p: IconProps) => (
  <Svg {...p}>
    <path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    <path d="M9 21v-7h6v7" />
  </Svg>
);

export const Chart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
    <path d="m7 15 3.5-4 3 2.5L18 8" />
  </Svg>
);

export const Calendar = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Svg>
);

export const Settings = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M2 12h3M19 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2" />
  </Svg>
);

export const Users = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16.5 5.2a3.5 3.5 0 0 1 0 5.6M18 20a6.5 6.5 0 0 0-2-4.7" />
  </Svg>
);

export const Package = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 8 12 3 3 8v8l9 5 9-5Z" />
    <path d="m3 8 9 5 9-5M12 13v8" />
  </Svg>
);

export const Stethoscope = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 3v5a4 4 0 0 0 8 0V3" />
    <path d="M5 3H3.5M13 3h1.5M9 12v2a5 5 0 0 0 10 0v-1" />
    <circle cx="19" cy="11" r="2" />
  </Svg>
);

export const Bell = (p: IconProps) => (
  <Svg {...p}>
    <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
    <path d="M10.5 20a2 2 0 0 0 3 0" />
  </Svg>
);
