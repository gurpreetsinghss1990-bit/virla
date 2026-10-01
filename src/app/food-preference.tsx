import React, { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FoodPreferenceSelectionView } from '../components/FoodPreferenceSelectionView';

export default function FoodPreferenceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ preference?: string }>();
  const [selectedPreference, setSelectedPreference] = useState<string>(() => {
    return params.preference || 'Vegetarian';
  });

  const handleContinue = () => {
    // Navigate to virla-ai step 5 (Physical Limitations & Safeguards)
    router.push({
      pathname: '/virla-ai',
      params: {
        step: '5',
        foodPreference: selectedPreference,
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
    <FoodPreferenceSelectionView
      selectedPreference={selectedPreference}
      onSelectPreference={setSelectedPreference}
      onContinue={handleContinue}
      onBack={handleBack}
      showHeader={true}
      stepNumber={3}
      totalSteps={5}
    />
  );
}
