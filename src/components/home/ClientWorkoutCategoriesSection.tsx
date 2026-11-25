import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from 'react-native-svg';
import { BackgroundVideoLoop } from '../BackgroundVideoLoop';
import { BUNNY_CDN_ASSETS } from '../../services/bunnyCdnService';
import { softShadow } from '../../utils/shadows';

const WORKOUT_BG_STRENGTH = BUNNY_CDN_ASSETS.WORKOUT_BG_STRENGTH;
const WORKOUT_BG_YOGA = BUNNY_CDN_ASSETS.WORKOUT_BG_YOGA;
const WORKOUT_BG_RHYTHM = BUNNY_CDN_ASSETS.WORKOUT_BG_RHYTHM;
const WORKOUT_BG_BOXING = BUNNY_CDN_ASSETS.WORKOUT_BG_BOXING;

interface ClientWorkoutCategoriesSectionProps {
  onWorkoutScroll: (event: any) => void;
  navigateSafely: (target: any) => void;
}

export const ClientWorkoutCategoriesSection: React.FC<ClientWorkoutCategoriesSectionProps> = ({
  onWorkoutScroll,
  navigateSafely,
}) => {
  return (
    <View className="gap-3">
      <View className="flex-row justify-between items-baseline">
        <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 18, color: '#0F172A', letterSpacing: -0.3 }}>
          Choose Your Workout
        </Text>
        <Pressable onPress={() => navigateSafely('/booking')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#E11D48' }}>
            View All ›
          </Text>
        </Pressable>
      </View>

      <ReanimatedAnimated.ScrollView
        horizontal
        nestedScrollEnabled={true}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={152}
        snapToAlignment="start"
        overScrollMode="always"
        bounces={true}
        alwaysBounceHorizontal={true}
        onScroll={onWorkoutScroll}
        scrollEventThrottle={16}
        style={{ marginHorizontal: -20 }}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
      >
        {[
          { id: 'strength', title: 'Strength', sub: 'Build & Tone', icon: 'dumbbell', colors: ['#FF6B6B', '#E11D48'], video: WORKOUT_BG_STRENGTH },
          { id: 'yoga', title: 'Yoga', sub: 'Mind & Body', icon: 'heart', colors: ['#C084FC', '#7C3AED'], video: WORKOUT_BG_YOGA },
          { id: 'rhythm', title: 'Rhythm', sub: 'Cardio & Beats', icon: 'zap', colors: ['#F472B6', '#BE185D'], video: WORKOUT_BG_RHYTHM },
          { id: 'boxing', title: 'Boxing', sub: 'Power & Endurance', icon: 'shield', colors: ['#FBBF24', '#EA580C'], video: WORKOUT_BG_BOXING }
        ].map((item) => (
          <Pressable
            key={item.id}
            onPress={() => navigateSafely({
              pathname: '/booking',
              params: {
                workoutId: item.id,
                workoutType: item.title,
                workoutName: item.title,
              },
            })}
            style={{
              borderRadius: 18,
              ...softShadow({ color: '#0F172A', opacity: 0.08, radius: 8, offsetY: 2 }),
            }}
          >
            <View className="w-[140px] h-[184px] p-3.5 rounded-[18px] relative overflow-hidden justify-between border border-white/60">
              {/* Background Video */}
              {item.video && (
                <BackgroundVideoLoop source={item.video} />
              )}

              {/* Foreground Gradient */}
              <View style={StyleSheet.absoluteFill}>
                <Svg width="100%" height="100%">
                  <Defs>
                    <LinearGradient id={`grad-${item.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                      <Stop offset="0%" stopColor={item.colors[0]} stopOpacity={item.video ? 0.25 : 1} />
                      <Stop offset="50%" stopColor={item.colors[0]} stopOpacity={item.video ? 0.20 : 1} />
                      <Stop offset="100%" stopColor="#09090B" stopOpacity={item.video ? 0.88 : 1} />
                    </LinearGradient>
                  </Defs>
                  <Rect width="100%" height="100%" fill={`url(#grad-${item.id})`} />
                </Svg>
              </View>

              {/* Top icon badge */}
              <View className="w-8 h-8 rounded-xl bg-white/20 items-center justify-center self-start border border-white/20">
                {item.icon === 'dumbbell' ? (
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#FDE047" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M6 5v14M18 5v14M2 9v6M22 9v6M6 12h12" />
                  </Svg>
                ) : (
                  <Feather name={item.icon as any} size={15} color="#FDE047" />
                )}
              </View>

              {/* Bottom title & sub & chevron */}
              <View className="gap-0.5 mt-auto">
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 14, color: '#FFFFFF', letterSpacing: -0.2 }} numberOfLines={1}>
                  {item.title}
                </Text>
                <View className="flex-row justify-between items-center pt-0.5">
                  <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10, color: '#CBD5E1' }} numberOfLines={1}>
                    {item.sub}
                  </Text>
                  <View className="w-5 h-5 rounded-full bg-white/25 items-center justify-center">
                    <Feather name="chevron-right" size={10} color="white" />
                  </View>
                </View>
              </View>
            </View>
          </Pressable>
        ))}
      </ReanimatedAnimated.ScrollView>
    </View>
  );
};
