import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useNotificationStore } from '../store/notificationStore';
import { Ionicons, Feather } from '@expo/vector-icons';
import { NotificationItem } from '../types';

type CategoryType = 'All' | 'Bookings' | 'Membership' | 'Credits' | 'Payments' | 'Promotions' | 'Trainer Updates' | 'Safety' | 'System';

const CATEGORIES: CategoryType[] = [
  'All', 'Bookings', 'Membership', 'Credits', 'Payments', 'Promotions', 'Trainer Updates', 'Safety', 'System'
];

interface TimelineGroup {
  title: string;
  items: NotificationItem[];
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { notifications, markAsRead, markAllAsRead, clearAll, deleteNotification, unreadCount } = useNotificationStore();

  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(15);

  const handleNotificationPress = (item: NotificationItem) => {
    markAsRead(item.id);
    if (item.deepLink) {
      // Direct deep link routing
      try {
        router.push(item.deepLink as any);
      } catch {
        Alert.alert('Routing Error', 'Could not open deep link screen.');
      }
    }
  };

  // Filter and pagination
  const getFilteredNotifications = () => {
    let list = [...notifications];
    
    // Category filter
    if (selectedCategory !== 'All') {
      list = list.filter(n => n.type === selectedCategory);
    }

    // Search query filter
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      list = list.filter(n => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));
    }

    return list;
  };

  const filtered = getFilteredNotifications();
  const paginated = filtered.slice(0, pageSize);
  const hasMore = filtered.length > pageSize;

  const getGroupedNotifications = (items: NotificationItem[]): TimelineGroup[] => {
    const todayItems = items.filter(n => n.group === 'today' || n.timestamp.includes('now') || n.timestamp.includes('min'));
    const yesterdayItems = items.filter(n => n.group === 'yesterday');
    const earlierItems = items.filter(n => n.group === 'earlier' && !todayItems.includes(n) && !yesterdayItems.includes(n));

    return [
      { title: 'Today', items: todayItems },
      { title: 'Yesterday', items: yesterdayItems },
      { title: 'Earlier', items: earlierItems }
    ];
  };

  const grouped = getGroupedNotifications(paginated);
  const hasNotifications = filtered.length > 0;

  const getIcon = (item: NotificationItem) => {
    const name = item.icon || 'bell';
    const typeColorMap: Record<string, string> = {
      'Bookings': '#E11D48',      // Rose
      'Membership': '#8B5CF6',    // Purple
      'Credits': '#06B6D4',       // Cyan
      'Payments': '#10B981',      // Emerald
      'Promotions': '#F59E0B',    // Amber
      'Trainer Updates': '#3B82F6', // Blue
      'Safety': '#EF4444',        // Red
      'System': '#6B7280'         // Gray
    };
    const color = typeColorMap[item.type || 'System'] || '#6B7280';
    return <Feather name={name as any} size={14} color={color} />;
  };

  const getBgColor = (item: NotificationItem) => {
    const typeBgMap: Record<string, string> = {
      'Bookings': 'bg-rose-50 border-rose-100',
      'Membership': 'bg-purple-50 border-purple-100',
      'Credits': 'bg-cyan-50 border-cyan-100',
      'Payments': 'bg-emerald-50 border-emerald-100',
      'Promotions': 'bg-amber-50 border-amber-100',
      'Trainer Updates': 'bg-blue-50 border-blue-100',
      'Safety': 'bg-red-50 border-red-100',
      'System': 'bg-zinc-50 border-zinc-100'
    };
    return typeBgMap[item.type || 'System'] || 'bg-zinc-50 border-zinc-100';
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FC', paddingTop: insets.top }}>
      {/* Header */}
      <View className="h-14 flex-row items-center justify-between px-6 border-b border-[#E5E7EB] bg-white">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#101828" />
        </TouchableOpacity>
        
        <View className="items-center">
          <Text className="text-[#101828] text-sm font-black uppercase tracking-wider">
            Notifications Center
          </Text>
          {unreadCount > 0 && (
            <Text className="text-[#4F46E5] text-[9px] font-black uppercase tracking-widest mt-0.5">
              {unreadCount} Unread
            </Text>
          )}
        </View>

        <View className="flex-row items-center gap-3">
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllAsRead} className="h-8 justify-center">
              <Text className="text-[#4F46E5] text-[9px] font-black uppercase">Mark All Read</Text>
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity onPress={clearAll} className="h-8 justify-center">
              <Text className="text-rose-600 text-[9px] font-black uppercase">Clear All</Text>
            </TouchableOpacity>
          )}
          {notifications.length === 0 && <View className="w-8" />}
        </View>
      </View>

      {/* Search Input */}
      <View className="px-6 pt-4 bg-white pb-3 border-b border-zinc-100">
        <View className="flex-row items-center bg-zinc-50 border border-zinc-200 px-3.5 py-1 rounded-xl">
          <Feather name="search" size={14} color="#6B7280" />
          <TextInput
            placeholder="Search notifications..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 text-xs font-semibold text-zinc-900 ml-2 py-1.5"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={12} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Horizontal Category Filters */}
      <View className="bg-white border-b border-[#E5E7EB] py-3.5">
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            const count = cat === 'All' ? filtered.length : notifications.filter(n => n.type === cat).length;
            
            return (
              <TouchableOpacity
                key={cat}
                activeOpacity={0.8}
                onPress={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full border flex-row items-center gap-1.5 ${
                  isSelected ? 'bg-zinc-950 border-zinc-950' : 'bg-[#F8FAFC] border-zinc-200'
                }`}
              >
                <Text className={`text-[10px] font-black uppercase tracking-wider ${isSelected ? 'text-white' : 'text-zinc-500'}`}>
                  {cat}
                </Text>
                {count > 0 && (
                  <View className={`px-1.5 py-0.5 rounded-full items-center justify-center ${isSelected ? 'bg-white/20' : 'bg-zinc-200'}`}>
                    <Text className={`text-[8px] font-extrabold ${isSelected ? 'text-white' : 'text-zinc-500'}`}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Notifications List */}
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
                  <Text className="text-[#101828] text-xs font-black uppercase tracking-wider pl-1">
                    {group.title}
                  </Text>
                  
                  <View className="gap-3">
                    {group.items.map((item) => (
                      <View 
                        key={item.id}
                        className={`p-4.5 rounded-[24px] border flex-row gap-4 relative bg-white ${
                          item.read ? 'border-zinc-200' : 'border-indigo-150'
                        }`}
                        style={{
                          shadowColor: '#101828',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: item.read ? 0.02 : 0.04,
                          shadowRadius: 8,
                          elevation: 2,
                        }}
                      >
                        {/* Unread indicator */}
                        {!item.read && (
                          <View className="absolute top-4.5 right-4.5 w-2 h-2 rounded-full bg-[#4F46E5]" />
                        )}

                        {/* Icon badge */}
                        <View className={`w-10 h-10 rounded-2xl items-center justify-center border ${getBgColor(item)}`}>
                          {getIcon(item)}
                        </View>
                        
                        <View className="flex-1 pr-4">
                          <View className="flex-row items-center gap-2">
                            <Text className="text-zinc-400 text-[8px] font-black uppercase tracking-widest">{item.type || 'System'}</Text>
                            {item.priority === 'high' && (
                              <View className="bg-red-50 px-1.5 py-0.5 rounded">
                                <Text className="text-red-500 text-[6px] font-black uppercase">Urgent</Text>
                              </View>
                            )}
                          </View>
                          
                          <Text className="text-[#101828] text-xs font-black tracking-tight mt-0.5">{item.title}</Text>
                          <Text className="text-[#6B7280] text-[10px] font-semibold leading-relaxed mt-1">
                            {item.body}
                          </Text>

                          {/* Action Button Redirection */}
                          {item.actionLabel && (
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={() => handleNotificationPress(item)}
                              className="bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 self-start mt-2.5 flex-row items-center gap-1.5"
                            >
                              <Text className="text-zinc-700 text-[8px] font-black uppercase tracking-wider">
                                {item.actionLabel}
                              </Text>
                              <Feather name="arrow-right" size={10} color="#374151" />
                            </TouchableOpacity>
                          )}

                          <View className="flex-row justify-between items-center mt-3 pt-2.5 border-t border-zinc-50">
                            <Text className="text-zinc-400 text-[8px] font-bold uppercase">{item.timestamp}</Text>
                            
                            <View className="flex-row gap-3">
                              {!item.read && (
                                <TouchableOpacity onPress={() => markAsRead(item.id)}>
                                  <Text className="text-[#4F46E5] text-[8px] font-bold uppercase">Mark Read</Text>
                                </TouchableOpacity>
                              )}
                              <TouchableOpacity onPress={() => deleteNotification(item.id)}>
                                <Text className="text-rose-600 text-[8px] font-bold uppercase">Delete</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}

            {hasMore && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setPageSize(prev => prev + 15)}
                className="w-full py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl items-center justify-center mt-2"
              >
                <Text className="text-zinc-600 text-xs font-bold uppercase tracking-wider">Load More</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View className="flex-1 justify-center items-center py-20 gap-3">
            <Text className="text-4xl">🎉</Text>
            <Text className="text-[#101828] text-base font-black">You&apos;re all caught up.</Text>
            <Text className="text-zinc-400 text-xs text-center">No new notifications in this category.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
