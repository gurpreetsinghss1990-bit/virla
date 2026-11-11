import { Image, type ImageProps } from 'expo-image';
import { useState } from 'react';
import { MASTER_TRAINER_AVATAR_IMAGE, MASTER_TRAINER_AVATAR_URI } from '../constants/masterTrainerAvatar';

export const FEMALE_DEFAULT_AVATAR_URI =
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=350&q=80';

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
  if (g === 'female' || g === 'women') return { uri: FEMALE_DEFAULT_AVATAR_URI };
  return MASTER_TRAINER_AVATAR_IMAGE;
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
export function resolveAvatarUri(rawAvatar?: string | null, gender?: string) {
  const source = resolveAvatarSource(rawAvatar, gender);
  return typeof source === 'number' ? MASTER_TRAINER_AVATAR_URI : source.uri;
}

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
