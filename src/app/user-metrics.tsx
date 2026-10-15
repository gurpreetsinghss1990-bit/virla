import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Animated,
  Vibration,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Rect,
} from 'react-native-svg';
import { Ionicons, Feather } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useUserStore } from '../store/userStore';
import { Database } from '../database/Database';
import { supabase } from '../database/supabaseClient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type GenderType = 'Male' | 'Female' | 'Other';
type WeightUnit = 'kg' | 'lbs';
type HeightUnit = 'cm' | 'ft';

interface InterestTopic {
  id: string;
  name: string;
  emoji: string;
  bgTint: string;
  badgeColor?: string;
  renderIcon?: (size?: number) => React.ReactNode;
}

const INTEREST_TOPICS: InterestTopic[] = [
  {
    id: 'nutrition',
    name: 'Nutrition',
    emoji: '🍎',
    bgTint: '#FFF1F2',
  },
  {
    id: 'organic',
    name: 'Organic',
    emoji: '🌱',
    bgTint: '#ECFDF5',
  },
  {
    id: 'meditation',
    name: 'Meditation',
    emoji: '🧘',
    bgTint: '#FEF3C7',
  },
  {
    id: 'sports',
    name: 'Sports',
    emoji: '🏀',
    bgTint: '#FFF7ED',
  },
  {
    id: 'smoke_free',
    name: 'Smoke Free',
    emoji: '🚭',
    bgTint: '#F1F5F9',
  },
  {
    id: 'sleep',
    name: 'Sleep',
    emoji: '🌙',
    bgTint: '#EEF2FF',
  },
  {
    id: 'health',
    name: 'Health',
    emoji: '🩺',
    bgTint: '#FFF1F2',
  },
  {
    id: 'running',
    name: 'Running',
    emoji: '👟',
    bgTint: '#F0F9FF',
  },
  {
    id: 'vegan',
    name: 'Vegan',
    emoji: '🥦',
    bgTint: '#ECFDF5',
  },
];

export default function UserMetricsLandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Multi-step progression states (Step 1: Gender, Step 2: Name, Step 3: Weight & Height, Step 4: Interests/Goals)
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  // Form State
  const [name, setName] = useState('');
  const [gender, setGender] = useState<GenderType>('Male');
  const [weight, setWeight] = useState(70);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [height, setHeight] = useState(175);
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm');
  const [age, setAge] = useState(25);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([
    'nutrition',
    'meditation',
    'running',
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Animations
  const contentFadeAnim = useRef(new Animated.Value(1)).current;
  const contentTranslateY = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1 / totalSteps)).current;

  // Pre-fill user name if already partially known
  useEffect(() => {
    const currUser = useUserStore.getState().user;
    if (currUser && currUser.name && currUser.name !== 'Complete your profile') {
      setName(currUser.name);
    }
  }, []);

  // Animate progress bar when currentStep changes
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: currentStep / totalSteps,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [currentStep]);

  const triggerHaptic = () => {
    if (Platform.OS !== 'web') {
      try {
        Vibration.vibrate(10);
      } catch (_) {}
    }
  };

  const animateStepTransition = (nextStep: number) => {
    Animated.parallel([
      Animated.timing(contentFadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslateY, {
        toValue: -10,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentStep(nextStep);
      contentTranslateY.setValue(14);
      Animated.parallel([
        Animated.timing(contentFadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(contentTranslateY, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const toggleInterest = (id: string) => {
    triggerHaptic();
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    triggerHaptic();

    if (currentStep === 1) {
      // Gender chosen -> go to Name
      animateStepTransition(2);
    } else if (currentStep === 2) {
      // Name entered -> go to Weight & Height
      if (!name.trim()) {
        Alert.alert('Name Required', 'Please tell us your name to continue.');
        return;
      }
      animateStepTransition(3);
    } else if (currentStep === 3) {
      // Physical metrics chosen -> go to Step 4 (Interests / Goals)
      animateStepTransition(4);
    } else if (currentStep === 4) {
      // Final submit
      handleFinalSubmit();
    }
  };

  const handleBack = () => {
    triggerHaptic();
    if (currentStep > 1) {
      animateStepTransition(currentStep - 1);
    } else {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/get-started' as any);
      }
    }
  };

  const handleSkipOrPreferNotToSay = () => {
    triggerHaptic();
    if (currentStep === 1) {
      setGender('Other');
      animateStepTransition(2);
    } else if (currentStep === 4) {
      handleFinalSubmit();
    } else {
      handleNext();
    }
  };

  const handleFinalSubmit = async () => {
    triggerHaptic();
    setIsSubmitting(true);

    try {
      const userStore = useUserStore.getState();
      const currUser = userStore.user;
      const userId = currUser?.id;

      if (userId) {
        // 1. Update user row in remote Supabase
        const defaultAvatar = (gender || '').toLowerCase() === 'female'
          ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=350&q=80'
          : 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=350&q=80';

        await supabase
          .from('users')
          .update({
            name: name.trim() || 'Virla Athlete',
            avatar: defaultAvatar,
            registration_status: 'complete',
          })
          .eq('id', userId);

        // 2. Persist in local database profile
        Database.setCurrentUserId(userId);
        Database.updateProfile(userId, {
          gender,
          age,
          height: `${height} ${heightUnit}`,
          weight: `${weight} ${weightUnit}`,
          trainerPreference: 'no_preference',
          selectedGoals: selectedInterests,
        });

        // 3. Update active user store
        userStore.updateProfile({
          name: name.trim() || 'Virla Athlete',
          avatar: defaultAvatar,
          registrationStatus: 'complete',
        });
        userStore.setCompletedOnboarding(true);
      }

      router.replace('/(tabs)');
    } catch (err: any) {
      console.warn('[UserMetrics] Profile persistence warning:', err);
      router.replace('/(tabs)');
    } finally {
      setIsSubmitting(false);
    }
  };

  // BMI calculation for step 3
  const bmiData = useMemo(() => {
    const heightInMeters = heightUnit === 'cm' ? height / 100 : (height * 30.48) / 100;
    const weightInKg = weightUnit === 'kg' ? weight : weight * 0.453592;
    if (heightInMeters <= 0) return { bmi: '--', status: 'Healthy', color: '#16A34A' };

    const bmiVal = weightInKg / (heightInMeters * heightInMeters);
    const rounded = bmiVal.toFixed(1);

    if (bmiVal < 18.5) return { bmi: rounded, status: 'Underweight', color: '#DC2626' };
    if (bmiVal < 25) return { bmi: rounded, status: 'Normal / Healthy', color: '#16A34A' };
    if (bmiVal < 30) return { bmi: rounded, status: 'Overweight', color: '#EA580C' };
    return { bmi: rounded, status: 'High Focus Zone', color: '#DC2626' };
  }, [weight, height, weightUnit, heightUnit]);

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />

      {/* Top Header matching reference screen */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 12,
        }}
        className="bg-white"
      >
        <View className="flex-row items-center justify-between">
          {/* Back Icon */}
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.7}
            className="w-10 h-10 items-center justify-center -ml-2"
          >
            <Feather name="chevron-left" size={26} color="#111827" />
          </TouchableOpacity>

          {/* Centered Title & Segmented Progress Bar */}
          <View className="items-center flex-1 mx-2">
            <Text className="text-[#E11D48] text-xs font-black tracking-widest uppercase mb-1.5">
              {currentStep === 4 ? 'GOAL SELECTION' : 'VIRLA ONBOARDING'}
            </Text>

            <View className="w-24 h-1 bg-[#F3F4F6] rounded-full overflow-hidden">
              <Animated.View
                style={{
                  height: '100%',
                  backgroundColor: '#E11D48',
                  borderRadius: 999,
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                }}
              />
            </View>
          </View>

          {/* Right empty spacer to keep progress bar and title centered */}
          <View className="w-10" />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: insets.bottom + 20,
            flexGrow: 1,
            justifyContent: 'space-between',
          }}
        >
          {/* Animated Main Content Body */}
          <Animated.View
            style={{
              opacity: contentFadeAnim,
              transform: [{ translateY: contentTranslateY }],
            }}
          >
            {/* ================= STEP 1: GENDER SELECTION ================= */}
            {currentStep === 1 && (
              <View>
                <View className="items-center mt-2 mb-1">
                  <View className="px-3.5 py-1 rounded-full bg-[#FFF1F2]">
                    <Text className="text-[#E11D48] text-[11px] font-black uppercase tracking-wider">
                      STEP 1 OF 4
                    </Text>
                  </View>
                </View>

                <Text className="text-[#101828] text-[28px] font-black tracking-tight text-center mt-2 leading-[36px]">
                  Which one are you?
                </Text>

                <View className="flex-row justify-between gap-4 mt-8">
                  {/* Male Card */}
                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => {
                      triggerHaptic();
                      setGender('Male');
                    }}
                    style={{
                      shadowColor: gender === 'Male' ? '#E11D48' : '#000',
                      shadowOffset: { width: 0, height: gender === 'Male' ? 6 : 2 },
                      shadowOpacity: gender === 'Male' ? 0.18 : 0.04,
                      shadowRadius: gender === 'Male' ? 14 : 8,
                      elevation: gender === 'Male' ? 6 : 1,
                    }}
                    className={`flex-1 rounded-[28px] p-4 items-center justify-between min-h-[290px] border-2 transition-all ${
                      gender === 'Male'
                        ? 'border-[#E11D48] bg-white'
                        : 'border-[#F3F4F6] bg-[#FAFAFC]'
                    }`}
                  >
                    <View className="flex-1 w-full items-center justify-center my-2">
                      <Image
                        source={require('../../assets/images/gender_male_runner.png')}
                        style={{
                          width: '100%',
                          height: 140,
                          resizeMode: 'contain',
                        }}
                      />
                    </View>

                    <View
                      className={`w-full py-3.5 rounded-2xl items-center justify-center shadow-sm ${
                        gender === 'Male' ? 'bg-[#E11D48]' : 'bg-white border border-[#E5E7EB]'
                      }`}
                    >
                      <Text
                        className={`text-sm font-bold ${
                          gender === 'Male' ? 'text-white' : 'text-[#374151]'
                        }`}
                      >
                        Male
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Female Card */}
                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => {
                      triggerHaptic();
                      setGender('Female');
                    }}
                    style={{
                      shadowColor: gender === 'Female' ? '#E11D48' : '#000',
                      shadowOffset: { width: 0, height: gender === 'Female' ? 6 : 2 },
                      shadowOpacity: gender === 'Female' ? 0.18 : 0.04,
                      shadowRadius: gender === 'Female' ? 14 : 8,
                      elevation: gender === 'Female' ? 6 : 1,
                    }}
                    className={`flex-1 rounded-[28px] p-4 items-center justify-between min-h-[290px] border-2 transition-all ${
                      gender === 'Female'
                        ? 'border-[#E11D48] bg-white'
                        : 'border-[#F3F4F6] bg-[#FAFAFC]'
                    }`}
                  >
                    <View className="flex-1 w-full items-center justify-center my-2">
                      <Image
                        source={require('../../assets/images/gender_female_yoga.jpg')}
                        style={{
                          width: '100%',
                          height: 140,
                          resizeMode: 'contain',
                        }}
                      />
                    </View>

                    <View
                      className={`w-full py-3.5 rounded-2xl items-center justify-center shadow-sm ${
                        gender === 'Female' ? 'bg-[#E11D48]' : 'bg-white border border-[#E5E7EB]'
                      }`}
                    >
                      <Text
                        className={`text-sm font-bold ${
                          gender === 'Female' ? 'text-white' : 'text-[#374151]'
                        }`}
                      >
                        Female
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

                <Text className="text-[#6B7280] text-sm text-center mt-7 leading-relaxed px-4">
                  To give you a customized experience we need to know your gender
                </Text>
              </View>
            )}

            {/* ================= STEP 2: NAME INPUT ================= */}
            {currentStep === 2 && (
              <View className="mt-2">
                <View className="items-center mb-1">
                  <View className="px-3.5 py-1 rounded-full bg-[#FFF1F2]">
                    <Text className="text-[#E11D48] text-[11px] font-black uppercase tracking-wider">
                      STEP 2 OF 4
                    </Text>
                  </View>
                </View>

                <Text className="text-[#101828] text-[28px] font-black tracking-tight text-center mt-2 leading-[36px]">
                  What's your name?
                </Text>
                <Text className="text-[#6B7280] text-sm text-center mt-2 px-2">
                  We'll use this to personalize your journey and connect you with trainers.
                </Text>

                <View className="mt-8 bg-[#FAFAFC] border border-[#E5E7EB] rounded-[24px] p-6 shadow-sm">
                  <Text className="text-[#6B7280] text-xs font-bold uppercase tracking-wider mb-2">
                    FULL NAME
                  </Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Enter your full name"
                    placeholderTextColor="#9CA3AF"
                    autoFocus
                    autoCapitalize="words"
                    className="w-full text-[#111827] text-xl font-bold py-2 border-b border-[#E11D48]"
                  />
                </View>
              </View>
            )}

            {/* ================= STEP 3: PHYSICAL METRICS ================= */}
            {currentStep === 3 && (
              <View className="mt-2">
                <View className="items-center mb-1">
                  <View className="px-3.5 py-1 rounded-full bg-[#FFF1F2]">
                    <Text className="text-[#E11D48] text-[11px] font-black uppercase tracking-wider">
                      STEP 3 OF 4
                    </Text>
                  </View>
                </View>

                <Text className="text-[#101828] text-[28px] font-black tracking-tight text-center mt-2 leading-[36px]">
                  Your Body Metrics
                </Text>
                <Text className="text-[#6B7280] text-sm text-center mt-2">
                  Helps us calculate accurate calorie burn and custom workout intensities.
                </Text>

                {/* Weight Card */}
                <View className="mt-6 bg-white border border-[#F3F4F6] rounded-[28px] p-6 items-center shadow-md">
                  <View className="flex-row items-center justify-between w-full mb-4">
                    <Text className="text-[#6B7280] text-xs font-bold uppercase tracking-wider">
                      WEIGHT
                    </Text>
                    <View className="flex-row bg-[#F3F4F6] p-1 rounded-xl">
                      {(['kg', 'lbs'] as WeightUnit[]).map((u) => (
                        <TouchableOpacity
                          key={u}
                          onPress={() => {
                            triggerHaptic();
                            setWeightUnit(u);
                          }}
                          className={`px-3 py-1 rounded-lg ${
                            weightUnit === u ? 'bg-[#E11D48]' : 'bg-transparent'
                          }`}
                        >
                          <Text
                            className={`text-[10px] font-black uppercase ${
                              weightUnit === u ? 'text-white' : 'text-[#6B7280]'
                            }`}
                          >
                            {u}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View className="flex-row items-center justify-between w-full px-2 my-2">
                    <TouchableOpacity
                      onPress={() => {
                        triggerHaptic();
                        setWeight((prev) => Math.max(30, prev - 1));
                      }}
                      className="w-13 h-13 rounded-2xl bg-[#FFF1F2] border border-[#FECDD3] items-center justify-center"
                    >
                      <Feather name="minus" size={22} color="#E11D48" />
                    </TouchableOpacity>

                    <View className="items-center">
                      <Text className="text-[#111827] text-5xl font-black tracking-tight">
                        {weight}
                      </Text>
                      <Text className="text-[#9CA3AF] text-xs font-bold uppercase mt-1">
                        {weightUnit}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => {
                        triggerHaptic();
                        setWeight((prev) => Math.min(250, prev + 1));
                      }}
                      className="w-13 h-13 rounded-2xl bg-[#FFF1F2] border border-[#FECDD3] items-center justify-center"
                    >
                      <Feather name="plus" size={22} color="#E11D48" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Height & Age Grid with enhanced vertical margin */}
                <View className="flex-row gap-4 mt-5">
                  {/* Height */}
                  <View className="flex-1 bg-white border border-[#F3F4F6] rounded-[24px] p-4 shadow-sm">
                    <Text className="text-[#6B7280] text-[11px] font-bold uppercase tracking-wider mb-1">
                      HEIGHT ({heightUnit})
                    </Text>
                    <View className="flex-row items-center justify-between mt-3">
                      <TouchableOpacity
                        onPress={() => {
                          triggerHaptic();
                          setHeight((prev) => Math.max(90, prev - 1));
                        }}
                        className="w-9 h-9 rounded-xl bg-[#FFF1F2] border border-[#FECDD3] items-center justify-center"
                      >
                        <Feather name="minus" size={16} color="#E11D48" />
                      </TouchableOpacity>
                      <Text className="text-[#111827] text-2xl font-black">{height}</Text>
                      <TouchableOpacity
                        onPress={() => {
                          triggerHaptic();
                          setHeight((prev) => Math.min(240, prev + 1));
                        }}
                        className="w-9 h-9 rounded-xl bg-[#FFF1F2] border border-[#FECDD3] items-center justify-center"
                      >
                        <Feather name="plus" size={16} color="#E11D48" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Age */}
                  <View className="flex-1 bg-white border border-[#F3F4F6] rounded-[24px] p-4 shadow-sm">
                    <Text className="text-[#6B7280] text-[11px] font-bold uppercase tracking-wider mb-1">
                      AGE (YEARS)
                    </Text>
                    <View className="flex-row items-center justify-between mt-3">
                      <TouchableOpacity
                        onPress={() => {
                          triggerHaptic();
                          setAge((prev) => Math.max(12, prev - 1));
                        }}
                        className="w-9 h-9 rounded-xl bg-[#FFF1F2] border border-[#FECDD3] items-center justify-center"
                      >
                        <Feather name="minus" size={16} color="#E11D48" />
                      </TouchableOpacity>
                      <Text className="text-[#111827] text-2xl font-black">{age}</Text>
                      <TouchableOpacity
                        onPress={() => {
                          triggerHaptic();
                          setAge((prev) => Math.min(99, prev + 1));
                        }}
                        className="w-9 h-9 rounded-xl bg-[#FFF1F2] border border-[#FECDD3] items-center justify-center"
                      >
                        <Feather name="plus" size={16} color="#E11D48" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* BMI indicator with enhanced vertical margin */}
                <View className="bg-[#FFF1F2] border border-[#FECDD3] rounded-[20px] p-4 flex-row items-center mt-5">
                  <View className="flex-row items-center gap-3">
                    <View className="w-8 h-8 rounded-full bg-[#FFE4E6] items-center justify-center">
                      <Feather name="activity" size={16} color="#E11D48" />
                    </View>
                    <Text className="text-[#111827] font-bold text-xs tracking-wide">
                      BMI: {bmiData.bmi}{' '}
                      <Text style={{ color: bmiData.color }} className="font-extrabold">
                        • {bmiData.status}
                      </Text>
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* ================= STEP 4: GOAL / INTEREST SELECTION (Exact Reference Design) ================= */}
            {currentStep === 4 && (
              <View>
                {/* Step Pill */}
                <View className="items-center mt-2 mb-1">
                  <View className="px-3.5 py-1 rounded-full bg-[#FFF1F2]">
                    <Text className="text-[#E11D48] text-[11px] font-black uppercase tracking-wider">
                      STEP 4 OF 7
                    </Text>
                  </View>
                </View>

                {/* Main Heading */}
                <Text className="text-[#101828] text-[26px] font-black tracking-tight text-center mt-2 leading-[34px]">
                  Time to customize{'\n'}your interest
                </Text>

                {/* Subtitle */}
                <Text className="text-[#6B7280] text-sm text-center mt-2 px-3 leading-relaxed">
                  Select categories to personalize your daily fitness and wellness rituals.
                </Text>

                {/* 3x3 Grid of Interest Categories */}
                <View className="flex-row flex-wrap justify-between gap-y-3 mt-6">
                  {INTEREST_TOPICS.map((item) => {
                    const isSelected = selectedInterests.includes(item.id);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        activeOpacity={0.85}
                        onPress={() => toggleInterest(item.id)}
                        style={{
                          width: (SCREEN_WIDTH - 40 - 24) / 3, // 3 columns with padding
                          shadowColor: isSelected ? '#E11D48' : '#000',
                          shadowOffset: { width: 0, height: isSelected ? 4 : 1 },
                          shadowOpacity: isSelected ? 0.16 : 0.03,
                          shadowRadius: isSelected ? 10 : 6,
                          elevation: isSelected ? 4 : 1,
                        }}
                        className={`aspect-square rounded-[24px] items-center justify-center p-2 relative border-2 transition-all ${
                          isSelected
                            ? 'border-[#E11D48] bg-white'
                            : 'border-[#F3F4F6] bg-white'
                        }`}
                      >
                        {/* Top-Right Selection Check Badge */}
                        {isSelected && (
                          <View className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#E11D48] items-center justify-center">
                            <Feather name="check" size={12} color="#FFFFFF" />
                          </View>
                        )}

                        {/* Circular Emoji / Icon Avatar */}
                        <View
                          style={{ backgroundColor: item.bgTint }}
                          className="w-13 h-13 rounded-full items-center justify-center mb-2 shadow-xs"
                        >
                          <Text style={{ fontSize: 28 }}>{item.emoji}</Text>
                        </View>

                        {/* Category Name */}
                        <Text
                          numberOfLines={1}
                          className={`text-xs text-center font-bold tracking-tight ${
                            isSelected ? 'text-[#101828]' : 'text-[#374151]'
                          }`}
                        >
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </Animated.View>

          {/* Bottom Action Footer */}
          <View className="mt-8 pt-2">
            {/* Primary Action Button (Red & White palette matching mockup) */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={isSubmitting ? undefined : handleNext}
              disabled={isSubmitting}
              style={{
                shadowColor: '#E11D48',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 14,
                elevation: 6,
                backgroundColor: '#E11D48',
              }}
              className="w-full py-4 rounded-full items-center justify-center flex-row gap-2"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text className="text-white text-base font-extrabold tracking-wide">
                    {currentStep === totalSteps ? 'Continue' : 'Continue'}
                  </Text>
                  <Feather name="arrow-right" size={18} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>

            {/* Prefer not to choose / Skip footer link */}
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={handleSkipOrPreferNotToSay}
              className="items-center justify-center mt-3 py-1"
            >
              <Text className="text-[#9CA3AF] text-xs font-semibold">
                {currentStep === 1
                  ? 'Prefer not to choose'
                  : currentStep === 4
                  ? 'Skip for now'
                  : 'Skip this step'}
              </Text>
              {/* Subtle underline bar matching Android home/indicator bar */}
              <View className="w-32 h-1 bg-[#E5E7EB] rounded-full mt-2" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
