import { Database } from '../database/Database';
import { Coach, Booking } from '../types';
import { AssignmentConfig } from '../config/AssignmentConfig';
import { getCategoryFromTitle } from '../config/WorkoutMapping';
import { normalizeDate, canonicalizeTimeRange } from '../utils/date';
import { calculateDistanceKm, geocodeAddressSync } from '../utils/distance';

export interface RatedTrainer {
  coach: Coach;
  score: number;
  distance: number;
  breakdown: {
    availability: number;
    distance: number;
    reliability: number;
    rating: number;
    workload: number;
    acceptanceRate: number;
  };
}

export class AssignmentEngine {
  /**
   * Evaluates eligibility and ranks all eligible trainers for a given booking.
   * Highest scoring trainer is first.
   */
  static rankTrainers(booking: Booking): RatedTrainer[] {
    const coaches = Database.getCoaches();
    const bookings = Database.schema.bookings;
    const weights = AssignmentConfig.weights;

    const rated: RatedTrainer[] = [];

    for (const coach of coaches) {
      // 1. Eligibility Checks
      
      // Eligibility Rule 1: Centralized category mapping check
      const targetCategory = getCategoryFromTitle(booking.workoutTitle);
      const assignments = Database.getWorkoutAssignments(coach.id);
      const isCategoryApproved = assignments.some(a => a.workoutCategory === targetCategory && a.status === 'APPROVED');
      const acceptsAll = assignments.some(a => a.workoutCategory === 'All Workouts' && a.status === 'APPROVED');
      if (!acceptsAll && !isCategoryApproved) continue;

      // Eligibility Rule 2: Online status
      const isOnline = coach.preferences?.online !== false;
      if (!isOnline) continue;

      // Eligibility Rule 3: Approved Partner Coach / Active account
      const isApproved = coach.verifiedBadge !== false;
      if (!isApproved) continue;

      // Eligibility Rule 4: No overlapping bookings or active sessions (respecting 30-minute operational buffer)
      const hasOverlap = bookings.some(b => {
        if (b.trainerId !== coach.id) return false; // Match by trainer ID
        if (b.status === 'cancelled') return false;
        
        // Check date overlap
        if (normalizeDate(b.date) !== normalizeDate(booking.date)) return false;
        
        // Check time overlap and buffer
        const bMinutes = this.parseTimeToMinutes(b.time);
        const bookingMinutes = this.parseTimeToMinutes(booking.time);
        const diff = Math.abs(bookingMinutes - bMinutes);
        const duration = b.durationMinutes || 60;
        return diff < (duration + 30);
      });
      if (hasOverlap) continue;

      // Eligibility Rule 5: Travel / Active session conflict detection
      const hasActiveSession = bookings.some(b => {
        if (b.trainerId !== coach.id && b.trainerName !== coach.name) return false;
        if (b.status !== 'upcoming') return false;
        
        const activeStatuses = ['trainer_travelling', 'trainer_arrived', 'otp_verified', 'workout_started'];
        return activeStatuses.includes(b.timelineStatus || '');
      });
      if (hasActiveSession) continue;

      // Eligibility Rule 6: Cooldown rule conflict
      const hasCooldownConflict = bookings.some(b => {
        if (b.trainerId !== coach.id && b.trainerName !== coach.name) return false;
        if (b.status !== 'completed' && b.timelineStatus !== 'workout_completed') return false;
        
        if (normalizeDate(b.date) !== normalizeDate(booking.date)) return false;
        
        const bMinutes = this.parseTimeToMinutes(b.time);
        const bookingMinutes = this.parseTimeToMinutes(booking.time);
        const diff = Math.abs(bookingMinutes - bMinutes);
        
        const sessionDuration = b.durationMinutes || 60;
        return diff < (sessionDuration + AssignmentConfig.cooldownDurationMin);
      });
      if (hasCooldownConflict) continue;

      // Eligibility Rule 7: Inside service radius
      const trainerLat = coach.preferences?.operatingLatitude;
      const trainerLng = coach.preferences?.operatingLongitude;
      const locationStatus = coach.preferences?.operatingLocationStatus;

      let isLocationEligible = false;
      let distance = 0;
      if (locationStatus === 'verified' && trainerLat !== undefined && trainerLng !== undefined) {
        const customerLoc = geocodeAddressSync(booking.address || '');
        distance = calculateDistanceKm(
          trainerLat,
          trainerLng,
          customerLoc.lat,
          customerLoc.lng
        );
        const radiusLimit = coach.preferences?.radiusKm || AssignmentConfig.serviceRadiusKm;
        if (distance <= radiusLimit) {
          isLocationEligible = true;
        }
      }
      if (!isLocationEligible) continue;

      // Eligibility Rule 8: Max daily sessions limit
      const maxSessions = coach.preferences?.maxDailySessions || 5;
      const todaySessionsCount = bookings.filter(b => 
        (b.trainerId === coach.id || b.trainerName === coach.name) && 
        b.status !== 'cancelled' && 
        normalizeDate(b.date) === normalizeDate(booking.date)
      ).length;
      if (todaySessionsCount >= maxSessions) continue;

      // Eligibility Rule 9 is now handled at Rule 1 (Centralized Mapping)

      // 2. Score Calculations (All metric scores normalized out of 100)

      // Availability Score (30%)
      // Check if this slot is in the trainer's calendar availability list
      const hasSlot = coach.availability?.some(slot => canonicalizeTimeRange(slot) === canonicalizeTimeRange(booking.time));
      const availabilityScore = hasSlot ? 100 : 50; // 100 if preferred slot, 50 if generally online

      // Distance Score (25%)
      // Prefer nearest trainers. Max points at <= 2km, decays to 0 at 10km.
      const distanceScore = Math.max(0, 100 - ((distance - 1.5) * (100 / (AssignmentConfig.serviceRadiusKm - 1.5))));

      // Reliability Score (20%)
      // Derived from completed sessions and star rating
      const completedIndex = Math.min(100, (coach.completedSessions || 150) / 4);
      const reliabilityScore = Math.round((completedIndex * 0.4) + (coach.rating * 20 * 0.6));

      // Customer Rating (10%)
      const ratingScore = coach.rating * 20;

      // Current Workload (10%)
      // Count bookings for this coach today
      const todayBookingsCount = bookings.filter(b => 
        (b.trainerId === coach.id || b.trainerName === coach.name) && 
        b.status === 'upcoming' && 
        normalizeDate(b.date) === normalizeDate(booking.date)
      ).length;
      const workloadScore = Math.max(0, 100 - (todayBookingsCount * 25)); // Decays 25% per active booking

      // Recent Acceptance Rate (5%)
      // Seed a stable rating per coach
      const acceptanceRateScore = coach.id === 'c-1' ? 95 : coach.id === 'c-2' ? 90 : coach.id === 'c-3' ? 85 : 80;

      // 3. Weighted Total
      const score = (
        weights.availability * availabilityScore +
        weights.distance * distanceScore +
        weights.reliability * reliabilityScore +
        weights.rating * ratingScore +
        weights.workload * workloadScore +
        weights.acceptanceRate * acceptanceRateScore
      );

      rated.push({
        coach,
        score,
        distance,
        breakdown: {
          availability: availabilityScore,
          distance: distanceScore,
          reliability: reliabilityScore,
          rating: ratingScore,
          workload: workloadScore,
          acceptanceRate: acceptanceRateScore
        }
      });
    }

    // Sort descending by score
    return rated.sort((a, b) => b.score - a.score);
  }

  /**
   * Generates a stable, reproducible simulated distance between a coach and a booking.
   */
  public static getSimulatedDistance(coachId: string, bookingId: string): number {
    let hash = 0;
    const combined = coachId + bookingId;
    for (let i = 0; i < combined.length; i++) {
      hash = combined.charCodeAt(i) + ((hash << 5) - hash);
    }
    const finalHash = Math.abs(hash);
    // Returns distance between 1.5km and 9.5km
    return 1.5 + (finalHash % 80) / 10;
  }

  /**
   * Helper to parse time string like "09:00 AM" into minutes of day.
   */
  private static parseTimeToMinutes(timeStr: string): number {
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 0;
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
}
