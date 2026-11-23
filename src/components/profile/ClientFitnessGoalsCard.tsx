import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Svg, { Polygon } from 'react-native-svg';
import { NativeGoalChip } from '../NativeGoalChip';
import { softShadow } from '../../utils/shadows';

export interface ClientFitnessGoalsCardProps {
  gender: string;
  selectedGoalsKey: string;
  allFitnessGoals: string[];
  onOpenGoals: () => void;
}

export const ClientFitnessGoalsCard = React.memo(function ClientFitnessGoalsCard({
  gender,
  selectedGoalsKey,
  allFitnessGoals,
  onOpenGoals,
}: ClientFitnessGoalsCardProps) {
  const displayGoalsData = useMemo(() => {
    const isFemale = (gender || '').trim().toLowerCase() === 'female';
    const availableGoals = allFitnessGoals.filter((g) => g !== 'Post Pregnancy' || isFemale);
    const rawUserGoals = selectedGoalsKey ? selectedGoalsKey.split('|') : [];
    const userSelectedGoals = rawUserGoals.filter((g) => availableGoals.includes(g));
    const unselectedGoals = availableGoals.filter((g) => !userSelectedGoals.includes(g));
    return {
      displayGoals: [...userSelectedGoals, ...unselectedGoals].slice(0, 6),
      userSelectedGoals,
    };
  }, [gender, selectedGoalsKey, allFitnessGoals]);

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.8)',
        marginBottom: 16,
        ...softShadow({ color: '#0F172A', opacity: 0.04, radius: 10, offsetY: 2 }),
      }}
    >
      <View className="flex-row justify-between items-center mb-3.5">
        <View>
          <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-900 text-base font-bold tracking-tight">
            Fitness Goals
          </Text>
          <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-slate-400 text-[11px] mt-0.5">
            Personalized workout programming
          </Text>
        </View>
        <Pressable
          onPress={onOpenGoals}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: '#F1F5F9',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 9999,
          }}
        >
          <Feather name="edit-2" size={11} color="#64748B" />
          <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-slate-700 text-xs font-semibold">
            Edit
          </Text>
        </Pressable>
      </View>

      <View className="flex-row flex-wrap gap-2 mb-4">
        {displayGoalsData.displayGoals.map((goal, idx) => (
          <NativeGoalChip
            key={`${goal}-${idx}`}
            label={goal}
            selected={displayGoalsData.userSelectedGoals.includes(goal)}
            onPress={onOpenGoals}
          />
        ))}
      </View>

      <Pressable
        onPress={onOpenGoals}
        style={{
          backgroundColor: '#ECFDF5',
          borderWidth: 1,
          borderColor: '#A7F3D0',
          borderRadius: 16,
          padding: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View className="flex-row items-center gap-3 flex-1 pr-2">
          <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(167, 243, 208, 0.7)', alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="#047857">
              <Polygon points="12 2 14.4 9.2 22 9.2 15.9 13.7 18.2 21 12 16.4 5.8 21 8.1 13.7 2 9.2 9.6 9.2" />
            </Svg>
          </View>
          <View className="flex-1">
            <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-emerald-950 text-xs font-bold">
              Your fitness journey matters.
            </Text>
            <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-emerald-700 text-[11px] mt-0.5">
              Let&apos;s set your goals for better results.
            </Text>
          </View>
        </View>
        <Feather name="chevron-right" size={16} color="#059669" />
      </Pressable>
    </View>
  );
});
