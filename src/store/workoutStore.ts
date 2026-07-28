import { create } from 'zustand';
import { Workout, Coach } from '../types';
import { Database } from '../database/Database';

interface WorkoutState {
  workouts: Workout[];
  coaches: Coach[];
  recommendation: {
    message: string;
    workoutId: string;
  };
  syncFromDB: () => void;
}

export const useWorkoutStore = create<WorkoutState>((set) => ({
  workouts: [],
  coaches: [],
  recommendation: {
    message: 'Based on your profile, today we recommend starting a PowerForge session.',
    workoutId: 'w-1',
  },
  syncFromDB: () => {
    const list = Database.getWorkouts();
    const coachesList = Database.getCoaches();
    set({
      workouts: list,
      coaches: coachesList
    });
  }
}));


