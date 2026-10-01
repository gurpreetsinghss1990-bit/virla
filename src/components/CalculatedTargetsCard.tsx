import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Vibration, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAIWellnessStore, AIWellnessPlan } from '../store/aiWellnessStore';
import { useUserProfileStore } from '../store/userProfileStore';

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
        backgroundColor: '#0B0F19',
        borderColor: '#1E2536',
        borderWidth: 1,
        borderRadius: 28,
        padding: 24,
        shadowColor: '#0B0F19',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.24,
        shadowRadius: 16,
        elevation: 6,
      }}
    >
      {/* Top Tag & Goal Header */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Image
            source={require('../../assets/images/ai-coach-emblem.png')}
            style={{ width: 16, height: 16 }}
            resizeMode="contain"
          />
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: 0.88,
              color: 'rgba(255, 255, 255, 0.7)',
            }}
          >
            Calculated Targets
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          <View className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/10">
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                color: 'rgba(255, 255, 255, 0.85)',
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
              className="p-1 rounded-full bg-white/10"
            >
              <Feather name="arrow-up-right" size={13} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Headline Calorie Target */}
      <View className="flex-row justify-between items-baseline mt-3.5">
        <Text className="text-white text-[32px] font-bold tracking-tight">
          {targets.calories.toLocaleString()} kcal
        </Text>
        <Text className="text-zinc-400 text-xs font-medium">
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
          <View className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <View className="h-full bg-rose-500 rounded-full" style={{ width: `${proteinPercent}%` }} />
          </View>
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
          <View className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <View className="h-full bg-indigo-500 rounded-full" style={{ width: `${carbsPercent}%` }} />
          </View>
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
          <View className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <View className="h-full bg-amber-500 rounded-full" style={{ width: `${fatsPercent}%` }} />
          </View>
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
            <Text className="text-[#EC4899] text-[11px] font-bold">
              {targets.isAiGenerated ? 'View Protocol' : 'Customize Plan'}
            </Text>
            <Feather name="chevron-right" size={13} color="#EC4899" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};
