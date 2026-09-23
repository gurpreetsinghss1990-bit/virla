import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserProfileStore } from '../store/userProfileStore';
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

export default function FitnessGoalsScreen() {
  const router = useRouter();
  const [selectedGoals, setSelectedGoals] = useState<string[]>(() => {
    const storeGoals = useUserProfileStore.getState().selectedGoals;
    return Array.isArray(storeGoals) && storeGoals.length > 0 ? [...storeGoals] : ['Strength'];
  });

  const handleToggle = (goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  };

  const handleSave = async () => {
    try {
      await useUserProfileStore.getState().setGoals(selectedGoals);
    } catch (e) {
      console.warn('[FitnessGoals] Error saving goals:', e);
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile' as any);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/profile' as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FCF5F5' }}>
      <ScreenHeader 
        title="Fitness Goals" 
        category="VIRLA TARGETS"
        onBack={handleBack}
        rightElement={
          <TouchableOpacity onPress={handleSave} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text className="text-indigo-600 text-xs font-black uppercase tracking-wider">Done</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 60 }}>
        <View className="gap-6">
          
          <View>
            <Text className="text-zinc-900 text-2xl font-black tracking-tight leading-tight">Focus Training Targets</Text>
            <Text className="text-zinc-500 text-xs font-semibold mt-1 leading-relaxed">
              Select multiple targets. Coaches will review these focal points to design custom drills for your sessions.
            </Text>
          </View>

          {/* Goals Selection list */}
          <View style={styles.gridContainer}>
            {allGoals.map((goal) => {
              const isSelected = selectedGoals.includes(goal);
              return (
                <TouchableOpacity
                  key={goal}
                  activeOpacity={0.8}
                  onPress={() => handleToggle(goal)}
                  style={[
                    styles.capsule,
                    isSelected ? styles.capsuleSelected : styles.capsuleUnselected
                  ]}
                >
                  <Text
                    style={[
                      styles.capsuleText,
                      isSelected ? styles.capsuleTextSelected : styles.capsuleTextUnselected
                    ]}
                  >
                    {goal}
                  </Text>
                  {isSelected && <Feather name="check" size={12} color="#FFFFFF" />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Action Save button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSave}
            style={styles.saveButton}
          >
            <Text style={styles.saveButtonText}>Save Training Goals</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  capsule: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  capsuleSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  capsuleUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E4E7',
  },
  capsuleText: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  capsuleTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  capsuleTextUnselected: {
    color: '#18181B',
    fontWeight: '600',
  },
  saveButton: {
    width: '100%',
    backgroundColor: '#101828',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
