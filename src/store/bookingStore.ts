import { create } from 'zustand';
import { Booking } from '../types';
import { useMembershipStore } from './membershipStore';
import { useCoachStore } from './coachStore';
import { useNotificationStore } from './notificationStore';
import { useWalletStore } from './walletStore';

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
}

const mockBookings: Booking[] = [
  {
    id: 'b-1',
    trainerName: 'Karan Sharma',
    trainerPhoto: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=150&q=80',
    workoutTitle: 'Strength Training',
    date: 'Jul 20, 2026',
    time: '10:00 AM',
    status: 'upcoming',
    timelineStatus: 'booked',
    trainerLevel: 'Certified',
    trainerRating: 4.9,
    trainerCompletedSessions: 245,
    trainerSpeciality: 'Strength & HIIT',
    trainerLanguages: ['English', 'Hindi', 'Punjabi'],
    trainerDistance: '2.5 km',
    trainerArrivalTime: '12 mins',
    otp: '5829',
  },
  {
    id: 'b-2',
    trainerName: 'Priya Patel',
    trainerPhoto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
    workoutTitle: 'Yoga',
    date: 'Jul 14, 2026',
    time: '08:30 AM',
    status: 'completed',
    timelineStatus: 'session_closed',
    trainerLevel: 'Certified',
    trainerRating: 4.8,
    trainerCompletedSessions: 190,
    trainerSpeciality: 'Yoga & Pilates',
    trainerLanguages: ['English', 'Gujarati', 'Hindi'],
    trainerDistance: '1.8 km',
    trainerArrivalTime: '9 mins',
    otp: '3142',
  },
  {
    id: 'b-3',
    trainerName: 'Rohan Mehta',
    trainerPhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    workoutTitle: 'Boxing',
    date: 'Jul 11, 2026',
    time: '06:00 PM',
    status: 'completed',
    timelineStatus: 'session_closed',
    trainerLevel: 'Elite',
    trainerRating: 4.95,
    trainerCompletedSessions: 480,
    trainerSpeciality: 'Boxing & Athletics',
    trainerLanguages: ['English', 'Hindi', 'Marathi'],
    trainerDistance: '3.1 km',
    trainerArrivalTime: '15 mins',
    otp: '9920',
  },
  {
    id: 'b-4',
    trainerName: 'Anjali Rao',
    trainerPhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
    workoutTitle: 'Dance Fitness',
    date: 'Jul 08, 2026',
    time: '04:30 PM',
    status: 'cancelled',
  },
];

export const useBookingStore = create<BookingState>((set, get) => ({
  bookings: mockBookings,
  cancelSession: (id) =>
    set((state) => {
      const target = state.bookings.find(b => b.id === id);
      if (target && target.status === 'upcoming') {
        useMembershipStore.getState().refundCredit(1);
        useWalletStore.getState().refundCredit(`Refund: Cancelled Session ${target.workoutTitle}`);
        
        useNotificationStore.getState().addNotification({
          title: 'Booking Cancelled 🚨',
          body: `Your session for ${target.workoutTitle} was cancelled. 1 credit has been refunded to your wallet.`,
          icon: 'rotate-ccw'
        });
      }
      return {
        bookings: state.bookings.map((b) =>
          b.id === id ? { ...b, status: 'cancelled' } : b
        ),
      };
    }),
  rescheduleSession: (id, date, time) =>
    set((state) => ({
      bookings: state.bookings.map((b) =>
        b.id === id ? { ...b, date, time, status: 'upcoming', timelineStatus: 'booked' } : b
      ),
    })),
  addBooking: (booking) =>
    set((state) => {
      useWalletStore.getState().useCredit(`Booked ${booking.workoutTitle} Session`);

      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      return {
        bookings: [
          { ...booking, otp, status: 'upcoming', timelineStatus: 'booked' },
          ...state.bookings,
        ],
      };
    }),
  updateTimelineStatus: (id, status) =>
    set((state) => ({
      bookings: state.bookings.map((b) =>
        b.id === id
          ? {
              ...b,
              timelineStatus: status,
              status: status === 'session_closed' ? 'completed' : b.status,
            }
          : b
      ),
    })),
  updateBookingRating: (id, ratingDetails) =>
    set((state) => ({
      bookings: state.bookings.map((b) =>
        b.id === id
          ? {
              ...b,
              ratingDetails,
              timelineStatus: 'session_closed',
            }
          : b
      ),
    })),
  acceptBooking: (id) =>
    set((state) => {
      const target = state.bookings.find(b => b.id === id);
      if (target) {
        useNotificationStore.getState().addNotification({
          title: 'Booking Accepted 🔔',
          body: `Coach ${target.trainerName} has accepted your job. They will begin travel at the scheduled time.`,
          icon: 'user-check'
        });
      }
      return {
        bookings: state.bookings.map((b) =>
          b.id === id ? { ...b, timelineStatus: 'trainer_accepted' } : b
        ),
      };
    }),
  triggerClientNoShow: (id) =>
    set((state) => {
      const target = state.bookings.find(b => b.id === id);
      if (target) {
        useCoachStore.getState().addEarning({
          bookingId: id,
          clientName: 'Viral (No-Show)',
          amount: 400,
          type: 'no_show_compensation',
        });
        useCoachStore.getState().restoreAvailabilitySlot(target.time);
        useWalletStore.getState().deductCreditLateCancel('Client No-Show Forfeited');
        
        useNotificationStore.getState().addNotification({
          title: 'Client No-Show Logged ⚠️',
          body: `We logged a no-show for your scheduled session. 1 credit was forfeited, and travel compensation was sent to your coach.`,
          icon: 'rotate-ccw'
        });
      }
      return {
        bookings: state.bookings.map((b) =>
          b.id === id ? { ...b, status: 'client_no_show', timelineStatus: 'session_closed' } : b
        ),
      };
    }),
  triggerTrainerNoShow: (id) =>
    set((state) => {
      const target = state.bookings.find(b => b.id === id);
      if (target) {
        useMembershipStore.getState().refundCredit(1);
        useMembershipStore.getState().addCredits(1);
        useWalletStore.getState().refundCredit('Trainer No-Show Refund');
        useWalletStore.getState().addBonusCredit('Trainer No-Show Bonus Credit');
        
        useCoachStore.getState().addEarning({
          bookingId: id,
          clientName: 'VIRLA Penalty (No-Show)',
          amount: -500,
          type: 'penalty',
        });
        
        useCoachStore.getState().restoreAvailabilitySlot(target.time);

        useNotificationStore.getState().addNotification({
          title: 'Trainer No-Show Logged 🚨',
          body: `Your coach failed to arrive. Your credit has been refunded, and we've added a FREE bonus credit to your account.`,
          icon: 'rotate-ccw'
        });
      }
      return {
        bookings: state.bookings.map((b) =>
          b.id === id ? { ...b, status: 'trainer_no_show', timelineStatus: 'session_closed' } : b
        ),
      };
    }),
  submitQuestionnaire: (id, questionnaire) =>
    set((state) => {
      const target = state.bookings.find(b => b.id === id);
      if (target) {
        useCoachStore.getState().addEarning({
          bookingId: id,
          clientName: 'Viral',
          amount: 800,
          type: 'session',
        });
        useCoachStore.getState().restoreAvailabilitySlot(target.time);
      }
      return {
        bookings: state.bookings.map((b) =>
          b.id === id ? { ...b, questionnaire, timelineStatus: 'trainer_report_submitted', status: 'completed' } : b
        ),
      };
    }),
}));
