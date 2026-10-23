/**
 * Shared UI primitives, mirroring the web design system.
 *
 * React Native has no cascade, so what the web expresses as `.panel` /
 * `.panel-head` / `.rail-row` becomes components here. The names match the web
 * classes deliberately — a change made on one side should be obvious to port.
 *
 * Status is never carried by colour alone: every badge and rail row also shows
 * a word, because red/green is precisely the pair a meaningful share of people
 * cannot distinguish, and this app uses it for "taken" versus "missed".
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { DoseStatus } from '@medtrack/shared';
import { MIN_TOUCH, TABULAR, radius, spacing, type, useTheme, type Palette } from '../theme';
import { Check, ChevronRight } from './icons';
import { useT } from '../i18n/useT';
import type { StringKey } from '../i18n';

/* ── Text ────────────────────────────────────────────────────────────────── */

/** The uppercase micro-label that gives the interface its chart-like register. */
export function Micro({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const c = useTheme();
  return (
    <Text style={[type.micro, { color: c.text3, textTransform: 'uppercase' }, style as never]}>
      {children}
    </Text>
  );
}

export function Muted({ children, size = 'sm' }: { children: ReactNode; size?: 'sm' | 'xs' }) {
  const c = useTheme();
  return <Text style={[type[size], { color: c.text2, lineHeight: 20 }]}>{children}</Text>;
}

/* ── Panel ───────────────────────────────────────────────────────────────── */

export function Panel({
  children,
  critical = false,
  style,
}: {
  children: ReactNode;
  critical?: boolean;
  style?: ViewStyle;
}) {
  const c = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: critical ? c.danger : c.border,
          borderRadius: radius.md,
          overflow: 'hidden',
        },
        // An accent edge rather than tinting the whole panel.
        critical && { borderLeftWidth: 3, borderLeftColor: c.danger },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** The tinted strip that labels what a panel holds. */
export function PanelHead({ label, aside }: { label: string; aside?: ReactNode }) {
  const c = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: c.surface2,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
      }}
    >
      <Text style={[type.micro, { color: c.text2, textTransform: 'uppercase' }]}>{label}</Text>
      {aside}
    </View>
  );
}

export function PanelBody({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ padding: spacing.lg }, style]}>{children}</View>;
}

/* ── Screen header ───────────────────────────────────────────────────────── */

export function ScreenHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  const c = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: spacing.lg,
        paddingTop: spacing.xl,
        paddingBottom: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
        marginBottom: spacing.xl,
      }}
    >
      <View style={{ flex: 1 }}>
        {eyebrow ? (
          <Text style={[type.micro, { color: c.text3, textTransform: 'uppercase' }]}>{eyebrow}</Text>
        ) : null}
        <Text style={[type.title, { color: c.text, marginTop: 4 }]}>{title}</Text>
      </View>
      {action}
    </View>
  );
}

/** A rule with a micro-label — orders a screen without boxing every group. */
export function SectionHead({ title, aside }: { title: string; aside?: ReactNode }) {
  const c = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginTop: spacing.xxl,
        marginBottom: spacing.sm,
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
      }}
    >
      <Text style={[type.micro, { color: c.text3, textTransform: 'uppercase' }]}>{title}</Text>
      {aside}
    </View>
  );
}

/* ── Badge ───────────────────────────────────────────────────────────────── */

type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

function toneColours(c: Palette, tone: Tone) {
  switch (tone) {
    case 'ok': return { bg: c.okBg, fg: c.okInk };
    case 'warn': return { bg: c.warnBg, fg: c.warnInk };
    case 'danger': return { bg: c.dangerBg, fg: c.dangerInk };
    case 'info': return { bg: c.infoBg, fg: c.infoInk };
    default: return { bg: c.surface2, fg: c.text2 };
  }
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const c = useTheme();
  const { bg, fg } = toneColours(c, tone);
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.xs, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={[type.micro, { color: fg, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
        {label}
      </Text>
    </View>
  );
}

/* ── Banner ──────────────────────────────────────────────────────────────── */

export function Banner({
  tone,
  icon,
  children,
}: {
  tone: Tone;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const c = useTheme();
  const { bg, fg } = toneColours(c, tone);
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.sm,
        backgroundColor: bg,
      }}
    >
      {icon}
      <View style={{ flex: 1 }}>
        {typeof children === 'string' ? (
          <Text style={[type.sm, { color: fg, lineHeight: 20 }]}>{children}</Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

/* ── Actions ─────────────────────────────────────────────────────────────── */

/** The one action a screen is about. Fill and ink are chosen together. */
export function ActionPrimary({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon?: (color: string) => ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          minHeight: 52,
          borderRadius: radius.sm,
          backgroundColor: c.actionFill,
          opacity: disabled ? 0.55 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {icon?.(c.actionInk)}
      <Text style={{ ...type.base, fontWeight: '700', color: c.actionInk }}>{label}</Text>
    </Pressable>
  );
}

export function ActionSecondary({
  label,
  icon,
  onPress,
  style,
}: {
  label: string;
  icon?: (color: string) => ReactNode;
  onPress: () => void;
  style?: ViewStyle;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          minHeight: MIN_TOUCH,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: c.borderStrong,
          backgroundColor: pressed ? c.surface2 : c.surface,
        },
        style,
      ]}
    >
      {icon?.(c.text2)}
      <Text style={{ ...type.sm, fontWeight: '600', color: c.text2 }}>{label}</Text>
    </Pressable>
  );
}

/* ── Metric strip ────────────────────────────────────────────────────────── */

/** Several readings in one bordered group — they are one reading taken together. */
export function MetricStrip({ items }: { items: { value: string | number; label: string }[] }) {
  const c = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: radius.md,
        backgroundColor: c.surface,
        overflow: 'hidden',
      }}
    >
      {items.map((item, index) => (
        <View
          key={item.label}
          style={{
            flex: 1,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
            borderRightWidth: index < items.length - 1 ? 1 : 0,
            borderRightColor: c.border,
          }}
        >
          <Text style={[type.title, TABULAR, { color: c.text }]}>{item.value}</Text>
          <Text
            style={[type.micro, { color: c.text3, textTransform: 'uppercase', marginTop: 2 }]}
          >
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* ── Day progress ────────────────────────────────────────────────────────── */

/** Segmented, not a percentage bar: at four doses a day you can count them. */
export function DaySegments({ statuses }: { statuses: DoseStatus[] }) {
  const c = useTheme();
  const fill = (status: DoseStatus) =>
    status === 'taken' ? c.ok
      : status === 'missed' ? c.danger
      : status === 'skipped' ? c.borderStrong
      : c.surface3;

  return (
    <View style={{ flexDirection: 'row', gap: 3, flex: 1 }}>
      {statuses.map((status, index) => (
        <View
          key={index}
          style={{ flex: 1, height: 5, borderRadius: 2, backgroundColor: fill(status) }}
        />
      ))}
    </View>
  );
}

/* ── Schedule rail ───────────────────────────────────────────────────────── */

export function RailRow({
  time,
  name,
  strength,
  status,
  purpose,
  person,
  leading,
  critical = false,
  first = false,
  last = false,
  onPress,
}: {
  time: string;
  name: string;
  strength: string;
  status: DoseStatus;
  /** The patient's own word for what it is for. */
  purpose?: string | null;
  person?: string | null;
  /** Shown before the name — the medicine's colour dot. */
  leading?: ReactNode;
  critical?: boolean;
  first?: boolean;
  last?: boolean;
  onPress?: () => void;
}) {
  const c = useTheme();
  const { t } = useT();
  const stateText = t(`state_${status}` as StringKey);

  const dotFill =
    status === 'taken' ? c.ok
      : status === 'missed' ? c.danger
      : status === 'snoozed' ? c.warn
      : status === 'skipped' ? c.borderStrong
      : c.surface;

  const dotBorder =
    status === 'scheduled' ? c.borderStrong : dotFill;

  const stateColour =
    status === 'taken' ? c.ok
      : status === 'missed' ? c.danger
      : status === 'snoozed' ? c.warn
      : c.text3;

  const resolved = status === 'taken' || status === 'skipped';

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${name} · ${time} — ${stateText}`}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        borderRadius: radius.sm,
        backgroundColor: pressed && onPress ? c.surface2 : 'transparent',
      })}
    >
      {/* Fixed width so times align down the column. Sized for "10:00 PM" —
          at anything narrower it wraps and that row stands taller than its
          neighbours, which breaks the rhythm of the whole rail. */}
      <Text
        style={[
          type.xs,
          TABULAR,
          { width: 74, textAlign: 'right', paddingRight: spacing.sm, color: c.text2, fontWeight: '700' },
        ]}
        numberOfLines={1}
      >
        {time}
      </Text>

      {/* The spine: a hairline through every dot, capped at the ends. */}
      <View style={{ width: 22, alignItems: 'center', alignSelf: 'stretch', justifyContent: 'center' }}>
        <View
          style={{
            position: 'absolute',
            width: 1,
            backgroundColor: c.border,
            top: first ? '50%' : 0,
            bottom: last ? '50%' : 0,
          }}
        />
        <View
          style={{
            width: 11,
            height: 11,
            borderRadius: 6,
            backgroundColor: dotFill,
            borderWidth: 2,
            borderColor: dotBorder,
            // A surface ring keeps the dot legible where it crosses the spine.
            shadowColor: c.surface,
            shadowOpacity: 1,
            shadowRadius: 0,
            elevation: 0,
          }}
        />
      </View>

      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {leading}
        <Text style={[type.sm, { color: c.text, fontWeight: '600', flexShrink: 1 }]} numberOfLines={1}>
          {person ? `${person}: ` : ''}
          {name} <Text style={{ color: c.text3, fontWeight: '400' }}>{strength}</Text>
          {purpose ? <Text style={{ color: c.text2, fontWeight: '400' }}> · {purpose}</Text> : null}
        </Text>
        {critical ? (
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c.danger }} />
        ) : null}
      </View>

      {resolved && onPress ? (
        <Check size={15} color={stateColour} />
      ) : (
        <Text style={[type.micro, { color: stateColour, textTransform: 'uppercase' }]}>
          {stateText}
        </Text>
      )}
    </Pressable>
  );
}

/* ── List row ────────────────────────────────────────────────────────────── */

export function ListRow({
  title,
  subtitle,
  onPress,
  last = false,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: 56,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.border,
        backgroundColor: pressed && onPress ? c.surface2 : 'transparent',
      })}
    >
      <View style={{ flex: 1 }}>
        <Text style={[type.base, { color: c.text, fontWeight: '600' }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[type.xs, { color: c.text3, marginTop: 2 }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {onPress ? <ChevronRight size={18} color={c.text3} /> : null}
    </Pressable>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────────── */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: (color: string) => ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const c = useTheme();
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: radius.md,
        backgroundColor: c.surface,
        paddingVertical: spacing.xxxl,
        paddingHorizontal: spacing.lg,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: c.surface2,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.md,
        }}
      >
        {icon(c.text3)}
      </View>
      <Text style={[type.lg, { color: c.text }]}>{title}</Text>
      <Text
        style={[type.sm, { color: c.text2, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 }]}
      >
        {description}
      </Text>
      {action ? <View style={{ marginTop: spacing.lg }}>{action}</View> : null}
    </View>
  );
}

export const sharedStyles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  stack: { gap: spacing.lg },
  stackSm: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  split: { flexDirection: 'row', gap: spacing.sm },
});
