import { create } from 'zustand';
import { Booking } from '../types';
import { useMembershipStore } from './membershipStore';
import { useNotificationStore } from './notificationStore';
import { useWalletStore } from './walletStore';
import { useUserProfileStore } from './userProfileStore';
import { Database } from '../database/Database';
import { AssignmentEngine } from '../services/AssignmentEngine';

interface BookingState {
  bookings: Booking[];
  cancelSession: (id: string) => void;
  rescheduleSession: (id: string, date: string, time: string) => void;
  addBooking: (booking: Omit<Booking, 'status'>) => void;
  updateTimelineStatus: (id: string, status: Booking['timelineStatus']) => void;
  updateBookingRating: (id: string, ratingDetails: Booking['ratingDetails']) => void;
  updateBookingNote: (id: string, note: string) => void;
  updateBookingSessionDetails: (id: string, details: {
    status?: Booking['status'];
    timelineStatus?: Booking['timelineStatus'];
    otp?: string;
    gracePeriodStartedAt?: number;
    otpExpiresAt?: number;
    workoutStartedAt?: number;
  }) => void;
  
  // Sprint 6 state machine actions
  acceptBooking: (id: string) => void;
  triggerClientNoShow: (id: string) => void;
  triggerTrainerNoShow: (id: string) => void;
  submitQuestionnaire: (id: string, questionnaire: NonNullable<Booking['questionnaire']>) => void;
  reassignTrainer: (bookingId: string, action?: 'declined' | 'timeout') => void;
  syncFromDB: () => void;
}

export const useBookingStore = create<BookingState>((set, get) => ({
  bookings: [],
  cancelSession: (id) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      const target = get().bookings.find(b => b.id === id);
      if (target && target.status === 'upcoming') {
        // Log cancellation event for the current assigned trainer
        const currentCoach = Database.schema.coaches.find(c => c.name === target.trainerName);
        const currentCoachId = currentCoach?.id || 'unknown';
        Database.logAssignmentEvent({
          bookingId: id,
          trainerId: currentCoachId,
          score: 0,
          reason: 'Customer cancelled the booking request',
          action: 'cancelled'
        });

        Database.cancelBooking(userId, id);
        
        useMembershipStore.getState().syncFromDB();
        useWalletStore.getState().syncFromDB();
        
        useNotificationStore.getState().addNotification({
          title: 'Booking Cancelled 🚨',
          body: `Your session for ${target.workoutTitle} was cancelled. 1 credit has been refunded to your wallet.`,
          icon: 'rotate-ccw'
        });
        get().syncFromDB();
      }
    }
  },
  rescheduleSession: (id, date, time) => {
    Database.rescheduleBooking(id, date, time);
    get().syncFromDB();
  },
  addBooking: (booking) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      Database.addBooking(userId, booking);
      useWalletStore.getState().syncFromDB();
      useMembershipStore.getState().syncFromDB();
      get().syncFromDB();
    }
  },
  updateTimelineStatus: (id, status) => {
    if (status === 'trainer_accepted') {
      const target = get().bookings.find(b => b.id === id);
      if (target) {
        const currentCoach = Database.schema.coaches.find(c => c.name === target.trainerName);
        const currentCoachId = currentCoach?.id || 'unknown';
        const rated = AssignmentEngine.rankTrainers(target);
        const ratingMatch = rated.find(r => r.coach.id === currentCoachId);
        const score = ratingMatch?.score || 85;

        Database.logAssignmentEvent({
          bookingId: id,
          trainerId: currentCoachId,
          score: score,
          reason: 'Trainer manually accepted booking request',
          action: 'accepted'
        });
      }
    }

    Database.updateTimelineStatus(id, status);
    const target = get().bookings.find(b => b.id === id);
    if (target) {
      const userId = Database.getCurrentUserId();
      if (userId) {
        let nTitle = '';
        let nBody = '';
        let nType: any = 'Bookings';
        let nPriority: any = 'medium';
        let nAction = '';
        let nDeepLink = '';
        let nIcon = 'bell';

        if (status === 'trainer_assigned') {
          nTitle = 'Trainer Assigned ⚡';
          nBody = `Coach ${target.trainerName} (${target.trainerLevel || 'Certified'} Trainer) is assigned to your ${target.workoutTitle} session.`;
          nType = 'Trainer Updates';
          nAction = 'View Details';
          nDeepLink = `/session-detail?id=${id}`;
          nIcon = 'user-check';
        } else if (status === 'trainer_accepted') {
          nTitle = 'Booking Accepted 🤝';
          nBody = `Coach ${target.trainerName} accepted your booking. They will arrive at the scheduled time.`;
          nType = 'Trainer Updates';
          nAction = 'View Coach';
          nDeepLink = `/session-detail?id=${id}`;
          nIcon = 'user-check';
        } else if (status === 'trainer_preparing') {
          nTitle = 'Coach Preparing 🎒';
          nBody = `Coach ${target.trainerName} is preparing fitness gear for your ${target.workoutTitle} session.`;
          nType = 'Trainer Updates';
          nAction = 'View Status';
          nDeepLink = `/session-detail?id=${id}`;
          nIcon = 'clock';
        } else if (status === 'trainer_travelling') {
          nTitle = 'Coach On The Way 🚗';
          nBody = `Coach ${target.trainerName} started travelling to your venue. Est. arrival: ${target.trainerArrivalTime || '15 mins'}.`;
          nType = 'Trainer Updates';
          nPriority = 'high';
          nAction = 'Track Coach';
          nDeepLink = `/session-detail?id=${id}`;
          nIcon = 'navigation';
        } else if (status === 'trainer_arrived') {
          nTitle = 'Coach Arrived 🔔';
          nBody = `Coach ${target.trainerName} has arrived at your location. Share check-in OTP to begin.`;
          nType = 'Safety';
          nPriority = 'high';
          nAction = 'Reveal OTP';
          nDeepLink = `/session-detail?id=${id}`;
          nIcon = 'lock';
        } else if (status === 'otp_verified' || status === 'workout_started') {
          nTitle = 'Session Started ⚡';
          nBody = `Your ${target.workoutTitle} session has officially started. Enjoy your workout!`;
          nType = 'Bookings';
          nAction = 'View Status';
          nDeepLink = `/session-detail?id=${id}`;
          nIcon = 'award';
        } else if (status === 'workout_completed') {
          nTitle = 'Session Completed 🏆';
          nBody = `Well done! Your workout session is complete. Please rate your experience.`;
          nType = 'Bookings';
          nAction = 'Rate Coach';
          nDeepLink = `/session-detail?id=${id}`;
          nIcon = 'star';
        }

        if (nTitle) {
          useNotificationStore.getState().addNotification({
            title: nTitle,
            body: nBody,
            type: nType,
            priority: nPriority,
            actionLabel: nAction,
            deepLink: nDeepLink,
            icon: nIcon
          });
        }
      }
    }
    get().syncFromDB();
  },
  updateBookingRating: (id, ratingDetails) => {
    Database.updateBookingRating(id, ratingDetails);
    const userId = Database.getCurrentUserId();
    if (userId) {
      useUserProfileStore.getState().syncFromDB();
    }
    get().syncFromDB();
  },
  updateBookingNote: (id, note) => {
    Database.updateBookingNote(id, note);
    get().syncFromDB();
  },
  updateBookingSessionDetails: (id, details) => {
    Database.updateBookingSessionDetails(id, details);
    get().syncFromDB();
  },
  acceptBooking: (id) => {
    get().updateTimelineStatus(id, 'trainer_accepted');
  },
  reassignTrainer: (bookingId, action) => {
    const booking = get().bookings.find(b => b.id === bookingId);
    if (!booking) return;

    const allCoaches = Database.schema.coaches;
    if (allCoaches.length === 0) return;

    // Retrieve current coach to log the decline/timeout event
    const currentCoach = allCoaches.find(c => c.name === booking.trainerName);
    const currentCoachId = currentCoach?.id || 'unknown';

    // Log the trainer's action (decline or timeout)
    Database.logAssignmentEvent({
      bookingId: bookingId,
      trainerId: currentCoachId,
      score: 0,
      reason: action === 'declined' ? 'Trainer manually declined the request' : '60-second response window expired',
      action: action || 'timeout'
    });

    const pool = booking.assignedTrainersPool || [];
    const currentIndex = booking.currentTrainerIndex ?? 0;
    const nextIndex = currentIndex + 1;

    if (nextIndex < pool.length) {
      const nextCoachId = pool[nextIndex];
      const nextCoach = allCoaches.find(c => c.id === nextCoachId);
      
      if (nextCoach) {
        // Calculate dynamic score for logging purposes
        const rated = AssignmentEngine.rankTrainers(booking);
        const matchRating = rated.find(r => r.coach.id === nextCoachId);
        const score = matchRating?.score || 75;

        // Log the new assignment event
        Database.logAssignmentEvent({
          bookingId: bookingId,
          trainerId: nextCoachId,
          score: score,
          reason: `Sequential fallback to Rank ${nextIndex + 1} of pool`,
          action: 'assigned'
        });

        Database.updateBookingTrainer(bookingId, {
          trainerName: nextCoach.name,
          trainerPhoto: nextCoach.photo,
          trainerLevel: nextCoach.level || 'Certified',
          trainerRating: nextCoach.rating,
          trainerCompletedSessions: nextCoach.completedSessions || 150,
          trainerSpeciality: nextCoach.specialty,
          trainerLanguages: nextCoach.languages || [],
          price: nextCoach.price || 1200,
          createdAt: Date.now(),
          currentTrainerIndex: nextIndex,
        });

        get().syncFromDB();

        useNotificationStore.getState().addNotification({
          title: 'Booking Reassigned ⚡',
          body: `Booking request reassigned to Coach ${nextCoach.name}.`,
          icon: 'user-check',
        });
        return;
      }
    }

    // Fallback: If no more trainers are in the pool, cancel the request
    Database.updateBookingTrainer(bookingId, {
      status: 'cancelled',
      timelineStatus: 'session_closed',
      trainerName: 'No Trainer Available',
      createdAt: Date.now(),
    });

    get().syncFromDB();

    useNotificationStore.getState().addNotification({
      title: 'No Coaches Available ⚠️',
      body: `We could not find an available trainer for your session. Your credits have been returned.`,
      icon: 'alert-circle',
    });
  },
  triggerClientNoShow: (id) => {
    const target = get().bookings.find(b => b.id === id);
    if (target) {
      const userId = Database.getCurrentUserId();
      if (userId) {
        Database.addEarning({
          bookingId: id,
          clientName: 'Viral (No-Show)',
          amount: 400,
          type: 'no_show_compensation',
        });
        Database.updateTimelineStatus(id, 'session_closed');
        const b = Database.schema.bookings.find(x => x.id === id);
        if (b) b.status = 'client_no_show';
        
        // Deduct/forfeit credit
        const profile = Database.getProfile(userId);
        if (profile) {
          Database.addLedgerTransaction(userId, {
            id: Database.generateUUID('tx'),
            type: 'paid',
            amount: '₹0',
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
            status: 'paid',
            credits: -1
          });
        }
        
        useNotificationStore.getState().addNotification({
          title: 'Client No-Show Logged ⚠️',
          body: `We logged a no-show for your scheduled session. 1 credit was forfeited, and travel compensation was sent to your coach.`,
          type: 'Safety',
          priority: 'high',
          actionLabel: 'View Details',
          deepLink: `/session-detail?id=${id}`,
          icon: 'rotate-ccw'
        });
        get().syncFromDB();
      }
    }
  },
  triggerTrainerNoShow: (id) => {
    const target = get().bookings.find(b => b.id === id);
    if (target) {
      const userId = Database.getCurrentUserId();
      if (userId) {
        Database.updateTimelineStatus(id, 'session_closed');
        const b = Database.schema.bookings.find(x => x.id === id);
        if (b) b.status = 'trainer_no_show';

        // Refund and add bonus
        const profile = Database.getProfile(userId);
        if (profile) {
          profile.creditsBalance += 2; // +1 refund +1 bonus
        }
        Database.addLedgerTransaction(userId, {
          id: Database.generateUUID('tx'),
          type: 'paid',
          amount: '₹0',
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
          status: 'paid',
          credits: 2
        });

        Database.addEarning({
          bookingId: id,
          clientName: 'VIRLA Penalty (No-Show)',
          amount: -500,
          type: 'penalty',
        });
        
        useNotificationStore.getState().addNotification({
          title: 'Trainer No-Show Logged 🚨',
          body: `Your coach failed to arrive. Your credit has been refunded, and we've added a FREE bonus credit to your account.`,
          type: 'Safety',
          priority: 'high',
          actionLabel: 'Check Wallet',
          deepLink: '/membership',
          icon: 'rotate-ccw'
        });
        get().syncFromDB();
      }
    }
  },
  submitQuestionnaire: (id, questionnaire) => {
    const target = get().bookings.find(b => b.id === id);
    if (target) {
      const b = Database.schema.bookings.find(x => x.id === id);
      const userId = Database.getCurrentUserId() || target.clientId;
      if (b && userId) {
        b.questionnaire = questionnaire;
        b.timelineStatus = 'trainer_report_submitted';
        b.status = 'completed';
        
        // Progress Automation: log calories automatically
        const caloriesBurned = target.caloriesBurned || 380;
        const dateStr = new Date().toLocaleDateString('en-CA');
        Database.logCalories(userId, dateStr, caloriesBurned);
      }
      Database.addEarning({
        bookingId: id,
        clientName: target.clientName || 'Viral',
        amount: 800,
        type: 'session',
      });
      get().syncFromDB();
      if (userId) {
        useUserProfileStore.getState().syncFromDB();
      }
    }
  },
  syncFromDB: () => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      const list = Database.getBookings(userId);
      set({ bookings: list });
    } else {
      set({ bookings: [] });
    }
  }
}));
