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
  const { notifications, markAllAsRead } = useNotificationStore();

  // Mark all read on mount
  React.useEffect(() => {
    markAllAsRead();
  }, []);

  const handleClearAll = () => {
    useNotificationStore.setState({ notifications: [], unreadCount: 0 });
  };

  const getGroupedNotifications = (): TimelineGroup[] => {
    const todayItems = notifications.filter(n => n.timestamp.includes('hours') || n.timestamp.includes('now'));
    const yesterdayItems = notifications.filter(n => n.timestamp.includes('1 day'));
    const earlierItems = notifications.filter(n => !n.timestamp.includes('hours') && !n.timestamp.includes('now') && !n.timestamp.includes('1 day'));

    return [
      { title: 'Today', items: todayItems },
      { title: 'Yesterday', items: yesterdayItems },
      { title: 'Earlier', items: earlierItems }
    ];
  };

  const grouped = getGroupedNotifications();

  const getIcon = (item: any) => {
    const title = item.title.toLowerCase();
    if (title.includes('coach') || title.includes('message')) {
      return <Feather name="message-square" size={14} color="#06B6D4" />;
    }
    if (title.includes('achievement') || title.includes('unlocked')) {
      return <Feather name="award" size={14} color="#F59E0B" />;
    }
    if (title.includes('membership') || title.includes('renewed')) {
      return <Feather name="credit-card" size={14} color="#8B5CF6" />;
    }
    return <Feather name="bell" size={14} color="#4F46E5" />;
  };

  const getBgColor = (item: any) => {
    const title = item.title.toLowerCase();
    if (title.includes('coach') || title.includes('message')) return 'bg-cyan-50';
    if (title.includes('achievement') || title.includes('unlocked')) return 'bg-amber-50';
    if (title.includes('membership') || title.includes('renewed')) return 'bg-purple-50';
    return 'bg-indigo-50';
  };

  const hasNotifications = notifications.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FB]">
      {/* Header back button */}
      <View className="h-14 flex-row items-center justify-between px-6 border-b border-[#E5E7EB] bg-white">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text className="text-[#111827] text-base font-black tracking-tight">
          Notifications
        </Text>
        {hasNotifications ? (
          <TouchableOpacity onPress={handleClearAll} className="h-8 items-center justify-center">
            <Text className="text-indigo-600 text-xs font-black uppercase">Clear All</Text>
          </TouchableOpacity>
        ) : (
          <View className="w-8" />
        )}
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
                <View key={group.title} className="gap-3">
                  <Text className="text-[#111827] text-sm font-black uppercase tracking-wider pl-1">
                    {group.title}
                  </Text>
                  
                  <View className="gap-3">
                    {group.items.map((item) => (
                      <View 
                        key={item.id}
                        className="bg-white border border-[#E5E7EB] p-4.5 rounded-[24px] flex-row gap-4 shadow-xs"
                      >
                        <View className={`w-10 h-10 rounded-2xl items-center justify-center ${getBgColor(item)}`}>
                          {getIcon(item)}
                        </View>
                        <View className="flex-1 justify-center">
                          <Text className="text-[#111827] text-xs font-black tracking-tight">{item.title}</Text>
                          <Text className="text-[#6B7280] text-[10px] font-semibold leading-relaxed mt-0.5">
                            {item.body}
                          </Text>
                          <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-2">{item.timestamp}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View className="flex-1 justify-center items-center">
            <EmptyState type="no-notifications" />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

