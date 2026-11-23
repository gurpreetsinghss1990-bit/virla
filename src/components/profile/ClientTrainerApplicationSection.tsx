import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LuxuryCard } from '../LuxuryCard';
import { softShadow } from '../../utils/shadows';

export interface ClientTrainerApplicationSectionProps {
  isTrainerRole: boolean;
  hasApplied: boolean;
  applicationStatus?: string;
  onNavigateTrainerApp: () => void;
}

export const ClientTrainerApplicationSection = React.memo(function ClientTrainerApplicationSection({
  isTrainerRole,
  hasApplied,
  applicationStatus,
  onNavigateTrainerApp,
}: ClientTrainerApplicationSectionProps) {
  if (isTrainerRole) return null;

  if (!hasApplied) {
    return (
      <Pressable
        onPress={onNavigateTrainerApp}
        style={{
          backgroundColor: '#090D16',
          borderRadius: 24,
          padding: 20,
          borderWidth: 1,
          borderColor: '#1E293B',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: 16,
          ...softShadow({ color: '#090D16', opacity: 0.45, radius: 16, offsetY: 6 }),
        }}
      >
        <View className="flex-row items-start justify-between">
          <View style={{ maxWidth: '80%' }}>
            <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[10px] uppercase tracking-widest text-[#E11D48]">
              JOIN OUR TEAM
            </Text>
            <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-base text-white tracking-tight mt-0.5">
              Become a VIRLA Trainer
            </Text>
          </View>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: '#E11D48',
              alignItems: 'center',
              justifyContent: 'center',
              ...softShadow({ color: '#E11D48', opacity: 0.5, radius: 8, offsetY: 3 }),
            }}
          >
            <Feather name="arrow-right" size={16} color="#FFFFFF" />
          </View>
        </View>
        <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-xs text-slate-400 mt-2 leading-relaxed">
          Train on your schedule. Grow your client base. Keep more of what you earn with our elite clientele.
        </Text>
      </Pressable>
    );
  }

  if (!applicationStatus) return null;

  return (
    <View className="mb-4">
      <LuxuryCard
        className={`p-4 border rounded-[24px] ${
          applicationStatus === 'approved' ? 'bg-emerald-50 border-emerald-200' :
          applicationStatus === 'interview_scheduled' ? 'bg-amber-50/70 border-amber-300' :
          applicationStatus === 'rejected' ? 'bg-rose-50 border-rose-200' :
          applicationStatus === 'info_requested' ? 'bg-amber-50 border-amber-200' :
          'bg-[#F7F8FC] border-zinc-200'
        }`}
        onPress={onNavigateTrainerApp}
      >
        <View className="flex-row items-center justify-between w-full">
          <View className="flex-1 pr-4 gap-1">
            <Text className="text-zinc-500 text-[9px] font-black uppercase tracking-widest">Trainer Application</Text>
            <View className="flex-row items-center gap-1.5 mt-0.5">
              {applicationStatus === 'interview_scheduled' && (
                <View className="px-2.5 py-1 bg-amber-100 border border-amber-300 rounded-full flex-row items-center gap-1">
                  <View className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                  <Text className="text-amber-900 text-[8px] font-black uppercase tracking-wider">You are called for physical interview</Text>
                </View>
              )}
              {applicationStatus === 'pending' && (
                <View className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full flex-row items-center gap-1">
                  <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <Text className="text-emerald-800 text-[8px] font-black uppercase tracking-wider">Under Review</Text>
                </View>
              )}
              {applicationStatus === 'info_requested' && (
                <View className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full flex-row items-center gap-1">
                  <View className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <Text className="text-amber-800 text-[8px] font-black uppercase tracking-wider">Info Required</Text>
                </View>
              )}
              {applicationStatus === 'rejected' && (
                <View className="px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-full flex-row items-center gap-1">
                  <View className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <Text className="text-rose-800 text-[8px] font-black uppercase tracking-wider">Rejected</Text>
                </View>
              )}
              {applicationStatus === 'approved' && (
                <View className="gap-1 mt-0.5">
                  <View className="px-2.5 py-1 bg-emerald-100 border border-emerald-300 rounded-full flex-row items-center gap-1 self-start">
                    <View className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    <Text className="text-emerald-900 text-[8px] font-black uppercase tracking-wider">Application Approved ✓</Text>
                  </View>
                  <Text className="text-emerald-800 text-[9.5px] font-black leading-tight mt-1">
                    Please sign out for new experience. You are a trainer now.
                  </Text>
                </View>
              )}
            </View>
          </View>
          <Feather name="chevron-right" size={18} color="#6B7280" />
        </View>
      </LuxuryCard>
    </View>
  );
});

