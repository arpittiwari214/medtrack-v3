/**
 * Pickers and badges for recognising a medicine by sight.
 *
 * Every swatch carries its word as well as its colour, so colour is never the
 * only signal — red/green confusion is common, and this list includes both.
 */

import {
  DOSE_SLOTS,
  MEDICINE_COLORS,
  MEDICINE_COLOR_HEX,
  MEDICINE_COLOR_LABEL,
  slotNotation,
  slotOf,
  type MedicineColor,
} from '@medtrack/shared';

export function ColorPicker({
  label,
  value,
  onChange,
  name,
}: {
  label: string;
  value: MedicineColor | null;
  onChange: (next: MedicineColor | null) => void;
  name: string;
}) {
  return (
    <fieldset className="field" style={{ border: 'none', padding: 0, margin: 0 }}>
      <legend className="label mb-3">{label}</legend>
      <div className="swatches" role="radiogroup" aria-label={label}>
        {MEDICINE_COLORS.map((color) => {
          const selected = value === color;
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              name={name}
              className="swatch"
              // Tapping the selected swatch again clears it: not every patient
              // knows or cares about the strip colour.
              onClick={() => onChange(selected ? null : color)}
            >
              <span className="swatch-dot" style={{ background: MEDICINE_COLOR_HEX[color] }} />
              {MEDICINE_COLOR_LABEL[color]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** A small colour dot with its word, for lists and dose rows. */
export function ColorDot({ color, size = 12 }: { color: MedicineColor | null | undefined; size?: number }) {
  if (!color) return null;
  return (
    <span
      className="swatch-dot"
      role="img"
      aria-label={MEDICINE_COLOR_LABEL[color]}
      style={{ background: MEDICINE_COLOR_HEX[color], width: size, height: size }}
    />
  );
}

/**
 * Morning / Afternoon / Night, the way Indian prescriptions are written
 * ("1-0-1"). Toggling a slot adds or removes its usual time; the exact clock
 * times stay editable below.
 */
export function SlotPicker({
  times,
  onChange,
}: {
  times: string[];
  onChange: (next: string[]) => void;
}) {
  const active = new Set(times.map(slotOf));

  function toggle(slot: (typeof DOSE_SLOTS)[number]) {
    const next = active.has(slot.id)
      ? times.filter((time) => slotOf(time) !== slot.id)
      : [...times, slot.time];
    // Never leave a scheduled medicine with no times at all.
    onChange((next.length > 0 ? next : times).sort());
  }

  return (
    <div className="field">
      <span className="label">Time of day</span>
      <div className="row row-wrap" style={{ gap: 'var(--s2)' }}>
        {DOSE_SLOTS.map((slot) => (
          <button
            key={slot.id}
            type="button"
            className="slot-toggle"
            aria-pressed={active.has(slot.id)}
            onClick={() => toggle(slot)}
          >
            {slot.label}
          </button>
        ))}
        <span className="t-sm muted numeric" aria-label="Prescription notation">
          {slotNotation(times)}
        </span>
      </div>
    </div>
  );
}
