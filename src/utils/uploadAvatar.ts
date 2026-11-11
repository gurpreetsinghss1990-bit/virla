import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { supabase } from '../database/supabaseClient';
import { assertUploadableFile, safeStorageSegment } from './fileType';
import { AVATAR_MAX_WIDTH, compressImageForUpload } from './imageCompression';

const AVATAR_BUCKET = 'avatars';

async function readFileBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    return res.arrayBuffer();
  }
  try {
    return await new File(uri).arrayBuffer();
  } catch {
    const res = await fetch(uri);
    return res.arrayBuffer();
  }
}

/**
 * Uploads a locally picked image to the `avatars` bucket and returns a
 * permanent public HTTPS URL. The URL carries a `?v=` stamp so a replaced
 * photo bypasses the image cache while untouched photos stay cached on disk.
 */
export async function uploadAvatarToStorage(
  localFileUri: string,
  ownerId: string,
  folder: 'users' | 'trainers' = 'users'
): Promise<string> {
  if (!localFileUri) throw new Error('No image selected');
  if (!ownerId) throw new Error('Missing owner id');
  if (/^https?:\/\//i.test(localFileUri)) return localFileUri;

  const safeOwnerId = safeStorageSegment(ownerId);
  const compressedUri = await compressImageForUpload(localFileUri, {
    maxWidth: AVATAR_MAX_WIDTH,
    quality: 0.7,
  });
  const bytes = await readFileBytes(compressedUri);
  const sniffed = assertUploadableFile(bytes, ['jpg', 'png', 'webp', 'heic']);
  const { ext, contentType } = sniffed;

  const filePath = `${folder}/${safeOwnerId}/avatar.${ext}`;

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(filePath, bytes, { contentType, upsert: true });

  if (error) {
    // Never persist a URL we could not actually write: a private/absent bucket
    // yields a public URL that renders as a blank avatar.
    throw new Error(`Avatar upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);
  return `${data.publicUrl}?v=${Date.now()}`;
}
