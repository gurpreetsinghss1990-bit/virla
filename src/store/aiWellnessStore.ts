import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AIWellnessPlan {
  // Collected Info
  age: string;
  gender: string;
  height: string;
  weight: string;
  fitnessGoal: string;
  activityLevel: string;
  workoutFrequency: string;
  preferredDuration: string;
  wakeupTime: string;
  sleepTime: string;
  lifestyle: string[];
  foodPreference: string;
  dietRestrictions: string[];
  medicalConditions: string[];
  waterIntake: string;
  supplements: string[];

  // Generated Plan Recommendations
  dailyCalories: number;
  proteinTarget: number;
  carbTarget: number;
  fatTarget: number;
  hydrationGoal: string;
  mealTiming: string;
  breakfastSuggestions: string[];
  lunchSuggestions: string[];
  dinnerSuggestions: string[];
  snackSuggestions: string[];
  workoutRecommendation: string;
  dailyStepGoal: number;
  sleepRecommendation: string;
  recoveryAdvice: string;
  weeklyProgressGoals: string[];
  
  generatedAt: number;
}

interface AIWellnessState {
  savedPlan: AIWellnessPlan | null;
  savePlan: (plan: AIWellnessPlan) => void;
  clearPlan: () => void;
}

export const useAIWellnessStore = create<AIWellnessState>()(
  persist(
    (set) => ({
      savedPlan: null,
      savePlan: (plan) => set({ savedPlan: plan }),
      clearPlan: () => set({ savedPlan: null }),
    }),
    {
      name: 'virla-ai-wellness-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
