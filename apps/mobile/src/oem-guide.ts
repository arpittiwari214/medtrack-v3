/**
 * Per-manufacturer steps to stop the phone killing reminders.
 *
 * Roughly eight in ten Indian phones run a vendor skin that restricts
 * background apps (dontkillmyapp.com). A generic "disable battery optimisation"
 * dialog does not work, because every vendor hides the switch somewhere
 * different and some need two or three separate switches.
 *
 * Paths come from dontkillmyapp.com and vendor documentation, and they move
 * between OS versions — they must be re-checked on real devices.
 *
 * Pure: no Expo imports, so `node --test` can exercise it.
 */

export type Vendor = 'xiaomi' | 'oppo' | 'vivo' | 'realme' | 'oneplus' | 'samsung' | 'motorola' | 'other';

export interface VendorGuide {
  vendor: Vendor;
  /** Name shown to the patient. */
  label: string;
  /** How aggressively this skin kills background apps, 0–5 (dontkillmyapp). */
  severity: number;
  steps: string[];
}

const GUIDES: Record<Vendor, Omit<VendorGuide, 'vendor'>> = {
  xiaomi: {
    label: 'Xiaomi, Redmi or POCO',
    severity: 5,
    steps: [
      'Settings → Apps → MedTrack → Autostart: turn ON.',
      'Settings → Apps → MedTrack → Battery saver: choose "No restrictions".',
      'Open recent apps, long-press MedTrack and tap the lock icon so it is never cleared.',
    ],
  },
  oppo: {
    label: 'OPPO',
    severity: 4,
    steps: [
      'Settings → Apps → MedTrack → Battery usage: allow "Run in background".',
      'Settings → Apps → MedTrack → Allow auto-launch: turn ON.',
      'Open recent apps and lock MedTrack.',
    ],
  },
  vivo: {
    label: 'vivo or iQOO',
    severity: 3,
    steps: [
      'Settings → Battery → Background power consumption management → MedTrack: allow.',
      'Settings → Apps → Autostart → MedTrack: turn ON.',
      'Settings → Apps → MedTrack → Battery: set to "Unrestricted".',
    ],
  },
  realme: {
    label: 'realme',
    severity: 3,
    steps: [
      'Settings → Battery → App battery management → MedTrack: allow auto-launch and background activity.',
      'Settings → Battery → Power saver options → turn OFF "Sleep stand-by optimisation". This one silences night-time reminders.',
      'Open recent apps and lock MedTrack.',
    ],
  },
  oneplus: {
    label: 'OnePlus',
    severity: 5,
    steps: [
      'Settings → Battery → Battery optimisation → MedTrack: "Don\'t optimise".',
      'Settings → Apps → MedTrack → Battery usage: allow background activity.',
      'Open recent apps and lock MedTrack.',
    ],
  },
  samsung: {
    label: 'Samsung',
    severity: 5,
    steps: [
      'Settings → Battery → Background usage limits → Never sleeping apps: add MedTrack.',
      'Make sure MedTrack is NOT in "Sleeping apps" or "Deep sleeping apps".',
      'Samsung can undo this after a software update — check again if reminders stop.',
    ],
  },
  motorola: {
    label: 'Motorola',
    severity: 3,
    steps: ['Settings → Apps → MedTrack → Battery: set to "Unrestricted".'],
  },
  other: {
    label: 'your phone',
    severity: 1,
    steps: ['Settings → Apps → MedTrack → Battery: set to "Unrestricted" or "Not optimised".'],
  },
};

/** Map `Device.manufacturer` (free text from the vendor) to a guide. */
export function guideFor(manufacturer: string | null | undefined): VendorGuide {
  const name = (manufacturer ?? '').toLowerCase();

  let vendor: Vendor = 'other';
  if (/xiaomi|redmi|poco/.test(name)) vendor = 'xiaomi';
  else if (/realme/.test(name)) vendor = 'realme';
  else if (/oneplus/.test(name)) vendor = 'oneplus';
  else if (/oppo/.test(name)) vendor = 'oppo';
  else if (/vivo|iqoo/.test(name)) vendor = 'vivo';
  else if (/samsung/.test(name)) vendor = 'samsung';
  else if (/motorola|lenovo/.test(name)) vendor = 'motorola';

  return { vendor, ...GUIDES[vendor] };
}
