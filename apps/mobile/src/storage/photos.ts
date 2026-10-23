/**
 * Strip photos, stored on this phone only.
 *
 * A photo of the strip is the best recognition aid a low-literacy patient can
 * have — one picture carries the pill colour, strip colour, brand and strength
 * at once. It stays on the device:
 *
 *  - it is personal health data, and keeping it local means it is never in a
 *    breach, a backup or a caregiver's view unless the patient shows it;
 *  - images would make every sync heavy on intermittent mobile data.
 *
 * shortcut: photos do not follow the patient to a new phone or the web app.
 * Syncing them needs object storage, consent for that specific purpose, and a
 * size budget — a separate decision, not a side effect of this feature.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

const INDEX_KEY = 'mt.photos.v1';
const folder = () => new Directory(Paths.document, 'medicine-photos');

type PhotoIndex = Record<string, string>;

async function readIndex(): Promise<PhotoIndex> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as PhotoIndex) : {};
  } catch {
    return {};
  }
}

/** Every saved photo, by medicine id. */
export async function readPhotos(): Promise<PhotoIndex> {
  return readIndex();
}

/**
 * Copy a picked image into the app's own storage. The picker's file lives in a
 * cache the OS may clear at any time, so keeping its URI would lose the photo.
 */
export async function savePhoto(medicineId: string, pickedUri: string): Promise<string> {
  const dir = folder();
  if (!dir.exists) dir.create({ intermediates: true });

  // A new name per save, so an image view showing the old photo cannot keep
  // displaying a cached copy after the patient retakes it.
  const destination = new File(dir, `${medicineId}-${Date.now()}.jpg`);
  await new File(pickedUri).copy(destination);

  const index = await readIndex();
  const previous = index[medicineId];
  index[medicineId] = destination.uri;
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));

  if (previous) removeFile(previous);
  return destination.uri;
}

export async function deletePhoto(medicineId: string): Promise<void> {
  const index = await readIndex();
  const uri = index[medicineId];
  if (!uri) return;
  delete index[medicineId];
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
  removeFile(uri);
}

/** Remove every photo. Used on sign-out, with the rest of the local data. */
export async function deleteAllPhotos(): Promise<void> {
  await AsyncStorage.removeItem(INDEX_KEY);
  const dir = folder();
  if (dir.exists) dir.delete();
}

function removeFile(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A stray file costs a few kilobytes; failing the save over it would not.
  }
}
