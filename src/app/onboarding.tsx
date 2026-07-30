import React, { useEffect, useRef, useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, Animated } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, Path, Rect, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { useUserStore } from '../store/userStore';
import { PageIndicator } from '../presentation/components/PageIndicator';

export default function OnboardingScreen() {
  const { setCompletedOnboarding } = useUserStore();

  const [currentSlide, setCurrentSlide] = useState(0);

  // Animations
  const floatAnim = useRef(new Animated.Value(0)).current;
  const fadeContentAnim = useRef(new Animated.Value(1)).current;

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
  }, [floatAnim]);

  const handleNext = () => {
    if (currentSlide < 2) {
      // Fade out content, update slide, fade in content
      Animated.timing(fadeContentAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setCurrentSlide(prev => prev + 1);
        Animated.timing(fadeContentAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    } else {
      handleFinishOnboarding();
    }
  };

  const handleFinishOnboarding = () => {
    setCompletedOnboarding(true);
    router.replace('/get-started' as any);
  };

  // Render SVG Illustrations per slide
  const renderIllustration = (index: number) => {
    switch (index) {
      case 0:
        return (
          <Svg width="100%" height="100%" viewBox="0 0 280 200" fill="none">
            <Defs>
              <LinearGradient id="wallGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#EEF2F6" />
                <Stop offset="100%" stopColor="#D2D6DC" />
              </LinearGradient>
              <LinearGradient id="doorGrad" x1="0" y1="0" x2="100%" y2="0">
                <Stop offset="0%" stopColor="#1E293B" />
                <Stop offset="100%" stopColor="#0F172A" />
              </LinearGradient>
              <LinearGradient id="goldGrad" x1="0" y1="0" x2="100%" y2="0">
                <Stop offset="0%" stopColor="#F5B942" />
                <Stop offset="100%" stopColor="#D97706" />
              </LinearGradient>
            </Defs>
            {/* Wall Background */}
            <Rect x="0" y="0" width="280" height="200" fill="url(#wallGrad)" rx="24" />
            
            {/* Luxury Double Door */}
            <Rect x="80" y="20" width="120" height="180" fill="url(#doorGrad)" rx="8" />
            <Rect x="85" y="25" width="53" height="175" fill="none" stroke="#F5B942" strokeWidth="1.5" rx="4" />
            <Rect x="142" y="25" width="53" height="175" fill="none" stroke="#F5B942" strokeWidth="1.5" rx="4" />
            
            {/* Door glass panes */}
            <Rect x="95" y="40" width="33" height="50" fill="#E2E8F0" opacity="0.15" rx="2" />
            <Rect x="152" y="40" width="33" height="50" fill="#E2E8F0" opacity="0.15" rx="2" />
            
            {/* Gold Handles */}
            <Path d="M134 110 V130" stroke="url(#goldGrad)" strokeWidth="3" strokeLinecap="round" />
            <Path d="M146 110 V130" stroke="url(#goldGrad)" strokeWidth="3" strokeLinecap="round" />
            
            {/* Luxury Potted Plant */}
            <Path d="M22 155 L26 195 H44 L48 155 Z" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1" />
            <Path d="M35 155 C20 135, 15 110, 35 100 C30 115, 30 135, 35 155 Z" fill="#10B981" />
            <Path d="M35 155 C50 135, 55 110, 35 100 C40 115, 40 135, 35 155 Z" fill="#047857" />
            <Path d="M35 155 C35 125, 45 100, 50 90 C45 110, 40 135, 35 155 Z" fill="#059669" opacity="0.8" />
            
            {/* Approach Path / Welcome Mat */}
            <Path d="M60 200 L75 170 H205 L220 200 Z" fill="#F5B942" opacity="0.15" />
            <SvgText x="140" y="190" fill="#F5B942" fontSize="5" fontWeight="bold" textAnchor="middle" letterSpacing="2">VIRLA WELCOME</SvgText>

            {/* Sparkles / Luxury Lighting */}
            <Circle cx="240" cy="50" r="1.5" fill="#F5B942" />
            <Circle cx="225" cy="75" r="2.5" fill="#F5B942" opacity="0.6" />
          </Svg>
        );
      case 1:
        return (
          <Svg width="100%" height="100%" viewBox="0 0 280 200" fill="none">
            <Defs>
              <LinearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#A5F3FC" />
                <Stop offset="50%" stopColor="#E0F2FE" />
                <Stop offset="100%" stopColor="#FFFFFF" />
              </LinearGradient>
              <LinearGradient id="woodGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#F5E0C3" />
                <Stop offset="100%" stopColor="#E3C49D" />
              </LinearGradient>
            </Defs>
            {/* Room Background */}
            <Rect x="0" y="0" width="280" height="200" fill="url(#skyGrad)" rx="24" />
            
            {/* Wooden Floor */}
            <Path d="M0 150 L280 150 V200 H0 Z" fill="url(#woodGrad)" />
            <Path d="M0 150 L280 150" stroke="#E5E7EB" strokeWidth="2" />
            {/* Planks styling */}
            <Path d="M50 150 V200 M110 150 V200 M170 150 V200 M230 150 V200" stroke="#D1B084" strokeWidth="1" />
            
            {/* High Rise Window Grid */}
            <Path d="M0 30 H280 M0 90 H280 M90 0 V150 M190 0 V150" stroke="#FFFFFF" strokeWidth="3" opacity="0.6" />
            
            {/* Distant Skyscrapers */}
            <Rect x="30" y="95" width="25" height="55" fill="#CBD5E1" opacity="0.5" rx="1" />
            <Rect x="60" y="110" width="20" height="40" fill="#E2E8F0" opacity="0.6" rx="1" />
            <Rect x="200" y="80" width="30" height="70" fill="#CBD5E1" opacity="0.4" rx="1" />
            
            {/* Premium Yoga Mat */}
            <Rect x="60" y="145" width="160" height="15" rx="7.5" fill="#4F46E5" />
            <Rect x="65" y="147" width="150" height="11" rx="5.5" fill="none" stroke="#F5B942" strokeWidth="1.5" />
            
            {/* Sun Rays */}
            <Path d="M0 0 L150 150 L200 150 L50 0 Z" fill="#FFFBEB" opacity="0.25" />
            
            {/* Stylized Yoga practitioner */}
            <Circle cx={140} cy={100} r={12} fill="#101828" />
            <Path d="M140 112 C135 125, 120 132, 100 146" stroke="#101828" strokeWidth={7} strokeLinecap="round" />
            <Path d="M140 112 C148 125, 160 132, 180 146" stroke="#101828" strokeWidth={7} strokeLinecap="round" />
            <Path d="M130 120 L110 105" stroke="#4F46E5" strokeWidth={5} strokeLinecap="round" />
            <Path d="M150 120 L170 105" stroke="#4F46E5" strokeWidth={5} strokeLinecap="round" />
          </Svg>
        );
      case 2:
        return (
          <Svg width="100%" height="100%" viewBox="0 0 280 200" fill="none">
            <Defs>
              <LinearGradient id="bgGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#FAF5FF" />
                <Stop offset="100%" stopColor="#F3E8FF" />
              </LinearGradient>
              <LinearGradient id="barbellGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor="#4F46E5" />
                <Stop offset="100%" stopColor="#06B6D4" />
              </LinearGradient>
            </Defs>
            {/* Background */}
            <Rect x="0" y="0" width="280" height="200" fill="url(#bgGrad3)" rx="24" />
            
            {/* Luxury Gym Floor Mat */}
            <Rect x="20" y="140" width="240" height="50" rx="12" fill="#0F172A" opacity="0.9" />
            <Rect x="24" y="144" width="232" height="42" rx="8" fill="none" stroke="#F5B942" strokeWidth="1" opacity="0.3" />
            
            {/* Barbell weights representation */}
            <Path d="M50 160 H230" stroke="#64748B" strokeWidth={4} />
            <Circle cx={60} cy={160} r={15} fill="url(#barbellGrad)" />
            <Circle cx={70} cy={160} r={15} fill="url(#barbellGrad)" />
            <Circle cx={210} cy={160} r={15} fill="url(#barbellGrad)" />
            <Circle cx={220} cy={160} r={15} fill="url(#barbellGrad)" />
            
            {/* Client (lifting stance) */}
            <Circle cx={120} cy={95} r={10} fill="#101828" />
            <Path d="M120 105 L120 135 L105 160" stroke="#101828" strokeWidth={7} strokeLinecap="round" />
            <Path d="M120 135 L135 160" stroke="#101828" strokeWidth={7} strokeLinecap="round" />
            <Path d="M120 115 L100 112" stroke="#101828" strokeWidth={5} strokeLinecap="round" />
            
            {/* Strength Coach (standing stance, check posture) */}
            <Circle cx={170} cy={85} r={10} fill="#6D5EF7" />
            <Path d="M170 95 L170 130 L160 160" stroke="#6D5EF7" strokeWidth={7} strokeLinecap="round" />
            <Path d="M170 130 L180 160" stroke="#6D5EF7" strokeWidth={7} strokeLinecap="round" />
            {/* Arm reaching out guiding */}
            <Path d="M170 105 L142 108" stroke="#6D5EF7" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
            
            {/* Floating Gold Check Stars */}
            <Path d="M95 50 L98 56 L104 57 L100 61 L101 67 L95 64 L89 67 L90 61 L86 57 L92 56 Z" fill="#F5B942" />
            <Path d="M195 40 L197 44 L201 45 L198 48 L199 52 L195 50 L191 52 L192 48 L189 45 L193 44 Z" fill="#F5B942" opacity="0.7" />
          </Svg>
        );
      default:
        return null;
    }
  };

  const slides = [
    {
      title: 'Personal Fitness.\nAt Your Doorstep.',
      description: 'Book ACE/ISSA certified fitness coaches for Yoga, Strength, Boxing, Dance, and Rehabilitation. We bring all required gear straight to your home.',
    },
    {
      title: 'Flexible Spacing.\nSeamless Booking.',
      description: 'Train wherever you are comfortable: home, society gym, outdoor parks, or office. Select convenient morning or evening time slots that fit your day.',
    },
    {
      title: 'Verified & Secure.\nPeace of Mind.',
      description: 'Enjoy professional service with live travel arrival maps, secure customer OTP check-ins, and direct one-tap emergency SOS support.',
    }
  ];

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Top Header Navigation Row */}
      <View className="h-14 flex-row justify-end items-center px-6 z-10">
        <TouchableOpacity onPress={handleFinishOnboarding} activeOpacity={0.6}>
          <Text className="text-[#6B7280] text-xs font-black uppercase tracking-widest">
            Skip
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main slide content area */}
      <View className="flex-1 justify-between px-6 pb-10">
        <Animated.View 
          style={{ opacity: fadeContentAnim }} 
          className="flex-1 justify-center gap-6"
        >
          {/* Animated SVG Illustration wrapper */}
          <Animated.View 
            style={{ transform: [{ translateY: floatAnim }] }} 
            className="w-full aspect-[4/3] items-center justify-center relative overflow-hidden"
          >
            {renderIllustration(currentSlide)}
          </Animated.View>

          {/* Texts */}
          <View className="gap-3 px-2">
            <Text className="text-[#101828] text-[30px] font-black tracking-tight leading-[38px]">
              {slides[currentSlide].title}
            </Text>
            <Text className="text-[#6B7280] text-[15px] font-semibold leading-relaxed">
              {slides[currentSlide].description}
            </Text>
          </View>
        </Animated.View>

        {/* Footer controls: Page indicator & Primary action */}
        <View className="gap-6 mt-6 px-2">
          {/* Custom Page indicator */}
          <PageIndicator activeIndex={currentSlide} total={3} />

          {/* Main CTA button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleNext}
            className="w-full bg-[#101828] py-[18px] rounded-[20px] items-center justify-center shadow-md"
          >
            <Text className="text-white text-xs font-black uppercase tracking-widest">
              {currentSlide === 2 ? 'Get Started' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
