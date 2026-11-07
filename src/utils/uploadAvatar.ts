import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { supabase } from '../database/supabaseClient';
import { assertUploadableFile, safeStorageSegment } from './fileType';

const AVATAR_BUCKET = 'avatars';
const FALLBACK_BUCKET = 'trainer-documents';

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
  const bytes = await readFileBytes(localFileUri);
  const sniffed = assertUploadableFile(bytes, ['jpg', 'png', 'webp', 'heic']);
  const { ext, contentType } = sniffed;

  let bucket = AVATAR_BUCKET;
  let filePath = `${folder}/${safeOwnerId}/avatar.${ext}`;

  let { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, bytes, { contentType, upsert: true });

  // The project's `avatars` bucket may not exist yet; reuse the existing
  // public document bucket so uploads keep working in the meantime.
  if (error && /bucket/i.test(`${error.message ?? ''} ${error.name ?? ''}`)) {
    bucket = FALLBACK_BUCKET;
    filePath = `avatars/${folder}/${safeOwnerId}/avatar.${ext}`;
    ({ error } = await supabase.storage
      .from(bucket)
      .upload(filePath, bytes, { contentType, upsert: true }));
    console.warn(`[uploadAvatar] Bucket "${AVATAR_BUCKET}" missing, used "${FALLBACK_BUCKET}"`);
  }

  if (error) {
    throw new Error(`Avatar upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return `${data.publicUrl}?v=${Date.now()}`;
}
