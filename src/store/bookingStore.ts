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
  cancelSession: (id: string) => Promise<void>;
  rescheduleSession: (id: string, date: string, time: string) => Promise<void>;
  addBooking: (booking: Omit<Booking, 'status'>) => Promise<void>;
  updateTimelineStatus: (id: string, status: Booking['timelineStatus']) => Promise<void>;
  updateBookingRating: (id: string, ratingDetails: Booking['ratingDetails']) => Promise<void>;
  updateBookingNote: (id: string, note: string) => void;
  updateBookingSessionDetails: (id: string, details: {
    status?: Booking['status'];
    timelineStatus?: Booking['timelineStatus'];
    otp?: string;
    gracePeriodStartedAt?: number;
    otpExpiresAt?: number;
    workoutStartedAt?: number;
    travelStartedAt?: number;
    workoutCompletedAt?: number;
  }) => Promise<void>;
  
  acceptBooking: (id: string) => Promise<void>;
  triggerClientNoShow: (id: string) => Promise<void>;
  triggerTrainerNoShow: (id: string) => Promise<void>;
  submitQuestionnaire: (id: string, questionnaire: NonNullable<Booking['questionnaire']>) => Promise<void>;
  reassignTrainer: (bookingId: string, action?: 'declined' | 'timeout') => Promise<void>;
  acknowledgeSession: (id: string) => Promise<void>;
  syncFromDB: () => void;
  refreshBookings: () => Promise<void>;
}

export const useBookingStore = create<BookingState>((set, get) => ({
  bookings: [],
  cancelSession: async (id) => {
    const userId = Database.getCurrentUserId();
    if (!userId) {
      throw new Error('User not logged in');
    }
    const target = get().bookings.find(b => b.id === id);
    if (!target) {
      throw new Error('Booking not found in local store');
    }
    if (target.status !== 'upcoming') {
      throw new Error(`Cannot cancel session with status: ${target.status}`);
    }
    await Database.cancelBooking(userId, id);
    get().syncFromDB();
    useWalletStore.getState().syncFromDB();
    useMembershipStore.getState().syncFromDB();
    useUserProfileStore.getState().syncFromDB();
    
    useNotificationStore.getState().addNotification({
      title: 'Booking Cancelled 🚨',
      body: `Your session for ${target.workoutTitle} was cancelled.`,
      icon: 'rotate-ccw'
    });
  },
  rescheduleSession: async (id, date, time) => {
    await Database.rescheduleBooking(id, date, time);
    get().syncFromDB();
  },
  addBooking: async (booking) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      await Database.addBookingWithValidation(userId, booking);
      get().syncFromDB();
      useWalletStore.getState().syncFromDB();
      useMembershipStore.getState().syncFromDB();
    }
  },
  updateTimelineStatus: async (id, status) => {
    await Database.updateTimelineStatus(id, status);
    get().syncFromDB();
  },
  updateBookingRating: async (id, ratingDetails) => {
    await Database.updateBookingRating(id, ratingDetails);
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
  updateBookingSessionDetails: async (id, details) => {
    await Database.updateBookingSessionDetails(id, details);
    get().syncFromDB();
  },
  acceptBooking: async (id) => {
    await get().updateTimelineStatus(id, 'trainer_accepted');
  },
  reassignTrainer: async (bookingId, action) => {
    await Database.updateBookingTrainer(bookingId, { action });
    get().syncFromDB();
  },
  triggerClientNoShow: async (id) => {
    console.log("[CLIENT-NOSHOW-TRACE] TRAINER ACTION triggered CLIENT NO-SHOW");
    console.log(`[CLIENT-NOSHOW-TRACE] bookingId: ${id}`);
    const trainerId = Database.getCurrentUserId();
    console.log(`[CLIENT-NOSHOW-TRACE] trainerId / AUTHORIZATION: ${trainerId}`);
    try {
      console.log("[CLIENT-NOSHOW-TRACE] Calling database handleNoShow (RPC)");
      await Database.handleNoShow(id, 'client');
      console.log("[CLIENT-NOSHOW-TRACE] RPC returned SUCCESS. BOOKING STATE updated to client_no_show.");
      console.log("[CLIENT-NOSHOW-TRACE] CREDIT TRANSACTION processed (credits forfeited/no refund).");
      
      const userId = Database.getCurrentUserId();
      if (userId) {
        useWalletStore.getState().syncFromDB();
        useMembershipStore.getState().syncFromDB();
        useUserProfileStore.getState().syncFromDB();
      }
      get().syncFromDB();
      console.log("[CLIENT-NOSHOW-TRACE] CLIENT REFRESH / STORE REFRESH completed successfully.");
    } catch (err: any) {
      console.error("[CLIENT-NOSHOW-TRACE] handleNoShow failed", err);
      throw err;
    }
  },
  triggerTrainerNoShow: async (id) => {
    await Database.handleNoShow(id, 'trainer');
    const userId = Database.getCurrentUserId();
    if (userId) {
      useWalletStore.getState().syncFromDB();
      useMembershipStore.getState().syncFromDB();
      useUserProfileStore.getState().syncFromDB();
    }
    get().syncFromDB();
  },
  submitQuestionnaire: async (id, questionnaire) => {
    await Database.submitTrainerReport(id, questionnaire);
    const userId = Database.getCurrentUserId();
    if (userId) {
      useUserProfileStore.getState().syncFromDB();
    }
    get().syncFromDB();
  },
  acknowledgeSession: async (id) => {
    await Database.acknowledgeAutoAccept(id);
    get().syncFromDB();
  },
  syncFromDB: () => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      const list = Database.getBookings(userId);
      set({ bookings: list });
    } else {
      set({ bookings: [] });
    }
  },
  refreshBookings: async () => {
    await Database.refreshBookings();
    get().syncFromDB();
  }
}
));
