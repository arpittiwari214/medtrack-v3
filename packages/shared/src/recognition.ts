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

/* ──────────────────────────────── Languages ─────────────────────────────── */

/**
 * Languages the interface is translated into. Hindi first: it is the largest
 * Indian-language user base by every estimate the research found, and the
 * sequence (then Marathi, Bengali, Tamil, Telugu) holds across sources.
 *
 * Translations must be reviewed by a native speaker before release; they
 * were written carefully but not by one.
 */
export type Locale = 'en' | 'hi';

/** Pick a supported locale from a BCP-47 tag such as "hi-IN". */
export function localeFrom(tag: string | null | undefined): Locale {
  return tag?.toLowerCase().startsWith('hi') ? 'hi' : 'en';
}

/**
 * Hindi colour words in their masculine form. Adjectives ending in -ā take -ī
 * before a feminine noun (पीला कैप्सूल, पीली गोली); the rest do not change.
 */
const HINDI_COLOR: Record<MedicineColor, string> = {
  white: 'सफ़ेद',
  yellow: 'पीला',
  orange: 'नारंगी',
  pink: 'गुलाबी',
  red: 'लाल',
  brown: 'भूरा',
  green: 'हरा',
  blue: 'नीला',
  purple: 'बैंगनी',
  black: 'काला',
  silver: 'सिल्वर',
  gold: 'सुनहरा',
};

const HINDI_FORM: Record<string, { word: string; feminine: boolean }> = {
  tablet: { word: 'गोली', feminine: true },
  capsule: { word: 'कैप्सूल', feminine: false },
  liquid: { word: 'सिरप', feminine: false },
  injection: { word: 'इंजेक्शन', feminine: false },
  inhaler: { word: 'इनहेलर', feminine: false },
  drops: { word: 'ड्रॉप्स', feminine: true },
  patch: { word: 'पैच', feminine: false },
  cream: { word: 'क्रीम', feminine: true },
  medicine: { word: 'दवा', feminine: true },
};

function hindiColor(color: MedicineColor, feminine: boolean): string {
  const word = HINDI_COLOR[color];
  return feminine && word.endsWith('ा') ? `${word.slice(0, -1)}ी` : word;
}

/** The word for a colour, in a locale. Shown beside every swatch. */
export function colorLabel(color: MedicineColor, locale: Locale = 'en'): string {
  return locale === 'hi' ? HINDI_COLOR[color] : MEDICINE_COLOR_LABEL[color];
}

interface Recognisable {
  name: string;
  strength?: string | null;
  form?: string | null;
  pillColor?: MedicineColor | null;
  purpose?: string | null;
  person?: string | null;
}

/**
 * A short description a patient will recognise: "White tablet for BP",
 * "सफ़ेद गोली — BP के लिए".
 *
 * Falls back to the name when there is nothing visual to say. Used as the
 * headline on reminders and dose cards, with the name beneath it.
 */
export function describeMedicine(medicine: Recognisable, locale: Locale = 'en'): string {
  // On a phone shared by a family, whose medicine it is comes first.
  const person = medicine.person?.trim();
  const look = describeLook(medicine, locale);
  return person ? `${person}: ${look}` : look;
}

function describeLook(medicine: Recognisable, locale: Locale): string {
  const form = medicine.form && medicine.form !== 'other' ? medicine.form : 'medicine';
  const purpose = medicine.purpose?.trim();

  if (locale === 'hi') {
    const noun = HINDI_FORM[form] ?? HINDI_FORM['medicine']!;
    const subject = medicine.pillColor
      ? `${hindiColor(medicine.pillColor, noun.feminine)} ${noun.word}`
      : medicine.name;
    return purpose ? `${subject} — ${purpose} के लिए` : subject;
  }

  if (medicine.pillColor) {
    const look = `${MEDICINE_COLOR_LABEL[medicine.pillColor]} ${form}`;
    return purpose ? `${look} for ${purpose}` : look;
  }
  return purpose ? `${medicine.name} for ${purpose}` : medicine.name;
}

/**
 * A clock time the way it is said: "8:00 AM", "सुबह 8:00".
 *
 * Western digits in every language — they are the platform default, what
 * urban users prefer, and what is printed on the strip the patient is holding.
 * Hindi leads with the part of the day rather than AM/PM, which is how a time
 * is actually spoken ("रात 9 बजे").
 */
export function formatTimeFor(localTime: string, locale: Locale = 'en'): string {
  const [hourText = '0', minute = '00'] = localTime.split(':');
  const hour = Number(hourText);
  const twelve = hour % 12 === 0 ? 12 : hour % 12;

  if (locale !== 'hi') return `${twelve}:${minute} ${hour < 12 ? 'AM' : 'PM'}`;

  const part =
    hour < 4 ? 'रात' : hour < 12 ? 'सुबह' : hour < 16 ? 'दोपहर' : hour < 19 ? 'शाम' : 'रात';
  return `${part} ${twelve}:${minute}`;
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
  { id: 'morning', label: 'Morning', labelHi: 'सुबह', time: '08:00' },
  { id: 'afternoon', label: 'Afternoon', labelHi: 'दोपहर', time: '14:00' },
  { id: 'night', label: 'Night', labelHi: 'रात', time: '21:00' },
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
