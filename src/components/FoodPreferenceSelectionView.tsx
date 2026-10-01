import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

// Smooth entrance fade
export function FoodFadeIn({ delay = 0, style, children }: { delay?: number; style?: any; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const t = Animated.timing(v, { toValue: 1, duration: 420, delay, useNativeDriver: true });
    t.start();
    return () => t.stop();
  }, [delay]);
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

export interface FoodPreferenceItem {
  id: string;
  title: string;
  tag: string;
  desc: string;
  iconName: string;
  iconFamily: 'MaterialCommunityIcons' | 'Ionicons' | 'Feather';
  iconColor: string;
  iconBgColor: string;
}

export const foodPreferencesData: FoodPreferenceItem[] = [
  {
    id: 'Vegetarian',
    title: 'Vegetarian',
    tag: 'PLANT & DAIRY',
    desc: 'Plant nutrition including dairy & cottage cheese',
    iconFamily: 'MaterialCommunityIcons',
    iconName: 'leaf',
    iconColor: '#10B981',
    iconBgColor: '#ECFDF5',
  },
  {
    id: 'Vegan',
    title: 'Vegan',
    tag: '100% PLANT BASED',
    desc: 'Pure plant foods, zero animal or dairy products',
    iconFamily: 'MaterialCommunityIcons',
    iconName: 'sprout',
    iconColor: '#059669',
    iconBgColor: '#F0FDF4',
  },
  {
    id: 'Eggitarian',
    title: 'Eggitarian',
    tag: 'VEG & WHOLE EGGS',
    desc: 'Plant-based diet supplemented with whole eggs',
    iconFamily: 'MaterialCommunityIcons',
    iconName: 'egg-outline',
    iconColor: '#F59E0B',
    iconBgColor: '#FFFBEB',
  },
  {
    id: 'Non-Vegetarian',
    title: 'Non-Vegetarian',
    tag: 'LEAN MEATS & FISH',
    desc: 'Poultry, fish, seafood & high-protein meats',
    iconFamily: 'MaterialCommunityIcons',
    iconName: 'food-drumstick-outline',
    iconColor: '#E11D48',
    iconBgColor: '#FFE4E6',
  },
  {
    id: 'Jain',
    title: 'Jain',
    tag: 'SATTVIC & ROOT-FREE',
    desc: 'Pure vegetarian without underground root vegetables',
    iconFamily: 'MaterialCommunityIcons',
    iconName: 'flower-tulip-outline',
    iconColor: '#8B5CF6',
    iconBgColor: '#F5F3FF',
  },
  {
    id: 'Other',
    title: 'Other',
    tag: 'FLEXIBLE & VARIED',
    desc: 'Pescatarian, keto, or personalized diet choices',
    iconFamily: 'MaterialCommunityIcons',
    iconName: 'silverware-fork-knife',
    iconColor: '#0EA5E9',
    iconBgColor: '#F0F9FF',
  },
];

interface FoodPreferenceCardProps {
  item: FoodPreferenceItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
  index?: number;
}

export function FoodPreferenceCard({ item, isSelected, onSelect, index = 0 }: FoodPreferenceCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const selectAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  const checkAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  const iconScaleAnim = useRef(new Animated.Value(isSelected ? 1.1 : 1)).current;
  const mountAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = Animated.timing(mountAnim, {
      toValue: 1,
      duration: 420,
      delay: 60 + index * 65,
      useNativeDriver: true,
    });
    t.start();
    return () => t.stop();
  }, [index]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(selectAnim, {
        toValue: isSelected ? 1 : 0,
        friction: 6,
        tension: 80,
        useNativeDriver: false,
      }),
      Animated.spring(checkAnim, {
        toValue: isSelected ? 1 : 0,
        friction: 5,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.spring(iconScaleAnim, {
        toValue: isSelected ? 1.12 : 1,
        friction: 5,
        tension: 90,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isSelected]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.94,
      useNativeDriver: true,
      speed: 50,
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
      Vibration.vibrate(Platform.OS === 'ios' ? 10 : 25);
    } catch {
      // Ignore vibration errors on unsupported environments
    }

    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.94, duration: 60, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1.03, friction: 3, tension: 90, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
    ]).start();

    onSelect(item.id);
  };

  const animatedBg = selectAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFFFFF', '#FFF5F6'],
  });

  const animatedBorder = selectAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#F1F5F9', '#E11D48'],
  });

  const animatedBorderWidth = selectAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1.4, 2],
  });

  const checkRotate = checkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-45deg', '0deg'],
  });

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: mountAnim,
        transform: [
          { translateY: mountAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
          { scale: scaleAnim },
        ],
      }}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={{ flex: 1 }}
      >
        <Animated.View
          style={{
            flex: 1,
            backgroundColor: animatedBg,
            borderColor: animatedBorder,
            borderWidth: animatedBorderWidth,
            borderRadius: 22,
            minHeight: 130,
            height: 130,
            paddingVertical: 14,
            paddingHorizontal: 8,
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            shadowColor: isSelected ? '#E11D48' : '#0F172A',
            shadowOffset: { width: 0, height: isSelected ? 4 : 2 },
            shadowOpacity: isSelected ? 0.20 : 0.04,
            shadowRadius: isSelected ? 12 : 6,
            elevation: isSelected ? 4 : 1.5,
          }}
        >
          {/* Top-Right Animated Checkmark Badge with Pop & Rotate */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: '#E11D48',
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: checkAnim }, { rotate: checkRotate }],
              opacity: checkAnim,
              zIndex: 10,
              shadowColor: '#E11D48',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.35,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <Feather name="check" size={12} color="#FFFFFF" />
          </Animated.View>

          {/* Card Content with Symmetrical Centering & Icon Scale Pop */}
          <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <Animated.View
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: isSelected ? '#FFE4E6' : item.iconBgColor,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 8,
                transform: [{ scale: iconScaleAnim }],
              }}
            >
              {item.iconFamily === 'MaterialCommunityIcons' ? (
                <MaterialCommunityIcons
                  name={item.iconName as any}
                  size={24}
                  color={isSelected ? '#E11D48' : item.iconColor}
                />
              ) : item.iconFamily === 'Ionicons' ? (
                <Ionicons
                  name={item.iconName as any}
                  size={24}
                  color={isSelected ? '#E11D48' : item.iconColor}
                />
              ) : (
                <Feather
                  name={item.iconName as any}
                  size={22}
                  color={isSelected ? '#E11D48' : item.iconColor}
                />
              )}
            </Animated.View>
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
              {item.title}
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
              {item.tag}
            </Text>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export interface FoodPreferenceSelectionViewProps {
  selectedPreference: string;
  onSelectPreference: (id: string) => void;
  onContinue: () => void;
  onBack?: () => void;
  showHeader?: boolean;
  stepNumber?: number;
  totalSteps?: number;
}

export function FoodPreferenceSelectionView({
  selectedPreference,
  onSelectPreference,
  onContinue,
  onBack,
  showHeader = false,
  stepNumber = 6,
  totalSteps = 10,
}: FoodPreferenceSelectionViewProps) {
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

  // Symmetrical row pairs of cards
  const cardRows = [];
  for (let i = 0; i < foodPreferencesData.length; i += 2) {
    cardRows.push(foodPreferencesData.slice(i, i + 2));
  }

  const content = (
    <View className="flex-1 justify-between pb-2">
      <View className="gap-3.5">
        {/* Headings */}
        <FoodFadeIn delay={0}>
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
              Select your food preference
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
              Your meal suggestions and macro plans calibrate around this dietary lifestyle.
            </Text>
          </View>
        </FoodFadeIn>

        {/* Symmetrical 2-Column Grid (Row-by-row with equal flex and gap) */}
        <View style={{ gap: 12, marginVertical: 4 }}>
          {cardRows.map((row, rowIdx) => (
            <View key={rowIdx} style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              {row.map((item, colIdx) => (
                <FoodPreferenceCard
                  key={item.id}
                  item={item}
                  isSelected={selectedPreference === item.id}
                  onSelect={onSelectPreference}
                  index={rowIdx * 2 + colIdx}
                />
              ))}
            </View>
          ))}
        </View>
      </View>

      {/* Footer Section: Continue Button */}
      <FoodFadeIn delay={520}>
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
      </FoodFadeIn>
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
            <Text className="text-[#0F172A] text-base font-bold text-center">
              AI Wellness Coach
            </Text>
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
