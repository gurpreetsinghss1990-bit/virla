import { Coach } from '../types';
import { calculateDistanceKm, trainerServiceRadiusKm } from './distance';

/**
 * Single source of truth for "is this place inside Virla's service area?".
 * A place is served when at least one trainer's operating base is within that
 * trainer's own radius (capped at 5 km). Same rule everywhere: booking,
 * saved addresses and the assignment engine.
 */
export function isAreaServedByAnyTrainer(
  lat?: number | null,
  lng?: number | null,
  coaches?: Coach[] | null
): boolean {
  if (lat === undefined || lat === null || lng === undefined || lng === null) return false;
  if (!lat || !lng || !coaches?.length) return false;

  for (const coach of coaches) {
    const trainerLat = coach?.preferences?.operatingLatitude;
    const trainerLng = coach?.preferences?.operatingLongitude;
    if (trainerLat === undefined || trainerLat === null || trainerLng === undefined || trainerLng === null) {
      continue;
    }
    const distKm = calculateDistanceKm(lat, lng, trainerLat, trainerLng);
    if (distKm <= trainerServiceRadiusKm(coach.preferences?.radiusKm)) return true;
  }

  return false;
}
