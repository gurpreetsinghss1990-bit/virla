import { create } from 'zustand';
import { Booking } from '../types';
import { useMembershipStore } from './membershipStore';
import { useCoachStore } from './coachStore';
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
    get().syncFromDB();
  },
  updateBookingRating: (id, ratingDetails) => {
    Database.updateBookingRating(id, ratingDetails);
    get().syncFromDB();
  },
  acceptBooking: (id) => {
    const target = get().bookings.find(b => b.id === id);
    if (target) {
      Database.updateTimelineStatus(id, 'trainer_accepted');
      const userId = Database.getCurrentUserId();
      if (userId) {
        useNotificationStore.getState().addNotification({
          title: 'Booking Accepted 🔔',
          body: `Coach ${target.trainerName} has accepted your job. They will begin travel at the scheduled time.`,
          icon: 'user-check'
        });
      }
      get().syncFromDB();
    }
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
          // already deducted when booked, but log a penalty ledger
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
