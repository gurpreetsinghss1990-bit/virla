import React from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useNotificationStore } from '../store/notificationStore';
import { EmptyState } from '../components/EmptyState';
import { Ionicons, Feather } from '@expo/vector-icons';

interface TimelineGroup {
  title: string;
  items: any[];
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { notifications, markAsRead, markAllAsRead, clearAll, unreadCount } = useNotificationStore();

  const getGroupedNotifications = (): TimelineGroup[] => {
    const todayItems = notifications.filter(n => n.group === 'today');
    const yesterdayItems = notifications.filter(n => n.group === 'yesterday');
    const earlierItems = notifications.filter(n => n.group === 'earlier');

    return [
      { title: 'Today', items: todayItems },
      { title: 'Yesterday', items: yesterdayItems },
      { title: 'Earlier', items: earlierItems }
    ];
  };

  const grouped = getGroupedNotifications();
  const hasNotifications = notifications.length > 0;

  const getIcon = (iconName?: string) => {
    const name = iconName || 'bell';
    const colorMap: Record<string, string> = {
      'user-check': '#4F46E5',
      'lock': '#F59E0B',
      'rotate-ccw': '#EF4444',
      'plus-circle': '#10B981',
      'shopping-bag': '#8B5CF6',
      'award': '#06B6D4'
    };
    return <Feather name={name as any} size={14} color={colorMap[name] || '#6B7280'} />;
  };

  const getBgColor = (iconName?: string) => {
    const name = iconName || 'bell';
    const bgMap: Record<string, string> = {
      'user-check': 'bg-indigo-50 border-indigo-100',
      'lock': 'bg-amber-50 border-amber-100',
      'rotate-ccw': 'bg-rose-50 border-rose-100',
      'plus-circle': 'bg-emerald-50 border-emerald-100',
      'shopping-bag': 'bg-purple-50 border-purple-100',
      'award': 'bg-cyan-50 border-cyan-100'
    };
    return bgMap[name] || 'bg-zinc-50 border-zinc-100';
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FB]">
      {/* Header */}
      <View className="h-14 flex-row items-center justify-between px-6 border-b border-[#E5E7EB] bg-white">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        
        <Text className="text-[#111827] text-sm font-black uppercase tracking-wider">
          Notifications Center
        </Text>

        <View className="flex-row items-center gap-3">
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllAsRead} className="h-8 justify-center">
              <Text className="text-[#4F46E5] text-[9px] font-black uppercase">Mark All Read</Text>
            </TouchableOpacity>
          )}
          {hasNotifications && (
            <TouchableOpacity onPress={clearAll} className="h-8 justify-center">
              <Text className="text-rose-600 text-[9px] font-black uppercase">Clear All</Text>
            </TouchableOpacity>
          )}
          {!hasNotifications && <View className="w-8" />}
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 50, flexGrow: 1 }}
      >
        {hasNotifications ? (
          <View className="gap-6">
            {grouped.map((group) => {
              if (group.items.length === 0) return null;
              return (
                <View key={group.title} className="gap-3.5">
                  <Text className="text-[#111827] text-xs font-black uppercase tracking-wider pl-1">
                    {group.title}
                  </Text>
                  
                  <View className="gap-3">
                    {group.items.map((item) => (
                      <TouchableOpacity 
                        key={item.id}
                        activeOpacity={0.8}
                        onPress={() => markAsRead(item.id)}
                        className={`p-4.5 rounded-[24px] border flex-row gap-4 shadow-xs relative ${
                          item.read ? 'bg-white border-zinc-200' : 'bg-indigo-50/20 border-indigo-150'
                        }`}
                      >
                        {/* Unread dot indicator */}
                        {!item.read && (
                          <View className="absolute top-4.5 right-4.5 w-2 h-2 rounded-full bg-[#4F46E5]" />
                        )}

                        <View className={`w-10 h-10 rounded-2xl items-center justify-center border ${getBgColor(item.icon)}`}>
                          {getIcon(item.icon)}
                        </View>
                        
                        <View className="flex-1 justify-center pr-3">
                          <Text className="text-[#111827] text-xs font-black tracking-tight">{item.title}</Text>
                          <Text className="text-[#6B7280] text-[10px] font-semibold leading-relaxed mt-0.5">
                            {item.body}
                          </Text>
                          <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-2">{item.timestamp}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View className="flex-1 justify-center items-center py-20">
            <EmptyState type="no-notifications" />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
