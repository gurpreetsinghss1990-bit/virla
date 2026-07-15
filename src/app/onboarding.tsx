import React, { useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Heading, Subtitle, PrimaryButton, PageIndicator } from '@/presentation/components';

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 4;

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      router.push('/get-started');
    }
  };

  const handleSkip = () => {
    router.push('/get-started');
  };

  // Pre-compiled list of workouts for Screen 2
  const workouts = [
    { title: 'Strength Training', icon: '🏋️‍♂️' },
    { title: 'Yoga', icon: '🧘‍♀️' },
    { title: 'Boxing', icon: '🥊' },
    { title: 'Dance', icon: '💃' },
    { title: 'Stretching', icon: '🤸‍♂️' },
    { title: 'Mobility', icon: '🔄' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Top Bar with Skip Button */}
      <View className="h-14 flex-row justify-end items-center px-6">
        {currentStep < totalSteps - 1 ? (
          <TouchableOpacity onPress={handleSkip} activeOpacity={0.6}>
            <Text className="text-zinc-400 text-sm font-semibold tracking-wider uppercase">
              Skip
            </Text>
          </TouchableOpacity>
        ) : (
          <View className="h-4" /> // empty space to keep layout alignment
        )}
      </View>

      {/* Screen Content */}
      <View className="flex-1 justify-between px-6 pb-8">
        {/* Dynamic slide presentation */}
        <View className="flex-1 justify-center my-auto">
          {currentStep === 0 && (
            <View className="space-y-6">
              {/* Illustration Placeholder */}
              <View className="w-full aspect-[4/3] bg-zinc-50 border border-zinc-100 rounded-3xl items-center justify-center relative overflow-hidden mb-8">
                {/* Abstract shape representing home/wellness */}
                <View className="absolute w-64 h-64 rounded-full bg-accent/5 -top-10 -right-10" />
                <View className="absolute w-40 h-40 rounded-full bg-primary/5 -bottom-10 -left-10" />
                <View className="w-20 h-20 rounded-2xl bg-white shadow-sm border border-zinc-100 items-center justify-center">
                  <Text className="text-4xl">🏡</Text>
                </View>
                <View className="absolute bottom-4 bg-white/90 border border-zinc-100 px-4 py-2 rounded-full shadow-sm">
                  <Text className="text-xs font-semibold text-primary">Wellness at your doorstep</Text>
                </View>
              </View>

              <Heading align="left">Fitness That Comes To You</Heading>
              <Subtitle align="left" className="mt-2">
                Book certified trainers at home in minutes. Get personalized training programs tailored to your space and schedules.
              </Subtitle>
            </View>
          )}

          {currentStep === 1 && (
            <View className="space-y-6">
              <Heading align="left">One Membership. {'\n'}Multiple Workouts.</Heading>
              <Subtitle align="left" className="mt-2 mb-6">
                Gain access to a variety of specialized wellness programs. Seamlessly switch between different types of workouts:
              </Subtitle>

              {/* Workouts Grid */}
              <View className="flex-row flex-wrap gap-3">
                {workouts.map((workout, idx) => (
                  <View 
                    key={idx} 
                    className="flex-row items-center bg-zinc-50 border border-zinc-100 px-4 py-3 rounded-2xl w-[47%]"
                  >
                    <Text className="text-xl mr-3">{workout.icon}</Text>
                    <Text className="text-sm font-semibold text-primary flex-shrink">
                      {workout.title}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {currentStep === 2 && (
            <View className="space-y-6">
              {/* Illustration Placeholder */}
              <View className="w-full aspect-[4/3] bg-zinc-50 border border-zinc-100 rounded-3xl items-center justify-center relative overflow-hidden mb-8">
                <View className="absolute w-48 h-48 rounded-full bg-accent/5 -bottom-8 -right-8" />
                <View className="flex-row items-center gap-3">
                  <View className="w-14 h-14 rounded-full bg-white border border-zinc-100 items-center justify-center shadow-sm">
                    <Text className="text-xl">👩‍🦰</Text>
                  </View>
                  <View className="w-16 h-16 rounded-full bg-primary items-center justify-center shadow-sm">
                    <Text className="text-2xl">👨‍💻</Text>
                  </View>
                  <View className="w-14 h-14 rounded-full bg-white border border-zinc-100 items-center justify-center shadow-sm">
                    <Text className="text-xl">👧</Text>
                  </View>
                </View>
                <View className="mt-6 bg-accent/10 border border-accent/20 px-4 py-2 rounded-full">
                  <Text className="text-xs font-bold text-accent">Family sharing active</Text>
                </View>
              </View>

              <Heading align="left">Your Family Can Join Too</Heading>
              <Subtitle align="left" className="mt-2">
                Share your wellness membership credits with up to 4 family members at no additional cost. Achieve your collective wellness goals together.
              </Subtitle>
            </View>
          )}

          {currentStep === 3 && (
            <View className="space-y-6">
              {/* Illustration Placeholder */}
              <View className="w-full aspect-[4/3] bg-zinc-50 border border-zinc-100 rounded-3xl items-center justify-center relative overflow-hidden mb-8">
                <View className="absolute w-52 h-52 rounded-full bg-primary/5 -top-10 -left-10" />
                <View className="w-4/5 bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm">
                  <View className="flex-row items-center mb-3">
                    <View className="w-10 h-10 rounded-full bg-zinc-100 items-center justify-center mr-3">
                      <Text className="text-lg">📋</Text>
                    </View>
                    <View>
                      <Text className="text-xs text-zinc-400 font-bold uppercase tracking-wider">AI Report</Text>
                      <Text className="text-sm font-extrabold text-primary">Monthly Wellness Index</Text>
                    </View>
                  </View>
                  <View className="h-2 bg-zinc-100 rounded-full mb-2">
                    <View className="h-2 bg-accent rounded-full w-[85%]" />
                  </View>
                  <Text className="text-xs text-zinc-500 font-medium">Wellness score: 85% (Excellent progress)</Text>
                </View>
              </View>

              <Heading align="left">Meet Your Wellness Coach</Heading>
              <Subtitle align="left" className="mt-2">
                Work with elite certified coaches and receive monthly AI-powered wellness reports to track your metrics, posture improvements, and goals.
              </Subtitle>
            </View>
          )}
        </View>

        {/* Footer Navigation */}
        <View className="mt-12 space-y-6">
          <PageIndicator activeIndex={currentStep} total={totalSteps} className="mb-4" />
          
          <PrimaryButton
            title={currentStep === totalSteps - 1 ? "Get Started" : "Continue"}
            onPress={handleNext}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
