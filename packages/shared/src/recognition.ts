/**
 * Recognising a medicine by sight.
 *
 * In a 901-patient Indian survey, patients identified their medicines by pill
 * colour (29.4%), strip colour (28.4%) and brand name (28.0%) — and among those
 * educated to high school or below, by colour 71% of the time and by name only
 * 11.9%. 59.3% confused look-alike medicines. So a medicine carries the colours
 * the patient sees and their own word for what it is for, and those lead the
 * display wherever a dose is shown; the name supports them rather than the
 * other way round.
 *
 * Colours are a fixed list rather than a picker: a list can carry a word for
 * every swatch, so colour is never the only signal (red/green confusion is
 * common), and it keeps web and phone identical.
 */

export const MEDICINE_COLORS = [
  'white',
  'yellow',
  'orange',
  'pink',
  'red',
  'brown',
  'green',
  'blue',
  'purple',
  'black',
  'silver',
  'gold',
] as const;

export type MedicineColor = (typeof MEDICINE_COLORS)[number];

/** Swatch fill for each colour. Physical-object colours, not a data palette. */
export const MEDICINE_COLOR_HEX: Record<MedicineColor, string> = {
  white: '#ffffff',
  yellow: '#f5d04c',
  orange: '#f08a3c',
  pink: '#f2a7c3',
  red: '#d9433d',
  brown: '#8b5a3c',
  green: '#3fa34d',
  blue: '#3d7dd8',
  purple: '#8357c7',
  black: '#222222',
  silver: '#c0c4c8',
  gold: '#d4af37',
};

/** The word shown beside every swatch. */
export const MEDICINE_COLOR_LABEL: Record<MedicineColor, string> = {
  white: 'White',
  yellow: 'Yellow',
  orange: 'Orange',
  pink: 'Pink',
  red: 'Red',
  brown: 'Brown',
  green: 'Green',
  blue: 'Blue',
  purple: 'Purple',
  black: 'Black',
  silver: 'Silver',
  gold: 'Gold',
};

interface Recognisable {
  name: string;
  strength?: string | null;
  form?: string | null;
  pillColor?: MedicineColor | null;
  purpose?: string | null;
}

/**
 * A short description a patient will recognise: "White tablet for BP".
 *
 * Falls back to the name when there is nothing visual to say. Used as the
 * headline on reminders and dose cards, with the name beneath it.
 */
export function describeMedicine(medicine: Recognisable): string {
  const form = medicine.form && medicine.form !== 'other' ? medicine.form : 'medicine';
  const purpose = medicine.purpose?.trim();

  if (medicine.pillColor) {
    const look = `${MEDICINE_COLOR_LABEL[medicine.pillColor]} ${form}`;
    return purpose ? `${look} for ${purpose}` : look;
  }
  return purpose ? `${medicine.name} for ${purpose}` : medicine.name;
}

/* ─────────────────────────── Time-of-day slots ──────────────────────────── */

/**
 * The slots Indian prescriptions are written in.
 *
 * "1-0-1" means morning and night; "1-1-1" morning, afternoon and night. It is
 * how doctors write and pharmacists explain, so it is how the app asks — the
 * clock times underneath stay editable.
 */
export const DOSE_SLOTS = [
  { id: 'morning', label: 'Morning', time: '08:00' },
  { id: 'afternoon', label: 'Afternoon', time: '14:00' },
  { id: 'night', label: 'Night', time: '21:00' },
] as const;

export type DoseSlot = (typeof DOSE_SLOTS)[number]['id'];

/** Which slot a clock time belongs to. */
export function slotOf(localTime: string): DoseSlot {
  const hour = Number(localTime.slice(0, 2));
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'night';
}

/** "1-0-1" style notation for a set of dose times. */
export function slotNotation(times: readonly string[]): string {
  const taken = new Set(times.map(slotOf));
  return DOSE_SLOTS.map((slot) => (taken.has(slot.id) ? '1' : '0')).join('-');
}
