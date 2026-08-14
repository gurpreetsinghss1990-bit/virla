

import { create } from 'zustand';
import { Coach, TrainerEarning, ScheduleSlot, AvailabilityOverride, TrainerWorkoutAssignment } from '../types';
import { Alert } from 'react-native';
import { Database } from '../database/Database';
import { normalizeDate } from '../utils/date';

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

  // Commission availability overrides
  availabilityOverrides: AvailabilityOverride[];
  workoutAssignments: TrainerWorkoutAssignment[];
  toggleMonthlySlotAvailability: (trainerId: string, date: string, time: string) => Promise<void>;
  updateMonthlySlotCategory: (trainerId: string, date: string, time: string, category: string) => Promise<void>;
  disableAllSlotsForDay: (trainerId: string, date: string) => Promise<void>;
  enableAllSlotsForDay: (trainerId: string, date: string) => Promise<void>;
  syncFromDB: () => void;
}

// Helper to generate default availability planner slots
export interface GeneratedDaySlots {
  date: string; // YYYY-MM-DD
  slots: Array<{
    id: string; // YYYY-MM-DD-time
    time: string; // "06:00 AM - 07:30 AM"
    isAvailable: boolean;
    isBooked: boolean;
    category?: string;
  }>;
}

// Reusable slot generation system helper
export const generateMonthlySlots = (
  month: number, // 0-indexed: 0-11
  year: number,
  options: {
    startHour: number; // e.g. 6 (6 AM)
    endHour: number; // e.g. 23 (11 PM)
    durationMinutes: number; // e.g. 90
    gapMinutes: number; // e.g. 60
  } = { startHour: 6, endHour: 23, durationMinutes: 90, gapMinutes: 60 }
): GeneratedDaySlots[] => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daySlotsList: GeneratedDaySlots[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const slots = [];
    
    let current = new Date(year, month, day, options.startHour, 0);
    const endLimit = new Date(year, month, day, options.endHour, 0);
    
    let slotIndex = 1;
    while (true) {
      const slotEnd = new Date(current.getTime() + options.durationMinutes * 60 * 1000);
      if (slotEnd.getTime() > endLimit.getTime()) {
        break;
      }
      
      const formatTime = (d: Date) => {
        let hr = d.getHours();
        const min = String(d.getMinutes()).padStart(2, '0');
        const ampm = hr >= 12 ? 'PM' : 'AM';
        hr = hr % 12;
        hr = hr ? hr : 12;
        return `${String(hr).padStart(2, '0')}:${min} ${ampm}`;
      };

      const timeRange = `${formatTime(current)} - ${formatTime(slotEnd)}`;
      slots.push({
        id: `${dateStr}-s${slotIndex}`,
        time: timeRange,
        isAvailable: true,
        isBooked: false,
      });

      slotIndex++;
      current = new Date(slotEnd.getTime() + options.gapMinutes * 60 * 1000);
    }

    daySlotsList.push({
      date: dateStr,
      slots
    });
  }

  return daySlotsList;
};

export const useCoachStore = create<CoachState>((set, get) => ({
  coaches: [],
  selectedCoachId: '',
  setSelectedCoachId: (id) => set({ selectedCoachId: id }),
  workoutAssignments: [],
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
  
  availabilityOverrides: [],

  toggleMonthlySlotAvailability: async (trainerId, date, time) => {
    const coachesList = Database.getCoaches();
    const coach = coachesList.find(c => c.id === trainerId);
    if (!coach) return;

    const currentOverrides = coach.preferences?.availabilityOverrides || [];
    const idx = currentOverrides.findIndex(o => o.date === date && o.time === time);

    let updatedOverrides = [...currentOverrides];
    if (idx >= 0) {
      const existing = currentOverrides[idx];
      if (existing.isAvailable === false) {
        if (existing.category) {
          updatedOverrides[idx] = { ...existing, isAvailable: true };
        } else {
          updatedOverrides.splice(idx, 1);
        }
      } else {
        updatedOverrides[idx] = { ...existing, isAvailable: false };
      }
    } else {
      updatedOverrides.push({ date, time, isAvailable: false });
    }

    const prevOverrides = coach.preferences?.availabilityOverrides ? JSON.parse(JSON.stringify(coach.preferences.availabilityOverrides)) : [];

    // Optimistically update local cache
    coach.preferences = {
      ...(coach.preferences || { online: false, radiusKm: 15, maxDailySessions: 5, categories: [] }),
      availabilityOverrides: updatedOverrides
    };
    get().syncFromDB();

    try {
      await Database.updateTrainerPreferences(trainerId, { availabilityOverrides: updatedOverrides });
    } catch (err: any) {
      // Rollback
      coach.preferences.availabilityOverrides = prevOverrides;
      get().syncFromDB();
      Alert.alert('Database Sync Error', 'Failed to save availability change. Rolled back state.\nError: ' + err.message);
    }
  },

  updateMonthlySlotCategory: async (trainerId, date, time, category) => {
    const coachesList = Database.getCoaches();
    const coach = coachesList.find(c => c.id === trainerId);
    if (!coach) return;

    const currentOverrides = coach.preferences?.availabilityOverrides || [];
    const idx = currentOverrides.findIndex(o => o.date === date && o.time === time);

    let updatedOverrides = [...currentOverrides];
    if (idx >= 0) {
      if (!category && currentOverrides[idx].isAvailable) {
        updatedOverrides.splice(idx, 1);
      } else {
        updatedOverrides[idx] = { ...currentOverrides[idx], category };
      }
    } else {
      if (category) {
        updatedOverrides.push({ date, time, isAvailable: true, category });
      }
    }

    const prevOverrides = coach.preferences?.availabilityOverrides ? JSON.parse(JSON.stringify(coach.preferences.availabilityOverrides)) : [];

    // Optimistically update
    coach.preferences = {
      ...(coach.preferences || { online: false, radiusKm: 15, maxDailySessions: 5, categories: [] }),
      availabilityOverrides: updatedOverrides
    };
    get().syncFromDB();

    try {
      await Database.updateTrainerPreferences(trainerId, { availabilityOverrides: updatedOverrides });
    } catch (err: any) {
      // Rollback
      coach.preferences.availabilityOverrides = prevOverrides;
      get().syncFromDB();
      Alert.alert('Database Sync Error', 'Failed to update category restriction. Rolled back state.\nError: ' + err.message);
    }
  },

  disableAllSlotsForDay: async (trainerId, date) => {
    const coachesList = Database.getCoaches();
    const coach = coachesList.find(c => c.id === trainerId);
    if (!coach) return;

    const currentOverrides = coach.preferences?.availabilityOverrides || [];
    const parsedDate = new Date(date);
    const daySlots = generateMonthlySlots(parsedDate.getMonth(), parsedDate.getFullYear())
      .find(d => d.date === date)?.slots || [];

    const bookings = Database.schema.bookings || [];
    const bookedTimes = bookings
      .filter((b: any) => b.trainerId === trainerId && normalizeDate(b.date) === normalizeDate(date) && b.status === 'upcoming')
      .map((b: any) => b.time);

    let updatedOverrides = [...currentOverrides];
    daySlots.forEach(slot => {
      if (bookedTimes.includes(slot.time)) return;
      const idx = updatedOverrides.findIndex(o => normalizeDate(o.date) === normalizeDate(date) && o.time === slot.time);
      if (idx >= 0) {
        updatedOverrides[idx] = { ...updatedOverrides[idx], isAvailable: false };
      } else {
        updatedOverrides.push({ date, time: slot.time, isAvailable: false });
      }
    });

    const prevOverrides = coach.preferences?.availabilityOverrides ? JSON.parse(JSON.stringify(coach.preferences.availabilityOverrides)) : [];

    // Optimistically update
    coach.preferences = {
      ...(coach.preferences || { online: false, radiusKm: 15, maxDailySessions: 5, categories: [] }),
      availabilityOverrides: updatedOverrides
    };
    get().syncFromDB();

    try {
      await Database.updateTrainerPreferences(trainerId, { availabilityOverrides: updatedOverrides });
    } catch (err: any) {
      // Rollback
      coach.preferences.availabilityOverrides = prevOverrides;
      get().syncFromDB();
      Alert.alert('Database Sync Error', 'Failed to disable all slots. Rolled back state.\nError: ' + err.message);
    }
  },

  enableAllSlotsForDay: async (trainerId, date) => {
    const coachesList = Database.getCoaches();
    const coach = coachesList.find(c => c.id === trainerId);
    if (!coach) return;

    const currentOverrides = coach.preferences?.availabilityOverrides || [];
    const updatedOverrides = currentOverrides.filter(o => normalizeDate(o.date) !== normalizeDate(date));

    const prevOverrides = coach.preferences?.availabilityOverrides ? JSON.parse(JSON.stringify(coach.preferences.availabilityOverrides)) : [];

    // Optimistically update
    coach.preferences = {
      ...(coach.preferences || { online: false, radiusKm: 15, maxDailySessions: 5, categories: [] }),
      availabilityOverrides: updatedOverrides
    };
    get().syncFromDB();

    try {
      await Database.updateTrainerPreferences(trainerId, { availabilityOverrides: updatedOverrides });
    } catch (err: any) {
      // Rollback
      coach.preferences.availabilityOverrides = prevOverrides;
      get().syncFromDB();
      Alert.alert('Database Sync Error', 'Failed to enable all slots. Rolled back state.\nError: ' + err.message);
    }
  },

  syncFromDB: () => {
    const userId = Database.getCurrentUserId();
    const coachesList = Database.getCoaches();
    let earningsList: TrainerEarning[] = [];
    let overrides: AvailabilityOverride[] = [];

    if (userId) {
      earningsList = Database.getEarnings(userId);
      const userObj = Database.schema.users.find(u => u.id === userId);
      const coachObj = userObj ? coachesList.find(c => c.name === userObj.name) : undefined;
      if (coachObj) {
        overrides = coachObj.preferences?.availabilityOverrides || [];
      }
    }
    set({
      coaches: coachesList,
      earningsList,
      totalEarnings: earningsList.reduce((acc, curr) => acc + curr.amount, 0),
      availabilityOverrides: overrides,
      workoutAssignments: Database.schema.trainer_workout_assignments || []
    });
  }
}));
