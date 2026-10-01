import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Vibration,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';

// ponytail: opacity ramp stands in for blur — RN has no blur filter, BlurView isn't worth it here.
export function FadeIn({ delay = 0, style, children }: { delay?: number; style?: any; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const t = Animated.timing(v, { toValue: 1, duration: 420, delay, useNativeDriver: true });
    t.start();
    return () => t.stop();
  }, []);
  return (
    <Animated.View
      style={[
        {
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

export interface PrimaryGoalItem {
  id: string;
  title: string;
  tag: string;
  desc: string;
  hasIcon?: boolean;
  iconSource?: any;
}

export const primaryGoalsData: PrimaryGoalItem[] = [
  {
    id: 'Weight Loss',
    title: 'Weight Loss',
    tag: 'CALORIE DEFICIT',
    desc: 'Sustainable fat burn & steady weight drop',
    hasIcon: true,
    iconSource: require('../../assets/images/goal/weightloss.png'),
  },
  {
    id: 'Fat Loss',
    title: 'Fat Loss',
    tag: 'LEAN DEFINITION',
    desc: 'Shed body fat while preserving lean muscle',
    hasIcon: true,
    iconSource: require('../../assets/images/goal/fatloss.png'),
  },
  {
    id: 'Muscle Gain',
    title: 'Muscle Gain',
    tag: 'HYPERTROPHY',
    desc: 'Build size with progressive resistance drills',
    hasIcon: true,
    iconSource: require('../../assets/images/goal/muscle.png'),
  },
  {
    id: 'Strength',
    title: 'Strength',
    tag: 'POWER & FORCE',
    desc: 'Boost neuromuscular drive & lifting power',
    hasIcon: true,
    iconSource: require('../../assets/images/goal/strength.png'),
  },
  {
    id: 'General Fitness',
    title: 'General Fitness',
    tag: 'TOTAL VITALITY',
    desc: 'Heart health, mobility & daily energy levels',
    hasIcon: true,
    iconSource: require('../../assets/images/goal/generalfitness.png'),
  },
  {
    id: 'Flexibility',
    title: 'Flexibility',
    tag: 'RANGE OF MOTION',
    desc: 'Deep mobility, joint relief & supple posture',
    hasIcon: true,
    iconSource: require('../../assets/images/goal/flexibility.png'),
  },
  {
    id: 'Endurance',
    title: 'Endurance',
    tag: 'CARDIO & STAMINA',
    desc: 'Boost aerobic threshold & sustained stamina',
    hasIcon: true,
    iconSource: require('../../assets/images/goal/endurance.png'),
  },
  {
    id: 'Sports Performance',
    title: 'Sports Performance',
    tag: 'SPEED & AGILITY',
    desc: 'Explosive power, quick feet & dynamic agility',
    hasIcon: true,
    iconSource: require('../../assets/images/goal/sportsperformance.png'),
  },
];

interface GoalCardProps {
  goal: PrimaryGoalItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
  index?: number;
}

export function GoalCard({ goal, isSelected, onSelect, index = 0 }: GoalCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const checkAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  const mountAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = Animated.timing(mountAnim, {
      toValue: 1,
      duration: 420,
      delay: 80 + index * 70,
      useNativeDriver: true,
    });
    t.start();
    return () => t.stop();
  }, []);

  useEffect(() => {
    Animated.spring(checkAnim, {
      toValue: isSelected ? 1 : 0,
      friction: 5,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [isSelected]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 45,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 8,
    }).start();
  };

  const handlePress = () => {
    try {
      Vibration.vibrate(10);
    } catch {
      // Ignore vibration errors on unsupported environments
    }

    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 60, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
    ]).start();

    onSelect(goal.id);
  };

  return (
    <Animated.View
      style={{
        width: '47.8%',
        opacity: mountAnim,
        transform: [
          { translateY: mountAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          { scale: scaleAnim },
        ],
      }}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: isSelected ? '#E11D48' : '#F1F5F9',
          borderWidth: isSelected ? 2 : 1.4,
          borderRadius: 22,
          minHeight: 124,
          height: 124,
          paddingVertical: 12,
          paddingHorizontal: 8,
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          shadowColor: isSelected ? '#E11D48' : '#0F172A',
          shadowOffset: { width: 0, height: isSelected ? 4 : 2 },
          shadowOpacity: isSelected ? 0.18 : 0.04,
          shadowRadius: isSelected ? 10 : 6,
          elevation: isSelected ? 3.5 : 1.5,
        }}
      >
        {/* Top-Right Animated Checkmark Badge */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 9,
            right: 9,
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: '#E11D48',
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: checkAnim }],
            opacity: checkAnim,
            zIndex: 10,
          }}
        >
          <Feather name="check" size={11} color="#FFFFFF" />
        </Animated.View>

        {/* Card Content */}
        {goal.hasIcon ? (
          <View className="items-center justify-center w-full">
            {goal.iconSource ? (
              <Image
                source={goal.iconSource}
                style={{ width: 44, height: 44, marginBottom: 8 }}
                resizeMode="contain"
              />
            ) : null}
            <Text
              numberOfLines={1}
              style={{
                fontSize: 14,
                fontWeight: '700',
                letterSpacing: -0.3,
                color: isSelected ? '#E11D48' : '#0F172A',
                textAlign: 'center',
              }}
            >
              {goal.title}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 9.5,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                color: isSelected ? '#E11D48' : '#94A3B8',
                marginTop: 2,
                textAlign: 'center',
              }}
            >
              {goal.tag}
            </Text>
          </View>
        ) : (
          <View className="items-center justify-center w-full px-1">
            <Text
              numberOfLines={1}
              style={{
                fontSize: 14.5,
                fontWeight: '700',
                letterSpacing: -0.3,
                color: isSelected ? '#E11D48' : '#0F172A',
                textAlign: 'center',
              }}
            >
              {goal.title}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 9.5,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                color: isSelected ? '#E11D48' : '#94A3B8',
                marginTop: 3,
                textAlign: 'center',
              }}
            >
              {goal.tag}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export interface GoalSelectionViewProps {
  selectedGoal: string;
  onSelectGoal: (id: string) => void;
  onContinue: () => void;
  onBack?: () => void;
  showHeader?: boolean;
  stepNumber?: number;
  totalSteps?: number;
}

export function GoalSelectionView({
  selectedGoal,
  onSelectGoal,
  onContinue,
  onBack,
  showHeader = false,
  stepNumber = 2,
  totalSteps = 10,
}: GoalSelectionViewProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const continueScaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(stepNumber / totalSteps)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: stepNumber / totalSteps,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [stepNumber, totalSteps]);

  const content = (
    <View className="flex-1 justify-between pb-2">
      <View className="gap-3.5">
        {/* Headings */}
        <FadeIn delay={0}>
        <View className="gap-1.5">
          <Text
            style={{
              color: '#0F172A',
              fontSize: 27,
              fontWeight: '700',
              letterSpacing: -0.7,
              lineHeight: 32,
              marginTop: 2,
            }}
          >
            Select your primary goal
          </Text>
          <Text
            style={{
              color: '#64748B',
              fontSize: 13,
              fontWeight: '400',
              lineHeight: 20,
              letterSpacing: 0,
            }}
          >
            Your calorie expenditure and macro targets calibrate around this focus.
          </Text>
        </View>
        </FadeIn>

        {/* 2-Column Grid of 8 Goals */}
        <View className="flex-row flex-wrap justify-between gap-y-3.5 my-1">
          {primaryGoalsData.map((item, i) => (
            <GoalCard
              key={item.id}
              goal={item}
              isSelected={selectedGoal === item.id}
              onSelect={onSelectGoal}
              index={i}
            />
          ))}
        </View>
      </View>

      {/* Footer Section: Continue Button */}
      <FadeIn delay={520}>
      <View className="gap-2 mt-2">
        {/* Continue Button */}
        <Animated.View style={{ width: '100%', transform: [{ scale: continueScaleAnim }] }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPressIn={() => {
              Animated.spring(continueScaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 45, bounciness: 4 }).start();
            }}
            onPressOut={() => {
              Animated.spring(continueScaleAnim, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
            }}
            onPress={() => {
              try {
                Vibration.vibrate(12);
              } catch {}
              onContinue();
            }}
            style={{
              backgroundColor: '#E11D48',
              height: 56,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 10,
              shadowColor: '#E11D48',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 4,
            }}
            className="w-full mt-1"
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 15,
                fontWeight: '800',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
              }}
            >
              CONTINUE
            </Text>
            <Feather name="arrow-right" size={17} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
      </View>
      </FadeIn>
    </View>
  );

  if (!showHeader) {
    return content;
  }

  // Standalone screen with top navigation header and progress bar
  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar style="dark" />

      {/* Top Header */}
      <View style={{ paddingTop: insets.top, backgroundColor: '#FFFFFF' }} className="z-10">
        <View className="h-14 flex-row items-center px-4 justify-between">
          <TouchableOpacity
            onPress={onBack || (() => router.back())}
            activeOpacity={0.6}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            className="w-10 h-10 items-center justify-center rounded-full"
          >
            <Ionicons name="arrow-back" size={22} color="#0F172A" />
          </TouchableOpacity>

          <View className="flex-1 items-center px-2">
            <View className="flex-row items-center gap-2">
              <Image
                source={require('../../assets/images/ai-coach-emblem.png')}
                style={{ width: 20, height: 20 }}
                resizeMode="contain"
              />
              <Text className="text-[#0F172A] text-base font-bold text-center">
                AI Wellness Coach
              </Text>
            </View>
          </View>

          <View
            style={{
              backgroundColor: '#FFE4E6',
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 9999,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: '#E11D48',
                letterSpacing: 0.5,
              }}
            >
              {stepNumber} / {totalSteps}
            </Text>
          </View>
        </View>

        {/* Progress Bar Line directly below Header */}
        <View className="w-full h-[3px] bg-[#F1F5F9]">
          <Animated.View
            className="h-full bg-[#E11D48] rounded-full"
            style={{
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            }}
          />
        </View>
      </View>

      {/* Main Canvas */}
      <View
        style={{
          flex: 1,
          backgroundColor: '#FFFFFF',
          paddingHorizontal: 22,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom, 20) + 12,
        }}
      >
        {content}
      </View>
    </View>
  );
}
