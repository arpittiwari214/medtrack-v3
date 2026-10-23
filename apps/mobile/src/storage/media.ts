/**
 * Strip photos and voice labels, stored on this phone only.
 *
 * Both are recognition aids for patients who may not read the name on a strip:
 * a photo carries the colours, brand and strength in one picture, and a voice
 * label — "this is the white one for BP", recorded by the patient or a family
 * member — needs no literacy at all.
 *
 * They stay on the device:
 *  - they are personal health data, so keeping them local keeps them out of
 *    breaches, backups and caregiver views unless the patient shows them;
 *  - media would make every sync heavy on intermittent mobile data.
 *
 * shortcut: they do not follow the patient to a new phone or the web app.
 * Syncing them needs object storage, consent for that specific purpose and a
 * size budget — a separate decision, not a side effect of this feature.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

type Index = Record<string, string>;

function createMediaStore(folderName: string, indexKey: string, extension: string) {
  const folder = () => new Directory(Paths.document, folderName);

  async function read(): Promise<Index> {
    try {
      const raw = await AsyncStorage.getItem(indexKey);
      return raw ? (JSON.parse(raw) as Index) : {};
    } catch {
      return {};
    }
  }

  /**
   * Copy a picked or recorded file into the app's own storage. Pickers and
   * recorders write to caches the OS may clear, so keeping their URI would
   * lose the file.
   */
  async function save(medicineId: string, sourceUri: string): Promise<string> {
    const dir = folder();
    if (!dir.exists) dir.create({ intermediates: true });

    // A new name per save, so a view showing the old file cannot keep
    // displaying a cached copy after it is replaced.
    const destination = new File(dir, `${medicineId}-${Date.now()}.${extension}`);
    await new File(sourceUri).copy(destination);

    const index = await read();
    const previous = index[medicineId];
    index[medicineId] = destination.uri;
    await AsyncStorage.setItem(indexKey, JSON.stringify(index));

    if (previous) removeFile(previous);
    return destination.uri;
  }

  async function remove(medicineId: string): Promise<void> {
    const index = await read();
    const uri = index[medicineId];
    if (!uri) return;
    delete index[medicineId];
    await AsyncStorage.setItem(indexKey, JSON.stringify(index));
    removeFile(uri);
  }

  async function removeAll(): Promise<void> {
    await AsyncStorage.removeItem(indexKey);
    const dir = folder();
    if (dir.exists) dir.delete();
  }

  return { read, save, remove, removeAll };
}

function removeFile(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A stray file costs a few kilobytes; failing the save over it would not.
  }
}

export const photoStore = createMediaStore('medicine-photos', 'mt.photos.v1', 'jpg');
export const voiceStore = createMediaStore('medicine-voice', 'mt.voice.v1', 'm4a');

/** Remove every photo and voice label. Used on sign-out, with the rest of the local data. */
export async function deleteAllMedia(): Promise<void> {
  await Promise.all([photoStore.removeAll(), voiceStore.removeAll()]);
}
