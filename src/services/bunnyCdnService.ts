import { Platform } from 'react-native';

/**
 * Public BunnyCDN pull zone URL for Virla static assets.
 * Note: Only public CDN distribution URLs are used in the client app.
 * Storage API/Access keys are never embedded in client source code.
 */
export const BUNNY_CDN_BASE_URL = 'https://virla.b-cdn.net';

export const BUNNY_CDN_ASSETS = {
  TRAINER_VIDEO_KALPESH: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/coach_avatar_v2.mp4`,
  TRAINER_IMAGE_KALPESH: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/coach_kalpesh_transparent.webp`,

  TRAINER_VIDEO_PRANAY: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/pranay_sardesai_v2.mp4`,
  TRAINER_IMAGE_PRANAY: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/pranay_sardesai_transparent.webp`,

  TRAINER_VIDEO_SHIVANI: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/shivani_gupta_v2.mp4`,
  TRAINER_IMAGE_SHIVANI: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/shivani_gupta_transparent.webp`,

  TRAINER_VIDEO_MAYUR: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/mayur_bhosle_v2.mp4`,
  TRAINER_IMAGE_MAYUR: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/mayur_bhosle_transparent.webp`,

  TRAINER_VIDEO_PANKAJ: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/pankaj_yadav.mp4`,
  TRAINER_IMAGE_PANKAJ: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/pankaj_yadav_transparent.webp`,

  TRAINER_VIDEO_ATHARVA: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/aatharva_tawde.mp4`,
  TRAINER_IMAGE_ATHARVA: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/aatharva_tawde_transparent.webp`,

  TRAINER_VIDEO_PARTH: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/parth_thakur.mp4`,
  TRAINER_IMAGE_PARTH: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/parth_thakur_transparent.webp`,

  WORKOUT_BG_STRENGTH: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/strength_bg.mp4`,
  WORKOUT_BG_YOGA: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/yoga_bg.mp4`,
  WORKOUT_BG_RHYTHM: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/rhythm_bg.mp4`,
  WORKOUT_BG_BOXING: `${BUNNY_CDN_BASE_URL}/Trainer%20Videos/boxing_bg.mp4`,
};

/**
 * Trainer identity -> media. Keyed by a normalized token found in the trainer's
 * name or id so a card can never play another trainer's clip.
 */
const TRAINER_MEDIA_MAP: Record<string, { video: string; thumb: string }> = {
  kalpesh: { video: BUNNY_CDN_ASSETS.TRAINER_VIDEO_KALPESH, thumb: BUNNY_CDN_ASSETS.TRAINER_IMAGE_KALPESH },
  pranay: { video: BUNNY_CDN_ASSETS.TRAINER_VIDEO_PRANAY, thumb: BUNNY_CDN_ASSETS.TRAINER_IMAGE_PRANAY },
  shivani: { video: BUNNY_CDN_ASSETS.TRAINER_VIDEO_SHIVANI, thumb: BUNNY_CDN_ASSETS.TRAINER_IMAGE_SHIVANI },
  mayur: { video: BUNNY_CDN_ASSETS.TRAINER_VIDEO_MAYUR, thumb: BUNNY_CDN_ASSETS.TRAINER_IMAGE_MAYUR },
  pankaj: { video: BUNNY_CDN_ASSETS.TRAINER_VIDEO_PANKAJ, thumb: BUNNY_CDN_ASSETS.TRAINER_IMAGE_PANKAJ },
  atharva: { video: BUNNY_CDN_ASSETS.TRAINER_VIDEO_ATHARVA, thumb: BUNNY_CDN_ASSETS.TRAINER_IMAGE_ATHARVA },
  aatharva: { video: BUNNY_CDN_ASSETS.TRAINER_VIDEO_ATHARVA, thumb: BUNNY_CDN_ASSETS.TRAINER_IMAGE_ATHARVA },
  parth: { video: BUNNY_CDN_ASSETS.TRAINER_VIDEO_PARTH, thumb: BUNNY_CDN_ASSETS.TRAINER_IMAGE_PARTH },
};

export function getTrainerMedia(...keys: (string | null | undefined)[]) {
  const haystack = keys.filter(Boolean).join(' ').toLowerCase();
  if (!haystack) return null;
  for (const token of Object.keys(TRAINER_MEDIA_MAP)) {
    if (haystack.includes(token)) return TRAINER_MEDIA_MAP[token];
  }
  return null;
}

/**
 * Resolves video URI: Returns direct BunnyCDN URL immediately for instant playback
 * without waiting for disk caching or download failures.
 */
export function getDirectVideoUri(remoteUrl: string): string {
  return remoteUrl;
}

