import React, { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MetricsSelectionView } from '../components/MetricsSelectionView';

export default function TellUsAboutYourMetricsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    gender?: string;
    age?: string;
    height?: string;
    weight?: string;
  }>();

  const [gender, setGender] = useState<string>(params.gender || 'Male');
  const [age, setAge] = useState<string>(params.age || '28');
  const [height, setHeight] = useState<string>(params.height || '178 cm');
  const [weight, setWeight] = useState<string>(params.weight || '72');

  const handleContinue = () => {
    // Navigate to step 4 (Nutrition & Diet Preferences) in virla-ai onboarding
    router.push({
      pathname: '/virla-ai',
      params: {
        step: '4',
        gender,
        age,
        height,
        weight,
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
    <MetricsSelectionView
      gender={gender}
      setGender={setGender}
      age={age}
      setAge={setAge}
      height={height}
      setHeight={setHeight}
      weight={weight}
      setWeight={setWeight}
      onContinue={handleContinue}
      onBack={handleBack}
      showHeader={true}
      stepNumber={2}
      totalSteps={5}
    />
  );
}
