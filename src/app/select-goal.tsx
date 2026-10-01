import React, { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { GoalSelectionView } from '../components/GoalSelectionView';
import { useAIWellnessStore } from '../store/aiWellnessStore';

export default function SelectGoalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ goal?: string }>();
  const [selectedGoal, setSelectedGoal] = useState<string>(() => {
    return params.goal || 'Flexibility';
  });

  const handleContinue = () => {
    // Navigate to virla-ai metrics step (Step 2/5 -> virla-ai step 3)
    router.push({
      pathname: '/virla-ai',
      params: {
        step: '3',
        goal: selectedGoal,
      },
    } as any);
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/virla-ai' as any);
    }
  };

  return (
    <GoalSelectionView
      selectedGoal={selectedGoal}
      onSelectGoal={setSelectedGoal}
      onContinue={handleContinue}
      onBack={handleBack}
      showHeader={true}
      stepNumber={1}
      totalSteps={5}
    />
  );
}
