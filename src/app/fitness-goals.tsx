import React, { useState, useRef, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Platform, InteractionManager, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUserProfileStore } from '../store/userProfileStore';
import { Database } from '../database/Database';
import { Feather } from '@expo/vector-icons';
import { ScreenHeader } from '../components/ScreenHeader';

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
  'Maintain Weight'
];

interface GoalCapsuleButtonProps {
  goal: string;
  isSelected: boolean;
  onPress: () => void;
}

const GoalCapsuleButton = React.memo(({ goal, isSelected, onPress }: GoalCapsuleButtonProps) => {
  return (
    <Pressable
      android_ripple={{
        color: isSelected ? 'rgba(255, 255, 255, 0.4)' : 'rgba(225, 29, 72, 0.25)',
        borderless: false,
      }}
      onPress={onPress}
      style={[
        styles.capsule,
        isSelected ? styles.capsuleSelected : styles.capsuleUnselected,
      ]}
    >
      <Text
        style={[
          styles.capsuleText,
          isSelected ? styles.capsuleTextSelected : styles.capsuleTextUnselected,
        ]}
      >
        {goal}
      </Text>
      {isSelected && <Feather name="check" size={13} color="#FFFFFF" />}
    </Pressable>
  );
});

export default function FitnessGoalsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isNavigatingRef = useRef(false);

  // Local state for instant, isolated UI updates with zero background tab churn
  const [initialGoals] = useState<string[]>(() => {
    const storeGoals = useUserProfileStore.getState().selectedGoals;
    return Array.isArray(storeGoals) && storeGoals.length > 0 ? [...storeGoals] : ['Strength'];
  });
  const [selectedGoals, setSelectedGoals] = useState<string[]>(() => [...initialGoals]);

  const selectedGoalsRef = useRef(selectedGoals);
  selectedGoalsRef.current = selectedGoals;

  const handleToggle = useCallback((goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  }, []);

  const persistGoals = useCallback(() => {
    const goalsToSave = selectedGoalsRef.current;
    
    // Check if goals actually changed before doing any DB write or network sync
    const hasChanged = 
      goalsToSave.length !== initialGoals.length ||
      goalsToSave.some((g) => !initialGoals.includes(g));

    if (!hasChanged) {
      return;
    }

    // 1. Instantly update Zustand store so profile tab displays them without lag
    useUserProfileStore.setState({
      selectedGoals: goalsToSave,
      targetGoal: goalsToSave.length > 0 ? goalsToSave[0] : '',
    });

    // 2. Persist to local database cache immediately (0ms)
    const userId = Database.getCurrentUserId();
    if (userId) {
      const dbProfile = Database.getProfile(userId);
      if (dbProfile) {
        dbProfile.selectedGoals = goalsToSave;
        if (goalsToSave.length > 0) dbProfile.fitnessGoal = goalsToSave[0];
      }

      // 3. Asynchronous non-blocking Supabase sync scheduled via runAfterInteractions
      InteractionManager.runAfterInteractions(() => {
        useUserProfileStore.getState().setGoals(goalsToSave).catch((err) => {
          console.warn('[FitnessGoals] Background sync caught error:', err);
        });
      });
    }
  }, [initialGoals]);

  const handleExitScreen = useCallback(() => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;

    persistGoals();

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile' as any);
    }
  }, [persistGoals, router]);

  return (
    <View style={{ flex: 1, backgroundColor: '#FCF5F5' }}>
      <ScreenHeader 
        title="Fitness Goals" 
        category="VIRLA TARGETS"
        backgroundColor="#FCF5F5"
        showBorder={false}
        onBack={handleExitScreen}
      />

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6" contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 40 }}>
        <View className="gap-6">
          
          <View>
            <Text className="text-zinc-900 text-2xl font-black tracking-tight leading-tight">Focus Training Targets</Text>
            <Text className="text-zinc-500 text-xs font-semibold mt-1 leading-relaxed">
              Select multiple targets. Coaches will review these focal points to design custom drills for your sessions.
            </Text>
          </View>

          {/* Goals Selection list */}
          <View className="flex-row flex-wrap gap-3">
            {allGoals.map((goal) => {
              const isSelected = selectedGoals.includes(goal);
              return (
                <GoalCapsuleButton
                  key={goal}
                  goal={goal}
                  isSelected={isSelected}
                  onPress={() => handleToggle(goal)}
                />
              );
            })}
          </View>

          {/* Action Save button with increased height & asynchronous handling */}
          <Pressable
            android_ripple={{
              color: 'rgba(255, 255, 255, 0.25)',
              borderless: false,
            }}
            onPress={handleExitScreen}
            style={[styles.saveButton]}
          >
            <Text style={styles.saveButtonText}>Save Training Goals</Text>
          </Pressable>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  capsule: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  capsuleSelected: {
    backgroundColor: '#E11D48',
    borderColor: '#E11D48',
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  capsuleUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E4E7',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  capsuleText: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    flexShrink: 0,
  },
  capsuleTextSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  capsuleTextUnselected: {
    color: '#18181B',
    fontWeight: '700',
  },
  saveButton: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 20,
    backgroundColor: '#E11D48',
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
});
