import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * Public BunnyCDN pull zone URL for Virla static assets.
 * Note: Only public CDN distribution URLs are used in the client app.
 * Storage API/Access keys are never embedded in client source code.
 */
export const BUNNY_CDN_BASE_URL = 'https://virla.b-cdn.net';

export const BUNNY_CDN_ASSETS = {
  TRAINER_VIDEO_KALPESH: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/coach_avatar.mp4`,
  TRAINER_IMAGE_KALPESH: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/coach_kalpesh_transparent.webp`,

  TRAINER_VIDEO_PANKAJ: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/pankaj_yadav.mp4`,
  TRAINER_IMAGE_PANKAJ: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/pankaj_yadav_transparent.webp`,

  TRAINER_VIDEO_ATHARVA: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/aatharva_tawde.mp4`,
  TRAINER_IMAGE_ATHARVA: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/aatharva_tawde_transparent.webp`,

  TRAINER_VIDEO_PARTH: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/parth_thakur.mp4`,
  TRAINER_IMAGE_PARTH: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/parth_thakur_transparent.webp`,

  WORKOUT_BG_STRENGTH: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/strength_bg.mp4`,
};

// In-memory cache map of remote URLs to resolved local disk URIs
const localVideoCache = new Map<string, string>();
const ongoingDownloads = new Map<string, Promise<string>>();

/**
 * Ensures video from BunnyCDN is cached on local disk so it plays with 0 latency
 * and doesn't re-download every time the user opens the screen.
 */
export async function getCachedVideoUri(remoteUrl: string): Promise<string> {
  if (Platform.OS === 'web') {
    return remoteUrl;
  }

  if (localVideoCache.has(remoteUrl)) {
    return localVideoCache.get(remoteUrl)!;
  }

  if (ongoingDownloads.has(remoteUrl)) {
    return ongoingDownloads.get(remoteUrl)!;
  }

  const downloadPromise = (async () => {
    try {
      const cacheDir = `${FileSystem.cacheDirectory}virla_trainer_videos/`;
      const dirInfo = await FileSystem.getInfoAsync(cacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
      }

      // Hash or sanitize filename
      const cleanName = remoteUrl.split('/').pop()?.split('?')[0] || 'cached_video.mp4';
      const fileUri = `${cacheDir}${cleanName}`;

      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists && (fileInfo as any).size > 1000) {
        localVideoCache.set(remoteUrl, fileUri);
        return fileUri;
      }

      // Download from BunnyCDN pull zone to phone storage
      const result = await FileSystem.downloadAsync(remoteUrl, fileUri);
      if (result.status === 200) {
        localVideoCache.set(remoteUrl, result.uri);
        return result.uri;
      }

      return remoteUrl;
    } catch (e) {
      console.warn('[BunnyCDN Cache] Fallback to remote stream:', e);
      return remoteUrl;
    } finally {
      ongoingDownloads.delete(remoteUrl);
    }
  })();

  ongoingDownloads.set(remoteUrl, downloadPromise);
  return downloadPromise;
}

