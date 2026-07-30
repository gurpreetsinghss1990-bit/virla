import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useUserProfileStore } from '../store/userProfileStore';

export default function PersonalAchievementsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { totalSessions, currentStreak } = useUserProfileStore();

  const achievements = [
    { id: 'ach-1', title: 'First Workout', desc: 'Completed your 1st home session.', unlocked: totalSessions >= 1, icon: 'shield', color: totalSessions >= 1 ? 'text-indigo-600 bg-indigo-50 border-indigo-150' : 'text-zinc-400 bg-zinc-50 border-zinc-150' },
    { id: 'ach-2', title: '10 Sessions club', desc: 'Log 10 complete workout slots.', unlocked: totalSessions >= 10, icon: 'award', color: totalSessions >= 10 ? 'text-emerald-600 bg-emerald-50 border-emerald-150' : 'text-zinc-400 bg-zinc-50 border-zinc-150' },
    { id: 'ach-3', title: 'Morning Warrior', desc: 'Complete any workout before 9:00 AM.', unlocked: totalSessions >= 3, icon: 'sun', color: totalSessions >= 3 ? 'text-amber-600 bg-amber-50 border-amber-150' : 'text-zinc-400 bg-zinc-50 border-zinc-150' },
    { id: 'ach-4', title: 'Consistency Streak', desc: 'Maintain a 5-day active workout streak.', unlocked: currentStreak >= 5, icon: 'zap', color: currentStreak >= 5 ? 'text-orange-500 bg-orange-50 border-orange-150' : 'text-zinc-400 bg-zinc-50 border-zinc-150' },
    { id: 'ach-5', title: '50 Sessions Legend', desc: 'Reach 50 scheduled workout hours.', unlocked: totalSessions >= 50, icon: 'lock', color: totalSessions >= 50 ? 'text-indigo-600 bg-indigo-50 border-indigo-150' : 'text-zinc-400 bg-zinc-50 border-zinc-150' },
    { id: 'ach-6', title: '100 Sessions Centenary', desc: 'Complete 100 sessions with Master Elite coaches.', unlocked: totalSessions >= 100, icon: 'lock', color: totalSessions >= 100 ? 'text-[#D97706] bg-amber-50 border-amber-150' : 'text-zinc-400 bg-zinc-50 border-zinc-150' },
    { id: 'ach-7', title: 'Weekend Champion', desc: 'Log 10 Saturday/Sunday sessions.', unlocked: totalSessions >= 15, icon: 'lock', color: totalSessions >= 15 ? 'text-[#4F46E5] bg-indigo-50 border-indigo-150' : 'text-zinc-400 bg-zinc-50 border-zinc-150' },
    { id: 'ach-8', title: 'Weight Loss Target', desc: 'Log a 5kg weight reduction update.', unlocked: totalSessions >= 5, icon: 'lock', color: totalSessions >= 5 ? 'text-rose-600 bg-rose-50 border-rose-150' : 'text-zinc-400 bg-zinc-50 border-zinc-150' }
  ];

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FC', paddingTop: insets.top }}>
      {/* Header */}
      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white justify-between">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#101828" />
        </TouchableOpacity>
        <Text className="text-[#101828] text-sm font-black uppercase tracking-wider">
          Personal Achievements
        </Text>
        <View className="w-8" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 60 }}>
        <View className="gap-6">
          
          <View className="bg-zinc-950 p-6 rounded-[28px] border border-zinc-800 shadow-xl gap-2">
            <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-wider">Badges Collection</Text>
            <Text className="text-white text-xl font-black mt-1">{unlockedCount} / {achievements.length} Unlocked</Text>
            <View className="h-2 bg-zinc-800 rounded-full overflow-hidden mt-2">
              <View style={{ width: `${(unlockedCount / achievements.length) * 100}%` }} className="h-full bg-indigo-500 rounded-full" />
            </View>
          </View>

          {/* Badges Grid */}
          <View className="gap-4">
            {achievements.map((ach) => (
              <View
                key={ach.id}
                className={`bg-white border p-4.5 rounded-[24px] shadow-xs flex-row gap-4 items-center ${
                  ach.unlocked ? 'border-zinc-200' : 'border-dashed border-zinc-200'
                }`}
              >
                <View className={`w-12 h-12 rounded-2xl items-center justify-center border ${ach.color}`}>
                  <Feather name={ach.icon as any} size={18} />
                </View>

                <View className="flex-1 pr-3">
                  <Text className={`text-xs font-black ${ach.unlocked ? 'text-zinc-950' : 'text-zinc-400'}`}>
                    {ach.title}
                  </Text>
                  <Text className="text-zinc-450 text-[10px] font-semibold mt-0.5 leading-relaxed">
                    {ach.desc}
                  </Text>
                </View>

                <View className="items-end">
                  <View className={`px-2 py-0.5 rounded-full ${
                    ach.unlocked ? 'bg-green-50 border border-green-150' : 'bg-zinc-50 border border-zinc-150'
                  }`}>
                    <Text className={`text-[7px] font-black uppercase ${
                      ach.unlocked ? 'text-green-600' : 'text-zinc-450'
                    }`}>
                      {ach.unlocked ? 'Unlocked' : 'Locked'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

        </View>
      </ScrollView>
    </View>
  );
}
