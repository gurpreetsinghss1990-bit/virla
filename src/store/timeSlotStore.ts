import { create } from 'zustand';

export interface TimeSlot {
  slot: string;
  isAvailable: boolean;
}

interface TimeSlotState {
  selectedTimeSlot: string;
  timeSlots: TimeSlot[];
  setSelectedTimeSlot: (slot: string) => void;
  setTimeSlots: (slots: TimeSlot[]) => void;
}

const mockSlots: TimeSlot[] = [
  { slot: '07:00 AM - 08:00 AM', isAvailable: true },
  { slot: '08:00 AM - 09:00 AM', isAvailable: true },
  { slot: '09:00 AM - 10:00 AM', isAvailable: false }, // disabled/unavailable
  { slot: '10:00 AM - 11:00 AM', isAvailable: true },
  { slot: '05:00 PM - 06:00 PM', isAvailable: true },
  { slot: '06:00 PM - 07:00 PM', isAvailable: false }, // disabled/unavailable
  { slot: '07:00 PM - 08:00 PM', isAvailable: true },
];

export const useTimeSlotStore = create<TimeSlotState>((set) => ({
  selectedTimeSlot: '',
  timeSlots: mockSlots,
  setSelectedTimeSlot: (slot) => set({ selectedTimeSlot: slot }),
  setTimeSlots: (slots) => set({ timeSlots: slots }),
}));
