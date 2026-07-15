import { create } from 'zustand';
import { Booking } from '../types';

interface BookingState {
  bookings: Booking[];
  cancelSession: (id: string) => void;
  rescheduleSession: (id: string, date: string, time: string) => void;
  addBooking: (booking: Omit<Booking, 'status'>) => void;
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
  },
  {
    id: 'b-2',
    trainerName: 'Priya Patel',
    trainerPhoto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
    workoutTitle: 'Yoga',
    date: 'Jul 14, 2026',
    time: '08:30 AM',
    status: 'completed',
  },
  {
    id: 'b-3',
    trainerName: 'Rohan Mehta',
    trainerPhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    workoutTitle: 'Boxing',
    date: 'Jul 11, 2026',
    time: '06:00 PM',
    status: 'completed',
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
        b.id === id ? { ...b, date, time, status: 'upcoming' } : b
      ),
    })),
  addBooking: (booking) =>
    set((state) => ({
      bookings: [
        { ...booking, status: 'upcoming' },
        ...state.bookings,
      ],
    })),
}));
