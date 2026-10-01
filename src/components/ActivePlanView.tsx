import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  Vibration,
  Image,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { AIWellnessPlan } from '../store/aiWellnessStore';

interface ActivePlanViewProps {
  plan: AIWellnessPlan;
  onSavePlan: () => void;
  onRegenerate: () => void;
  isSaved?: boolean;
  bottomInset?: number;
}

// ============================================================================
// DESIGN SYSTEM TOKENS
// ============================================================================
// Strictly 2 Spacing values:
const SPACING = {
  internal: 14, // 12-16px between elements within a section
  chapter: 48,  // 40-56px between distinct chapters/sections
};

// Strictly 4 Content Zones + 1 Dark Summary Card:
const ZONES = {
  darkSummary: {
    bg: '#0B0F19',
    border: '#1E2536',
  },
  movement: {
    name: '01 Fitness & Training',
    base: '#7A8462', // soft sage & olive
    tint: '#F3F5EE',
    border: 'rgba(122, 132, 98, 0.22)',
    mutedLabel: '#626B4E',
  },
  nutrition: {
    name: '02 Daily Meal Plan',
    base: '#C4633F', // warm cream & terracotta
    tint: '#FBF1EB',
    border: 'rgba(196, 99, 63, 0.22)',
    mutedLabel: '#9A4C2E',
  },
  recovery: {
    name: '03 Lifestyle & Recovery',
    base: '#8A5A72', // dusk lavender & plum
    tint: '#F6F0F3',
    border: 'rgba(138, 90, 114, 0.22)',
    mutedLabel: '#6F445B',
  },
  goals: {
    name: '04 Weekly Progress Goals',
    base: '#D6336C', // pink accent, used exclusively here
    tint: '#FDF0F5',
    border: 'rgba(214, 51, 108, 0.22)',
    mutedLabel: '#A82151',
  },
};

// Strictly 3 Typography Levels:
const TYPOGRAPHY = {
  // Level 1: Section Header (15-16px, semibold, sentence case)
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  // Level 2: Card Label (11px, uppercase, 0.08em letterspacing, muted colour)
  cardLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.88, // ~0.08em of 11px
  },
  // Level 3: Body Text (14-15px, regular weight, line height 1.55-1.65)
  bodyText: {
    fontSize: 14.5,
    fontWeight: '400' as const,
    lineHeight: 23, // 23 / 14.5 = 1.586 ratio
    color: '#1E293B',
  },
};

export const ActivePlanView: React.FC<ActivePlanViewProps> = ({
  plan,
  onSavePlan,
  onRegenerate,
  isSaved = false,
  bottomInset = 24,
}) => {
  // Meal section segmented control tab
  const [selectedMealTab, setSelectedMealTab] = useState<'breakfast' | 'lunch' | 'dinner' | 'snacks'>('breakfast');

  // Interactive goals tracking
  const [completedGoals, setCompletedGoals] = useState<Set<number>>(new Set([0]));

  // Meal calorie allocation based on total daily target
  const mealCalorieDistribution = {
    breakfast: Math.round(plan.dailyCalories * 0.25),
    lunch: Math.round(plan.dailyCalories * 0.35),
    dinner: Math.round(plan.dailyCalories * 0.30),
    snacks: Math.round(plan.dailyCalories * 0.10),
  };

  const currentMealItems =
    selectedMealTab === 'breakfast'
      ? plan.breakfastSuggestions || []
      : selectedMealTab === 'lunch'
      ? plan.lunchSuggestions || []
      : selectedMealTab === 'dinner'
      ? plan.dinnerSuggestions || []
      : plan.snackSuggestions || [];

  const toggleGoal = (index: number) => {
    if (Platform.OS !== 'web') {
      try {
        Vibration.vibrate(12);
      } catch {}
    }
    setCompletedGoals((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleFoodItemPress = (item: string) => {
    Alert.alert(
      'Meal Item Options',
      `"${item}"`,
      [
        {
          text: 'Log to Daily Intake',
          onPress: () => {
            Alert.alert('Logged', `Added to your ${selectedMealTab} log.`);
          },
        },
        {
          text: 'Swap Item',
          onPress: () => {
            Alert.alert('Ingredient Swap', 'Alternative suggested based on your diet preferences.');
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const totalGoals = (plan.weeklyProgressGoals || []).length;
  const completedCount = completedGoals.size;
  const goalsProgressRatio = totalGoals > 0 ? completedCount / totalGoals : 0;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: Math.max(bottomInset, 24) + 40,
      }}
    >
      {/* ==================================================================== */}
      {/* 00. HERO TARGETS CARD (Dark Obsidian Visual Anchor)                  */}
      {/* ==================================================================== */}
      <View
        style={{
          backgroundColor: ZONES.darkSummary.bg,
          borderColor: ZONES.darkSummary.border,
          borderWidth: 1,
          borderRadius: 28,
          padding: 30, // Increased internal padding by ~25% (was 24px)
        }}
        className="shadow-sm"
      >
        {/* Top Tag & Goal */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Image
              source={require('../../assets/images/ai-coach-emblem.png')}
              style={{ width: 16, height: 16 }}
              resizeMode="contain"
            />
            <Text
              style={[
                TYPOGRAPHY.cardLabel,
                { color: 'rgba(255, 255, 255, 0.7)', letterSpacing: 0.88 },
              ]}
            >
              Calculated Targets
            </Text>
          </View>
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
              {plan.fitnessGoal}
            </Text>
          </View>
        </View>

        {/* Headline Calorie Target */}
        <View className="flex-row justify-between items-baseline mt-3">
          <Text className="text-white text-[32px] font-bold tracking-tight">
            {plan.dailyCalories.toLocaleString()} kcal
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
              <Text style={[TYPOGRAPHY.cardLabel, { color: 'rgba(255, 255, 255, 0.55)' }]}>
                Protein
              </Text>
              <Text className="text-white text-xs font-bold">
                {plan.proteinTarget}g
              </Text>
            </View>
            <View className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <View className="h-full bg-rose-500 rounded-full" style={{ width: '40%' }} />
            </View>
          </View>

          {/* Carbohydrates */}
          <View style={{ gap: 6 }}>
            <View className="flex-row justify-between items-center">
              <Text style={[TYPOGRAPHY.cardLabel, { color: 'rgba(255, 255, 255, 0.55)' }]}>
                Carbohydrates
              </Text>
              <Text className="text-white text-xs font-bold">
                {plan.carbTarget}g
              </Text>
            </View>
            <View className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <View className="h-full bg-indigo-500 rounded-full" style={{ width: '45%' }} />
            </View>
          </View>

          {/* Fats */}
          <View style={{ gap: 6 }}>
            <View className="flex-row justify-between items-center">
              <Text style={[TYPOGRAPHY.cardLabel, { color: 'rgba(255, 255, 255, 0.55)' }]}>
                Fats
              </Text>
              <Text className="text-white text-xs font-bold">
                {plan.fatTarget}g
              </Text>
            </View>
            <View className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <View className="h-full bg-amber-500 rounded-full" style={{ width: '30%' }} />
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

        {/* Tinted Bottom Chips (Daily Steps, Water Goal, Frequency) */}
        <View className="flex-row justify-between gap-2.5">
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(255, 255, 255, 0.07)', // Tinted fill so they don't disappear
              borderColor: 'rgba(255, 255, 255, 0.12)',
              borderWidth: 1,
              borderRadius: 16,
              paddingVertical: 10,
              paddingHorizontal: 8,
              alignItems: 'center',
            }}
          >
            <Text style={[TYPOGRAPHY.cardLabel, { color: 'rgba(255, 255, 255, 0.5)', fontSize: 9.5 }]}>
              Daily Steps
            </Text>
            <Text className="text-white text-xs font-bold mt-1">
              {plan.dailyStepGoal.toLocaleString()}
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(255, 255, 255, 0.07)', // Tinted fill
              borderColor: 'rgba(255, 255, 255, 0.12)',
              borderWidth: 1,
              borderRadius: 16,
              paddingVertical: 10,
              paddingHorizontal: 8,
              alignItems: 'center',
            }}
          >
            <Text style={[TYPOGRAPHY.cardLabel, { color: 'rgba(255, 255, 255, 0.5)', fontSize: 9.5 }]}>
              Water Goal
            </Text>
            <Text className="text-emerald-400 text-xs font-bold mt-1">
              {plan.hydrationGoal.split(' ')[0]} L
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(255, 255, 255, 0.07)', // Tinted fill
              borderColor: 'rgba(255, 255, 255, 0.12)',
              borderWidth: 1,
              borderRadius: 16,
              paddingVertical: 10,
              paddingHorizontal: 8,
              alignItems: 'center',
            }}
          >
            <Text style={[TYPOGRAPHY.cardLabel, { color: 'rgba(255, 255, 255, 0.5)', fontSize: 9.5 }]}>
              Frequency
            </Text>
            <Text className="text-white text-xs font-bold mt-1">
              {plan.workoutFrequency} d/wk
            </Text>
          </View>
        </View>
      </View>

      {/* Large Chapter Gap (48px) */}
      <View style={{ height: SPACING.chapter }} />

      {/* ==================================================================== */}
      {/* 01. MOVEMENT ZONE (Soft Sage & Olive)                                */}
      {/* ==================================================================== */}
      <View style={{ gap: SPACING.internal }}>
        {/* Section Header */}
        <View className="flex-row items-center gap-3 px-0.5">
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: ZONES.movement.tint,
              borderColor: ZONES.movement.border,
              borderWidth: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="activity" size={17} color={ZONES.movement.base} />
          </View>
          <View>
            <Text style={TYPOGRAPHY.sectionHeader}>
              {ZONES.movement.name}
            </Text>
            {/* Informational subtitle retained */}
            {plan.preferredDuration ? (
              <Text className="text-[#64748B] text-xs font-normal mt-0.5">
                Calibrated for {plan.preferredDuration} sessions
              </Text>
            ) : null}
          </View>
        </View>

        {/* Content Card */}
        <View
          style={{
            backgroundColor: ZONES.movement.tint,
            borderColor: ZONES.movement.border,
            borderWidth: 1,
            borderRadius: 20,
            padding: 18,
            gap: 8,
          }}
        >
          <Text
            style={[
              TYPOGRAPHY.cardLabel,
              { color: ZONES.movement.mutedLabel },
            ]}
          >
            Recommended Routine
          </Text>
          <Text style={TYPOGRAPHY.bodyText}>
            {plan.workoutRecommendation}
          </Text>
        </View>
      </View>

      {/* Large Chapter Gap (48px) */}
      <View style={{ height: SPACING.chapter }} />

      {/* ==================================================================== */}
      {/* 02. NUTRITION ZONE (Warm Cream & Terracotta)                         */}
      {/* ==================================================================== */}
      <View style={{ gap: SPACING.internal }}>
        {/* Section Header (No uninformative subtitle) */}
        <View className="flex-row items-center gap-3 px-0.5">
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: ZONES.nutrition.tint,
              borderColor: ZONES.nutrition.border,
              borderWidth: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="pie-chart" size={17} color={ZONES.nutrition.base} />
          </View>
          <View>
            <Text style={TYPOGRAPHY.sectionHeader}>
              {ZONES.nutrition.name}
            </Text>
          </View>
        </View>

        {/* Horizontal Segmented Control for Meals */}
        <View
          style={{
            backgroundColor: '#F1F5F9',
            padding: 4,
            borderRadius: 16,
            flexDirection: 'row',
            gap: 4,
          }}
        >
          {(['breakfast', 'lunch', 'dinner', 'snacks'] as const).map((mealKey) => {
            const isSelected = selectedMealTab === mealKey;
            const labelMap = {
              breakfast: 'Breakfast',
              lunch: 'Lunch',
              dinner: 'Dinner',
              snacks: 'Snacks',
            };
            return (
              <TouchableOpacity
                key={mealKey}
                onPress={() => setSelectedMealTab(mealKey)}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSelected ? '#FFFFFF' : 'transparent',
                  shadowColor: isSelected ? '#000' : 'transparent',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: isSelected ? 0.08 : 0,
                  shadowRadius: 2,
                  elevation: isSelected ? 1 : 0,
                }}
              >
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: isSelected ? '600' : '500',
                    color: isSelected ? ZONES.nutrition.base : '#64748B',
                  }}
                >
                  {labelMap[mealKey]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected Meal Card */}
        <View
          style={{
            backgroundColor: ZONES.nutrition.tint,
            borderColor: ZONES.nutrition.border,
            borderWidth: 1,
            borderRadius: 20,
            padding: 18,
            gap: 12,
          }}
        >
          {/* Card Header: Label on Left, Estimated Calorie figure on Right */}
          <View className="flex-row items-center justify-between">
            <Text
              style={[
                TYPOGRAPHY.cardLabel,
                { color: ZONES.nutrition.mutedLabel },
              ]}
            >
              {selectedMealTab === 'snacks' ? 'Healthy Snacks' : selectedMealTab}
            </Text>
            <View
              style={{
                backgroundColor: 'rgba(196, 99, 63, 0.12)',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: ZONES.nutrition.base,
                }}
              >
                ~{mealCalorieDistribution[selectedMealTab]} kcal
              </Text>
            </View>
          </View>

          {/* Food items list (each tappable to swap or log) */}
          <View style={{ gap: 8 }}>
            {currentMealItems.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => handleFoodItemPress(item)}
                activeOpacity={0.65}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'rgba(255, 255, 255, 0.65)',
                  borderColor: 'rgba(196, 99, 63, 0.15)',
                  borderWidth: 1,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 14,
                }}
              >
                <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: ZONES.nutrition.base,
                    }}
                  />
                  <Text style={[TYPOGRAPHY.bodyText, { flex: 1 }]}>
                    {item}
                  </Text>
                </View>
                <Feather name="more-horizontal" size={16} color={ZONES.nutrition.base} />
              </TouchableOpacity>
            ))}
          </View>

          <Text
            style={{
              fontSize: 11.5,
              color: '#94A3B8',
              fontStyle: 'italic',
              marginTop: 2,
            }}
          >
            Tap any item to log or swap ingredient
          </Text>
        </View>
      </View>

      {/* Large Chapter Gap (48px) */}
      <View style={{ height: SPACING.chapter }} />

      {/* ==================================================================== */}
      {/* 03. RECOVERY ZONE (Dusk Lavender & Plum)                             */}
      {/* ==================================================================== */}
      <View style={{ gap: SPACING.internal }}>
        {/* Section Header */}
        <View className="flex-row items-center gap-3 px-0.5">
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: ZONES.recovery.tint,
              borderColor: ZONES.recovery.border,
              borderWidth: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="moon" size={17} color={ZONES.recovery.base} />
          </View>
          <View>
            <Text style={TYPOGRAPHY.sectionHeader}>
              {ZONES.recovery.name}
            </Text>
          </View>
        </View>

        {/* Content Cards (small internal gap between them) */}
        <View style={{ gap: SPACING.internal }}>
          {/* Card 1: Sleep Routine */}
          <View
            style={{
              backgroundColor: ZONES.recovery.tint,
              borderColor: ZONES.recovery.border,
              borderWidth: 1,
              borderRadius: 20,
              padding: 18,
              gap: 8,
            }}
          >
            <Text
              style={[
                TYPOGRAPHY.cardLabel,
                { color: ZONES.recovery.mutedLabel },
              ]}
            >
              Sleep Routine
            </Text>
            <Text style={TYPOGRAPHY.bodyText}>
              {plan.sleepRecommendation || '8 hours of restful sleep with consistent sleep-wake cycles.'}
            </Text>
          </View>

          {/* Card 2: Recovery Advice */}
          <View
            style={{
              backgroundColor: ZONES.recovery.tint,
              borderColor: ZONES.recovery.border,
              borderWidth: 1,
              borderRadius: 20,
              padding: 18,
              gap: 8,
            }}
          >
            <Text
              style={[
                TYPOGRAPHY.cardLabel,
                { color: ZONES.recovery.mutedLabel },
              ]}
            >
              Recovery Advice
            </Text>
            <Text style={TYPOGRAPHY.bodyText}>
              {plan.recoveryAdvice || 'Light stretching post-workout with hydration focus.'}
            </Text>
          </View>
        </View>
      </View>

      {/* Large Chapter Gap (48px) */}
      <View style={{ height: SPACING.chapter }} />

      {/* ==================================================================== */}
      {/* 04. GOALS ZONE (Pink Accent, Interactive Action Items)                */}
      {/* ==================================================================== */}
      <View style={{ gap: SPACING.internal }}>
        {/* Section Header with dynamic progress indicator */}
        <View className="px-0.5 gap-2">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: ZONES.goals.tint,
                  borderColor: ZONES.goals.border,
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather name="check-circle" size={17} color={ZONES.goals.base} />
              </View>
              <Text style={TYPOGRAPHY.sectionHeader}>
                {ZONES.goals.name}
              </Text>
            </View>

            {/* "1 of 3 complete" label */}
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: ZONES.goals.base,
              }}
            >
              {completedCount} of {totalGoals} complete
            </Text>
          </View>

          {/* Small progress bar */}
          <View
            style={{
              width: '100%',
              height: 3.5,
              backgroundColor: '#F1F5F9',
              borderRadius: 99,
              overflow: 'hidden',
              marginTop: 4,
            }}
          >
            <View
              style={{
                width: `${Math.round(goalsProgressRatio * 100)}%`,
                height: '100%',
                backgroundColor: ZONES.goals.base,
                borderRadius: 99,
              }}
            />
          </View>
        </View>

        {/* Interactive Goal Checkbox Cards */}
        <View style={{ gap: 10 }}>
          {(plan.weeklyProgressGoals || []).map((goal, idx) => {
            const isDone = completedGoals.has(idx);
            return (
              <TouchableOpacity
                key={idx}
                onPress={() => toggleGoal(idx)}
                activeOpacity={0.75}
                style={{
                  backgroundColor: ZONES.goals.tint,
                  borderColor: isDone ? ZONES.goals.base : ZONES.goals.border,
                  borderWidth: 1.2,
                  borderRadius: 18,
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                {/* Genuine Checkbox */}
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: isDone ? ZONES.goals.base : '#FFFFFF',
                    borderColor: ZONES.goals.base,
                    borderWidth: 1.5,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isDone ? <Feather name="check" size={13} color="#FFFFFF" /> : null}
                </View>

                {/* Text and Label */}
                <View style={{ flex: 1, gap: 3 }}>
                  <Text
                    style={[
                      TYPOGRAPHY.cardLabel,
                      { color: ZONES.goals.mutedLabel, fontSize: 10 },
                    ]}
                  >
                    Action Item {idx + 1}
                  </Text>
                  <Text
                    style={[
                      TYPOGRAPHY.bodyText,
                      {
                        color: isDone ? '#64748B' : '#1E293B',
                        textDecorationLine: isDone ? 'line-through' : 'none',
                      },
                    ]}
                  >
                    {goal}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Large Chapter Gap (48px) */}
      <View style={{ height: SPACING.chapter }} />

      {/* ==================================================================== */}
      {/* 05. BOTTOM ACTIONS (Clear Primary & Secondary States)                */}
      {/* ==================================================================== */}
      <View style={{ gap: SPACING.internal }}>
        {!isSaved && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onSavePlan}
            style={{
              backgroundColor: '#0F172A',
              paddingVertical: 16,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
              shadowColor: '#0F172A',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 10,
              elevation: 4,
            }}
          >
            <Feather name="check" size={18} color="#FFFFFF" />
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 14.5,
                fontWeight: '600',
                letterSpacing: 0.2,
              }}
            >
              Save & Activate Plan
            </Text>
          </TouchableOpacity>
        )}

        {/* Retake Questionnaire: Proper secondary button with visible border */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onRegenerate}
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: '#CBD5E1',
            borderWidth: 1.5,
            paddingVertical: 14,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: '#334155',
              fontSize: 14,
              fontWeight: '600',
              letterSpacing: 0.1,
            }}
          >
            Retake Questionnaire
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
