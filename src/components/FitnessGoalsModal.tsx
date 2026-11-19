import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeSheet } from './NativeSheet';
import { NativeGoalChip } from './NativeGoalChip';
import { NativePrimaryButton } from './NativePrimaryButton';
import { useUserProfileStore } from '../store/userProfileStore';
import { Database } from '../database/Database';
import { InteractionManager } from '../utils/interactionManager';

const allGoals = [
  'Weight Loss',
  'Fat Loss',
  'Muscle Gain',
  'Body Recomposition',
  'Strength',
  'Flexibility',
  'Mobility',
  'Sports Training',
  'Senior Fitness',
  'Post Pregnancy',
  'Rehabilitation',
  'General Fitness',
  'Maintain Weight',
];

interface FitnessGoalsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const FitnessGoalsModal: React.FC<FitnessGoalsModalProps> = ({
  visible,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const safeBottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 16) + 8;

  const profileGender = useUserProfileStore((s) => s.gender);
  const isFemale = (profileGender || '').trim().toLowerCase() === 'female';
  const visibleGoals = allGoals.filter((g) => g !== 'Post Pregnancy' || isFemale);

  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  // Sync state whenever modal opens
  useEffect(() => {
    if (visible) {
      const storeGoals = useUserProfileStore.getState().selectedGoals;
      const initial = Array.isArray(storeGoals) && storeGoals.length > 0 ? storeGoals : ['Strength'];
      // Only keep goals that are legitimately available (e.g. no 'Post Pregnancy' for non-females)
      setSelectedGoals(initial.filter((g) => visibleGoals.includes(g)));
    }
  }, [visible, visibleGoals]);

  const handleToggle = useCallback((goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  }, []);

  const handleSave = useCallback(() => {
    const goalsToSave = selectedGoals.length > 0 ? selectedGoals : ['General Fitness'];
    const initialGoals = useUserProfileStore.getState().selectedGoals || [];

    const hasChanged =
      goalsToSave.length !== initialGoals.length ||
      goalsToSave.some((g) => !initialGoals.includes(g));

    if (hasChanged) {
      // 1. Instantly update Zustand store
      useUserProfileStore.setState({
        selectedGoals: goalsToSave,
        targetGoal: goalsToSave[0] || '',
      });

      // 2. Persist to local database cache
      const userId = Database.getCurrentUserId();
      if (userId) {
        const dbProfile = Database.getProfile(userId);
        if (dbProfile) {
          dbProfile.selectedGoals = goalsToSave;
          if (goalsToSave.length > 0) dbProfile.fitnessGoal = goalsToSave[0];
        }

        // 3. Asynchronous non-blocking Supabase sync
        InteractionManager.runAfterInteractions(() => {
          useUserProfileStore.getState().setGoals(goalsToSave).catch((err) => {
            console.warn('[FitnessGoalsModal] Background sync error:', err);
          });
        });
      }
    }

    onClose();
  }, [selectedGoals, onClose]);

  return (
    <NativeSheet visible={visible} onClose={onClose}>
      <View style={{ paddingBottom: safeBottomPadding }} className="w-full px-5 pt-4 pb-3 gap-4">
        {/* Header without drag lid, with clear spacing */}
        <View className="flex-row justify-between items-start pb-3 border-b border-zinc-100/80">
          <View className="flex-1 pr-3">
            <Text className="text-zinc-900 text-lg font-black tracking-tight">Focus Training Targets</Text>
            <Text className="text-zinc-500 text-xs font-medium mt-1.5 leading-relaxed">
              Select multiple targets for custom workout drills.
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            className="w-8 h-8 rounded-full bg-zinc-100 items-center justify-center mt-0.5"
          >
            <Feather name="x" size={15} color="#101828" />
          </TouchableOpacity>
        </View>

        {/* Goals Chips List */}
        <View className="flex-row flex-wrap gap-x-2 gap-y-2 py-1">
          {visibleGoals.map((goal) => {
            const isSelected = selectedGoals.includes(goal);
            return (
              <NativeGoalChip
                key={goal}
                label={goal}
                selected={isSelected}
                onPress={() => handleToggle(goal)}
              />
            );
          })}
        </View>

        {/* Save Button */}
        <View className="pt-2">
          <NativePrimaryButton
            label="Save Training Goals"
            onPress={handleSave}
          />
        </View>
      </View>
    </NativeSheet>
  );
};

