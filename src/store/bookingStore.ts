import { create } from 'zustand';
import { Booking } from '../types';
import { useMembershipStore } from './membershipStore';
import { useNotificationStore } from './notificationStore';
import { useWalletStore } from './walletStore';
import { Database } from '../database/Database';

interface BookingState {
  bookings: Booking[];
  cancelSession: (id: string) => void;
  rescheduleSession: (id: string, date: string, time: string) => void;
  addBooking: (booking: Omit<Booking, 'status'>) => void;
  updateTimelineStatus: (id: string, status: Booking['timelineStatus']) => void;
  updateBookingRating: (id: string, ratingDetails: Booking['ratingDetails']) => void;
  
  // Sprint 6 state machine actions
  acceptBooking: (id: string) => void;
  triggerClientNoShow: (id: string) => void;
  triggerTrainerNoShow: (id: string) => void;
  submitQuestionnaire: (id: string, questionnaire: NonNullable<Booking['questionnaire']>) => void;
  syncFromDB: () => void;
}

export const useBookingStore = create<BookingState>((set, get) => ({
  bookings: [],
  cancelSession: (id) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      const target = get().bookings.find(b => b.id === id);
      if (target && target.status === 'upcoming') {
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
    get().syncFromDB();
  },
  acceptBooking: (id) => {
    get().updateTimelineStatus(id, 'trainer_accepted');
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
      if (b) {
        b.questionnaire = questionnaire;
        b.timelineStatus = 'trainer_report_submitted';
        b.status = 'completed';
      }
      Database.addEarning({
        bookingId: id,
        clientName: 'Viral',
        amount: 800,
        type: 'session',
      });
      get().syncFromDB();
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
