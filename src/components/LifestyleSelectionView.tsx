import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Smooth fade in helper
export function LifestyleFadeIn({
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

export interface LifestyleProfileTag {
  id: string;
  label: string;
  iconName: string;
  iconFamily: 'Feather' | 'Ionicons';
  iconColor: string;
  iconBgColor: string;
}

export const LIFESTYLE_TAGS: LifestyleProfileTag[] = [
  {
    id: 'Office Job',
    label: 'Office Job',
    iconName: 'monitor',
    iconFamily: 'Feather',
    iconColor: '#3B82F6',
    iconBgColor: '#EFF6FF',
  },
  {
    id: 'Work From Home',
    label: 'Work From Home',
    iconName: 'home',
    iconFamily: 'Feather',
    iconColor: '#E11D48',
    iconBgColor: '#FFE4E6',
  },
  {
    id: 'Student',
    label: 'Student',
    iconName: 'school-outline',
    iconFamily: 'Ionicons',
    iconColor: '#0D9488',
    iconBgColor: '#F0FDFA',
  },
  {
    id: 'Shift Worker',
    label: 'Shift Worker',
    iconName: 'clock',
    iconFamily: 'Feather',
    iconColor: '#8B5CF6',
    iconBgColor: '#F5F3FF',
  },
  {
    id: 'Travel Often',
    label: 'Travel Often',
    iconName: 'airplane-outline',
    iconFamily: 'Ionicons',
    iconColor: '#0EA5E9',
    iconBgColor: '#F0F9FF',
  },
  {
    id: 'Active Field',
    label: 'Active Field',
    iconName: 'zap',
    iconFamily: 'Feather',
    iconColor: '#F97316',
    iconBgColor: '#FFF7ED',
  },
];

interface LifestyleTagCardProps {
  tag: LifestyleProfileTag;
  isSelected: boolean;
  onToggle: () => void;
  index?: number;
}

export function LifestyleTagCard({ tag, isSelected, onToggle, index = 0 }: LifestyleTagCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const selectAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  const checkAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  const iconScaleAnim = useRef(new Animated.Value(isSelected ? 1.1 : 1)).current;
  const mountAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = Animated.timing(mountAnim, {
      toValue: 1,
      duration: 380,
      delay: 50 + index * 50,
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
        toValue: isSelected ? 1.14 : 1,
        friction: 5,
        tension: 90,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isSelected]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
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
      Vibration.vibrate(10);
    } catch {}

    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.94, duration: 60, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1.03, friction: 3, tension: 90, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
    ]).start();

    onToggle();
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

  return (
    <Animated.View
      style={{
        flex: 1,
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
        style={{ flex: 1 }}
      >
        <Animated.View
          style={{
            flex: 1,
            height: 60,
            backgroundColor: animatedBg,
            borderColor: animatedBorder,
            borderWidth: animatedBorderWidth,
            borderRadius: 20,
            paddingHorizontal: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            shadowColor: isSelected ? '#E11D48' : '#0F172A',
            shadowOffset: { width: 0, height: isSelected ? 3 : 1.5 },
            shadowOpacity: isSelected ? 0.16 : 0.03,
            shadowRadius: isSelected ? 8 : 4,
            elevation: isSelected ? 3 : 1,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 }}>
            <Animated.View
              style={{
                width: 34,
                height: 34,
                borderRadius: 11,
                backgroundColor: isSelected ? '#FFE4E6' : tag.iconBgColor,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale: iconScaleAnim }],
              }}
            >
              {tag.iconFamily === 'Feather' ? (
                <Feather name={tag.iconName as any} size={16} color={isSelected ? '#E11D48' : tag.iconColor} />
              ) : (
                <Ionicons name={tag.iconName as any} size={17} color={isSelected ? '#E11D48' : tag.iconColor} />
              )}
            </Animated.View>

            <Text
              numberOfLines={1}
              style={{
                fontSize: 12.5,
                fontWeight: '700',
                color: isSelected ? '#E11D48' : '#0F172A',
                letterSpacing: -0.2,
                flexShrink: 1,
              }}
            >
              {tag.label}
            </Text>
          </View>

          {/* Animated checkmark */}
          <Animated.View
            style={{
              transform: [{ scale: checkAnim }],
              opacity: checkAnim,
            }}
          >
            <Ionicons name="checkmark-circle" size={19} color="#E11D48" />
          </Animated.View>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export interface LifestyleSelectionViewProps {
  wakeupTime: string;
  setWakeupTime: (t: string) => void;
  sleepTime: string;
  setSleepTime: (t: string) => void;
  selectedLifestyle: string[];
  setSelectedLifestyle: React.Dispatch<React.SetStateAction<string[]>>;
  onContinue: () => void;
  onBack?: () => void;
  showHeader?: boolean;
  stepNumber?: number;
  totalSteps?: number;
}

export function LifestyleSelectionView({
  wakeupTime = '06:30 AM',
  setWakeupTime,
  sleepTime = '10:30 PM',
  setSleepTime,
  selectedLifestyle = ['Work From Home'],
  setSelectedLifestyle,
  onContinue,
  onBack,
  showHeader = false,
  stepNumber = 5,
  totalSteps = 10,
}: LifestyleSelectionViewProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const continueScaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(stepNumber / totalSteps)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: stepNumber / totalSteps,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [stepNumber, totalSteps]);

  // Adjust time by delta minutes (+30 or -30)
  const adjustTime = (type: 'wake' | 'sleep', deltaMinutes: number) => {
    try {
      Vibration.vibrate(8);
    } catch { }

    const currentTimeStr = type === 'wake' ? wakeupTime : sleepTime;
    const match = currentTimeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    let hours = 6;
    let minutes = 30;
    let period = 'AM';
    if (match) {
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
      period = match[3].toUpperCase();
    }

    let totalMin = (hours % 12) * 60 + minutes;
    if (period === 'PM') totalMin += 12 * 60;

    totalMin = (totalMin + deltaMinutes + 24 * 60) % (24 * 60);

    const h24 = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const newPeriod = h24 >= 12 ? 'PM' : 'AM';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;

    const formattedTime = `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${newPeriod}`;
    if (type === 'wake') {
      setWakeupTime(formattedTime);
    } else {
      setSleepTime(formattedTime);
    }
  };

  // Toggle AM / PM
  const togglePeriod = (type: 'wake' | 'sleep') => {
    try {
      Vibration.vibrate(8);
    } catch { }

    const currentTimeStr = type === 'wake' ? wakeupTime : sleepTime;
    const match = currentTimeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return;
    const timePart = match[1].padStart(2, '0') + ':' + match[2];
    const newPeriod = match[3].toUpperCase() === 'AM' ? 'PM' : 'AM';
    const formattedTime = `${timePart} ${newPeriod}`;
    if (type === 'wake') {
      setWakeupTime(formattedTime);
    } else {
      setSleepTime(formattedTime);
    }
  };


  const parsedWakeTime = useMemo(() => {
    const parts = wakeupTime.trim().split(' ');
    return {
      time: parts[0] || '06:30',
      period: parts[1] || 'AM',
    };
  }, [wakeupTime]);

  const parsedSleepTime = useMemo(() => {
    const parts = sleepTime.trim().split(' ');
    return {
      time: parts[0] || '10:30',
      period: parts[1] || 'PM',
    };
  }, [sleepTime]);

  const handleToggleLifestyle = (id: string) => {
    try {
      Vibration.vibrate(10);
    } catch { }

    setSelectedLifestyle((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((item) => item !== id);
        return next;
      } else {
        return [...prev, id];
      }
    });
  };

  const handlePressIn = () => {
    Animated.spring(continueScaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 45,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(continueScaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 8,
    }).start();
  };

  const handleContinuePress = () => {
    try {
      Vibration.vibrate(12);
    } catch { }
    onContinue();
  };

  const content = (
    <View className="flex-1 justify-between pb-2">
      <View>

        {/* Heading & Subtitle */}
        <LifestyleFadeIn delay={60}>
          <View style={{ marginBottom: 18 }}>
            <Text
              style={{
                color: '#0F172A',
                fontSize: 27,
                fontWeight: '800',
                letterSpacing: -0.7,
                lineHeight: 33,
              }}
            >
              Lifestyle & sleep habits
            </Text>
            <Text
              style={{
                color: '#64748B',
                fontSize: 13.5,
                fontWeight: '400',
                lineHeight: 20,
                marginTop: 6,
              }}
            >
              Syncs your meal, hydration, and recovery schedule with your natural biological clock.
            </Text>
          </View>
        </LifestyleFadeIn>

        {/* WAKE-UP & SLEEP TIME CARDS */}
        <LifestyleFadeIn delay={120}>
          <View style={{ flexDirection: 'row', gap: 11 }}>
            {/* Card 1: WAKE-UP */}
            <View
              style={{
                flex: 1,
                backgroundColor: '#FFFFFF',
                borderColor: '#FDE047',
                borderWidth: 1.5,
                borderRadius: 20,
                padding: 13,
                shadowColor: '#F59E0B',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              {/* Header row */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Feather name="sun" size={13} color="#D97706" />
                  <Text
                    style={{
                      color: '#92400E',
                      fontSize: 11,
                      fontWeight: '800',
                      letterSpacing: 0.8,
                      textTransform: 'uppercase',
                    }}
                  >
                    WAKE-UP
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: '#FEF3C7',
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    borderRadius: 9999,
                  }}
                >
                  <Text
                    style={{
                      color: '#B45309',
                      fontSize: 9.5,
                      fontWeight: '700',
                    }}
                  >
                    Sun Rise
                  </Text>
                </View>
              </View>

              {/* Time display with Minus & Plus buttons */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                  <Text
                    style={{
                      color: '#0F172A',
                      fontSize: 22,
                      fontWeight: '800',
                      letterSpacing: -0.5,
                    }}
                  >
                    {parsedWakeTime.time}
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => togglePeriod('wake')}
                    style={{
                      backgroundColor: '#FEF3C7',
                      paddingHorizontal: 5,
                      paddingVertical: 1.5,
                      borderRadius: 5,
                    }}
                  >
                    <Text
                      style={{
                        color: '#B45309',
                        fontSize: 10,
                        fontWeight: '800',
                      }}
                    >
                      {parsedWakeTime.period}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Stepper with - and + */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Pressable
                    onPress={() => adjustTime('wake', -30)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={({ pressed }) => [
                      {
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor: '#FFFBEB',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: '#FDE68A',
                        opacity: pressed ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Feather name="minus" size={13} color="#B45309" />
                  </Pressable>

                  <Pressable
                    onPress={() => adjustTime('wake', 30)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={({ pressed }) => [
                      {
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor: '#FEF3C7',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: '#FCD34D',
                        opacity: pressed ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Feather name="plus" size={13} color="#B45309" />
                  </Pressable>
                </View>
              </View>

              {/* Footer hint */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: '#F59E0B',
                  }}
                />
                <Text
                  numberOfLines={1}
                  style={{
                    color: '#64748B',
                    fontSize: 11,
                    fontWeight: '500',
                  }}
                >
                  Peak Morning Energy
                </Text>
              </View>
            </View>

            {/* Card 2: SLEEP TIME */}
            <View
              style={{
                flex: 1,
                backgroundColor: '#FFFFFF',
                borderColor: '#C7D2FE',
                borderWidth: 1.5,
                borderRadius: 20,
                padding: 13,
                shadowColor: '#6366F1',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              {/* Header row */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Feather name="moon" size={13} color="#4F46E5" />
                  <Text
                    style={{
                      color: '#3730A3',
                      fontSize: 11,
                      fontWeight: '800',
                      letterSpacing: 0.8,
                      textTransform: 'uppercase',
                    }}
                  >
                    SLEEP TIME
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: '#EEF2FF',
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    borderRadius: 9999,
                  }}
                >
                  <Text
                    style={{
                      color: '#4F46E5',
                      fontSize: 9.5,
                      fontWeight: '700',
                    }}
                  >
                    Night
                  </Text>
                </View>
              </View>

              {/* Time display with Minus & Plus buttons */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                  <Text
                    style={{
                      color: '#0F172A',
                      fontSize: 22,
                      fontWeight: '800',
                      letterSpacing: -0.5,
                    }}
                  >
                    {parsedSleepTime.time}
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => togglePeriod('sleep')}
                    style={{
                      backgroundColor: '#EEF2FF',
                      paddingHorizontal: 5,
                      paddingVertical: 1.5,
                      borderRadius: 5,
                    }}
                  >
                    <Text
                      style={{
                        color: '#4F46E5',
                        fontSize: 10,
                        fontWeight: '800',
                      }}
                    >
                      {parsedSleepTime.period}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Stepper with - and + */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Pressable
                    onPress={() => adjustTime('sleep', -30)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={({ pressed }) => [
                      {
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor: '#F8FAFC',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        opacity: pressed ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Feather name="minus" size={13} color="#4F46E5" />
                  </Pressable>

                  <Pressable
                    onPress={() => adjustTime('sleep', 30)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={({ pressed }) => [
                      {
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor: '#EEF2FF',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: '#C7D2FE',
                        opacity: pressed ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Feather name="plus" size={13} color="#4F46E5" />
                  </Pressable>
                </View>
              </View>

              {/* Footer hint */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: '#6366F1',
                  }}
                />
                <Text
                  numberOfLines={1}
                  style={{
                    color: '#64748B',
                    fontSize: 11,
                    fontWeight: '500',
                  }}
                >
                  Deep Sleep Window
                </Text>
              </View>
            </View>
          </View>
        </LifestyleFadeIn>

        {/* LIFESTYLE PROFILE TAGS SECTION */}
        <LifestyleFadeIn delay={180}>
          <View style={{ marginTop: 38 }}>
            {/* Header row */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 11,
                paddingHorizontal: 2,
              }}
            >
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                  color: '#64748B',
                }}
              >
                LIFESTYLE PROFILE TAGS
              </Text>
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: '700',
                  color: '#E11D48',
                }}
              >
                Select
              </Text>
            </View>

            {/* Symmetrical 2-Column Grid */}
            <View style={{ gap: 12 }}>
              {Array.from({ length: Math.ceil(LIFESTYLE_TAGS.length / 2) }).map((_, rowIdx) => {
                const pair = LIFESTYLE_TAGS.slice(rowIdx * 2, rowIdx * 2 + 2);
                return (
                  <View key={rowIdx} style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                    {pair.map((tag, colIdx) => (
                      <LifestyleTagCard
                        key={tag.id}
                        tag={tag}
                        isSelected={selectedLifestyle.includes(tag.id)}
                        onToggle={() => handleToggleLifestyle(tag.id)}
                        index={rowIdx * 2 + colIdx}
                      />
                    ))}
                  </View>
                );
              })}
            </View>
          </View>
        </LifestyleFadeIn>

      </View>

      {/* Bottom Button & Settings Hint */}
      <LifestyleFadeIn delay={360}>
        <View style={{ marginTop: 18 }}>
          <Animated.View style={{ transform: [{ scale: continueScaleAnim }] }}>
            <TouchableOpacity
              activeOpacity={0.92}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onPress={handleContinuePress}
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
      </LifestyleFadeIn>


    </View>
  );

  // If used inside virla-ai onboarding wizard where the top header & progress bar are already mounted
  if (!showHeader) {
    return content;
  }

  // Standalone mode with full screen header & progress bar
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
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#F1F5F9',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFFFFF',
            }}
          >
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
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
        <View className="w-full h-[3.5px] bg-[#F1F5F9]">
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 22,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom, 20) + 12,
        }}
      >
        {content}
      </ScrollView>
    </View>
  );
}
