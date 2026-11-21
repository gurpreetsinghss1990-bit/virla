import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useUserStore } from '../store/userStore';
import { bootstrapApp } from '../utils/bootstrap';

export default function SplashScreen() {
  const insets = useSafeAreaInsets();

  // 🚀 100% UI Thread Reanimated Shared Values
  const screenFade = useSharedValue(0);
  const logoScale = useSharedValue(0.95);
  const sparkScale = useSharedValue(1);
  const sparkGlowScale = useSharedValue(1);
  const sparkGlowOpacity = useSharedValue(0.5);

  // Loading dots shared values (pure UI thread stagger)
  const dot1Scale = useSharedValue(0.8);
  const dot2Scale = useSharedValue(0.8);
  const dot3Scale = useSharedValue(0.8);

  useEffect(() => {
    // 1. Screen fade-in on UI Thread
    screenFade.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    logoScale.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });

    // 2. Spark luxury pulse on UI Thread (3.5s cycle matching Stitch code.html)
    sparkScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1750, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1750, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    sparkGlowScale.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 1750, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1750, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    sparkGlowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.45, { duration: 1750, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // 3. Dots pulse on UI Thread
    const pulseDot = (sharedVal: any, delay: number) => {
      setTimeout(() => {
        sharedVal.value = withRepeat(
          withSequence(
            withTiming(1.25, { duration: 400, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.75, { duration: 400, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
        );
      }, delay);
    };

    pulseDot(dot1Scale, 0);
    pulseDot(dot2Scale, 200);
    pulseDot(dot3Scale, 400);

    // 4. Bootstrap logic & Navigation
    let hasNavigated = false;
    const startTime = Date.now();

    const runBootstrap = async () => {
      try {
        await bootstrapApp();
      } catch (err) {
        console.warn('Bootstrap orchestrator errored:', err);
      } finally {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(1600 - elapsed, 0);

        setTimeout(() => {
          triggerExitTransition();
        }, Math.min(remaining, 1400));
      }
    };

    const triggerExitTransition = () => {
      if (hasNavigated) return;
      hasNavigated = true;

      screenFade.value = withTiming(0, { duration: 400, easing: Easing.in(Easing.cubic) });

      setTimeout(() => {
        const { isLoggedIn, hasCompletedOnboarding, user } = useUserStore.getState();
        try {
          if (isLoggedIn) {
            if (user && user.registrationStatus !== 'complete') {
              console.log('[Splash] Incomplete registration detected on startup. Redirecting to user-metrics.');
              router.replace('/user-metrics' as any);
            } else {
              router.replace('/(tabs)');
            }
          } else if (hasCompletedOnboarding) {
            router.replace('/get-started');
          } else {
            router.replace('/onboarding');
          }
        } catch (error) {
          console.error('Splash screen transition error:', error);
          router.replace('/onboarding');
        }
      }, 420);
    };

    const safetyTimeout = setTimeout(() => {
      triggerExitTransition();
    }, 2400);

    runBootstrap();

    return () => {
      clearTimeout(safetyTimeout);
    };
  }, []);

  // Animated styles on UI Thread
  const animatedScreenStyle = useAnimatedStyle(() => ({
    opacity: screenFade.value,
  }));

  const animatedLogoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const animatedSparkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sparkScale.value }],
  }));

  const animatedSparkGlowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sparkGlowScale.value }],
    opacity: sparkGlowOpacity.value,
  }));

  const animatedDot1 = useAnimatedStyle(() => ({
    transform: [{ scale: dot1Scale.value }],
  }));
  const animatedDot2 = useAnimatedStyle(() => ({
    transform: [{ scale: dot2Scale.value }],
  }));
  const animatedDot3 = useAnimatedStyle(() => ({
    transform: [{ scale: dot3Scale.value }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Atmospheric Background Contours & Soft Radial Gradient Mesh */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            {/* Seamless Soft Radial Gradient Mesh around logo center */}
            <RadialGradient id="ambientMeshGrad" cx="58%" cy="46%" r="48%">
              <Stop offset="0%" stopColor="#FB7185" stopOpacity="0.28" />
              <Stop offset="25%" stopColor="#FB7185" stopOpacity="0.16" />
              <Stop offset="55%" stopColor="#FDA4AF" stopOpacity="0.06" />
              <Stop offset="100%" stopColor="#FAFAF9" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="58%" cy="46%" r="220" fill="url(#ambientMeshGrad)" />
        </Svg>

        {/* Top Organic Contour Wave */}
        <Svg
          width="100%"
          height="55%"
          viewBox="0 0 430 450"
          style={styles.topContours}
        >
          <Path
            d="M -40,160 C 120,80 260,260 480,140 C 580,85 520,380 340,420 C 180,455 80,310 -40,160 Z"
            fill="none"
            stroke="#CBD5E1"
            strokeWidth="0.85"
            strokeDasharray="4 5"
            opacity={0.45}
          />
          <Path
            d="M -10,210 C 140,130 280,300 510,190"
            fill="none"
            stroke="#CBD5E1"
            strokeWidth="0.75"
            opacity={0.35}
          />
          <Circle
            cx="280"
            cy="220"
            r="160"
            stroke="#CBD5E1"
            strokeWidth="0.5"
            fill="none"
            opacity={0.3}
          />
        </Svg>

        {/* Bottom Architectural Arc Contours */}
        <Svg
          width="100%"
          height="45%"
          viewBox="0 0 430 380"
          style={styles.bottomContours}
        >
          <Circle
            cx="320"
            cy="280"
            r="230"
            stroke="#CBD5E1"
            strokeWidth="0.75"
            fill="none"
            opacity={0.4}
          />
          <Circle
            cx="320"
            cy="280"
            r="180"
            stroke="#CBD5E1"
            strokeWidth="0.6"
            strokeDasharray="4 6"
            fill="none"
            opacity={0.3}
          />
          <Path
            d="M 60,340 C 160,220 320,200 480,240"
            stroke="#E2E8F0"
            strokeWidth="1.2"
            fill="none"
            opacity={0.4}
          />
        </Svg>
      </View>

      {/* Main Content Area */}
      <Animated.View style={[styles.mainWrapper, animatedScreenStyle]}>
        {/* Spacer for vertical balance */}
        <View style={{ flex: 1 }} />

        {/* ==================== EXACT BRAND MASTER CORE (CENTER) ==================== */}
        <Animated.View style={[styles.centerCore, animatedLogoStyle]}>
          {/* Brand Lockup: VIRLA Wordmark + Crimson Spark */}
          <View style={styles.brandRow}>
            {/* VIRLA Wordmark with exact geometric spacing */}
            <Text style={styles.virlaWordmark}>
              VIRLA
            </Text>

            {/* Signature Radiant Crimson Spark */}
            <View style={styles.sparkContainer}>
              {/* Soft Radial Glow Halo behind spark on UI Thread */}
              <Animated.View style={[styles.sparkGlowWrapper, animatedSparkGlowStyle]}>
                <Svg width={80} height={80} viewBox="0 0 80 80">
                  <Defs>
                    <RadialGradient id="sparkHaloGrad" cx="50%" cy="50%" r="50%">
                      <Stop offset="0%" stopColor="#E11D48" stopOpacity="0.55" />
                      <Stop offset="50%" stopColor="#FB7185" stopOpacity="0.25" />
                      <Stop offset="100%" stopColor="#FB7185" stopOpacity="0" />
                    </RadialGradient>
                  </Defs>
                  <Circle cx="40" cy="40" r="40" fill="url(#sparkHaloGrad)" />
                </Svg>
              </Animated.View>

              {/* 4-Point Star Spark Geometry - 100% UI Thread Animated */}
              <Animated.View style={animatedSparkStyle}>
                <Svg width={40} height={40} viewBox="0 0 100 100">
                  <Defs>
                    <RadialGradient id="sparkGrad" cx="50%" cy="50%" r="50%">
                      <Stop offset="0%" stopColor="#FB7185" />
                      <Stop offset="100%" stopColor="#E11D48" />
                    </RadialGradient>
                  </Defs>
                  {/* Exact 4-point star bezier curve from Stitch specification */}
                  <Path
                    d="M 50 0 C 50 27.614 72.386 50 100 50 C 72.386 50 50 72.386 50 100 C 50 72.386 27.614 50 0 50 C 27.614 50 50 27.614 50 0 Z"
                    fill="url(#sparkGrad)"
                  />
                </Svg>
              </Animated.View>
            </View>
          </View>

          {/* Exact Tagline matching Stitch & screenshot */}
          <Text style={styles.taglineText}>
            WELLNESS AT YOUR DOORSTEP
          </Text>

          {/* Delicate Micro Hallmark Accent: Line - Dot - Line */}
          <View style={styles.hallmarkRow}>
            <View style={styles.hallmarkLine} />
            <View style={styles.hallmarkDot} />
            <View style={styles.hallmarkLine} />
          </View>
        </Animated.View>

        {/* Spacer for bottom anchoring */}
        <View style={{ flex: 1 }} />

        {/* ==================== LUXURY FOOTER PROGRESS ==================== */}
        <View style={[styles.footerContainer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          {/* Animated 3-dot pulse */}
          <View style={styles.dotsRow}>
            <Animated.View style={[styles.dot, styles.dotCrimson, animatedDot1]} />
            <Animated.View style={[styles.dot, styles.dotOnyx, animatedDot2]} />
            <Animated.View style={[styles.dot, styles.dotSlate, animatedDot3]} />
          </View>

          {/* Concierge status text */}
          <Text style={styles.statusText}>
            PREPARING YOUR CONCIERGE EXPERIENCE
          </Text>

          {/* Discreet Hallmark Badge */}
          <View style={styles.bottomBadgeRow}>
            <Svg width={12} height={12} viewBox="0 0 20 20" fill="#E11D48">
              <Path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              />
            </Svg>
            <Text style={styles.bottomBadgeText}>
              1-ON-1 DOORSTEP FITNESS
            </Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF9',
  },
  mainWrapper: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  topContours: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bottomContours: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  centerCore: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  virlaWordmark: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 44,
    color: '#0F172A',
    letterSpacing: 12,
    marginLeft: 12, // compensates letterSpacing on right
  },
  sparkContainer: {
    position: 'relative',
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
  sparkGlowWrapper: {
    position: 'absolute',
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taglineText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: '#1E293B',
    letterSpacing: 5.2,
    textTransform: 'uppercase',
    marginTop: 22,
    textAlign: 'center',
    marginLeft: 5.2,
  },
  hallmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 18,
    opacity: 0.5,
  },
  hallmarkLine: {
    width: 26,
    height: 0.75,
    backgroundColor: '#94A3B8',
  },
  hallmarkDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E11D48',
  },
  footerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    width: '100%',
    paddingHorizontal: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotCrimson: {
    backgroundColor: '#E11D48',
  },
  dotOnyx: {
    backgroundColor: '#0F172A',
  },
  dotSlate: {
    backgroundColor: '#94A3B8',
  },
  statusText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 9.5,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: '#64748B',
    textAlign: 'center',
  },
  bottomBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(203, 213, 225, 0.6)',
    paddingTop: 10,
    width: '65%',
  },
  bottomBadgeText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 9,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: '#94A3B8',
  },
});
