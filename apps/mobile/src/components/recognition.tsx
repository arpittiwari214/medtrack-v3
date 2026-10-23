/**
 * Recognising a medicine by sight, on the phone.
 *
 * Mirrors apps/web/src/components/recognition.tsx. Every swatch carries its word,
 * so colour is never the only signal.
 */

import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import {
  DOSE_SLOTS,
  MEDICINE_COLORS,
  MEDICINE_COLOR_HEX,
  MEDICINE_COLOR_LABEL,
  formatTime12h,
  slotNotation,
  slotOf,
  type MedicineColor,
} from '@medtrack/shared';
import { MIN_TOUCH, TABULAR, radius, spacing, type, useTheme } from '../theme';
import { Pill } from './icons';

export function ColorDot({ color, size = 12 }: { color: MedicineColor | null | undefined; size?: number }) {
  if (!color) return null;
  return (
    <View
      accessibilityLabel={MEDICINE_COLOR_LABEL[color]}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: MEDICINE_COLOR_HEX[color],
        // White and silver pills need an edge to show on a white surface.
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.22)',
      }}
    />
  );
}

export function ColorSwatches({
  label,
  value,
  onChange,
}: {
  label: string;
  value: MedicineColor | null;
  onChange: (next: MedicineColor | null) => void;
}) {
  const c = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[type.sm, { color: c.text, fontWeight: '600' }]}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {MEDICINE_COLORS.map((color) => {
          const selected = value === color;
          return (
            <Pressable
              key={color}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${label}: ${MEDICINE_COLOR_LABEL[color]}`}
              // Tapping the chosen colour again clears it.
              onPress={() => onChange(selected ? null : color)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                minHeight: MIN_TOUCH,
                paddingHorizontal: spacing.md,
                borderRadius: radius.sm,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? c.brand : c.borderStrong,
                backgroundColor: c.surface,
              }}
            >
              <ColorDot color={color} size={18} />
              <Text style={[type.sm, { color: c.text, fontWeight: '600' }]}>
                {MEDICINE_COLOR_LABEL[color]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** The strip photo when there is one, otherwise a colour block, otherwise an icon. */
export function MedicinePhoto({
  uri,
  color,
  size = 72,
}: {
  uri: string | undefined;
  color: MedicineColor | null | undefined;
  size?: number;
}) {
  const c = useTheme();
  if (uri) {
    return (
      <Image
        source={{ uri }}
        accessibilityLabel="Photo of the strip"
        style={{ width: size, height: size, borderRadius: radius.md, backgroundColor: c.surface2 }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        backgroundColor: c.surface2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {color ? <ColorDot color={color} size={size * 0.45} /> : <Pill size={size * 0.4} color={c.text3} />}
    </View>
  );
}

const STEP_MINUTES = 15;

function shift(localTime: string, minutes: number): string {
  const [h, m] = localTime.split(':').map(Number) as [number, number];
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Morning / Afternoon / Night, the way Indian prescriptions are written
 * ("1-0-1"), with each chosen time adjustable by large − / + buttons.
 * Steppers rather than a clock picker: easier for older hands, and no extra
 * native dependency for one form.
 */
export function SlotPicker({ times, onChange }: { times: string[]; onChange: (next: string[]) => void }) {
  const c = useTheme();
  const bySlot = new Map(times.map((time) => [slotOf(time), time]));

  function toggle(slot: (typeof DOSE_SLOTS)[number]) {
    const next = bySlot.has(slot.id)
      ? times.filter((time) => slotOf(time) !== slot.id)
      : [...times, slot.time];
    onChange(next.sort());
  }

  function adjust(time: string, minutes: number) {
    onChange(times.map((t) => (t === time ? shift(time, minutes) : t)).sort());
  }

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[type.sm, { color: c.text, fontWeight: '600' }]}>When do you take it?</Text>
        <Text style={[type.sm, TABULAR, { color: c.text2 }]}>{slotNotation(times)}</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {DOSE_SLOTS.map((slot) => {
          const on = bySlot.has(slot.id);
          return (
            <Pressable
              key={slot.id}
              accessibilityRole="switch"
              accessibilityState={{ checked: on }}
              onPress={() => toggle(slot)}
              style={{
                flex: 1,
                minHeight: 52,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: on ? c.brandStrong : c.borderStrong,
                backgroundColor: on ? c.brandStrong : c.surface,
              }}
            >
              <Text style={[type.sm, { color: on ? c.onBrand : c.text2, fontWeight: '700' }]}>
                {slot.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView scrollEnabled={false} contentContainerStyle={{ gap: spacing.sm }}>
        {times.map((time) => (
          <View
            key={time}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              padding: spacing.sm,
              borderRadius: radius.sm,
              backgroundColor: c.surface2,
            }}
          >
            <Stepper label="−" accessibilityLabel={`Earlier than ${formatTime12h(time)}`} onPress={() => adjust(time, -STEP_MINUTES)} />
            <Text style={[type.lg, TABULAR, { flex: 1, textAlign: 'center', color: c.text }]}>
              {formatTime12h(time)}
            </Text>
            <Stepper label="+" accessibilityLabel={`Later than ${formatTime12h(time)}`} onPress={() => adjust(time, STEP_MINUTES)} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function Stepper({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 52,
        height: 52,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: c.borderStrong,
        backgroundColor: pressed ? c.surface3 : c.surface,
      })}
    >
      <Text style={{ fontSize: 24, fontWeight: '600', color: c.text }}>{label}</Text>
    </Pressable>
  );
}
