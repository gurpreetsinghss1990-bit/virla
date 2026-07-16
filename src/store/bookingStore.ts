import { create } from 'zustand';
import { Booking } from '../types';

interface BookingState {
  bookings: Booking[];
  cancelSession: (id: string) => void;
  rescheduleSession: (id: string, date: string, time: string) => void;
  addBooking: (booking: Omit<Booking, 'status'>) => void;
  updateTimelineStatus: (id: string, status: Booking['timelineStatus']) => void;
  updateBookingRating: (id: string, ratingDetails: Booking['ratingDetails']) => void;
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
    timelineStatus: 'confirmed',
    trainerLevel: 'Certified',
    trainerRating: 4.9,
    trainerCompletedSessions: 245,
    trainerSpeciality: 'Strength & HIIT',
    trainerLanguages: ['English', 'Hindi', 'Punjabi'],
    trainerDistance: '2.5 km',
    trainerArrivalTime: '12 mins',
  },
  {
    id: 'b-2',
    trainerName: 'Priya Patel',
    trainerPhoto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
    workoutTitle: 'Yoga',
    date: 'Jul 14, 2026',
    time: '08:30 AM',
    status: 'completed',
    timelineStatus: 'completed',
    trainerLevel: 'Certified',
    trainerRating: 4.8,
    trainerCompletedSessions: 190,
    trainerSpeciality: 'Yoga & Pilates',
    trainerLanguages: ['English', 'Gujarati', 'Hindi'],
    trainerDistance: '1.8 km',
    trainerArrivalTime: '9 mins',
  },
  {
    id: 'b-3',
    trainerName: 'Rohan Mehta',
    trainerPhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    workoutTitle: 'Boxing',
    date: 'Jul 11, 2026',
    time: '06:00 PM',
    status: 'completed',
    timelineStatus: 'completed',
    trainerLevel: 'Elite',
    trainerRating: 4.95,
    trainerCompletedSessions: 480,
    trainerSpeciality: 'Boxing & Athletics',
    trainerLanguages: ['English', 'Hindi', 'Marathi'],
    trainerDistance: '3.1 km',
    trainerArrivalTime: '15 mins',
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

export const useBookingStore = create<BookingState>((set) => ({
  bookings: mockBookings,
  cancelSession: (id) =>
    set((state) => ({
      bookings: state.bookings.map((b) =>
        b.id === id ? { ...b, status: 'cancelled' } : b
      ),
    })),
  rescheduleSession: (id, date, time) =>
    set((state) => ({
      bookings: state.bookings.map((b) =>
        b.id === id ? { ...b, date, time, status: 'upcoming', timelineStatus: 'confirmed' } : b
      ),
    })),
  addBooking: (booking) =>
    set((state) => ({
      bookings: [
        { ...booking, status: 'upcoming', timelineStatus: 'confirmed' },
        ...state.bookings,
      ],
    })),
  updateTimelineStatus: (id, status) =>
    set((state) => ({
      bookings: state.bookings.map((b) =>
        b.id === id
          ? {
              ...b,
              timelineStatus: status,
              status: status === 'completed' ? 'completed' : b.status,
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
              timelineStatus: 'completed', // finalized once rated
            }
          : b
      ),
    })),
}));
