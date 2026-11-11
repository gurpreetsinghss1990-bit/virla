import { useCoachStore } from '../store/coachStore';
import { resolveAvatarSource, resolveAvatarUri } from '../components/AvatarImage';

/**
 * One source of truth for a trainer's picture.
 * Prefers the live coach record (so a freshly uploaded photo shows
 * everywhere immediately) and falls back to the booking snapshot, then to
 * the shared gender default. Stock/placeholder URLs are ignored.
 */
export function useTrainerAvatar(
  trainerId?: string | null,
  snapshotPhoto?: string | null,
  gender?: string,
) {
  const livePhoto = useCoachStore((s) =>
    trainerId ? s.coaches.find((c) => c.id === trainerId)?.photo : undefined,
  );
  const liveGender = useCoachStore((s) =>
    trainerId ? s.coaches.find((c) => c.id === trainerId)?.gender : undefined,
  );

  const photo = livePhoto || snapshotPhoto || '';
  const g = liveGender || gender;
  return { source: resolveAvatarSource(photo, g), uri: resolveAvatarUri(photo, g) };
}

export { resolveAvatarSource, resolveAvatarUri };
