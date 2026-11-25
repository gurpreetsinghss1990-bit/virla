import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image as ExpoImage } from 'expo-image';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { ProgressRing } from '../ProgressRing';
import { softShadow } from '../../utils/shadows';

const ATHLETE_HERO_IMAGE = require('../../../assets/images/athlete_hero.webp');

interface ClientRecoveryHeroCardProps {
  greeting: { title: string; subtitle?: string };
  user: { id?: string | null };
  recoveryVal: number;
  userRecovery: number | null;
  recoveryStatus: { title: string; desc: string };
  membership: { tier?: string };
  navigateSafely: (target: any) => void;
}

export const ClientRecoveryHeroCard: React.FC<ClientRecoveryHeroCardProps> = ({
  greeting,
  user,
  recoveryVal,
  userRecovery,
  recoveryStatus,
  membership,
  navigateSafely,
}) => {
  return (
    <>
      {/* Greeting */}
      <View className="gap-1 px-1">
        <Text 
          style={{ 
            fontFamily: 'Outfit_700Bold',
            fontSize: 27, 
            letterSpacing: -0.5,
            lineHeight: 32,
            color: '#0F172A',
          }}
        >
          {greeting.title}
        </Text>
        <Text 
          style={{ 
            fontFamily: 'Inter_500Medium',
            fontSize: 12,
            color: '#64748B',
            lineHeight: 16,
          }}
        >
          Your bespoke personal concierge is ready for today's session.
        </Text>
      </View>

      {/* Recovery Hero Card */}
      <View 
        style={{
          backgroundColor: '#12131F',
          borderRadius: 26,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.08)',
          ...softShadow({ color: '#0F172A', opacity: 0.18, radius: 20, offsetY: 8 }),
        }}
      >
        <View className="w-full bg-[#12131F] rounded-[26px] p-5 relative overflow-hidden">
          {/* Athlete Image on the right */}
          <View className="absolute right-0 top-0 bottom-0 w-[55%] z-0 pointer-events-none">
            <ExpoImage
              source={ATHLETE_HERO_IMAGE}
              style={{ width: '100%', height: '100%', opacity: 0.85 }}
              contentFit="cover"
              transition={0}
            />
            {/* Blending Mask for Dark Obsidian Card */}
            <View style={StyleSheet.absoluteFill}>
              <Svg width="100%" height="100%">
                <Defs>
                  <LinearGradient id="blendGradDark" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#12131F" stopOpacity={1} />
                    <Stop offset="45%" stopColor="#12131F" stopOpacity={0.85} />
                    <Stop offset="100%" stopColor="#12131F" stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#blendGradDark)" />
              </Svg>
            </View>
          </View>

          {/* Hero Content */}
          <View className="z-10 gap-4 flex-1 justify-between">
            {/* Recovery score and ring row */}
            <View className="flex-row items-center gap-4">
              {/* Ring Container */}
              <View 
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: '#161726',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  ...softShadow({ color: '#E11D48', opacity: 0.35, radius: 14, offsetY: 0 }),
                }}
              >
                <ProgressRing progress={recoveryVal > 0 ? recoveryVal / 100 : 0.5} size={88} strokeWidth={7} activeColor="#E11D48" inactiveColor="#2D2030">
                  <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: 'Outfit_800ExtraBold', fontSize: 24, color: '#FFFFFF', letterSpacing: -0.5, lineHeight: 28 }}>
                      {userRecovery !== null ? userRecovery : '50'}
                    </Text>
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#94A3B8', marginTop: -1 }}>/100</Text>
                  </View>
                </ProgressRing>
              </View>

              {/* Status Info */}
              <View className="flex-1 min-w-0 pr-1">
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.5, color: '#FB7185', textTransform: 'uppercase' }}>
                  RECOVERY SCORE
                </Text>
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 18, color: '#FFFFFF', letterSpacing: -0.3, marginTop: 2 }}>
                  {user.id ? recoveryStatus.title : 'Moderate Recovery'}
                </Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#CBD5E1', lineHeight: 16, marginTop: 3 }}>
                  {user.id ? recoveryStatus.desc : 'Consider active recovery or light mobility.'}
                </Text>
                <View className="flex-row mt-2.5">
                  <View 
                    style={{
                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                      borderColor: 'rgba(251, 191, 36, 0.3)',
                      borderWidth: 1,
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                      borderRadius: 999,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Ionicons name="star" size={9} color="#FBBF24" />
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9, color: '#FCD34D', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      {(membership.tier || 'PREMIUM').toUpperCase()} STATUS
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Schedule Session Button */}
            <Pressable
              onPress={() => navigateSafely('/booking')}
              className="w-full h-12 bg-[#E11D48] rounded-2xl justify-between items-center px-4 flex-row mt-1"
              style={{
                backgroundColor: '#E11D48',
                minHeight: 48,
                borderRadius: 16,
                ...softShadow({ color: '#E11D48', opacity: 0.3, radius: 14, offsetY: 6 }),
              }}
            >
              <View className="flex-row items-center gap-2">
                <Feather name="calendar" size={15} color="white" />
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 12, letterSpacing: 0.8, color: '#FFFFFF', textTransform: 'uppercase' }}>
                  Schedule Home Session
                </Text>
              </View>
              <View className="w-6 h-6 rounded-full bg-white/20 items-center justify-center">
                <Feather name="chevron-right" size={13} color="white" />
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </>
  );
};
