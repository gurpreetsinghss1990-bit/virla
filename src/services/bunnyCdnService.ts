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

  TRAINER_VIDEO_PRANAY: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/pranay_sardesai.mp4`,
  TRAINER_IMAGE_PRANAY: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/pranay_sardesai_transparent.webp`,

  TRAINER_VIDEO_SHIVANI: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/shivani_gupta.mp4`,
  TRAINER_IMAGE_SHIVANI: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/shivani_gupta_transparent.webp`,

  TRAINER_VIDEO_MAYUR: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/mayur_bhosle.mp4`,
  TRAINER_IMAGE_MAYUR: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/mayur_bhosle_transparent.webp`,

  TRAINER_VIDEO_PANKAJ: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/pankaj_yadav.mp4`,
  TRAINER_IMAGE_PANKAJ: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/pankaj_yadav_transparent.webp`,

  TRAINER_VIDEO_ATHARVA: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/aatharva_tawde.mp4`,
  TRAINER_IMAGE_ATHARVA: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/aatharva_tawde_transparent.webp`,

  TRAINER_VIDEO_PARTH: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/parth_thakur.mp4`,
  TRAINER_IMAGE_PARTH: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/parth_thakur_transparent.webp`,

  WORKOUT_BG_STRENGTH: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/strength_bg.mp4`,
};

/**
 * Resolves video URI: Returns direct BunnyCDN URL immediately for instant playback
 * without waiting for disk caching or download failures.
 */
export function getDirectVideoUri(remoteUrl: string): string {
  return remoteUrl;
}

