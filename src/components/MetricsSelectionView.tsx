import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Vibration,
  Platform,
  Pressable,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

// Smooth fade in helper
export function MetricsFadeIn({
  delay = 0,
  style,
  children,
}: {
  delay?: number;
  style?: any;
  children: React.ReactNode;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const t = Animated.timing(v, {
      toValue: 1,
      duration: 380,
      delay,
      useNativeDriver: true,
    });
    t.start();
    return () => t.stop();
  }, [delay]);
  return (
    <Animated.View
      style={[
        {
          opacity: v,
          transform: [
            {
              translateY: v.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

export interface MetricsSelectionViewProps {
  gender: string;
  setGender: (g: string) => void;
  age: string;
  setAge: (a: string) => void;
  height: string;
  setHeight: (h: string) => void;
  weight: string;
  setWeight: (w: string) => void;
  onContinue: () => void;
  onBack?: () => void;
  showHeader?: boolean;
  stepNumber?: number;
  totalSteps?: number;
}

export function MetricsSelectionView({
  gender,
  setGender,
  age,
  setAge,
  height,
  setHeight,
  weight,
  setWeight,
  onContinue,
  onBack,
  showHeader = false,
  stepNumber = 1,
  totalSteps = 10,
}: MetricsSelectionViewProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Unit states
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');

  // Parse numeric values safely with sensible defaults matching the design
  const parsedAge = useMemo(() => {
    const val = parseInt(age.replace(/[^0-9]/g, ''), 10);
    return !isNaN(val) && val >= 10 && val <= 100 ? val : 28;
  }, [age]);

  const parsedHeightCm = useMemo(() => {
    const raw = height.trim().toLowerCase();
    if (!raw) return 178;

    // Check ft/in match
    const ftMatch = raw.match(/^(\d+)\s*(?:'|ft)?\s*(\d+)?(?:"|in)?$/i);
    if (ftMatch && ftMatch[1]) {
      const feet = parseInt(ftMatch[1], 10);
      const inches = ftMatch[2] ? parseInt(ftMatch[2], 10) : 0;
      if (feet >= 3 && feet <= 8) {
        return Math.round((feet * 12 + inches) * 2.54);
      }
    }

    const num = parseFloat(raw.replace(/[^0-9.]/g, ''));
    if (!isNaN(num) && num >= 90 && num <= 250) {
      return Math.round(num);
    }
    return 178;
  }, [height]);

  const parsedWeightKg = useMemo(() => {
    const val = parseInt(weight.replace(/[^0-9]/g, ''), 10);
    return !isNaN(val) && val >= 30 && val <= 250 ? val : 72;
  }, [weight]);

  // Derived values for ft/in and lbs display
  const heightInFtIn = useMemo(() => {
    const totalInches = Math.round(parsedHeightCm / 2.54);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return { feet, inches };
  }, [parsedHeightCm]);

  const weightInLbs = useMemo(() => {
    return Math.round(parsedWeightKg * 2.20462);
  }, [parsedWeightKg]);

  // Quick age options
  const quickAges = [21, 28, 35, 45];

  // Button hold repeat helpers
  const repeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearHoldTimer = () => {
    if (repeatTimerRef.current) {
      clearInterval(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
  };

  const triggerHaptic = () => {
    try {
      Vibration.vibrate(8);
    } catch {}
  };

  // Age adjusters
  const adjustAge = (delta: number) => {
    triggerHaptic();
    const next = Math.max(12, Math.min(99, parsedAge + delta));
    setAge(next.toString());
  };

  const startHoldAge = (delta: number) => {
    adjustAge(delta);
    clearHoldTimer();
    repeatTimerRef.current = setInterval(() => {
      adjustAge(delta);
    }, 120);
  };

  // Height adjusters
  const adjustHeight = (delta: number) => {
    triggerHaptic();
    if (heightUnit === 'cm') {
      const nextCm = Math.max(90, Math.min(240, parsedHeightCm + delta));
      setHeight(`${nextCm} cm`);
    } else {
      // In feet/inches, delta adjusts by 1 inch (~2.54 cm)
      const currentInches = Math.round(parsedHeightCm / 2.54);
      const nextInches = Math.max(36, Math.min(94, currentInches + delta));
      const nextCm = Math.round(nextInches * 2.54);
      const feet = Math.floor(nextInches / 12);
      const inches = nextInches % 12;
      setHeight(`${feet}'${inches}"`);
    }
  };

  const startHoldHeight = (delta: number) => {
    adjustHeight(delta);
    clearHoldTimer();
    repeatTimerRef.current = setInterval(() => {
      adjustHeight(delta);
    }, 120);
  };

  // Weight adjusters
  const adjustWeight = (delta: number) => {
    triggerHaptic();
    if (weightUnit === 'kg') {
      const nextKg = Math.max(30, Math.min(220, parsedWeightKg + delta));
      setWeight(nextKg.toString());
    } else {
      // In lbs, delta adjusts by 1 lb
      const nextLbs = Math.max(66, Math.min(485, weightInLbs + delta));
      const nextKg = Math.round(nextLbs / 2.20462);
      setWeight(nextKg.toString());
    }
  };

  const startHoldWeight = (delta: number) => {
    adjustWeight(delta);
    clearHoldTimer();
    repeatTimerRef.current = setInterval(() => {
      adjustWeight(delta);
    }, 120);
  };

  // Animations
  const continueScaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(
    new Animated.Value(stepNumber / totalSteps)
  ).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: stepNumber / totalSteps,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [stepNumber, totalSteps]);

  // Main UI Content (Reusable whether inside virla-ai or standalone)
  const content = (
    <View className="flex-1 justify-between">
      <View className="gap-5">
        {/* Title and Subtitle */}
        <MetricsFadeIn delay={40}>
          <View className="gap-1 mt-0.5">
            <Text
              style={{
                color: '#0F172A',
                fontSize: 26,
                fontWeight: '800',
                letterSpacing: -0.6,
                lineHeight: 32,
              }}
            >
              Tell us about your metrics <Text style={{ color: '#E11D48', fontWeight: '800' }}>*</Text>
            </Text>
            <Text
              style={{
                color: '#64748B',
                fontSize: 13,
                fontWeight: '400',
                lineHeight: 19,
              }}
            >
              Used to calculate your Basal Metabolic Rate (BMR) with clinical
              precision.
            </Text>
          </View>
        </MetricsFadeIn>

        {/* SECTION 1: GENDER */}
        <MetricsFadeIn delay={90} style={{ marginTop: 16 }}>
          <View className="gap-2.5">
            {/* Section Header */}
            <View className="flex-row items-center px-0.5">
              <Text
                style={{
                  color: '#475569',
                  fontSize: 12.5,
                  fontWeight: '800',
                  letterSpacing: 0.6,
                }}
              >
                GENDER <Text style={{ color: '#E11D48', fontWeight: '800' }}>*</Text>
              </Text>
            </View>

            {/* Sex Options: Male, Female, Other */}
            <View className="flex-row gap-3">
              {/* Male Card */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  triggerHaptic();
                  setGender('Male');
                }}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: gender === 'Male' ? '#C0003C' : '#E2E8F0',
                  borderWidth: gender === 'Male' ? 1.5 : 1,
                  borderRadius: 18,
                  paddingVertical: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  shadowColor: gender === 'Male' ? '#C0003C' : '#64748B',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: gender === 'Male' ? 0.12 : 0.04,
                  shadowRadius: 6,
                  elevation: 2,
                }}
                className="flex-1"
              >
                {gender === 'Male' && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 7,
                      right: 7,
                      width: 17,
                      height: 17,
                      borderRadius: 9,
                      backgroundColor: '#C0003C',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                  </View>
                )}
                {/* Icon Circle */}
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: '#EDE9FE',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 8,
                  }}
                >
                  <Ionicons name="male" size={21} color="#C0003C" />
                </View>
                <Text
                  style={{
                    color: gender === 'Male' ? '#C0003C' : '#334155',
                    fontSize: 13.5,
                    fontWeight: gender === 'Male' ? '800' : '600',
                  }}
                >
                  Male
                </Text>
              </TouchableOpacity>

              {/* Female Card */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  triggerHaptic();
                  setGender('Female');
                }}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: gender === 'Female' ? '#C0003C' : '#E2E8F0',
                  borderWidth: gender === 'Female' ? 1.5 : 1,
                  borderRadius: 18,
                  paddingVertical: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  shadowColor: gender === 'Female' ? '#C0003C' : '#64748B',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: gender === 'Female' ? 0.12 : 0.04,
                  shadowRadius: 6,
                  elevation: 2,
                }}
                className="flex-1"
              >
                {gender === 'Female' && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 7,
                      right: 7,
                      width: 17,
                      height: 17,
                      borderRadius: 9,
                      backgroundColor: '#C0003C',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                  </View>
                )}
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: '#E0E7FF',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 8,
                  }}
                >
                  <Ionicons name="female" size={21} color="#6366F1" />
                </View>
                <Text
                  style={{
                    color: gender === 'Female' ? '#C0003C' : '#334155',
                    fontSize: 13.5,
                    fontWeight: gender === 'Female' ? '800' : '600',
                  }}
                >
                  Female
                </Text>
              </TouchableOpacity>

              {/* Other Card */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  triggerHaptic();
                  setGender('Other');
                }}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: gender === 'Other' ? '#C0003C' : '#E2E8F0',
                  borderWidth: gender === 'Other' ? 1.5 : 1,
                  borderRadius: 18,
                  paddingVertical: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  shadowColor: gender === 'Other' ? '#C0003C' : '#64748B',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: gender === 'Other' ? 0.12 : 0.04,
                  shadowRadius: 6,
                  elevation: 2,
                }}
                className="flex-1"
              >
                {gender === 'Other' && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 7,
                      right: 7,
                      width: 17,
                      height: 17,
                      borderRadius: 9,
                      backgroundColor: '#C0003C',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                  </View>
                )}
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: '#E0E7FF',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 8,
                  }}
                >
                  <Ionicons name="male-female" size={21} color="#6366F1" />
                </View>
                <Text
                  style={{
                    color: gender === 'Other' ? '#C0003C' : '#334155',
                    fontSize: 13.5,
                    fontWeight: gender === 'Other' ? '800' : '600',
                  }}
                >
                  Other
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </MetricsFadeIn>

        {/* SECTION 2: AGE (YEARS) */}
        <MetricsFadeIn delay={140} style={{ marginTop: 28 }}>
          <View className="gap-2.5">
            {/* Header row with quick pills */}
            <View className="flex-row items-center justify-between px-0.5">
              <Text
                style={{
                  color: '#475569',
                  fontSize: 12.5,
                  fontWeight: '800',
                  letterSpacing: 0.6,
                }}
              >
                AGE (YEARS)
              </Text>

              {/* Quick Select Pills: 21, 28, 35, 45 */}
              <View className="flex-row gap-1.5">
                {quickAges.map((qa) => {
                  const isSelected = parsedAge === qa;
                  return (
                    <TouchableOpacity
                      key={qa}
                      activeOpacity={0.75}
                      onPress={() => {
                        triggerHaptic();
                        setAge(qa.toString());
                      }}
                      style={{
                        backgroundColor: isSelected ? '#FFE4E6' : '#F1F5F9',
                        paddingHorizontal: 9,
                        paddingVertical: 3,
                        borderRadius: 9999,
                      }}
                    >
                      <Text
                        style={{
                          color: isSelected ? '#C0003C' : '#475569',
                          fontSize: 11.5,
                          fontWeight: isSelected ? '800' : '600',
                        }}
                      >
                        {qa}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Stepper Card */}
            <View
              style={{
                backgroundColor: '#F1F5F9',
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingVertical: 10,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              {/* Minus Button */}
              <Pressable
                onPressIn={() => startHoldAge(-1)}
                onPressOut={clearHoldTimer}
                style={({ pressed }) => [
                  {
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#0F172A',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.08,
                    shadowRadius: 3,
                    elevation: 2,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Feather name="minus" size={20} color="#0F172A" />
              </Pressable>

              {/* Value Display */}
              <View className="flex-row items-baseline gap-1.5">
                <Text
                  style={{
                    color: '#0F172A',
                    fontSize: 32,
                    fontWeight: '800',
                    letterSpacing: -0.5,
                  }}
                >
                  {parsedAge}
                </Text>
                <Text
                  style={{
                    color: '#64748B',
                    fontSize: 13.5,
                    fontWeight: '500',
                  }}
                >
                  yrs old
                </Text>
              </View>

              {/* Plus Button */}
              <Pressable
                onPressIn={() => startHoldAge(1)}
                onPressOut={clearHoldTimer}
                style={({ pressed }) => [
                  {
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#0F172A',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.08,
                    shadowRadius: 3,
                    elevation: 2,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Feather name="plus" size={20} color="#0F172A" />
              </Pressable>
            </View>
          </View>
        </MetricsFadeIn>

        {/* SECTION 3: HEIGHT & WEIGHT SIDE-BY-SIDE */}
        <MetricsFadeIn delay={190} style={{ marginTop: 28 }}>
          <View className="flex-row gap-3">
            {/* HEIGHT CARD */}
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                padding: 13,
                shadowColor: '#64748B',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 5,
                elevation: 1,
              }}
              className="flex-1 gap-2.5"
            >
              {/* Header with unit toggle */}
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <MaterialCommunityIcons
                    name="ruler"
                    size={14}
                    color="#475569"
                  />
                  <Text
                    style={{
                      color: '#475569',
                      fontSize: 10.5,
                      fontWeight: '800',
                      letterSpacing: 0.5,
                    }}
                  >
                    HEIGHT
                  </Text>
                </View>

                {/* cm / ft toggle pill */}
                <View
                  style={{
                    backgroundColor: '#E0E7FF',
                    borderRadius: 9999,
                    flexDirection: 'row',
                    padding: 2,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      triggerHaptic();
                      setHeightUnit('cm');
                    }}
                    style={{
                      backgroundColor:
                        heightUnit === 'cm' ? '#FFFFFF' : 'transparent',
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                      borderRadius: 9999,
                    }}
                  >
                    <Text
                      style={{
                        color: heightUnit === 'cm' ? '#C0003C' : '#64748B',
                        fontSize: 10,
                        fontWeight: heightUnit === 'cm' ? '800' : '600',
                      }}
                    >
                      cm
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      triggerHaptic();
                      setHeightUnit('ft');
                    }}
                    style={{
                      backgroundColor:
                        heightUnit === 'ft' ? '#FFFFFF' : 'transparent',
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                      borderRadius: 9999,
                    }}
                  >
                    <Text
                      style={{
                        color: heightUnit === 'ft' ? '#C0003C' : '#64748B',
                        fontSize: 10,
                        fontWeight: heightUnit === 'ft' ? '800' : '600',
                      }}
                    >
                      ft
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Stepper Inside Height Card */}
              <View
                style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: 16,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Pressable
                  onPressIn={() => startHoldHeight(-1)}
                  onPressOut={clearHoldTimer}
                  style={({ pressed }) => [
                    {
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: '#FFFFFF',
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: '#0F172A',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.08,
                      shadowRadius: 2,
                      elevation: 1,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Feather name="minus" size={17} color="#0F172A" />
                </Pressable>

                <View className="flex-row items-baseline gap-1">
                  <Text
                    style={{
                      color: '#0F172A',
                      fontSize: heightUnit === 'cm' ? 22 : 18,
                      fontWeight: '800',
                    }}
                  >
                    {heightUnit === 'cm'
                      ? parsedHeightCm
                      : `${heightInFtIn.feet}'${heightInFtIn.inches}"`}
                  </Text>
                  <Text
                    style={{
                      color: '#64748B',
                      fontSize: 11,
                      fontWeight: '500',
                    }}
                  >
                    {heightUnit}
                  </Text>
                </View>

                <Pressable
                  onPressIn={() => startHoldHeight(1)}
                  onPressOut={clearHoldTimer}
                  style={({ pressed }) => [
                    {
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: '#FFFFFF',
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: '#0F172A',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.08,
                      shadowRadius: 2,
                      elevation: 1,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Feather name="plus" size={17} color="#0F172A" />
                </Pressable>
              </View>
            </View>

            {/* WEIGHT CARD */}
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                padding: 13,
                shadowColor: '#64748B',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 5,
                elevation: 1,
              }}
              className="flex-1 gap-2.5"
            >
              {/* Header with unit toggle */}
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <MaterialCommunityIcons
                    name="scale-bathroom"
                    size={14}
                    color="#475569"
                  />
                  <Text
                    style={{
                      color: '#475569',
                      fontSize: 10.5,
                      fontWeight: '800',
                      letterSpacing: 0.5,
                    }}
                  >
                    WEIGHT
                  </Text>
                </View>

                {/* kg / lbs toggle pill */}
                <View
                  style={{
                    backgroundColor: '#E0E7FF',
                    borderRadius: 9999,
                    flexDirection: 'row',
                    padding: 2,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      triggerHaptic();
                      setWeightUnit('kg');
                    }}
                    style={{
                      backgroundColor:
                        weightUnit === 'kg' ? '#FFFFFF' : 'transparent',
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                      borderRadius: 9999,
                    }}
                  >
                    <Text
                      style={{
                        color: weightUnit === 'kg' ? '#C0003C' : '#64748B',
                        fontSize: 10,
                        fontWeight: weightUnit === 'kg' ? '800' : '600',
                      }}
                    >
                      kg
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      triggerHaptic();
                      setWeightUnit('lbs');
                    }}
                    style={{
                      backgroundColor:
                        weightUnit === 'lbs' ? '#FFFFFF' : 'transparent',
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                      borderRadius: 9999,
                    }}
                  >
                    <Text
                      style={{
                        color: weightUnit === 'lbs' ? '#C0003C' : '#64748B',
                        fontSize: 10,
                        fontWeight: weightUnit === 'lbs' ? '800' : '600',
                      }}
                    >
                      lbs
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Stepper Inside Weight Card */}
              <View
                style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: 16,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Pressable
                  onPressIn={() => startHoldWeight(-1)}
                  onPressOut={clearHoldTimer}
                  style={({ pressed }) => [
                    {
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: '#FFFFFF',
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: '#0F172A',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.08,
                      shadowRadius: 2,
                      elevation: 1,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Feather name="minus" size={17} color="#0F172A" />
                </Pressable>

                <View className="flex-row items-baseline gap-1">
                  <Text
                    style={{
                      color: '#0F172A',
                      fontSize: 22,
                      fontWeight: '800',
                    }}
                  >
                    {weightUnit === 'kg' ? parsedWeightKg : weightInLbs}
                  </Text>
                  <Text
                    style={{
                      color: '#64748B',
                      fontSize: 11,
                      fontWeight: '500',
                    }}
                  >
                    {weightUnit}
                  </Text>
                </View>

                <Pressable
                  onPressIn={() => startHoldWeight(1)}
                  onPressOut={clearHoldTimer}
                  style={({ pressed }) => [
                    {
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: '#FFFFFF',
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: '#0F172A',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.08,
                      shadowRadius: 2,
                      elevation: 1,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Feather name="plus" size={17} color="#0F172A" />
                </Pressable>
              </View>
            </View>
          </View>
        </MetricsFadeIn>
      </View>

      {/* SECTION 5: FOOTER (CONTINUE BUTTON + PRIVACY FOOTNOTE) */}
      <MetricsFadeIn delay={340}>
        <View className="gap-3 pt-6 pb-2">
          {/* Continue Button */}
          <Animated.View
            style={{
              width: '100%',
              transform: [{ scale: continueScaleAnim }],
            }}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPressIn={() => {
                Animated.spring(continueScaleAnim, {
                  toValue: 0.97,
                  useNativeDriver: true,
                  speed: 45,
                  bounciness: 4,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(continueScaleAnim, {
                  toValue: 1,
                  useNativeDriver: true,
                  speed: 30,
                  bounciness: 8,
                }).start();
              }}
              onPress={() => {
                triggerHaptic();
                // Ensure form state is synchronized
                setAge(parsedAge.toString());
                setHeight(
                  heightUnit === 'cm'
                    ? `${parsedHeightCm} cm`
                    : `${heightInFtIn.feet}'${heightInFtIn.inches}"`
                );
                setWeight(parsedWeightKg.toString());
                onContinue();
              }}
              style={{
                backgroundColor: gender ? '#E11D48' : '#FDA4AF',
                height: 56,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 10,
                shadowColor: '#E11D48',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: gender ? 0.3 : 0.08,
                shadowRadius: 12,
                elevation: 4,
                opacity: gender ? 1 : 0.65,
              }}
              className="w-full"
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
      </MetricsFadeIn>
    </View>
  );

  if (!showHeader) {
    return content;
  }

  // Standalone Screen wrapper with complete custom header
  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar style="dark" />

      {/* Top Header */}
      <View
        style={{ paddingTop: insets.top, backgroundColor: '#FFFFFF' }}
        className="z-10"
      >
        <View className="h-14 flex-row items-center px-4 justify-between">
          {/* Back Button */}
          <TouchableOpacity
            onPress={onBack || (() => router.back())}
            activeOpacity={0.6}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            className="w-10 h-10 items-center justify-center rounded-full"
          >
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>

          {/* Center Title */}
          <View className="flex-1 items-center px-2">
            <View className="flex-row items-center gap-2">
              <Image
                source={require('../../assets/images/ai-coach-emblem.png')}
                style={{ width: 20, height: 20 }}
                resizeMode="contain"
              />
              <Text
                style={{
                  color: '#0F172A',
                  fontSize: 16,
                  fontWeight: '700',
                  textAlign: 'center',
                }}
              >
                AI Wellness Coach
              </Text>
            </View>
          </View>

          {/* Right Step Count Pill */}
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
      </View>

      {/* Main Canvas Scroll Area */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom, 20) + 12,
        }}
      >
        {content}
      </ScrollView>
    </View>
  );
}
