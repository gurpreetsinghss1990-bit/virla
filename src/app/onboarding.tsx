import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Animated, PanResponder, Easing, Platform, StatusBar as RNStatusBar, Dimensions, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Circle, Path, Rect, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';
import { useUserStore } from '../store/userStore';
import { PageIndicator } from '../presentation/components/PageIndicator';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { setCompletedOnboarding } = useUserStore();

  const [currentSlide, setCurrentSlide] = useState(0);
  const slideRef = useRef(0);
  slideRef.current = currentSlide;

  // Animation values (lightweight native-driven)
  const fadeContentAnim = useMemo(() => new Animated.Value(1), []);
  const fadeTextAnim = useMemo(() => new Animated.Value(1), []);
  const dragAnim = useMemo(() => new Animated.Value(0), []);
  const buttonScaleAnim = useMemo(() => new Animated.Value(1), []);
  const buttonFadeAnim = useMemo(() => new Animated.Value(1), []);
  const swipeHintPulse = useMemo(() => new Animated.Value(0), []);

  // Cutout exit animation: Slides out cleanly to left & fades when going to slide 1 or 2
  const cutoutTranslateX = useMemo(() => new Animated.Value(0), []);
  const cutoutOpacity = useMemo(() => new Animated.Value(1), []);

  // Slide 2 (index 1) phone cutout slow reveal animation
  const phoneCutoutAnim = useMemo(() => new Animated.Value(60), []);
  const phoneCutoutOpacity = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    // 0. Modern Android Edge-to-Edge System Bar
    if (Platform.OS === 'android') {
      RNStatusBar.setTranslucent(true);
      RNStatusBar.setBackgroundColor('transparent');
    }

    // Subtle swipe hint pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(swipeHintPulse, {
          toValue: 6,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(swipeHintPulse, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [swipeHintPulse]);

  // Animate button entry when landing on 3rd slide
  useEffect(() => {
    if (currentSlide === 2) {
      buttonScaleAnim.setValue(0.92);
      buttonFadeAnim.setValue(0);
      Animated.parallel([
        Animated.spring(buttonScaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.timing(buttonFadeAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      buttonScaleAnim.setValue(1);
      buttonFadeAnim.setValue(1);
    }
  }, [currentSlide, buttonScaleAnim, buttonFadeAnim]);

  const goToSlide = (nextIndex: number) => {
    if (nextIndex === slideRef.current || nextIndex < 0 || nextIndex > 2) {
      Animated.spring(dragAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
      return;
    }

    const direction = nextIndex > slideRef.current ? -120 : 120;

    // If moving away from slide 0, animate cutout sliding out to the left & fading
    if (slideRef.current === 0 && nextIndex > 0) {
      Animated.parallel([
        Animated.timing(cutoutTranslateX, {
          toValue: -SCREEN_WIDTH * 0.45,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cutoutOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (nextIndex === 0) {
      // Returning to slide 0, smoothly bring cutout back
      Animated.parallel([
        Animated.spring(cutoutTranslateX, {
          toValue: 0,
          friction: 7,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.timing(cutoutOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }

    const isSlide1Entry = slideRef.current === 0 && nextIndex === 1;

    Animated.parallel([
      Animated.timing(fadeContentAnim, {
        toValue: 0,
        duration: isSlide1Entry ? 220 : 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeTextAnim, {
        toValue: 0,
        duration: isSlide1Entry ? 220 : 150,
        useNativeDriver: true,
      }),
      Animated.timing(dragAnim, {
        toValue: direction,
        duration: isSlide1Entry ? 220 : 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentSlide(nextIndex);
      dragAnim.setValue(direction * -0.5);

      if (nextIndex === 1) {
        // Reset phone cutout position & opacity
        phoneCutoutAnim.setValue(50);
        phoneCutoutOpacity.setValue(0);
      }

      Animated.parallel([
        Animated.timing(fadeContentAnim, {
          toValue: 1,
          duration: isSlide1Entry ? 380 : 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeTextAnim, {
          toValue: 1,
          duration: isSlide1Entry ? 380 : 250,
          useNativeDriver: true,
        }),
        Animated.spring(dragAnim, {
          toValue: 0,
          friction: isSlide1Entry ? 8 : 7,
          tension: isSlide1Entry ? 45 : 60,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Once page 2 lands smoothly, animate the phone cutout smoothly with a delicate slide & fade
        if (nextIndex === 1) {
          Animated.parallel([
            Animated.timing(phoneCutoutAnim, {
              toValue: 0,
              duration: 500,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(phoneCutoutOpacity, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
          ]).start();
        }
      });
    });
  };

  const handleFinishOnboarding = () => {
    setCompletedOnboarding(true);
    router.replace('/get-started' as any);
  };

  // PanResponder only active on slides 1 & 2. On slide 0, swipe is disabled (user uses Next / Get Started)
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Disable swipe on slide 0
          if (slideRef.current === 0) return false;
          return Math.abs(gestureState.dx) > 14 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2;
        },
        onPanResponderMove: (_, gestureState) => {
          let dx = gestureState.dx;
          if (slideRef.current === 2 && dx < 0) {
            dx = dx * 0.25;
          }
          dragAnim.setValue(dx);
          const dragRatio = Math.min(Math.abs(gestureState.dx) / 120, 1);
          fadeTextAnim.setValue(1 - dragRatio * 0.6);
          fadeContentAnim.setValue(1 - dragRatio * 0.25);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx < -50) {
            if (slideRef.current < 2) {
              goToSlide(slideRef.current + 1);
            } else {
              Animated.parallel([
                Animated.spring(dragAnim, { toValue: 0, useNativeDriver: true }),
                Animated.timing(fadeContentAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
                Animated.timing(fadeTextAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
              ]).start();
            }
          } else if (gestureState.dx > 50) {
            if (slideRef.current > 0) {
              goToSlide(slideRef.current - 1);
            } else {
              Animated.parallel([
                Animated.spring(dragAnim, { toValue: 0, useNativeDriver: true }),
                Animated.timing(fadeContentAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
                Animated.timing(fadeTextAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
              ]).start();
            }
          } else {
            Animated.parallel([
              Animated.spring(dragAnim, { toValue: 0, friction: 6, tension: 50, useNativeDriver: true }),
              Animated.timing(fadeContentAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
              Animated.timing(fadeTextAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
            ]).start();
          }
        },
      }),
    [dragAnim, fadeContentAnim, fadeTextAnim, buttonScaleAnim, buttonFadeAnim]
  );

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
    },
  ];

  // Render Cutout Images for slides 1 & 2
  const renderIllustration = (index: number) => {
    switch (index) {
      case 1:
        return (
          <Animated.View
            style={{
              width: '100%',
              height: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: phoneCutoutOpacity,
              transform: [
                { translateY: phoneCutoutAnim },
                { scale: 1.05 },
              ],
            }}
          >
            <Image
              source={require('../../assets/images/booked_sessions_3d_transparent.webp')}
              style={{ width: '100%', height: '100%' }}
              resizeMode="contain"
            />
          </Animated.View>
        );
      case 2:
        return (
          <View
            style={{
              width: SCREEN_WIDTH,
              height: '100%',
              justifyContent: 'center',
              alignItems: 'flex-start',
              overflow: 'visible',
            }}
          >
            {/* Phone anchored to left edge in opposite direction, with 3D UI cards emerging outward from screen */}
            <Image
              source={require('../../assets/images/left_edge_emerging_phone_transparent.webp')}
              style={{
                width: Math.min(SCREEN_WIDTH * 1.05, 440),
                height: '100%',
                marginLeft: -SCREEN_WIDTH * 0.05,
              }}
              resizeMode="contain"
            />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#090B0E' }}>
      {/* Modern Edge-to-Edge System Bar */}
      <StatusBar style="light" />

      {/* ===================================================================== */}
      {/* 1. PERSISTENT STUDIO BACKGROUND IMAGE ACROSS ALL 3 ONBOARDING PAGES   */}
      {/* ===================================================================== */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <Image
          source={require('../../assets/images/athlete_background_clean.jpg')}
          style={{ width: SCREEN_WIDTH, height: '100%' }}
          resizeMode="cover"
        />
        {/* Subtle backdrop overlay for slides 1 & 2 only */}
        {currentSlide > 0 && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(9, 11, 14, 0.45)',
            }}
          />
        )}
      </View>

      {/* ===================================================================== */}
      {/* 2. ATHLETE PERSON CUTOUT (ONLY ON 1ST SLIDE, SLIDES OUT TO LEFT)      */}
      {/* ===================================================================== */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: insets.top + 20,
          bottom: 0,
          left: 0,
          right: 0,
          alignItems: 'center',
          justifyContent: 'flex-end',
          opacity: cutoutOpacity,
          transform: [{ translateX: cutoutTranslateX }],
          zIndex: 10,
        }}
      >
        <Image
          source={require('../../assets/images/athlete_person_transparent.webp')}
          style={{
            width: SCREEN_WIDTH * 0.95,
            height: SCREEN_HEIGHT * 0.72,
          }}
          resizeMode="contain"
        />
      </Animated.View>

      {/* ===================================================================== */}
      {/* 3. SOFT BOTTOM VIGNETTE (PRESERVES RIGHT-SIDE ORANGE SHADE)           */}
      {/* ===================================================================== */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 240,
          zIndex: 15,
        }}
      >
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="bottomVignette" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#090B0E" stopOpacity="0" />
              <Stop offset="50%" stopColor="#090B0E" stopOpacity="0.45" />
              <Stop offset="100%" stopColor="#090B0E" stopOpacity="0.88" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#bottomVignette)" />
        </Svg>
      </View>



      {/* ===================================================================== */}
      {/* 4. TOP CENTER BRAND LOGO ON SLIDE 1: SPLASH ICON V + 'IRLA'           */}
      {/* ===================================================================== */}
      {currentSlide === 0 && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: insets.top + 18,
            left: 0,
            right: 0,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 40,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            {/* Real App V Logo from splash-icon.png */}
            <Image
              source={require('../../assets/images/splash-icon.png')}
              style={{
                width: 32,
                height: 32,
                resizeMode: 'contain',
              }}
            />

            {/* Large Bold IRLA Brand Text */}
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 26,
                fontWeight: '900',
                letterSpacing: 4,
                marginLeft: 1,
              }}
            >
              IRLA
            </Text>
          </View>
        </View>
      )}

      {/* ===================================================================== */}
      {/* 5. SLIDE 0 CONTENT OVERLAY (SWIPE DISABLED, CLEAN BUTTON & NEXT)     */}
      {/* ===================================================================== */}
      {currentSlide === 0 ? (
        <View
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            paddingBottom: Math.max(insets.bottom, 16) + 18,
            paddingHorizontal: 24,
            zIndex: 30,
          }}
        >
          {/* Headline & Description */}
          <View style={{ marginBottom: 22 }}>
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 28,
                fontWeight: '900',
                lineHeight: 34,
                letterSpacing: -0.5,
              }}
            >
              {slides[0].title}
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.85)',
                fontSize: 13.5,
                fontWeight: '500',
                lineHeight: 19,
                marginTop: 8,
              }}
            >
              {slides[0].description}
            </Text>
          </View>

          {/* Controls Row: Page Indicator & Next Button */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            {/* Page Indicator on Left */}
            <PageIndicator activeIndex={0} total={3} />

            {/* NEXT BUTTON: Styled with White background, Black text, Thick border & bold uppercase */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => goToSlide(1)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: '#FFFFFF',
                paddingHorizontal: 22,
                paddingVertical: 11,
                borderRadius: 999,
                borderWidth: 3,
                borderColor: '#000000',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.4,
                shadowRadius: 5,
                elevation: 5,
              }}
            >
              <Text
                style={{
                  color: '#000000',
                  fontSize: 12,
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
                }}
              >
                Next
              </Text>
              <Svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <Path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="#000000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* =================================================================== */
        /* 6. SLIDES 1 & 2 CONTENT (MATCHING SLIDE 1 LAYOUT: CLEAN & IMMERSIVE) */
        /* =================================================================== */
        <View
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            paddingBottom: Math.max(insets.bottom, 16) + 18,
            paddingHorizontal: 24,
            zIndex: 30,
          }}
          {...panResponder.panHandlers}
        >
          {/* Main slide illustration & animated content */}
          <Animated.View
            style={{
              opacity: fadeContentAnim,
              transform: [{ translateX: dragAnim }],
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {/* Clean Illustration wrapper (No vertical float loop) */}
            <View
              style={{
                width: SCREEN_WIDTH,
                height: SCREEN_HEIGHT * 0.45,
                marginHorizontal: -24,
                alignItems: currentSlide === 2 ? 'flex-start' : 'center',
                justifyContent: 'center',
                overflow: 'visible',
              }}
            >
              {renderIllustration(currentSlide)}
            </View>
          </Animated.View>

          {/* Headline & Description matching 1st slide position and typography */}
          <Animated.View
            style={{
              opacity: fadeTextAnim,
              marginBottom: 22,
            }}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 28,
                fontWeight: '900',
                lineHeight: 34,
                letterSpacing: -0.5,
              }}
            >
              {slides[currentSlide].title}
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.85)',
                fontSize: 13.5,
                fontWeight: '500',
                lineHeight: 19,
                marginTop: 8,
              }}
            >
              {slides[currentSlide].description}
            </Text>
          </Animated.View>

          {/* Footer controls: Page indicator on Left & Action button on Right */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            {/* Custom Page indicator on Left */}
            <PageIndicator activeIndex={currentSlide} total={3} />

            {/* Action button on Right with same styling as slide 0 */}
            {currentSlide === 2 ? (
              <Animated.View
                style={{
                  opacity: buttonFadeAnim,
                  transform: [{ scale: buttonScaleAnim }],
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleFinishOnboarding}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: '#FFFFFF',
                    paddingHorizontal: 22,
                    paddingVertical: 11,
                    borderRadius: 999,
                    borderWidth: 3,
                    borderColor: '#000000',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.4,
                    shadowRadius: 5,
                    elevation: 5,
                  }}
                >
                  <Text
                    style={{
                      color: '#000000',
                      fontSize: 12,
                      fontWeight: '900',
                      textTransform: 'uppercase',
                      letterSpacing: 1.2,
                    }}
                  >
                    Get Started
                  </Text>
                  <Svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <Path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="#000000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </TouchableOpacity>
              </Animated.View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => goToSlide(2)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: '#FFFFFF',
                  paddingHorizontal: 22,
                  paddingVertical: 11,
                  borderRadius: 999,
                  borderWidth: 3,
                  borderColor: '#000000',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.4,
                  shadowRadius: 5,
                  elevation: 5,
                }}
              >
                <Text
                  style={{
                    color: '#000000',
                    fontSize: 12,
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    letterSpacing: 1.2,
                  }}
                >
                  Next
                </Text>
                <Svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <Path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="#000000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}
