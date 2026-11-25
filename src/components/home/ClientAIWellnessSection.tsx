import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { softShadow } from '../../utils/shadows';

const AI_COACH_EMBLEM = require('../../../assets/images/ai-coach-emblem.png');

interface SavedPlan {
  dailyCalories?: number;
  proteinTarget?: number;
  hydrationGoal?: string | number;
}

interface ClientAIWellnessSectionProps {
  savedPlan: SavedPlan | null;
  upcomingBookings: any[];
  formatToDDMMYYYY: (dateStr: string) => string;
  navigateSafely: (target: any) => void;
}

export const ClientAIWellnessSection: React.FC<ClientAIWellnessSectionProps> = ({
  savedPlan,
  upcomingBookings,
  formatToDDMMYYYY,
  navigateSafely,
}) => {
  return (
    <View className="gap-3">
      <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 18, color: '#0F172A', letterSpacing: -0.3 }}>
        AI Wellness Coach
      </Text>
      <View 
        style={{
          backgroundColor: '#121324',
          borderRadius: 24,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.08)',
          ...softShadow({ color: '#0F172A', opacity: 0.15, radius: 20, offsetY: 8 }),
        }}
      >
        <View className="w-full bg-[#121324] rounded-[24px] p-5 relative overflow-hidden">
          {/* Glowing Radar Rings on right */}
          <View className="absolute -right-8 -bottom-8 w-44 h-44 rounded-full border border-purple-500/20 items-center justify-center pointer-events-none">
            <View className="w-32 h-32 rounded-full border border-rose-500/25 items-center justify-center">
              <View className="w-22 h-22 rounded-full border border-rose-500/40 bg-purple-950/20 items-center justify-center">
                <View className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-400/50 items-center justify-center">
                  <Feather name="compass" size={16} color="#FDA4AF" />
                </View>
              </View>
            </View>
          </View>

          {/* Left content */}
          <View className="z-10 max-w-[72%] gap-2">
            <View className="flex-row items-center gap-1.5">
              <Image
                source={AI_COACH_EMBLEM}
                style={{ width: 13, height: 13 }}
                resizeMode="contain"
              />
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2, color: '#FDA4AF', textTransform: 'uppercase' }}>
                {savedPlan ? 'MY AI WELLNESS PLAN' : 'AI WELLNESS COACH'}
              </Text>
            </View>

            {savedPlan ? (
              <View className="gap-2.5 my-1">
                <View className="flex-row justify-between flex-wrap gap-y-2">
                  <View className="w-[48%] gap-0.5">
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9, color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase' }}>Calories Goal</Text>
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 13, color: '#FFFFFF' }}>{savedPlan.dailyCalories} kcal</Text>
                  </View>
                  <View className="w-[48%] gap-0.5">
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9, color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase' }}>Protein Goal</Text>
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 13, color: '#FFFFFF' }}>{savedPlan.proteinTarget}g</Text>
                  </View>
                  <View className="w-[48%] gap-0.5">
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9, color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase' }}>Water Goal</Text>
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 13, color: '#FFFFFF' }} numberOfLines={1}>
                      {savedPlan?.hydrationGoal ? String(savedPlan.hydrationGoal).split(' ')[0] : '2'} L
                    </Text>
                  </View>
                  <View className="w-[48%] gap-0.5">
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9, color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase' }}>Next Session</Text>
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 13, color: '#FFFFFF' }} numberOfLines={1}>
                      {upcomingBookings.length > 0 && upcomingBookings[0]?.date
                        ? `${formatToDDMMYYYY(upcomingBookings[0].date)}`
                        : 'None scheduled'}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View className="gap-1 my-0.5">
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 17, color: '#FFFFFF', letterSpacing: -0.2, lineHeight: 22 }}>
                  Create Your AI Wellness Plan
                </Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#CBD5E1', lineHeight: 16 }}>
                  Answer a few quick questions so VIRLA AI can create a personalized wellness plan.
                </Text>
              </View>
            )}

            <Pressable
              onPress={() => navigateSafely('/virla-ai')}
              className="bg-[#E11D48] rounded-full py-2.5 px-4 flex-row items-center self-start gap-2 mt-1.5"
              style={softShadow({ color: '#E11D48', opacity: 0.3, radius: 8, offsetY: 3 })}
            >
              <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 11, letterSpacing: 0.8, color: '#FFFFFF', textTransform: 'uppercase' }}>
                {savedPlan ? 'View Plan' : 'Get Started'}
              </Text>
              <Feather name="chevron-right" size={11} color="white" />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
};
