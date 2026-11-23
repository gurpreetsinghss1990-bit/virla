import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Feather, Ionicons } from '@expo/vector-icons';
import Svg, { Path, Polygon, Polyline, Defs, LinearGradient, Stop, Rect, Circle } from 'react-native-svg';
import { softShadow } from '../../utils/shadows';

export interface ClientVirlaPassCardProps {
  effectiveCredits: number;
  membershipStatus: string;
  validTillText: string;
  onOpenWallet: () => void;
}

export const ClientVirlaPassCard = React.memo(function ClientVirlaPassCard({
  effectiveCredits,
  membershipStatus,
  validTillText,
  onOpenWallet,
}: ClientVirlaPassCardProps) {
  const layer1Y = useSharedValue(0);
  const layer2Y = useSharedValue(0);
  const layer3Y = useSharedValue(0);
  const creditsScale = useSharedValue(1);
  const [isReanimatedLayersActive, setIsReanimatedLayersActive] = useState(false);

  const sparkleProgress = useSharedValue(0);
  const sparkleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 + sparkleProgress.value * 0.35 },
      { rotate: `${sparkleProgress.value * 25}deg` },
    ],
  }));

  const handleSparklePress = useCallback(() => {
    sparkleProgress.value = withSequence(
      withTiming(1, { duration: 250, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) }),
      withTiming(1, { duration: 250, easing: Easing.out(Easing.quad) }),
      withSpring(0, { damping: 10, stiffness: 180 })
    );
  }, [sparkleProgress]);

  const layer1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: layer1Y.value }],
  }));

  const layer2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: layer2Y.value }],
  }));

  const layer3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: layer3Y.value }],
  }));

  const creditsContainerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: creditsScale.value }],
  }));

  const playCreditsLayerBounce = useCallback(() => {
    layer1Y.value = withSequence(
      withTiming(4, { duration: 110, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }),
      withTiming(5.5, { duration: 80 }),
      withSpring(0, { damping: 9, stiffness: 180, mass: 0.7 })
    );

    layer2Y.value = withSequence(
      withTiming(0, { duration: 70 }),
      withTiming(3, { duration: 110, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }),
      withSpring(0, { damping: 10, stiffness: 170, mass: 0.7 })
    );

    layer3Y.value = withSequence(
      withTiming(0, { duration: 120 }),
      withTiming(1.5, { duration: 80 }),
      withSpring(0, { damping: 11, stiffness: 160, mass: 0.7 }, (finished) => {
        if (finished) {
          runOnJS(setIsReanimatedLayersActive)(false);
        }
      })
    );

    creditsScale.value = withSequence(
      withTiming(0.95, { duration: 90 }),
      withSpring(1.04, { damping: 10, stiffness: 220 }),
      withSpring(1, { damping: 12, stiffness: 180 })
    );

    setIsReanimatedLayersActive(true);
  }, [layer1Y, layer2Y, layer3Y, creditsScale]);

  // Entrance bounce on mount so the user experiences the credits layer animation on iOS & Android
  useEffect(() => {
    const timer = setTimeout(() => {
      playCreditsLayerBounce();
    }, 450);
    return () => clearTimeout(timer);
  }, [playCreditsLayerBounce]);

  let passTier = 'STANDARD';
  let passColor = '#F59E0B';
  if (effectiveCredits <= 0) {
    passTier = 'STANDARD';
    passColor = '#94A3B8';
  } else if (effectiveCredits >= 15) {
    passTier = 'ELITE';
    passColor = '#F59E0B';
  } else if (effectiveCredits >= 12) {
    passTier = 'ACTIVE PASS';
    passColor = '#D97706';
  } else if (effectiveCredits >= 8) {
    passTier = 'STARTER PASS';
    passColor = '#D97706';
  } else {
    const status = (membershipStatus || '').trim().toUpperCase();
    passTier = status && status !== 'STANDARD' && status !== 'NONE' ? status : 'PREMIUM';
    passColor = '#F59E0B';
  }

  return (
    <View
      style={{
        borderRadius: 24,
        padding: 20,
        borderWidth: 2,
        borderColor: 'rgba(15, 23, 42, 0.7)',
        position: 'relative',
        overflow: 'hidden',
        marginBottom: 16,
        ...softShadow({ color: '#0F172A', opacity: 0.1, radius: 14, offsetY: 4 }),
      }}
    >
      <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <Defs>
          <LinearGradient id="passCardBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FEF3C7" stopOpacity={0.55} />
            <Stop offset="45%" stopColor="#FFFFFF" stopOpacity={0.4} />
            <Stop offset="100%" stopColor="#F8FAFC" stopOpacity={0.48} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#passCardBg)" />
      </Svg>

      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <Svg width="100%" height="100%" viewBox="0 0 320 160" fill="none">
          {[30, 54, 78, 102, 126, 150, 174, 198, 222, 246, 270, 294, 318, 342].map((r, i) => (
            <Circle
              key={i}
              cx={0}
              cy={160}
              r={r}
              stroke="rgba(56, 189, 248, 0.16)"
              strokeWidth={1}
              fill="none"
            />
          ))}
          <Path d="M 0 160 C 80 140 160 80 320 20" stroke="rgba(13, 148, 136, 0.22)" strokeWidth="1" strokeDasharray="2.5,3" />
          <Path d="M 0 130 C 100 115 190 60 320 40" stroke="rgba(13, 148, 136, 0.18)" strokeWidth="1" strokeDasharray="2.5,3" />
          <Path d="M 0 100 C 120 90 220 40 320 60" stroke="rgba(13, 148, 136, 0.14)" strokeWidth="1" strokeDasharray="2.5,3" />
        </Svg>
      </View>

      <View pointerEvents="none" style={{ position: 'absolute', top: -35, right: -35, width: 175, height: 175 }}>
        <Svg width="100%" height="100%" viewBox="0 0 175 175">
          <Defs>
            <LinearGradient id="passCardRoseGlow" x1="100%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#E11D48" stopOpacity={0.22} />
              <Stop offset="45%" stopColor="#F43F5E" stopOpacity={0.1} />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width="175" height="175" fill="url(#passCardRoseGlow)" />
        </Svg>
      </View>

      <View className="flex-row justify-between items-start z-10">
        <Pressable onPress={handleSparklePress}>
          <View className="flex-row items-center gap-1.5">
            <Reanimated.View style={sparkleAnimatedStyle}>
              <Ionicons name="star" size={13} color="#F59E0B" />
            </Reanimated.View>
            <Text
              style={{ fontFamily: 'Outfit_700Bold' }}
              className="text-[#F59E0B] text-[11px] font-bold uppercase tracking-wider"
            >
              VIRLA PASS
            </Text>
          </View>
          <Text
            style={{ fontFamily: 'Outfit_800ExtraBold', color: passColor }}
            className="text-2xl mt-0.5 tracking-wider font-extrabold"
          >
            {passTier}
          </Text>
        </Pressable>

        <Pressable
          onPress={onOpenWallet}
          style={{
            width: 44,
            height: 44,
            borderRadius: 16,
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: 'rgba(226, 232, 240, 0.9)',
            alignItems: 'center',
            justifyContent: 'center',
            ...softShadow({ color: '#0F172A', opacity: 0.08, radius: 8, offsetY: 2 }),
          }}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Rect x={3} y={3} width={7} height={7} rx={1.8} stroke="#0F172A" strokeWidth={2.4} />
            <Rect x={14} y={3} width={7} height={7} rx={1.8} stroke="#0F172A" strokeWidth={2.4} />
            <Rect x={14} y={14} width={7} height={7} rx={1.8} stroke="#0F172A" strokeWidth={2.4} />
            <Path d="M3 14h3v3H3zM7 17h3v3H7zM3 18h1v3H3zM10 14h1v1h-1zM18 10v1h1v-1z" stroke="#0F172A" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
      </View>

      <View
        style={{
          height: 1,
          width: '100%',
          backgroundColor: 'rgba(15, 23, 42, 0.12)',
          marginVertical: 14,
        }}
      />

      <View className="flex-row justify-between items-end z-10 pt-0.5">
        <Pressable onPress={playCreditsLayerBounce} className="flex-row items-center">
          <Reanimated.View
            style={[
              { flexDirection: 'row', alignItems: 'center' },
              creditsContainerAnimatedStyle,
            ]}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                borderWidth: 1,
                borderColor: 'rgba(15, 23, 42, 0.08)',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
              }}
            >
              <Reanimated.View style={[{ position: 'absolute', top: 5, left: 5 }, layer1Style]}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Polygon
                    points="12 2 2 7 12 12 22 7 12 2"
                    stroke={isReanimatedLayersActive ? '#E11D48' : '#0F172A'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </Reanimated.View>

              <Reanimated.View style={[{ position: 'absolute', top: 5, left: 5 }, layer2Style]}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Polyline
                    points="2 12 12 17 22 12"
                    stroke={isReanimatedLayersActive ? '#E11D48' : '#0F172A'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </Reanimated.View>

              <Reanimated.View style={[{ position: 'absolute', top: 5, left: 5 }, layer3Style]}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Polyline
                    points="2 17 12 22 22 17"
                    stroke={isReanimatedLayersActive ? '#E11D48' : '#0F172A'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </Reanimated.View>
            </View>

            <View className="ml-2.5">
              <Text
                style={{ fontFamily: 'Outfit_700Bold', color: '#0F172A' }}
                className="text-xl font-bold tracking-tight"
              >
                {effectiveCredits} Credits
              </Text>
              <Text
                style={{ fontFamily: 'Outfit_500Medium' }}
                className="text-[#64748B] text-[10px] mt-0.5"
              >
                Concierge Sessions
              </Text>
            </View>
          </Reanimated.View>
        </Pressable>

        <View className="items-end">
          <Text
            style={{ fontFamily: 'Outfit_700Bold' }}
            className="text-slate-500 text-[10px] uppercase tracking-wider"
          >
            VALID TILL
          </Text>
          <Text
            style={{ fontFamily: 'Outfit_600SemiBold' }}
            className="text-slate-700 text-xs font-semibold mt-0.5"
          >
            {validTillText}
          </Text>
          <Pressable onPress={onOpenWallet} className="flex-row items-center gap-1 mt-1">
            <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#E11D48] text-xs font-bold">
              View Wallet
            </Text>
            <Feather name="arrow-right" size={13} color="#E11D48" />
          </Pressable>
        </View>
      </View>
    </View>
  );
});

