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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Ionicons, Feather } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useUserStore } from '../store/userStore';
import { Database } from '../database/Database';
import { supabase } from '../database/supabaseClient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type GenderType = 'Male' | 'Female' | 'Other';
type WeightUnit = 'kg' | 'lbs';
type HeightUnit = 'cm' | 'ft';

export default function UserMetricsLandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Form State
  const [name, setName] = useState('');
  const [gender, setGender] = useState<GenderType>('Male');
  const [weight, setWeight] = useState(72);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [height, setHeight] = useState(175);
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm');
  const [age, setAge] = useState(26);

  // Animations
  const headerFade = useRef(new Animated.Value(0)).current;
  const cardsFade = useRef(new Animated.Value(0)).current;
  const cardsTranslateY = useRef(new Animated.Value(20)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(cardsFade, {
        toValue: 1,
        duration: 700,
        delay: 150,
        useNativeDriver: true,
      }),
      Animated.timing(cardsTranslateY, {
        toValue: 0,
        duration: 700,
        delay: 150,
        useNativeDriver: true,
      }),
    ]).start();

    // Subtle breathing pulse for CTA glow
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, {
          toValue: 1.03,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(pulseScale, {
          toValue: 1.0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    return () => pulseLoop.stop();
  }, []);

  const triggerHaptic = () => {
    if (Platform.OS !== 'web') {
      try {
        Vibration.vibrate(12);
      } catch (_) {}
    }
  };

  const handleWeightAdjust = (delta: number) => {
    triggerHaptic();
    setWeight((prev) => Math.max(30, Math.min(250, prev + delta)));
  };

  const handleHeightAdjust = (delta: number) => {
    triggerHaptic();
    setHeight((prev) => Math.max(100, Math.min(230, prev + delta)));
  };

  const handleAgeAdjust = (delta: number) => {
    triggerHaptic();
    setAge((prev) => Math.max(12, Math.min(100, prev + delta)));
  };

  // Compute display BMI preview
  const bmiData = useMemo(() => {
    const heightInMeters = heightUnit === 'cm' ? height / 100 : (height * 30.48) / 100;
    const weightInKg = weightUnit === 'kg' ? weight : weight * 0.453592;
    if (heightInMeters <= 0) return { bmi: '--', status: 'Healthy', color: '#10B981' };

    const bmiVal = weightInKg / (heightInMeters * heightInMeters);
    const rounded = bmiVal.toFixed(1);

    if (bmiVal < 18.5) return { bmi: rounded, status: 'Underweight', color: '#3B82F6' };
    if (bmiVal < 25) return { bmi: rounded, status: 'Normal / Healthy', color: '#10B981' };
    if (bmiVal < 30) return { bmi: rounded, status: 'Overweight', color: '#F59E0B' };
    return { bmi: rounded, status: 'High Focus Zone', color: '#EF4444' };
  }, [weight, height, weightUnit, heightUnit]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill user name if already partially known
  useEffect(() => {
    const currUser = useUserStore.getState().user;
    if (currUser && currUser.name && currUser.name !== 'Complete your profile') {
      setName(currUser.name);
    }
  }, []);

  const handleContinue = async () => {
    triggerHaptic();

    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your name to proceed.');
      return;
    }

    setIsSubmitting(true);
    try {
      const userStore = useUserStore.getState();
      const currUser = userStore.user;
      const userId = currUser?.id;

      if (userId) {
        // 1. Update user row in remote Supabase
        await supabase
          .from('users')
          .update({
            name: name.trim(),
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
        });

        // 3. Update active user store
        userStore.updateProfile({
          name: name.trim(),
          registrationStatus: 'complete',
        });
        userStore.setCompletedOnboarding(true);
      }

      // Route smoothly into the main app experience
      router.replace('/(tabs)');
    } catch (err: any) {
      console.warn('[UserMetrics] Profile persistence warning:', err);
      // Fallback: continue to tabs even if network is offline
      router.replace('/(tabs)');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-[#090A0F]">
      <StatusBar style="light" />

      {/* Ambient Radial Gradient Background Elements */}
      <View style={{ position: 'absolute', top: -120, right: -60, width: 340, height: 340, opacity: 0.28 }}>
        <Svg height="100%" width="100%" viewBox="0 0 340 340">
          <Defs>
            <LinearGradient id="heroAura" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#E11D48" stopOpacity="0.8" />
              <Stop offset="100%" stopColor="#881337" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Circle cx="170" cy="170" r="170" fill="url(#heroAura)" />
        </Svg>
      </View>

      <View style={{ position: 'absolute', bottom: 100, left: -100, width: 300, height: 300, opacity: 0.2 }}>
        <Svg height="100%" width="100%" viewBox="0 0 300 300">
          <Defs>
            <LinearGradient id="cyanAura" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#6366F1" stopOpacity="0.7" />
              <Stop offset="100%" stopColor="#312E81" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Circle cx="150" cy="150" r="150" fill="url(#cyanAura)" />
        </Svg>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 32,
            paddingHorizontal: 20,
          }}
        >
          {/* Header Navigation */}
          <Animated.View style={{ opacity: headerFade }} className="mb-6">
            <View className="flex-row items-center justify-between">
              <TouchableOpacity
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
                activeOpacity={0.7}
                className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 items-center justify-center"
              >
                <Feather name="chevron-left" size={20} color="#F3F4F6" />
              </TouchableOpacity>

              <View className="px-3.5 py-1.5 rounded-full bg-white/10 border border-white/10 flex-row items-center gap-1.5">
                <View className="w-2 h-2 rounded-full bg-[#E11D48]" />
                <Text className="text-white/80 text-[11px] font-semibold tracking-wider uppercase">
                  VIRLA ONBOARDING
                </Text>
              </View>

              <View className="w-10" />
            </View>

            {/* Title & Subtitle */}
            <View className="mt-6">
              <Text className="text-white text-[32px] font-black tracking-tight leading-tight">
                Tell us about <Text className="text-[#E11D48]">yourself</Text>
              </Text>
              <Text className="text-zinc-400 text-sm mt-2 leading-relaxed">
                Personalize your workouts, metabolic rate calculations, and trainer recommendations.
              </Text>
            </View>
          </Animated.View>

          {/* Form Content Cards */}
          <Animated.View
            style={{
              opacity: cardsFade,
              transform: [{ translateY: cardsTranslateY }],
            }}
            className="gap-5"
          >
            {/* 1. Name Input Card */}
            <View className="bg-[#12131A] rounded-[24px] p-5 border border-white/10 shadow-lg">
              <View className="flex-row items-center gap-2 mb-3">
                <Ionicons name="person-outline" size={18} color="#E11D48" />
                <Text className="text-zinc-300 text-xs font-bold uppercase tracking-wider">
                  Full Name
                </Text>
              </View>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="What should we call you?"
                placeholderTextColor="#52525B"
                className="w-full bg-[#181924] border border-white/5 rounded-xl px-4 py-3.5 text-white font-semibold text-base"
                autoCapitalize="words"
                returnKeyType="done"
              />
            </View>

            {/* 2. Gender Selection Card */}
            <View className="bg-[#12131A] rounded-[24px] p-5 border border-white/10">
              <View className="flex-row items-center justify-between mb-3.5">
                <View className="flex-row items-center gap-2">
                  <MaterialCommunityIcons name="gender-male-female" size={18} color="#E11D48" />
                  <Text className="text-zinc-300 text-xs font-bold uppercase tracking-wider">
                    Gender Identity
                  </Text>
                </View>
                <Text className="text-zinc-500 text-[11px]">Caloric baseline</Text>
              </View>

              <View className="flex-row gap-3">
                {(['Male', 'Female', 'Other'] as GenderType[]).map((item) => {
                  const isSelected = gender === item;
                  return (
                    <TouchableOpacity
                      key={item}
                      activeOpacity={0.8}
                      onPress={() => {
                        triggerHaptic();
                        setGender(item);
                      }}
                      className={`flex-1 py-3.5 rounded-2xl items-center justify-center border transition-all ${
                        isSelected
                          ? 'bg-[#E11D48] border-[#E11D48]'
                          : 'bg-[#181924] border-white/5'
                      }`}
                    >
                      <Ionicons
                        name={
                          item === 'Male'
                            ? 'man-outline'
                            : item === 'Female'
                            ? 'woman-outline'
                            : 'fitness-outline'
                        }
                        size={22}
                        color={isSelected ? '#FFFFFF' : '#9CA3AF'}
                      />
                      <Text
                        className={`text-xs font-bold mt-1.5 ${
                          isSelected ? 'text-white' : 'text-zinc-400'
                        }`}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 3. Weight Card with Unit Switcher & Steppers */}
            <View className="bg-[#12131A] rounded-[24px] p-5 border border-white/10">
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-2">
                  <MaterialCommunityIcons name="scale-bathroom" size={18} color="#E11D48" />
                  <Text className="text-zinc-300 text-xs font-bold uppercase tracking-wider">
                    Current Weight
                  </Text>
                </View>

                {/* Unit Switcher */}
                <View className="flex-row bg-[#181924] p-1 rounded-xl border border-white/5">
                  {(['kg', 'lbs'] as WeightUnit[]).map((unit) => (
                    <TouchableOpacity
                      key={unit}
                      onPress={() => {
                        triggerHaptic();
                        setWeightUnit(unit);
                      }}
                      className={`px-3 py-1 rounded-lg ${
                        weightUnit === unit ? 'bg-[#E11D48]' : 'bg-transparent'
                      }`}
                    >
                      <Text
                        className={`text-[11px] font-bold uppercase ${
                          weightUnit === unit ? 'text-white' : 'text-zinc-500'
                        }`}
                      >
                        {unit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View className="flex-row items-center justify-between my-2">
                <TouchableOpacity
                  onPress={() => handleWeightAdjust(-1)}
                  activeOpacity={0.7}
                  className="w-12 h-12 rounded-2xl bg-[#181924] border border-white/10 items-center justify-center"
                >
                  <Feather name="minus" size={20} color="#F3F4F6" />
                </TouchableOpacity>

                <View className="items-center">
                  <Text className="text-white text-5xl font-black tracking-tight">{weight}</Text>
                  <Text className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mt-1">
                    {weightUnit}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => handleWeightAdjust(1)}
                  activeOpacity={0.7}
                  className="w-12 h-12 rounded-2xl bg-[#181924] border border-white/10 items-center justify-center"
                >
                  <Feather name="plus" size={20} color="#F3F4F6" />
                </TouchableOpacity>
              </View>

              {/* Fast Increment Pills */}
              <View className="flex-row justify-center gap-2 mt-2">
                {[-5, -1, 1, 5].map((delta) => (
                  <TouchableOpacity
                    key={delta}
                    onPress={() => handleWeightAdjust(delta)}
                    className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5"
                  >
                    <Text className="text-zinc-400 text-[10px] font-bold">
                      {delta > 0 ? `+${delta}` : delta}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 4. Height & Age Row */}
            <View className="flex-row gap-3">
              {/* Height Card */}
              <View className="flex-1 bg-[#12131A] rounded-[24px] p-4 border border-white/10">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-zinc-300 text-[11px] font-bold uppercase tracking-wider">
                    Height ({heightUnit})
                  </Text>
                </View>
                <View className="items-center my-1">
                  <Text className="text-white text-3xl font-black">{height}</Text>
                </View>
                <View className="flex-row justify-between gap-1.5 mt-2">
                  <TouchableOpacity
                    onPress={() => handleHeightAdjust(-1)}
                    className="flex-1 h-9 rounded-xl bg-[#181924] items-center justify-center border border-white/5"
                  >
                    <Feather name="minus" size={16} color="#E5E7EB" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleHeightAdjust(1)}
                    className="flex-1 h-9 rounded-xl bg-[#181924] items-center justify-center border border-white/5"
                  >
                    <Feather name="plus" size={16} color="#E5E7EB" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Age Card */}
              <View className="flex-1 bg-[#12131A] rounded-[24px] p-4 border border-white/10">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-zinc-300 text-[11px] font-bold uppercase tracking-wider">
                    Age (Years)
                  </Text>
                </View>
                <View className="items-center my-1">
                  <Text className="text-white text-3xl font-black">{age}</Text>
                </View>
                <View className="flex-row justify-between gap-1.5 mt-2">
                  <TouchableOpacity
                    onPress={() => handleAgeAdjust(-1)}
                    className="flex-1 h-9 rounded-xl bg-[#181924] items-center justify-center border border-white/5"
                  >
                    <Feather name="minus" size={16} color="#E5E7EB" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleAgeAdjust(1)}
                    className="flex-1 h-9 rounded-xl bg-[#181924] items-center justify-center border border-white/5"
                  >
                    <Feather name="plus" size={16} color="#E5E7EB" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* 5. Live Metabolic / BMI Summary Pill */}
            <View className="bg-gradient-to-r from-zinc-900 to-[#181924] rounded-2xl p-4 border border-white/10 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View
                  style={{ backgroundColor: `${bmiData.color}25` }}
                  className="w-10 h-10 rounded-xl items-center justify-center border border-white/10"
                >
                  <Feather name="activity" size={20} color={bmiData.color} />
                </View>
                <View>
                  <Text className="text-zinc-400 text-[11px] font-medium uppercase tracking-wider">
                    Calculated BMI
                  </Text>
                  <Text className="text-white font-bold text-base mt-0.5">
                    {bmiData.bmi}{' '}
                    <Text style={{ color: bmiData.color }} className="text-xs font-semibold">
                      • {bmiData.status}
                    </Text>
                  </Text>
                </View>
              </View>
              <Ionicons name="sparkles" size={18} color="#F59E0B" />
            </View>

            {/* CTA Continue Button */}
            <View className="mt-4">
              <Animated.View style={{ transform: [{ scale: pulseScale }] }}>
                <TouchableOpacity
                  onPress={isSubmitting ? undefined : handleContinue}
                  activeOpacity={0.85}
                  disabled={isSubmitting}
                  className="w-full bg-[#E11D48] py-4 rounded-2xl items-center justify-center flex-row gap-2 shadow-xl"
                  style={{
                    shadowColor: '#E11D48',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.45,
                    shadowRadius: 16,
                    elevation: 8,
                    opacity: isSubmitting ? 0.75 : 1,
                  }}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Text className="text-white text-base font-extrabold tracking-wide uppercase">
                        Continue to Dashboard
                      </Text>
                      <Feather name="arrow-right" size={20} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
