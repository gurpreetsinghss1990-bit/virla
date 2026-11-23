import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { softShadow } from '../../utils/shadows';

export interface ClientQuickActionsCardProps {
  onNavigateStats: () => void;
  onNavigateAddresses: () => void;
  onNavigateSupport: () => void;
  onLogout: () => void;
}

export const ClientQuickActionsCard = React.memo(function ClientQuickActionsCard({
  onNavigateStats,
  onNavigateAddresses,
  onNavigateSupport,
  onLogout,
}: ClientQuickActionsCardProps) {
  return (
    <>
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 24,
          padding: 8,
          borderWidth: 1,
          borderColor: 'rgba(226, 232, 240, 0.8)',
          marginBottom: 16,
          ...softShadow({ color: '#0F172A', opacity: 0.04, radius: 10, offsetY: 2 }),
        }}
      >
        <Pressable
          onPress={onNavigateStats}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 16 }}
        >
          <View className="flex-row items-center gap-3">
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="bar-chart-2" size={16} color="#475569" />
            </View>
            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-xs text-slate-700">
              Workout History & Metrics
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color="#94A3B8" />
        </Pressable>

        <View style={{ height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 8 }} />

        <Pressable
          onPress={onNavigateAddresses}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 16 }}
        >
          <View className="flex-row items-center gap-3">
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="map-pin" size={16} color="#475569" />
            </View>
            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-xs text-slate-700">
              Saved Workout Locations
            </Text>
          </View>
          <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[11px] text-slate-400">
            Home, Office
          </Text>
        </Pressable>

        <View style={{ height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 8 }} />

        <Pressable
          onPress={onNavigateSupport}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 16 }}
        >
          <View className="flex-row items-center gap-3">
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="message-square" size={16} color="#475569" />
            </View>
            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-xs text-slate-700">
              Dedicated Concierge Support
            </Text>
          </View>
          <View style={{ backgroundColor: 'rgba(225, 29, 72, 0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 }}>
            <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[10px] text-[#E11D48]">
              24/7 Priority
            </Text>
          </View>
        </Pressable>
      </View>

      <View className="pt-2 pb-6 items-center">
        <Pressable onPress={onLogout} className="flex-row items-center gap-1.5 px-4 py-2 rounded-full hover:bg-rose-50">
          <Feather name="log-out" size={15} color="#E11D48" style={{ transform: [{ rotate: '-90deg' }] }} />
          <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#E11D48] text-xs font-bold uppercase tracking-wider">
            SIGN OUT
          </Text>
        </Pressable>
      </View>
    </>
  );
});

