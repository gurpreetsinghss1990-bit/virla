

import { create } from 'zustand';
import { Coach, TrainerEarning, ScheduleSlot } from '../types';
import { Alert } from 'react-native';
import { Database } from '../database/Database';

interface CoachState {
  coaches: Coach[];
  selectedCoachId: string;
  setSelectedCoachId: (id: string) => void;
  toggleFavouriteCoach: (id: string) => void;
  
  // Trainer ledger (S6)
  earningsList: TrainerEarning[];
  totalEarnings: number;
  addEarning: (earning: Omit<TrainerEarning, 'id' | 'date'>) => void;
  restoreAvailabilitySlot: (slot: string) => void;

  // Sprint 7 availability planner
  weeklySchedule: ScheduleSlot[];
  remainingSlotChanges: number;
  isScheduleSubmitted: boolean;
  toggleSlotAvailability: (slotId: string) => void;
  editScheduleSlot: (slotId: string, newTime: string) => boolean;
  submitSchedule: () => void;
  syncFromDB: () => void;
}

// Helper to generate default availability planner slots
const generateInitialSchedule = (): ScheduleSlot[] => {
  const list: ScheduleSlot[] = [];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  days.forEach((day) => {
    list.push({ id: `${day}-p1`, day, time: '07:00 AM - 08:00 AM', isPrime: true, isBooked: false, isAvailable: true });
    list.push({ id: `${day}-p2`, day, time: '08:00 AM - 09:00 AM', isPrime: true, isBooked: false, isAvailable: true });
    list.push({ id: `${day}-p3`, day, time: '05:00 PM - 06:00 PM', isPrime: true, isBooked: false, isAvailable: true });
    list.push({ id: `${day}-p4`, day, time: '06:00 PM - 07:00 PM', isPrime: true, isBooked: false, isAvailable: true });
    list.push({ id: `${day}-o1`, day, time: '09:00 AM - 10:00 AM', isPrime: false, isBooked: false, isAvailable: true });
    list.push({ id: `${day}-o2`, day, time: '10:00 AM - 11:00 AM', isPrime: false, isBooked: false, isAvailable: true });
  });

  list[2].isBooked = true; // Tuesday Prime Booked
  list[8].isBooked = true; // Thursday Off Peak Booked
  return list;
};

export const useCoachStore = create<CoachState>((set, get) => ({
  coaches: [],
  selectedCoachId: '',
  setSelectedCoachId: (id) => set({ selectedCoachId: id }),
  toggleFavouriteCoach: (id) => {
    Database.toggleFavouriteCoach(id);
    get().syncFromDB();
  },
  earningsList: [],
  totalEarnings: 0,
  addEarning: (earning) => {
    Database.addEarning(earning);
    get().syncFromDB();
  },
  restoreAvailabilitySlot: (slot) => {
    const { coaches } = get();
    set({
      coaches: coaches.map(c => {
        if (c.id === 'c-1' && c.availability && !c.availability.includes(slot)) {
          const updatedAvailability = [...c.availability, slot];
          Database.schema.coaches.forEach(dc => {
            if (dc.id === 'c-1') dc.availability = updatedAvailability;
          });
          return { ...c, availability: updatedAvailability };
        }
        return c;
      })
    });
  },
  
  // Sprint 7 availability planner states
  weeklySchedule: generateInitialSchedule(),
  remainingSlotChanges: 2,
  isScheduleSubmitted: true,

  toggleSlotAvailability: (slotId) => {
    const { isScheduleSubmitted, remainingSlotChanges, weeklySchedule } = get();
    const slot = weeklySchedule.find(s => s.id === slotId);

    if (!slot) return;

    if (slot.isBooked) {
      Alert.alert('Change Blocked', 'Booked slots are locked and cannot be edited.');
      return;
    }

    if (isScheduleSubmitted) {
      if (remainingSlotChanges <= 0) {
        Alert.alert('Change Blocked', 'Remaining Changes: 0/2. You have used all allowed changes for this week.');
        return;
      }

      set((state) => ({
        weeklySchedule: state.weeklySchedule.map(s => 
          s.id === slotId ? { ...s, isAvailable: !s.isAvailable } : s
        ),
        remainingSlotChanges: state.remainingSlotChanges - 1
      }));
    } else {
      set((state) => ({
        weeklySchedule: state.weeklySchedule.map(s => 
          s.id === slotId ? { ...s, isAvailable: !s.isAvailable } : s
        )
      }));
    }
  },

  editScheduleSlot: (slotId, newTime) => {
    const { isScheduleSubmitted, remainingSlotChanges, weeklySchedule } = get();
    const slot = weeklySchedule.find(s => s.id === slotId);

    if (!slot) return false;

    if (slot.isBooked) {
      Alert.alert('Change Blocked', 'Booked slots are locked and cannot be edited.');
      return false;
    }

    if (isScheduleSubmitted && remainingSlotChanges <= 0) {
      Alert.alert('Change Blocked', 'Remaining Changes: 0/2. You have used all allowed changes for this week.');
      return false;
    }

    set((state) => ({
      weeklySchedule: state.weeklySchedule.map(s => 
        s.id === slotId ? { ...s, time: newTime } : s
      ),
      remainingSlotChanges: isScheduleSubmitted ? state.remainingSlotChanges - 1 : state.remainingSlotChanges
    }));
    
    return true;
  },

  submitSchedule: () => set({ isScheduleSubmitted: true, remainingSlotChanges: 2 }),

  syncFromDB: () => {
    const userId = Database.getCurrentUserId();
    const coachesList = Database.getCoaches();
    let earningsList: TrainerEarning[] = [];
    if (userId) {
      earningsList = Database.getEarnings(userId);
    }
    set({
      coaches: coachesList,
      earningsList,
      totalEarnings: earningsList.reduce((acc, curr) => acc + curr.amount, 0)
    });
  }
}));
