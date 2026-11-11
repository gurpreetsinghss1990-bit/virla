import { Image, type ImageProps } from 'expo-image';
import { useState } from 'react';
import { MALE_TRAINER_AVATAR_IMAGE, FEMALE_TRAINER_AVATAR_IMAGE } from '../constants/masterTrainerAvatar';

// Stock images shipped before the upload flow existed, plus the old bundled selfie.
const STOCK_AVATAR_MARKERS = [
  'photo-1534528741775',
  'photo-1544005313',
  'photo-1506794778',
  'photo-1568602471122',
  'selfie.jpg',
];

export function defaultAvatarSource(gender?: string) {
  const g = (gender || '').toLowerCase();
  return g === 'female' || g === 'women' ? FEMALE_TRAINER_AVATAR_IMAGE : MALE_TRAINER_AVATAR_IMAGE;
}

export function resolveAvatarSource(rawAvatar?: string | null, gender?: string) {
  const g = (gender || '').toLowerCase();
  const raw = typeof rawAvatar === 'string' ? rawAvatar.trim() : '';

  if (!raw) return defaultAvatarSource(g);
  if (STOCK_AVATAR_MARKERS.some((marker) => raw.includes(marker))) {
    return defaultAvatarSource(g);
  }
  if (/^https?:\/\//i.test(raw) || /^data:/i.test(raw) || /^(file|content|ph):\/\//i.test(raw)) {
    return { uri: raw };
  }
  return defaultAvatarSource(g);
}

/** Same rules as resolveAvatarSource, but always returns a string URI (for posters/video). */

type AvatarImageProps = Omit<ImageProps, 'source'> & {
  uri?: string | null;
  gender?: string;
};

/**
 * Avatar renderer that never leaves an empty circle: anything unloadable
 * (expired bucket URL, stale local file, garbage string) falls back to the
 * gender default.
 */
export function AvatarImage({ uri, gender, onError, ...rest }: AvatarImageProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const failed = failedUri !== null && failedUri === (uri ?? '');

  const source = failed ? defaultAvatarSource(gender) : resolveAvatarSource(uri, gender);

  return (
    <Image
      {...rest}
      source={source}
      onError={(event) => {
        setFailedUri(uri ?? '');
        onError?.(event);
      }}
    />
  );
}
