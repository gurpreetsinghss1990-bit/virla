import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Dimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useUserStore } from '../store/userStore';
import { PageIndicator } from '../presentation/components/PageIndicator';
import { softShadow } from '../utils/shadows';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { setCompletedOnboarding } = useUserStore();

  const [currentSlide, setCurrentSlide] = useState(0);

  // 100% UI-Thread Reanimated Shared Values
  const fadeContent = useSharedValue(1);
  const fadeText = useSharedValue(1);
  const dragX = useSharedValue(0);
  const buttonScale = useSharedValue(1);
  const buttonFade = useSharedValue(1);

  // Cutout exit/enter (slide 0)
  const cutoutTranslateX = useSharedValue(0);
  const cutoutOpacity = useSharedValue(1);

  // Slide 2 phone cutout
  const phoneCutoutY = useSharedValue(0);
  const phoneCutoutOpacity = useSharedValue(1);

  // Animated Styles on UI Thread
  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: fadeContent.value,
    transform: [{ translateX: dragX.value }],
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: fadeText.value,
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonFade.value,
    transform: [{ scale: buttonScale.value }],
  }));

  const cutoutAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cutoutOpacity.value,
    transform: [{ translateX: cutoutTranslateX.value }],
  }));

  const phoneCutoutAnimatedStyle = useAnimatedStyle(() => ({
    opacity: phoneCutoutOpacity.value,
    transform: [
      { translateY: phoneCutoutY.value },
      { scale: 1.05 },
    ],
  }));

  // Button entry animation on 3rd slide
  useEffect(() => {
    if (currentSlide === 2) {
      buttonScale.value = 0.92;
      buttonFade.value = 0;
      buttonScale.value = withSpring(1, { damping: 12, stiffness: 100 });
      buttonFade.value = withTiming(1, { duration: 300 });
    } else {
      buttonScale.value = 1;
      buttonFade.value = 1;
    }
  }, [currentSlide]);

  const updateSlideState = (idx: number) => {
    setCurrentSlide(idx);
  };

  const goToSlide = (nextIndex: number) => {
    'worklet';
    if (nextIndex < 0 || nextIndex > 2) {
      dragX.value = withSpring(0, { damping: 15, stiffness: 150 });
      return;
    }

    const cur = currentSlide;
    const direction = nextIndex > cur ? -100 : 100;

    // Slide 0 athlete cutout animation
    if (cur === 0 && nextIndex > 0) {
      cutoutTranslateX.value = withTiming(-SCREEN_WIDTH * 0.45, {
        duration: 280,
        easing: Easing.out(Easing.cubic),
      });
      cutoutOpacity.value = withTiming(0, { duration: 240 });
    } else if (nextIndex === 0) {
      cutoutTranslateX.value = withSpring(0, { damping: 14, stiffness: 90 });
      cutoutOpacity.value = withTiming(1, { duration: 250 });
    }

    // Outgoing content
    fadeContent.value = withTiming(0, { duration: 150 });
    fadeText.value = withTiming(0, { duration: 150 });
    dragX.value = withTiming(direction, { duration: 150 }, (finished) => {
      if (finished) {
        runOnJS(updateSlideState)(nextIndex);
        dragX.value = direction * -0.5;

        if (nextIndex === 1) {
          phoneCutoutY.value = 25;
          phoneCutoutOpacity.value = 0;
          phoneCutoutY.value = withTiming(0, {
            duration: 280,
            easing: Easing.out(Easing.cubic),
          });
          phoneCutoutOpacity.value = withTiming(1, { duration: 240 });
        }

        fadeContent.value = withTiming(1, { duration: 220 });
        fadeText.value = withTiming(1, { duration: 220 });
        dragX.value = withSpring(0, { damping: 15, stiffness: 120 });
      }
    });
  };

  const handleFinishOnboarding = () => {
    setCompletedOnboarding(true);
    router.replace('/get-started' as any);
  };

  // Pure UI-Thread Pan Gesture using react-native-gesture-handler
  const panGesture = Gesture.Pan()
    .enabled(currentSlide > 0)
    .activeOffsetX([-15, 15])
    .failOffsetY([-20, 20])
    .onUpdate((event) => {
      let dx = event.translationX;
      if (currentSlide === 2 && dx < 0) {
        dx = dx * 0.25;
      }
      dragX.value = dx;
      const dragRatio = Math.min(Math.abs(event.translationX) / 120, 1);
      fadeText.value = 1 - dragRatio * 0.6;
      fadeContent.value = 1 - dragRatio * 0.25;
    })
    .onEnd((event) => {
      if (event.translationX < -50) {
        if (currentSlide < 2) {
          goToSlide(currentSlide + 1);
        } else {
          dragX.value = withSpring(0, { damping: 15, stiffness: 150 });
          fadeContent.value = withTiming(1, { duration: 150 });
          fadeText.value = withTiming(1, { duration: 150 });
        }
      } else if (event.translationX > 50) {
        if (currentSlide > 0) {
          goToSlide(currentSlide - 1);
        } else {
          dragX.value = withSpring(0, { damping: 15, stiffness: 150 });
          fadeContent.value = withTiming(1, { duration: 150 });
          fadeText.value = withTiming(1, { duration: 150 });
        }
      } else {
        dragX.value = withSpring(0, { damping: 15, stiffness: 150 });
        fadeContent.value = withTiming(1, { duration: 150 });
        fadeText.value = withTiming(1, { duration: 150 });
      }
    });

  // Render Cutout Images for slides 1 & 2
  const renderIllustration = (index: number) => {
    switch (index) {
      case 1:
        return (
          <Animated.View
            style={[
              {
                width: '100%',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
              },
              phoneCutoutAnimatedStyle,
            ]}
          >
            <ExpoImage
              source={require('../../assets/images/booked_sessions_3d_transparent.webp')}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
              priority="high"
              cachePolicy="memory-disk"
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
            <ExpoImage
              source={require('../../assets/images/left_edge_emerging_phone_transparent.webp')}
              style={{
                width: Math.min(SCREEN_WIDTH * 1.05, 440),
                height: '100%',
                marginLeft: -SCREEN_WIDTH * 0.05,
              }}
              contentFit="contain"
              priority="high"
              cachePolicy="memory-disk"
            />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#090B0E' }}>
      <StatusBar style="light" />

      {/* PERSISTENT STUDIO BACKGROUND IMAGE */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <ExpoImage
          source={require('../../assets/images/athlete_background_clean.jpg')}
          style={{ width: SCREEN_WIDTH, height: '100%' }}
          contentFit="cover"
          priority="high"
          cachePolicy="memory-disk"
        />
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

      {/* ATHLETE PERSON CUTOUT (ONLY ON 1ST SLIDE, SLIDES OUT TO LEFT) */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: insets.top + 20,
            bottom: 0,
            left: 0,
            right: 0,
            alignItems: 'center',
            justifyContent: 'flex-end',
            zIndex: 10,
          },
          cutoutAnimatedStyle,
        ]}
      >
        <ExpoImage
          source={require('../../assets/images/athlete_person_transparent.webp')}
          style={{
            width: SCREEN_WIDTH * 0.95,
            height: SCREEN_HEIGHT * 0.72,
          }}
          contentFit="contain"
          priority="high"
          cachePolicy="memory-disk"
        />
      </Animated.View>

      {/* SOFT BOTTOM VIGNETTE */}
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

      {/* TOP CENTER BRAND LOGO ON SLIDE 1 */}
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
            <ExpoImage
              source={require('../../assets/images/splash-icon.png')}
              style={{
                width: 32,
                height: 32,
              }}
              contentFit="contain"
              priority="high"
              cachePolicy="memory-disk"
            />
            <Text
              style={{
                fontFamily: 'Outfit_900Black',
                color: '#FFFFFF',
                fontSize: 26,
                letterSpacing: 4,
                marginLeft: 1,
              }}
            >
              IRLA
            </Text>
          </View>
        </View>
      )}

      {/* SLIDE CONTENT */}
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
          <View style={{ marginBottom: 22 }}>
            <Text
              style={{
                fontFamily: 'Outfit_900Black',
                color: '#FFFFFF',
                fontSize: 28,
                lineHeight: 34,
                letterSpacing: -0.5,
              }}
            >
              {slides[0].title}
            </Text>
            <Text
              style={{
                fontFamily: 'Inter_500Medium',
                color: 'rgba(255,255,255,0.85)',
                fontSize: 13.5,
                lineHeight: 20,
                marginTop: 8,
              }}
            >
              {slides[0].description}
            </Text>
          </View>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <PageIndicator activeIndex={0} total={3} />

            <Pressable
              onPress={() => goToSlide(1)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: '#FFFFFF',
                paddingHorizontal: 24,
                paddingVertical: 11,
                borderRadius: 999,
                borderWidth: 3,
                borderColor: '#000000',
                ...softShadow({ color: '#000', opacity: 0.4, radius: 5, offsetY: 3 }),
              }}
            >
              <Text
                style={{
                  fontFamily: 'Outfit_800ExtraBold',
                  color: '#000000',
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  paddingRight: 3,
                }}
              >
                Next
              </Text>
              <Svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <Path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="#000000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
          </View>
        </View>
      ) : (
        <GestureDetector gesture={panGesture}>
          <View
            style={{
              flex: 1,
              justifyContent: 'flex-end',
              paddingBottom: Math.max(insets.bottom, 16) + 18,
              paddingHorizontal: 24,
              zIndex: 30,
            }}
          >
            {/* Main slide illustration & animated content */}
            <Animated.View
              style={[
                {
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                },
                contentAnimatedStyle,
              ]}
            >
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

            {/* Headline & Description */}
            <Animated.View
              style={[
                {
                  marginBottom: 22,
                },
                textAnimatedStyle,
              ]}
            >
              <Text
                style={{
                  fontFamily: 'Outfit_900Black',
                  color: '#FFFFFF',
                  fontSize: 28,
                  lineHeight: 34,
                  letterSpacing: -0.5,
                }}
              >
                {slides[currentSlide].title}
              </Text>
              <Text
                style={{
                  fontFamily: 'Inter_500Medium',
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: 13.5,
                  lineHeight: 20,
                  marginTop: 8,
                }}
              >
                {slides[currentSlide].description}
              </Text>
            </Animated.View>

            {/* Footer controls */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <PageIndicator activeIndex={currentSlide} total={3} />

              {currentSlide === 2 ? (
                <Animated.View style={buttonAnimatedStyle}>
                  <Pressable
                    onPress={handleFinishOnboarding}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: '#FFFFFF',
                      paddingHorizontal: 24,
                      paddingVertical: 11,
                      borderRadius: 999,
                      borderWidth: 3,
                      borderColor: '#000000',
                      ...softShadow({ color: '#000', opacity: 0.4, radius: 5, offsetY: 3 }),
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Outfit_800ExtraBold',
                        color: '#000000',
                        fontSize: 12,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        paddingRight: 3,
                      }}
                    >
                      Get Started
                    </Text>
                    <Svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <Path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="#000000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </Pressable>
                </Animated.View>
              ) : (
                <Pressable
                  onPress={() => goToSlide(2)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: '#FFFFFF',
                    paddingHorizontal: 24,
                    paddingVertical: 11,
                    borderRadius: 999,
                    borderWidth: 3,
                    borderColor: '#000000',
                    ...softShadow({ color: '#000', opacity: 0.4, radius: 5, offsetY: 3 }),
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Outfit_800ExtraBold',
                      color: '#000000',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      paddingRight: 3,
                    }}
                  >
                    Next
                  </Text>
                  <Svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <Path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="#000000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </Pressable>
              )}
            </View>
          </View>
        </GestureDetector>
      )}
    </GestureHandlerRootView>
  );
}
