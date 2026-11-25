import React from 'react';
import { View, Text } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { softShadow } from '../../utils/shadows';

export interface AchievementItem {
  id: string;
  icon: string;
  title: string;
  desc: string;
  unlocked: boolean;
  progress: number;
  progressText: string;
  tag: string;
}

export interface ClientAchievementsBadgesProps {
  achievements: AchievementItem[];
}

export const ClientAchievementsBadges = React.memo(function ClientAchievementsBadges({
  achievements,
}: ClientAchievementsBadgesProps) {
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between px-1">
        <Text
          style={{ fontFamily: 'Outfit_700Bold' }}
          className="text-[#0F172A] text-xs font-bold uppercase tracking-wider"
        >
          Achievements Badges
        </Text>
        <View className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100">
          <Text
            style={{ fontFamily: 'Outfit_700Bold' }}
            className="text-indigo-600 text-[10px] font-bold uppercase tracking-wider"
          >
            {unlockedCount} of {achievements.length} Unlocked
          </Text>
        </View>
      </View>

      {achievements.map((b) => (
        <View
          key={b.id}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: 'rgba(15, 23, 42, 0.08)',
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            ...softShadow({ color: '#0F172A', opacity: 0.03, radius: 8, offsetY: 2 }),
          }}
        >
          {/* Left Icon: Golden Medal for Unlocked, Slate Lock for Locked */}
          {b.unlocked ? (
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: '#FEF3C7',
                borderWidth: 2,
                borderColor: '#FDE68A',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="star" size={24} color="#F59E0B" />
            </View>
          ) : (
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: '#F8FAFC',
                borderWidth: 1,
                borderColor: '#E2E8F0',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="lock" size={20} color="#94A3B8" />
            </View>
          )}

          {/* Content */}
          <View className="flex-1 min-w-0">
            <View className="flex-row items-center justify-between">
              <Text
                style={{
                  fontFamily: 'Outfit_700Bold',
                  color: b.unlocked ? '#0F172A' : '#334155',
                  fontSize: 13,
                }}
                numberOfLines={1}
              >
                {b.title}
              </Text>
              {b.unlocked ? (
                <View
                  style={{
                    backgroundColor: 'rgba(254, 243, 199, 0.9)',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 6,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Outfit_700Bold',
                      color: '#B45309',
                      fontSize: 9,
                      textTransform: 'uppercase',
                    }}
                  >
                    Pioneer
                  </Text>
                </View>
              ) : (
                <Text
                  style={{
                    fontFamily: 'Outfit_600SemiBold',
                    color: '#94A3B8',
                    fontSize: 9,
                  }}
                >
                  Locked
                </Text>
              )}
            </View>

            <Text
              style={{ fontFamily: 'Outfit_500Medium', color: '#64748B', fontSize: 11 }}
              className="mt-0.5"
              numberOfLines={1}
            >
              {b.desc}
            </Text>

            {/* Progress Tracker for Locked Badges */}
            {!b.unlocked && (
              <View className="flex-row items-center gap-2 mt-2">
                <View className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <View
                    style={{ width: `${Math.min(100, Math.max(5, b.progress * 100))}%` }}
                    className="h-full bg-indigo-500 rounded-full"
                  />
                </View>
                <Text
                  style={{ fontFamily: 'Outfit_700Bold', color: '#94A3B8', fontSize: 9 }}
                >
                  {b.progressText}
                </Text>
              </View>
            )}
          </View>
        </View>
      ))}
    </View>
  );
});

