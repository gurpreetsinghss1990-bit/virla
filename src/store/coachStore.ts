

import { create } from 'zustand';
import { Coach, TrainerEarning, ScheduleSlot, AvailabilityOverride, TrainerWorkoutAssignment } from '../types';
import { Alert } from 'react-native';
import { Database } from '../database/Database';
import { normalizeDate, canonicalizeTimeRange } from '../utils/date';
import { useUserStore } from './userStore';

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
    durationMinutes: number; // e.g. 60
    gapMinutes: number; // e.g. 30
  } = { startHour: 6, endHour: 23, durationMinutes: 60, gapMinutes: 30 }
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
    console.log('[AVAILABILITY-HARD-FIX] STORE FUNCTION ENTERED: toggleMonthlySlotAvailability');
    console.log('[AVAILABILITY-HARD-FIX] trainer id:', trainerId);
    console.log('[AVAILABILITY-HARD-FIX] date:', date);
    console.log('[AVAILABILITY-HARD-FIX] time:', time);

    const coachesList = Database.getCoaches();
    const coach = coachesList.find(c => c.id === trainerId);
    if (!coach) {
      console.warn('[AVAILABILITY-HARD-FIX] coach not found for ID:', trainerId);
      return;
    }

    const currentOverrides = coach.preferences?.availabilityOverrides || [];
    console.log('[AVAILABILITY-HARD-FIX] PREVIOUS OVERRIDES:', JSON.stringify(currentOverrides, null, 2));

    const idx = currentOverrides.findIndex(o => 
      normalizeDate(o.date) === normalizeDate(date) && 
      canonicalizeTimeRange(o.time) === canonicalizeTimeRange(time)
    );

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
      updatedOverrides.push({ 
        date: normalizeDate(date), 
        time: canonicalizeTimeRange(time), 
        isAvailable: false 
      });
    }

    // Deduplicate overrides by date + time
    const seen = new Set<string>();
    updatedOverrides = updatedOverrides.filter(o => {
      const key = `${normalizeDate(o.date)}#${canonicalizeTimeRange(o.time)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log('[AVAILABILITY-HARD-FIX] NEW OVERRIDES:', JSON.stringify(updatedOverrides, null, 2));

    const prevOverrides = coach.preferences?.availabilityOverrides ? JSON.parse(JSON.stringify(coach.preferences.availabilityOverrides)) : [];

    // Optimistically update local cache
    coach.preferences = {
      ...(coach.preferences || { online: false, radiusKm: 15, maxDailySessions: 5, categories: [] }),
      availabilityOverrides: updatedOverrides
    };
    get().syncFromDB();

    console.log('[AVAILABILITY-HARD-FIX] ZUSTAND AFTER UPDATE:', JSON.stringify(get().availabilityOverrides, null, 2));
    console.log('[AVAILABILITY-HARD-FIX] PERSISTING overrides to database...');

    try {
      await Database.updateTrainerPreferences(trainerId, { availabilityOverrides: updatedOverrides });
      console.log('[AVAILABILITY-HARD-FIX] DB persistence succeeded');

      // Database verification
      const reloadedCoach = Database.schema.coaches.find(c => c.id === trainerId);
      const reloadedOverrides = reloadedCoach?.preferences?.availabilityOverrides || [];
      console.log('[AVAILABILITY-HARD-FIX] DATABASE VERIFICATION (reloaded overrides count):', reloadedOverrides.length);
    } catch (err: any) {
      console.error('[AVAILABILITY-HARD-FIX] DB persistence FAILED:', err.message);
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
    const idx = currentOverrides.findIndex(o => 
      normalizeDate(o.date) === normalizeDate(date) && 
      canonicalizeTimeRange(o.time) === canonicalizeTimeRange(time)
    );

    let updatedOverrides = [...currentOverrides];
    if (idx >= 0) {
      if (!category && currentOverrides[idx].isAvailable) {
        updatedOverrides.splice(idx, 1);
      } else {
        updatedOverrides[idx] = { ...currentOverrides[idx], category };
      }
    } else {
      if (category) {
        updatedOverrides.push({ 
          date: normalizeDate(date), 
          time: canonicalizeTimeRange(time), 
          isAvailable: true, 
          category 
        });
      }
    }

    // Deduplicate overrides by date + time
    const seen = new Set<string>();
    updatedOverrides = updatedOverrides.filter(o => {
      const key = `${normalizeDate(o.date)}#${canonicalizeTimeRange(o.time)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
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
      Alert.alert('Database Sync Error', 'Failed to update category restriction. Rolled back state.\nError: ' + err.message);
    }
  },

  disableAllSlotsForDay: async (trainerId, date) => {
    console.log('[AVAILABILITY-HARD-FIX] STORE FUNCTION ENTERED: disableAllSlotsForDay');
    console.log('[AVAILABILITY-HARD-FIX] trainer id:', trainerId);
    console.log('[AVAILABILITY-HARD-FIX] date:', date);

    const coachesList = Database.getCoaches();
    const coach = coachesList.find(c => c.id === trainerId);
    if (!coach) {
      console.warn('[AVAILABILITY-HARD-FIX] coach not found for ID:', trainerId);
      return;
    }

    const currentOverrides = coach.preferences?.availabilityOverrides || [];
    console.log('[AVAILABILITY-HARD-FIX] PREVIOUS OVERRIDES:', JSON.stringify(currentOverrides, null, 2));

    const parts = date.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const daySlots = generateMonthlySlots(month, year)
      .find(d => d.date === date)?.slots || [];

    console.log('[AVAILABILITY-HARD-FIX] GENERATED SLOTS COUNT:', daySlots.length);
    if (daySlots.length === 0) {
      console.error('[AVAILABILITY-HARD-FIX] ERROR: GENERATED SLOTS COUNT IS 0! STOPPING.');
      return;
    }

    const bookings = Database.schema.bookings || [];
    const bookedTimes = bookings
      .filter((b: any) => b.trainerId === trainerId && normalizeDate(b.date) === normalizeDate(date) && b.status === 'upcoming')
      .map((b: any) => b.time);

    let updatedOverrides = [...currentOverrides];
    daySlots.forEach(slot => {
      if (bookedTimes.includes(slot.time)) return;
      const canonicalTime = canonicalizeTimeRange(slot.time);
      const idx = updatedOverrides.findIndex(o => 
        normalizeDate(o.date) === normalizeDate(date) && 
        canonicalizeTimeRange(o.time) === canonicalTime
      );
      if (idx >= 0) {
        updatedOverrides[idx] = { ...updatedOverrides[idx], isAvailable: false };
      } else {
        updatedOverrides.push({ 
          date: normalizeDate(date), 
          time: canonicalTime, 
          isAvailable: false 
        });
      }
    });

    // Deduplicate overrides by date + time
    const seen = new Set<string>();
    updatedOverrides = updatedOverrides.filter(o => {
      const key = `${normalizeDate(o.date)}#${canonicalizeTimeRange(o.time)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log('[AVAILABILITY-HARD-FIX] NEW OVERRIDES:', JSON.stringify(updatedOverrides, null, 2));

    const prevOverrides = coach.preferences?.availabilityOverrides ? JSON.parse(JSON.stringify(coach.preferences.availabilityOverrides)) : [];

    // Optimistically update
    coach.preferences = {
      ...(coach.preferences || { online: false, radiusKm: 15, maxDailySessions: 5, categories: [] }),
      availabilityOverrides: updatedOverrides
    };
    get().syncFromDB();

    console.log('[AVAILABILITY-HARD-FIX] ZUSTAND AFTER UPDATE:', JSON.stringify(get().availabilityOverrides, null, 2));
    console.log('[AVAILABILITY-HARD-FIX] PERSISTING overrides to database...');

    try {
      await Database.updateTrainerPreferences(trainerId, { availabilityOverrides: updatedOverrides });
      console.log('[AVAILABILITY-HARD-FIX] DB persistence succeeded');

      // Database verification
      const reloadedCoach = Database.schema.coaches.find(c => c.id === trainerId);
      const reloadedOverrides = reloadedCoach?.preferences?.availabilityOverrides || [];
      console.log('[AVAILABILITY-HARD-FIX] DATABASE VERIFICATION (reloaded overrides count):', reloadedOverrides.length);
    } catch (err: any) {
      console.error('[AVAILABILITY-HARD-FIX] DB persistence FAILED:', err.message);
      // Rollback
      coach.preferences.availabilityOverrides = prevOverrides;
      get().syncFromDB();
      Alert.alert('Database Sync Error', 'Failed to disable all slots. Rolled back state.\nError: ' + err.message);
    }
  },

  enableAllSlotsForDay: async (trainerId, date) => {
    console.log('[AVAILABILITY-HARD-FIX] STORE FUNCTION ENTERED: enableAllSlotsForDay');
    console.log('[AVAILABILITY-HARD-FIX] trainer id:', trainerId);
    console.log('[AVAILABILITY-HARD-FIX] date:', date);

    const coachesList = Database.getCoaches();
    const coach = coachesList.find(c => c.id === trainerId);
    if (!coach) {
      console.warn('[AVAILABILITY-HARD-FIX] coach not found for ID:', trainerId);
      return;
    }

    const currentOverrides = coach.preferences?.availabilityOverrides || [];
    console.log('[AVAILABILITY-HARD-FIX] PREVIOUS OVERRIDES:', JSON.stringify(currentOverrides, null, 2));

    let updatedOverrides = currentOverrides.filter(o => normalizeDate(o.date) !== normalizeDate(date));

    // Deduplicate overrides by date + time
    const seen = new Set<string>();
    updatedOverrides = updatedOverrides.filter(o => {
      const key = `${normalizeDate(o.date)}#${canonicalizeTimeRange(o.time)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log('[AVAILABILITY-HARD-FIX] NEW OVERRIDES:', JSON.stringify(updatedOverrides, null, 2));

    const prevOverrides = coach.preferences?.availabilityOverrides ? JSON.parse(JSON.stringify(coach.preferences.availabilityOverrides)) : [];

    // Optimistically update
    coach.preferences = {
      ...(coach.preferences || { online: false, radiusKm: 15, maxDailySessions: 5, categories: [] }),
      availabilityOverrides: updatedOverrides
    };
    get().syncFromDB();

    console.log('[AVAILABILITY-HARD-FIX] ZUSTAND AFTER UPDATE:', JSON.stringify(get().availabilityOverrides, null, 2));
    console.log('[AVAILABILITY-HARD-FIX] PERSISTING overrides to database...');

    try {
      await Database.updateTrainerPreferences(trainerId, { availabilityOverrides: updatedOverrides });
      console.log('[AVAILABILITY-HARD-FIX] DB persistence succeeded');

      // Database verification
      const reloadedCoach = Database.schema.coaches.find(c => c.id === trainerId);
      const reloadedOverrides = reloadedCoach?.preferences?.availabilityOverrides || [];
      console.log('[AVAILABILITY-HARD-FIX] DATABASE VERIFICATION (reloaded overrides count):', reloadedOverrides.length);
    } catch (err: any) {
      console.error('[AVAILABILITY-HARD-FIX] DB persistence FAILED:', err.message);
      // Rollback
      coach.preferences.availabilityOverrides = prevOverrides;
      get().syncFromDB();
      Alert.alert('Database Sync Error', 'Failed to enable all slots. Rolled back state.\nError: ' + err.message);
    }
  },

  syncFromDB: () => {
    const userId = useUserStore.getState().user?.id || Database.getCurrentUserId();
    const coachesList = Database.getCoaches();
    let earningsList: TrainerEarning[] = [];
    let overrides: AvailabilityOverride[] = [];

    if (userId) {
      earningsList = Database.getEarnings(userId);
      const userObj = Database.schema.users.find(u => u.id === userId);
      let coachObj = coachesList.find(c => c.id === userId);
      if (!coachObj && userObj) {
        coachObj = coachesList.find(c => c.name === userObj.name);
      }
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
