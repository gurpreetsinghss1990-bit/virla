import { Database } from '../database/Database';
import { Booking } from '../types';
import { supabase } from '../database/supabaseClient';
import { normalizeDate } from '../utils/date';

export class SessionEngine {
  static TRAVEL_WINDOW_MINUTES = 25;

  /**
   * Checks if current time is inside the pre-session travel window.
   * Lock opens 25 minutes before scheduled start time.
   */
  static isTravelWindowOpen(booking: Booking): boolean {
    if (!booking) return false;
    return this.getMinutesToSession(booking) <= this.TRAVEL_WINDOW_MINUTES;
  }

  /**
   * Helper to parse booking date and time into a native Javascript Date object.
   */
  static getSessionStartDate(booking: Booking): Date {
    try {
      if (!booking) return new Date();
      
      const dateStr = normalizeDate(booking.date);
      if (!dateStr) return new Date();
      
      const timePart = booking.time.split('-')[0].trim();
      const match = timePart.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        
        const [year, month, day] = dateStr.split('-').map(x => parseInt(x, 10));
        const d = new Date(year, month - 1, day, hours, minutes, 0, 0);
        if (!isNaN(d.getTime())) {
          return d;
        }
      }
    } catch (e) {
      console.log('[SESSION ENGINE] Error parsing date:', e);
    }
    
    // Default fallback: 2 hours in the future
    const fallback = new Date();
    fallback.setHours(fallback.getHours() + 2);
    return fallback;
  }

  /**
   * Returns difference in minutes between current time and the scheduled session start time.
   */
  static getMinutesToSession(booking: Booking): number {
    const sessionDate = this.getSessionStartDate(booking);
    const now = new Date();
    return (sessionDate.getTime() - now.getTime()) / (1000 * 60);
  }

  /**
   * Returns the valid start window (±30 minutes) around the booked start time.
   */
  static getSessionWindow(booking: Booking): { start: Date; end: Date; booked: Date } {
    const booked = this.getSessionStartDate(booking);
    const start = new Date(booked.getTime() - 30 * 60 * 1000);
    const end = new Date(booked.getTime() + 30 * 60 * 1000);
    return { start, end, booked };
  }

  /**
   * Checks if current time is within ±30 minutes of the booked start time.
   */
  static isWithinStartWindow(booking: Booking): boolean {
    const { start, end } = this.getSessionWindow(booking);
    const now = new Date();
    return now.getTime() >= start.getTime() && now.getTime() <= end.getTime();
  }

  /**
   * Checks if current time is before the valid session start window.
   */
  static isBeforeStartWindow(booking: Booking): boolean {
    const { start } = this.getSessionWindow(booking);
    const now = new Date();
    return now.getTime() < start.getTime();
  }

  /**
   * Checks if current time is past the valid session start window.
   */
  static isAfterStartWindow(booking: Booking): boolean {
    const { end } = this.getSessionWindow(booking);
    const now = new Date();
    return now.getTime() > end.getTime();
  }

  /**
   * Check-in can happen MAXIMUM 30 minutes before the scheduled session, up to the end of the window.
   */
  static canCheckIn(booking: Booking): boolean {
    if (booking.status !== 'upcoming') return false;
    const now = Date.now();
    const { start, end } = this.getSessionWindow(booking);
    return now >= start.getTime() && now <= end.getTime();
  }

  /**
   * Performs the Check-In action for the trainer.
   * Generates a unique 6-digit OTP, sets the 15-minute grace period timeout,
   * updates status to 'trainer_arrived', and fires a customer notification.
   */
  static checkIn(bookingId: string): void {
    const booking = Database.schema.bookings.find(b => b.id === bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    if (!this.canCheckIn(booking)) {
      throw new Error("You can check in maximum 30 minutes before the scheduled session.");
    }

    // Generate a unique 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const gracePeriodStartedAt = Date.now();
    const otpExpiresAt = gracePeriodStartedAt + 15 * 60 * 1000; // 15 mins expiry

    // Save check-in state to database
    Database.updateBookingSessionDetails(bookingId, {
      timelineStatus: 'trainer_arrived',
      otp: otp,
      gracePeriodStartedAt: gracePeriodStartedAt,
      otpExpiresAt: otpExpiresAt
    });

    // Fire customer check-in notification
    try {
      const notificationStore = require('../store/notificationStore').useNotificationStore;
      notificationStore.getState().addNotification({
        title: 'Trainer Arrived 🔔',
        body: `Your trainer ${booking.trainerName} has arrived. Please share the OTP to begin your session.`,
        icon: 'bell',
        type: 'Safety',
        priority: 'high'
      });
    } catch (e) {
      console.log('[SESSION ENGINE] Notification store error:', e);
    }
  }

  /**
   * Verifies the 6-digit OTP code on database via RPC, falls back to local.
   * If correct, transitions the timelineStatus to 'workout_started'.
   */
  static async verifyOTP(bookingId: string, enteredOtp: string): Promise<boolean> {
    const booking = Database.schema.bookings.find(b => b.id === bookingId);
    if (!booking) return false;

    // 1. Strict status check
    if (booking.status !== 'upcoming') return false;

    // 2. Strict window check
    if (!this.isWithinStartWindow(booking)) return false;

    // 3. Strict trainer check
    const currentUserId = Database.getCurrentUserId();
    if (currentUserId && booking.trainerId && booking.trainerId !== currentUserId) return false;

    try {
      const { data, error } = await supabase.rpc('verify_and_start_session', {
        booking_id: bookingId,
        entered_otp: enteredOtp
      });

      if (error) {
        console.log('[SESSION ENGINE] Server-side OTP validation failed:', error.message);
        throw error;
      }

      Database.updateBookingSessionDetails(bookingId, {
        timelineStatus: 'otp_verified'
      });
      return true;
    } catch (e) {
      // Local fallback for offline mode or network failure
      console.log('[SESSION ENGINE] RPC failed, using local OTP verification fallback:', e);
      if (booking.otp !== enteredOtp) {
        return false;
      }
      if (booking.otpExpiresAt && Date.now() > booking.otpExpiresAt) {
        return false;
      }
      Database.updateBookingSessionDetails(bookingId, {
        timelineStatus: 'otp_verified'
      });
      return true;
    }
  }

  /**
   * Starts the workout session after OTP is verified.
   */
  static async startWorkout(bookingId: string): Promise<void> {
    const booking = Database.schema.bookings.find(b => b.id === bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.timelineStatus !== 'otp_verified') {
      throw new Error("OTP must be verified before starting the workout.");
    }

    // Update to workout_started and save the timestamp
    Database.updateBookingSessionDetails(bookingId, {
      timelineStatus: 'workout_started',
      workoutStartedAt: Date.now()
    });
  }

  /**
   * Completes the active workout session.
   */
  static completeSession(bookingId: string): void {
    const booking = Database.schema.bookings.find(b => b.id === bookingId);
    if (!booking) return;

    Database.updateBookingSessionDetails(bookingId, {
      status: 'completed',
      timelineStatus: 'workout_completed',
      workoutCompletedAt: Date.now()
    });
  }

  /**
   * Computes the remaining seconds of the 15-minute Check-In grace period.
   */
  static getGracePeriodSecondsLeft(booking: Booking): number {
    if (!booking.gracePeriodStartedAt) return 0;
    const expiry = booking.gracePeriodStartedAt + 15 * 60 * 1000;
    const diff = Math.ceil((expiry - Date.now()) / 1000);
    return Math.max(0, diff);
  }

  /**
   * Computes the remaining seconds of the 60-minute workout timer.
   */
  static getWorkoutSecondsLeft(booking: Booking): number {
    if (!booking.workoutStartedAt) return 0;
    const durationSec = (booking.durationMinutes || 60) * 60;
    const expiry = booking.workoutStartedAt + durationSec * 1000;
    const diff = Math.ceil((expiry - Date.now()) / 1000);
    return Math.max(0, diff);
  }
}
