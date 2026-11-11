import { Image, type ImageProps } from 'expo-image';
import { useState } from 'react';
import { MALE_TRAINER_AVATAR_IMAGE, FEMALE_TRAINER_AVATAR_IMAGE } from '../constants/masterTrainerAvatar';

// Anything pointing at a stock-photo host is a placeholder, never a real upload.
const isPlaceholderAvatar = (raw: string) =>
  raw.includes('images.unsplash.com') || raw.includes('selfie.jpg');

export function defaultAvatarSource(gender?: string) {
  const g = (gender || '').toLowerCase();
  return g === 'female' || g === 'women' ? FEMALE_TRAINER_AVATAR_IMAGE : MALE_TRAINER_AVATAR_IMAGE;
}

export function resolveAvatarSource(rawAvatar?: string | null, gender?: string) {
  const g = (gender || '').toLowerCase();
  const raw = typeof rawAvatar === 'string' ? rawAvatar.trim() : '';

  if (!raw) return defaultAvatarSource(g);
  if (isPlaceholderAvatar(raw)) {
    return defaultAvatarSource(g);
  }
  if (/^https?:\/\//i.test(raw) || /^data:/i.test(raw) || /^(file|content|ph):\/\//i.test(raw)) {
    return { uri: raw };
  }
  return defaultAvatarSource(g);
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
