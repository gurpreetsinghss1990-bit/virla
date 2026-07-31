import { Database } from '../database/Database';
import { Booking } from '../types';

export class SessionEngine {
  /**
   * Helper to parse booking date and time into a native Javascript Date object.
   */
  static getSessionStartDate(booking: Booking): Date {
    try {
      if (!booking) return new Date();
      let datePart = booking.date;
      if (datePart.startsWith('Today, ')) {
        datePart = datePart.replace('Today, ', '');
      } else if (datePart.startsWith('Tomorrow, ')) {
        datePart = datePart.replace('Tomorrow, ', '');
      }

      const timePart = booking.time.split('-')[0].trim();
      const combined = `${datePart} ${timePart}`;
      const d = new Date(combined);
      if (!isNaN(d.getTime())) {
        return d;
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
   * Check-in can happen MAXIMUM 30 minutes before the scheduled session.
   */
  static canCheckIn(booking: Booking): boolean {
    const minToSession = this.getMinutesToSession(booking);
    return minToSession <= 30;
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
   * Verifies the 6-digit OTP code.
   * If correct, transitions the timelineStatus to 'workout_started'.
   */
  static verifyOTP(bookingId: string, enteredOtp: string): boolean {
    const booking = Database.schema.bookings.find(b => b.id === bookingId);
    if (!booking) return false;

    // Strict OTP match check
    if (booking.otp !== enteredOtp) {
      return false;
    }

    // Check if grace period/OTP has expired
    if (booking.otpExpiresAt && Date.now() > booking.otpExpiresAt) {
      return false;
    }

    // Start workout timer and record timestamp
    Database.updateBookingSessionDetails(bookingId, {
      timelineStatus: 'workout_started',
      workoutStartedAt: Date.now()
    });

    return true;
  }

  /**
   * Completes the active workout session.
   */
  static completeSession(bookingId: string): void {
    const booking = Database.schema.bookings.find(b => b.id === bookingId);
    if (!booking) return;

    Database.updateBookingSessionDetails(bookingId, {
      status: 'completed',
      timelineStatus: 'workout_completed'
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
