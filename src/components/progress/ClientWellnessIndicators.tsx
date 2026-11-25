import React from 'react';
import { View, Text } from 'react-native';
import { ProgressRing } from '../ProgressRing';
import { softShadow } from '../../utils/shadows';

export interface ClientWellnessIndicatorsProps {
  currentStats: {
    calories: number | string;
    caloriesProgress: number;
    attendance: number | string;
    sessions: number | string;
    sessionsProgress: number;
    recovery: number | string;
  };
}

export const ClientWellnessIndicators = React.memo(function ClientWellnessIndicators({
  currentStats,
}: ClientWellnessIndicatorsProps) {
  return (
    <View className="gap-3.5">
      <View className="flex-row justify-between items-center px-1">
        <Text
          style={{ fontFamily: 'Outfit_700Bold' }}
          className="text-[#0F172A] text-xs font-bold uppercase tracking-wider"
        >
          Wellness Indicators
        </Text>
      </View>

      {/* 2x2 Stat Pods Grid (White Cards with ultra-soft hairline slate border) */}
      <View className="flex-row flex-wrap justify-between gap-y-3.5 pt-1">
        {/* Pod 1: Calories */}
        <View
          style={{
            width: '48%',
            paddingVertical: 16,
            paddingHorizontal: 12,
            backgroundColor: '#FFFFFF',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: 'rgba(15, 23, 42, 0.06)',
            alignItems: 'center',
            justifyContent: 'center',
            ...softShadow({ color: '#0F172A', opacity: 0.04, radius: 10, offsetY: 4 }),
          }}
        >
          <ProgressRing progress={currentStats.caloriesProgress} size={84} strokeWidth={9} activeColor="#E11D48" enable3D={true}>
            <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#0F172A] text-base font-extrabold">
              {Math.round(currentStats.caloriesProgress * 100)}%
            </Text>
          </ProgressRing>
          <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0F172A] text-xs font-bold mt-2.5">Calories</Text>
          <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-slate-400 text-[10px] font-semibold uppercase mt-0.5 tracking-tight">{currentStats.calories} KCAL</Text>
        </View>

        {/* Pod 2: Attendance */}
        <View
          style={{
            width: '48%',
            paddingVertical: 16,
            paddingHorizontal: 12,
            backgroundColor: '#FFFFFF',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: 'rgba(15, 23, 42, 0.06)',
            alignItems: 'center',
            justifyContent: 'center',
            ...softShadow({ color: '#0F172A', opacity: 0.04, radius: 10, offsetY: 4 }),
          }}
        >
          <ProgressRing progress={Number(currentStats.attendance) / 100} size={84} strokeWidth={9} activeColor="#10B981" enable3D={true}>
            <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#0F172A] text-base font-extrabold">{currentStats.attendance}%</Text>
          </ProgressRing>
          <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0F172A] text-xs font-bold mt-2.5">Attendance</Text>
          <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-slate-400 text-[10px] font-semibold uppercase mt-0.5 tracking-tight">OPTIMAL RATE</Text>
        </View>

        {/* Pod 3: Sessions */}
        <View
          style={{
            width: '48%',
            paddingVertical: 16,
            paddingHorizontal: 12,
            backgroundColor: '#FFFFFF',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: 'rgba(15, 23, 42, 0.06)',
            alignItems: 'center',
            justifyContent: 'center',
            ...softShadow({ color: '#0F172A', opacity: 0.04, radius: 10, offsetY: 4 }),
          }}
        >
          <ProgressRing progress={currentStats.sessionsProgress} size={84} strokeWidth={9} activeColor="#3B82F6" enable3D={true}>
            <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#0F172A] text-lg font-extrabold">{currentStats.sessions}</Text>
          </ProgressRing>
          <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0F172A] text-xs font-bold mt-2.5">Sessions</Text>
          <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-slate-400 text-[10px] font-semibold uppercase mt-0.5 tracking-tight">COMPLETED</Text>
        </View>

        {/* Pod 4: Recovery */}
        <View
          style={{
            width: '48%',
            paddingVertical: 16,
            paddingHorizontal: 12,
            backgroundColor: '#FFFFFF',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: 'rgba(15, 23, 42, 0.06)',
            alignItems: 'center',
            justifyContent: 'center',
            ...softShadow({ color: '#0F172A', opacity: 0.04, radius: 10, offsetY: 4 }),
          }}
        >
          <ProgressRing progress={Number(currentStats.recovery) / 100} size={84} strokeWidth={9} activeColor="#F59E0B" enable3D={true}>
            <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#0F172A] text-base font-extrabold">{currentStats.recovery}%</Text>
          </ProgressRing>
          <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0F172A] text-xs font-bold mt-2.5">Recovery</Text>
          <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-slate-400 text-[10px] font-semibold uppercase mt-0.5 tracking-tight">HIGH INDEX</Text>
        </View>
      </View>
    </View>
  );
});

