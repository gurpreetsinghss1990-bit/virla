import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Vibration, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useAIWellnessStore, AIWellnessPlan } from '../store/aiWellnessStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { NativeProgressBar } from './NativeProgressBar';

import { softShadow } from '../utils/shadows';
interface CalculatedTargetsCardProps {
  plan?: AIWellnessPlan | null;
  onPress?: () => void;
  showNavigation?: boolean;
}

export const CalculatedTargetsCard: React.FC<CalculatedTargetsCardProps> = ({
  plan: propPlan,
  onPress,
  showNavigation = true,
}) => {
  const router = useRouter();
  const { savedPlan } = useAIWellnessStore();
  const profile = useUserProfileStore();

  const plan = propPlan !== undefined ? propPlan : savedPlan;

  const targets = useMemo(() => {
    if (plan) {
      return {
        goal: plan.fitnessGoal || profile.targetGoal || 'Fitness Protocol',
        calories: plan.dailyCalories || 2150,
        protein: plan.proteinTarget || 140,
        carbs: plan.carbTarget || 220,
        fats: plan.fatTarget || 65,
        water: plan.hydrationGoal || '3.0 L',
        steps: plan.dailyStepGoal || 10000,
        frequency: plan.workoutFrequency || '4-5 Days/Wk',
        isAiGenerated: true,
      };
    }

    // Dynamic scientific fallback calculated from user profile
    const weightVal = parseFloat(profile.weight) || 70;
    const isDeficit = profile.targetGoal === 'Fat Loss' || profile.targetGoal === 'Weight Loss';
    const fallbackCalories = Math.round(weightVal * (isDeficit ? 26 : 32));
    const fallbackProtein = Math.round(weightVal * 1.8);
    const fallbackFats = Math.round((fallbackCalories * 0.25) / 9);
    const fallbackCarbs = Math.max(100, Math.round((fallbackCalories - (fallbackProtein * 4 + fallbackFats * 9)) / 4));

    return {
      goal: profile.targetGoal || 'Personal Target',
      calories: fallbackCalories,
      protein: fallbackProtein,
      carbs: fallbackCarbs,
      fats: fallbackFats,
      water: `${(weightVal * 0.035).toFixed(1)} L`,
      steps: 10000,
      frequency: '4-5 Days/Wk',
      isAiGenerated: false,
    };
  }, [plan, profile.targetGoal, profile.weight]);

  const handleCardPress = () => {
    try {
      Vibration.vibrate(10);
    } catch {}

    if (onPress) {
      onPress();
    } else if (showNavigation) {
      router.push('/virla-ai' as any);
    }
  };

  // Safe percentage calculations for macro bars
  const totalMacroCalories = targets.protein * 4 + targets.carbs * 4 + targets.fats * 9;
  const baseCalories = totalMacroCalories > 0 ? totalMacroCalories : targets.calories;
  const proteinPercent = Math.min(100, Math.max(15, Math.round(((targets.protein * 4) / baseCalories) * 100)));
  const carbsPercent = Math.min(100, Math.max(20, Math.round(((targets.carbs * 4) / baseCalories) * 100)));
  const fatsPercent = Math.min(100, Math.max(15, Math.round(((targets.fats * 9) / baseCalories) * 100)));

  return (
    <View
      style={{
        backgroundColor: '#0D0F17',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderRadius: 24,
        padding: 20,
        ...softShadow({ color: '#0F172A', opacity: 0.35, radius: 20, offsetY: 10 }),
      }}
    >
      {/* Top Tag & Goal Header */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          {/* Sparkle 4-point star icon exact SVG match from Stitch code.html */}
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="#D8B4FE">
            <Path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
          </Svg>
          <Text
            style={{
              fontFamily: 'Outfit_700Bold',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              color: '#CBD5E1',
            }}
          >
            CALCULATED TARGETS
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          <View 
            style={{
              backgroundColor: 'rgba(30, 41, 59, 0.8)',
              borderWidth: 1,
              borderColor: '#334155',
              paddingHorizontal: 10,
              paddingVertical: 3,
              borderRadius: 9999,
            }}
          >
            <Text
              style={{
                fontFamily: 'Outfit_600SemiBold',
                fontSize: 10,
                color: '#CBD5E1',
                textTransform: 'uppercase',
                letterSpacing: 0.8,
              }}
            >
              {targets.goal}
            </Text>
          </View>

          {showNavigation && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleCardPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: '#1E293B',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="arrow-up-right" size={13} color="#CBD5E1" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Headline Calorie Target */}
      <View className="flex-row justify-between items-baseline mt-3.5">
        <Text 
          style={{ fontFamily: 'Outfit_700Bold' }} 
          className="text-white text-[32px] tracking-tight font-bold"
        >
          {targets.calories.toLocaleString()} <Text style={{ fontSize: 22, fontWeight: '700' }}>kcal</Text>
        </Text>
        <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-slate-400 text-xs font-medium">
          Daily Calorie Target
        </Text>
      </View>

      {/* Hairline divider directly separating headline from macro bars */}
      <View
        style={{
          height: 1,
          backgroundColor: 'rgba(255, 255, 255, 0.09)',
          marginVertical: 14,
        }}
      />

      {/* Macro Progress Sliders */}
      <View style={{ gap: 12 }}>
        {/* Protein */}
        <View style={{ gap: 6 }}>
          <View className="flex-row justify-between items-center">
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: 0.88,
                color: 'rgba(255, 255, 255, 0.55)',
              }}
            >
              Protein
            </Text>
            <Text className="text-white text-xs font-bold">
              {targets.protein}g
            </Text>
          </View>
          <NativeProgressBar progress={proteinPercent / 100} color="#E11D48" trackColor="#1E293B" height={6} />
        </View>

        {/* Carbohydrates */}
        <View style={{ gap: 6 }}>
          <View className="flex-row justify-between items-center">
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: 0.88,
                color: 'rgba(255, 255, 255, 0.55)',
              }}
            >
              Carbohydrates
            </Text>
            <Text className="text-white text-xs font-bold">
              {targets.carbs}g
            </Text>
          </View>
          <NativeProgressBar progress={carbsPercent / 100} color="#6366F1" trackColor="#1E293B" height={6} />
        </View>

        {/* Fats */}
        <View style={{ gap: 6 }}>
          <View className="flex-row justify-between items-center">
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: 0.88,
                color: 'rgba(255, 255, 255, 0.55)',
              }}
            >
              Fats
            </Text>
            <Text className="text-white text-xs font-bold">
              {targets.fats}g
            </Text>
          </View>
          <NativeProgressBar progress={fatsPercent / 100} color="#F59E0B" trackColor="#1E293B" height={6} />
        </View>
      </View>

      {/* Hairline divider before bottom chips */}
      <View
        style={{
          height: 1,
          backgroundColor: 'rgba(255, 255, 255, 0.09)',
          marginVertical: 14,
        }}
      />

      {/* Micro-Metrics Row */}
      <View className="flex-row justify-between items-center">
        <View className="items-center flex-1">
          <Text className="text-zinc-400 text-[10px] font-semibold uppercase tracking-wider">Water</Text>
          <Text className="text-white text-sm font-bold mt-1">{targets.water}</Text>
        </View>
        <View className="h-6 w-[1px] bg-white/10" />
        <View className="items-center flex-1">
          <Text className="text-zinc-400 text-[10px] font-semibold uppercase tracking-wider">Steps</Text>
          <Text className="text-white text-sm font-bold mt-1">{(targets.steps || 10000).toLocaleString()}</Text>
        </View>
        <View className="h-6 w-[1px] bg-white/10" />
        <View className="items-center flex-1">
          <Text className="text-zinc-400 text-[10px] font-semibold uppercase tracking-wider">Frequency</Text>
          <Text className="text-white text-sm font-bold mt-1" numberOfLines={1}>{targets.frequency}</Text>
        </View>
      </View>

      {/* Interactive Footer Navigation Bar */}
      {showNavigation && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleCardPress}
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255, 255, 255, 0.07)',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View className="flex-row items-center gap-1.5">
            <View className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <Text className="text-zinc-400 text-[11px] font-medium">
              {targets.isAiGenerated ? 'Active AI Protocol' : 'Scientific Profile Estimate'}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#E11D48] text-[11px] font-bold">
              {targets.isAiGenerated ? 'View Protocol' : 'Customize Plan'}
            </Text>
            <Feather name="chevron-right" size={13} color="#E11D48" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};
