import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { AvatarImage } from '../AvatarImage';
import { softShadow } from '../../utils/shadows';

export interface ClientHeroSectionProps {
  name: string;
  avatar?: string;
  gender?: string;
  canSwitchToTrainer: boolean;
  onEditPress: () => void;
  onSwitchToTrainer: () => void;
}

export const ClientHeroSection = React.memo(function ClientHeroSection({
  name,
  avatar,
  gender,
  canSwitchToTrainer,
  onEditPress,
  onSwitchToTrainer,
}: ClientHeroSectionProps) {
  return (
    <View className="flex-row items-center gap-4 mb-5 z-10">
      <Pressable onPress={onEditPress} className="relative">
        <View
          style={{
            width: 84,
            height: 84,
            borderRadius: 42,
            alignItems: 'center',
            justifyContent: 'center',
            ...softShadow({ color: '#F59E0B', opacity: 0.25, radius: 8, offsetY: 3 }),
          }}
        >
          <Svg width={84} height={84} style={{ position: 'absolute', top: 0, left: 0 }}>
            <Defs>
              <LinearGradient id="avatarBorderGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor="#FBBF24" />
                <Stop offset="50%" stopColor="#E11D48" />
                <Stop offset="100%" stopColor="#FCD34D" />
              </LinearGradient>
            </Defs>
            <Circle cx={42} cy={42} r={40.5} stroke="url(#avatarBorderGrad)" strokeWidth={3} fill="none" />
          </Svg>
          <View style={{ width: 76, height: 76, borderRadius: 38, overflow: 'hidden', borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: '#0F172A' }}>
            <AvatarImage
              uri={avatar}
              gender={gender}
              style={{ width: '100%', height: '100%', borderRadius: 38 }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
            />
          </View>
        </View>
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: '#E11D48',
            borderWidth: 2,
            borderColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
            ...softShadow({ color: '#E11D48', opacity: 0.4, radius: 4, offsetY: 2 }),
          }}
        >
          <Feather name="camera" size={11} color="#FFFFFF" />
        </View>
      </Pressable>

      <View className="flex-1">
        <View className="flex-row items-center gap-2 flex-wrap">
          <Text
            style={{ fontFamily: 'Outfit_700Bold' }}
            className="text-[#0F172A] text-2xl font-bold tracking-tight"
          >
            {name}
          </Text>
          <View
            style={{
              backgroundColor: '#FEF3C7',
              borderWidth: 1,
              borderColor: 'rgba(251, 191, 36, 0.8)',
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 9999,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <MaterialCommunityIcons name="crown" size={11} color="#B45309" />
            <Text
              style={{ fontFamily: 'Outfit_700Bold' }}
              className="text-[#B45309] text-[9.5px] uppercase tracking-wide"
            >
              ELITE MEMBER
            </Text>
          </View>
        </View>

        <Text
          style={{ fontFamily: 'Outfit_500Medium' }}
          className="text-[#64748B] text-xs mt-0.5"
        >
          Stronger • Healthier • Happier
        </Text>

        <View className="flex-row items-center gap-2 mt-2">
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: 'rgba(226, 232, 240, 0.8)',
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 6,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <View className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            <Text
              style={{ fontFamily: 'Outfit_600SemiBold' }}
              className="text-[#475569] text-[10.5px]"
            >
              Active Concierge Tier
            </Text>
          </View>
        </View>

        {canSwitchToTrainer && (
          <Pressable
            onPress={onSwitchToTrainer}
            className="mt-2.5 bg-[#101828] border border-zinc-800 px-3 py-1.5 rounded-xl flex-row items-center gap-1.5 self-start"
          >
            <Feather name="repeat" size={11} color="#F5B942" />
            <Text className="text-white text-[10px] font-black uppercase tracking-wider">
              Go to Trainer Mode
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
});

