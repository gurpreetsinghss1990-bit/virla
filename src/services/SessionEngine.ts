import { Database, getCurrentServerTime, getBookingISTDateRange } from '../database/Database';
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
    const range = getBookingISTDateRange(booking);
    const now = getCurrentServerTime();
    const unlockTime = range.start.getTime() - this.TRAVEL_WINDOW_MINUTES * 60 * 1000;
    return now.getTime() >= unlockTime;
  }

  /**
   * Helper to parse booking date and time into a native Javascript Date object.
   */
  static getSessionStartDate(booking: Booking): Date {
    if (!booking) return getCurrentServerTime();
    return getBookingISTDateRange(booking).start;
  }

  /**
   * Returns difference in minutes between current time and the scheduled session start time.
   */
  static getMinutesToSession(booking: Booking): number {
    if (!booking) return 0;
    const range = getBookingISTDateRange(booking);
    const now = getCurrentServerTime();
    return (range.start.getTime() - now.getTime()) / (1000 * 60);
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
    const now = getCurrentServerTime();
    return now.getTime() >= start.getTime() && now.getTime() <= end.getTime();
  }

  /**
   * Checks if current time is before the valid session start window.
   */
  static isBeforeStartWindow(booking: Booking): boolean {
    const { start } = this.getSessionWindow(booking);
    const now = getCurrentServerTime();
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
   * Invokes mark_trainer_arrived RPC, generating OTP on Supabase server.
   */
  static async checkIn(bookingId: string): Promise<void> {
    const { error } = await supabase.rpc('mark_trainer_arrived', {
      p_booking_id: bookingId
    });

    if (error) {
      console.error('[SESSION ENGINE] checkIn failed:', error);
      throw new Error(error.message);
    }

    await Database.refreshBookings();
  }

  /**
   * Verifies the 6-digit OTP code on database via RPC.
   * If correct, transitions the timelineStatus to 'otp_verified'.
   */
  static async verifyOTP(bookingId: string, enteredOtp: string): Promise<boolean> {
    const { error } = await supabase.rpc('verify_session_otp', {
      p_booking_id: bookingId,
      p_entered_otp: enteredOtp
    });

    if (error) {
      console.error('[SESSION ENGINE] Server-side OTP validation failed:', error.message);
      return false;
    }

    await Database.refreshBookings();
    return true;
  }

  /**
   * Starts the workout session after OTP is verified.
   */
  static async startWorkout(bookingId: string): Promise<void> {
    const { error } = await supabase.rpc('start_session', {
      p_booking_id: bookingId
    });

    if (error) {
      console.error('[SESSION ENGINE] startWorkout failed:', error);
      throw new Error(error.message);
    }

    await Database.refreshBookings();
  }

  /**
   * Completes the active workout session.
   */
  static async completeSession(bookingId: string): Promise<void> {
    const { error } = await supabase.rpc('complete_session', {
      p_booking_id: bookingId
    });

    if (error) {
      console.error('[SESSION ENGINE] completeSession failed:', error);
      throw new Error(error.message);
    }

    await Database.refreshBookings();
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
