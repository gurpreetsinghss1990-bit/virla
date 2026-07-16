import React, { useEffect, useRef } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, Animated, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle, Path, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

export default function OnboardingScreen() {
  const router = useRouter();

  // Animation values
  const floatAnim = useRef(new Animated.Value(0)).current;
  const fadeTextAnim = useRef(new Animated.Value(0)).current;
  const slideCardsAnim = useRef(new Animated.Value(30)).current;
  const fadeCardsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Gently floating illustration loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        })
      ])
    ).start();

    // 2. Sequence stagger animation on mount
    Animated.parallel([
      Animated.timing(fadeTextAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(fadeCardsAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.spring(slideCardsAnim, {
        toValue: 0,
        friction: 8,
        tension: 30,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const handleSkipOrStart = () => {
    router.push('/get-started' as any);
  };

  const featureCards = [
    { label: 'Verified Trainers', desc: 'ACE/ISSA Certified Pros', icon: 'shield' },
    { label: 'Flexible Scheduling', desc: 'Train when you want', icon: 'calendar' },
    { label: 'Live Session Tracking', desc: 'Real-time arrival maps', icon: 'map-pin' },
    { label: 'Safe OTP Verification', desc: 'Secure trainer check-in', icon: 'lock' },
    { label: 'Secure Payments', desc: 'Transparent local ledgers', icon: 'credit-card' },
    { label: 'Emergency SOS Help', desc: 'One-tap dispatch support', icon: 'heart' }
  ];

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Top Header Row */}
      <View className="h-14 flex-row justify-end items-center px-6 z-10">
        <TouchableOpacity onPress={handleSkipOrStart} activeOpacity={0.6}>
          <Text className="text-zinc-400 text-xs font-black uppercase tracking-widest">
            Skip
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 60 }}
      >
        <View className="gap-6">
          
          {/* Visual Illustration Area - occupies ~40% (Feature 2) */}
          <Animated.View 
            style={{ transform: [{ translateY: floatAnim }] }} 
            className="w-full aspect-[4/3] items-center justify-center relative overflow-hidden"
          >
            {/* Crisp Custom SVG Illustration */}
            <Svg width="100%" height="100%" viewBox="0 0 280 200" fill="none">
              <Defs>
                <LinearGradient id="grad-illustration-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#4F46E5" stopOpacity="0.1" />
                  <Stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.05" />
                </LinearGradient>
                <LinearGradient id="grad-active-ring" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#4F46E5" />
                  <Stop offset="100%" stopColor="#10B981" />
                </LinearGradient>
              </Defs>

              {/* Background circle blobs */}
              <Circle cx={140} cy={100} r={80} fill="url(#grad-illustration-bg)" />
              <Circle cx={220} cy={60} r={35} fill="#EEF2F6" opacity={0.5} />
              
              {/* Abstract Room elements: Mat & plant */}
              <Path d="M40 160 L240 160" stroke="#E5E7EB" strokeWidth={3} strokeLinecap="round" />
              <Rect x={80} y={150} width={120} height={10} rx={5} fill="#10B981" opacity={0.35} />
              
              {/* Stylized Client (Yoga pose / stretching) */}
              <Circle cx={110} cy={95} r={12} fill="#111827" />
              <Path d="M110 107 C110 120, 125 130, 130 150" stroke="#111827" strokeWidth={8} strokeLinecap="round" />
              <Path d="M110 115 L95 130" stroke="#111827" strokeWidth={6} strokeLinecap="round" />
              <Path d="M130 150 L155 150" stroke="#111827" strokeWidth={6} strokeLinecap="round" />

              {/* Stylized Coach (Helping layout form) */}
              <Circle cx={175} cy={80} r={12} fill="#4F46E5" />
              <Path d="M175 92 L175 125 L190 150" stroke="#4F46E5" strokeWidth={8} strokeLinecap="round" />
              <Path d="M175 105 L145 110" stroke="#4F46E5" strokeWidth={6} strokeLinecap="round" />
              <Path d="M190 150 L205 150" stroke="#4F46E5" strokeWidth={6} strokeLinecap="round" />

              {/* Floating micro indicators (Safe shield and location sparkles) */}
              <Circle cx={50} cy={70} r={15} fill="white" opacity={0.9} />
              <Path d="M46 70 L49 73 L54 67" stroke="#10B981" strokeWidth={2.5} strokeLinecap="round" />
              
              <Circle cx={235} cy={110} r={18} fill="white" opacity={0.9} />
              <Path d="M230 110 H240 M235 105 V115" stroke="#4F46E5" strokeWidth={2} />
            </Svg>
          </Animated.View>

          {/* Headline and description (Feature 2) */}
          <Animated.View style={{ opacity: fadeTextAnim }} className="gap-2.5">
            <Text className="text-zinc-950 text-3xl font-black tracking-tight leading-[1.15]">
              Personal Fitness.{"\n"}At Your Doorstep.
            </Text>
            <Text className="text-zinc-500 text-xs font-semibold leading-relaxed">
              Book certified trainers for Yoga, Strength, Boxing, Dance, Rehabilitation, Senior Fitness and more.
            </Text>
          </Animated.View>

          {/* Feature Cards Grid (Feature 2 & 5) */}
          <Animated.View 
            style={{ opacity: fadeCardsAnim, transform: [{ translateY: slideCardsAnim }] }}
            className="flex-row flex-wrap justify-between gap-y-3.5 mt-2"
          >
            {featureCards.map((card, idx) => (
              <View 
                key={idx}
                className="w-[48%] bg-[#F8F9FB] border border-zinc-200/60 p-3.5 rounded-2xl flex-row gap-2.5 items-center"
              >
                <View className="w-7 h-7 rounded-lg bg-indigo-50 items-center justify-center">
                  <Feather name={card.icon as any} size={11} color="#4F46E5" />
                </View>
                <View className="flex-1 pr-1">
                  <Text className="text-zinc-950 text-[9px] font-black uppercase tracking-wider">{card.label}</Text>
                  <Text className="text-zinc-400 text-[7px] font-bold mt-0.5 leading-tight">{card.desc}</Text>
                </View>
              </View>
            ))}
          </Animated.View>

          {/* Primary & Secondary Call to Actions */}
          <View className="gap-3 mt-6">
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSkipOrStart}
              className="w-full bg-[#111827] py-4 rounded-2xl items-center justify-center shadow-md"
            >
              <Text className="text-white text-xs font-black uppercase tracking-wider">Get Started</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.6}
              onPress={handleSkipOrStart}
              className="w-full py-3.5 items-center justify-center"
            >
              <Text className="text-zinc-500 text-xs font-black uppercase tracking-widest">
                I Already Have An Account
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
