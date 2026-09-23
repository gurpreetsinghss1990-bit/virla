import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, TextInput, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useNotificationStore } from '../store/notificationStore';
import { Feather, Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../components/ScreenHeader';
import { EmptyState } from '../components/EmptyState';
import { NotificationItem } from '../types';
interface TimelineGroup {
  title: string;
  items: NotificationItem[];
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { notifications, markAsRead, deleteNotification, unreadCount, syncFromDB } = useNotificationStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    syncFromDB();
  }, [syncFromDB]);

  const handleNotificationPress = (item: NotificationItem) => {
    if (isSelectionMode) {
      toggleSelectItem(item.id);
      return;
    }

    if (!item.read) {
      markAsRead(item.id);
    }
    if (item.deepLink) {
      try {
        router.push(item.deepLink as any);
      } catch {
        Alert.alert('Notice', 'Could not open the linked page.');
      }
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = (visibleItems: NotificationItem[]) => {
    if (selectedIds.size === visibleItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleItems.map(n => n.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    Alert.alert(
      'Delete Notifications',
      `Are you sure you want to delete ${count} selected ${count === 1 ? 'notification' : 'notifications'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: `Delete (${count})`, 
          style: 'destructive', 
          onPress: () => {
            selectedIds.forEach((id) => {
              deleteNotification(id);
            });
            setSelectedIds(new Set());
            setIsSelectionMode(false);
          }
        }
      ]
    );
  };

  // Filter logic (search only)
  const filteredNotifications = useMemo(() => {
    if (!searchQuery.trim()) return notifications;
    const q = searchQuery.toLowerCase().trim();
    return notifications.filter(n => 
      (n.title && n.title.toLowerCase().includes(q)) || 
      (n.body && n.body.toLowerCase().includes(q)) ||
      (n.type && n.type.toLowerCase().includes(q))
    );
  }, [notifications, searchQuery]);

  const paginated = filteredNotifications.slice(0, pageSize);
  const hasMore = filteredNotifications.length > pageSize;

  // Robust grouping
  const groupedNotifications = useMemo((): TimelineGroup[] => {
    const todayItems: NotificationItem[] = [];
    const yesterdayItems: NotificationItem[] = [];
    const earlierItems: NotificationItem[] = [];

    paginated.forEach(n => {
      const ts = (n.timestamp || '').toLowerCase();
      if (
        n.group === 'today' || 
        ts.includes('just now') || 
        ts.includes('now') || 
        ts.includes('min') || 
        ts.includes('hour') || 
        ts.includes('today')
      ) {
        todayItems.push(n);
      } else if (n.group === 'yesterday' || ts.includes('yesterday')) {
        yesterdayItems.push(n);
      } else {
        earlierItems.push(n);
      }
    });

    const groups: TimelineGroup[] = [];
    if (todayItems.length > 0) groups.push({ title: 'Today', items: todayItems });
    if (yesterdayItems.length > 0) groups.push({ title: 'Yesterday', items: yesterdayItems });
    if (earlierItems.length > 0) groups.push({ title: 'Earlier', items: earlierItems });

    // Fallback if timestamps didn't match any bucket
    if (groups.length === 0 && paginated.length > 0) {
      groups.push({ title: 'Notifications', items: paginated });
    }

    return groups;
  }, [paginated]);

  const resolveNotificationCategory = (item: NotificationItem): string | null => {
    if (item.type && item.type !== 'System') {
      return item.type;
    }
    const text = `${item.title || ''} ${item.body || ''}`.toLowerCase();
    if (text.includes('booking') || text.includes('session') || text.includes('workout')) return 'Bookings';
    if (text.includes('credit') || text.includes('wallet') || text.includes('recharge')) return 'Credits';
    if (text.includes('payment') || text.includes('paid') || text.includes('invoice')) return 'Payments';
    if (text.includes('trainer') || text.includes('coach')) return 'Trainer Updates';
    if (text.includes('safety') || text.includes('emergency')) return 'Safety';
    return null;
  };

  const getCategoryTheme = (type?: string) => {
    switch (type) {
      case 'Bookings':
        return {
          icon: 'calendar',
          color: '#E11D48',
          bg: 'bg-rose-50',
          border: 'border-rose-200/80',
          badgeText: 'text-rose-700',
          badgeBg: 'bg-rose-50/80 border-rose-200/60',
        };
      case 'Membership':
        return {
          icon: 'award',
          color: '#8B5CF6',
          bg: 'bg-purple-50',
          border: 'border-purple-200/80',
          badgeText: 'text-purple-700',
          badgeBg: 'bg-purple-50/80 border-purple-200/60',
        };
      case 'Credits':
        return {
          icon: 'credit-card',
          color: '#D97706',
          bg: 'bg-amber-50',
          border: 'border-amber-200/80',
          badgeText: 'text-amber-700',
          badgeBg: 'bg-amber-50/80 border-amber-200/60',
        };
      case 'Payments':
        return {
          icon: 'check-circle',
          color: '#059669',
          bg: 'bg-emerald-50',
          border: 'border-emerald-200/80',
          badgeText: 'text-emerald-700',
          badgeBg: 'bg-emerald-50/80 border-emerald-200/60',
        };
      case 'Promotions':
        return {
          icon: 'zap',
          color: '#EA580C',
          bg: 'bg-orange-50',
          border: 'border-orange-200/80',
          badgeText: 'text-orange-700',
          badgeBg: 'bg-orange-50/80 border-orange-200/60',
        };
      case 'Trainer Updates':
        return {
          icon: 'user-check',
          color: '#2563EB',
          bg: 'bg-blue-50',
          border: 'border-blue-200/80',
          badgeText: 'text-blue-700',
          badgeBg: 'bg-blue-50/80 border-blue-200/60',
        };
      case 'Safety':
        return {
          icon: 'shield',
          color: '#DC2626',
          bg: 'bg-red-50',
          border: 'border-red-200/80',
          badgeText: 'text-red-700',
          badgeBg: 'bg-red-50/80 border-red-200/60',
        };
      case 'System':
      default:
        return {
          icon: 'bell',
          color: '#475569',
          bg: 'bg-slate-100',
          border: 'border-slate-200/80',
          badgeText: 'text-slate-700',
          badgeBg: 'bg-slate-100 border-slate-200/60',
        };
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FCF5F5' }}>
      {/* Unified Screen Header - Virla Concierge category removed, borderless */}
      <ScreenHeader 
        title={isSelectionMode ? `${selectedIds.size} Selected` : 'Notifications'} 
        category=""
        showBorder={false}
        backgroundColor="#FCF5F5"
        titleClassName="text-zinc-950 text-2xl font-black tracking-tight mt-0.5"
        subtitle={!isSelectionMode && unreadCount > 0 ? `${unreadCount} unread` : undefined}
        onBack={isSelectionMode ? () => {
          setIsSelectionMode(false);
          setSelectedIds(new Set());
        } : undefined}
        rightElement={
          isSelectionMode ? (
            <View className="flex-row items-center gap-2">
              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => handleSelectAll(paginated)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                className="px-2.5 py-1.5 rounded-full bg-white border border-zinc-200/80 shadow-xs"
              >
                <Text className="text-zinc-900 text-xs font-black">
                  {selectedIds.size === paginated.length && paginated.length > 0 ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => {
                  setIsSelectionMode(false);
                  setSelectedIds(new Set());
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                className="px-2.5 py-1.5 rounded-full bg-white border border-zinc-200/80 shadow-xs"
              >
                <Text className="text-zinc-600 text-xs font-bold">Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            notifications.length > 0 ? (
              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => setIsSelectionMode(true)} 
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                className="w-9 h-9 items-center justify-center"
              >
                <Feather name="trash-2" size={20} color="#101828" />
              </TouchableOpacity>
            ) : undefined
          )
        }
      />

      {/* Search Input Bar (shown only when notifications exist and not selecting) */}
      {!isSelectionMode && notifications.length > 0 && (
        <View className="px-5 pt-2 pb-2 bg-[#FCF5F5]">
          <View className="flex-row items-center bg-white border border-zinc-200/70 px-3.5 py-2.5 rounded-2xl shadow-xs">
            <Feather name="search" size={15} color="#9CA3AF" />
            <TextInput
              placeholder="Search notifications..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 text-sm font-semibold text-zinc-900 ml-2.5 py-0"
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <View className="w-4 h-4 rounded-full bg-zinc-300 items-center justify-center">
                  <Feather name="x" size={10} color="white" />
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Notifications List - Completely borderless, no horizontal lines */}
      <ScrollView 
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ 
          paddingHorizontal: 20, 
          paddingTop: 8, 
          paddingBottom: Math.max(insets.bottom + (isSelectionMode ? 88 : 32), 64), 
          flexGrow: 1 
        }}
      >
        {filteredNotifications.length > 0 ? (
          <View className="gap-6">
            {groupedNotifications.map((group) => {
              if (group.items.length === 0) return null;
              return (
                <View key={group.title} className="gap-1">
                  {/* Group Header (borderless, no horizontal line) */}
                  <View className="flex-row items-center justify-between pt-3 pb-2">
                    <Text className="text-zinc-900 text-sm font-black uppercase tracking-wider">
                      {group.title}
                    </Text>
                    <View className="bg-zinc-100 px-2.5 py-0.5 rounded-full">
                      <Text className="text-zinc-600 text-xs font-bold">
                        {group.items.length} {group.items.length === 1 ? 'alert' : 'alerts'}
                      </Text>
                    </View>
                  </View>
                  
                  {/* Notification Items - Clean list rows without cards or horizontal lines */}
                  <View className="gap-1.5">
                    {group.items.map((item) => {
                      const category = resolveNotificationCategory(item);
                      const theme = getCategoryTheme(category || undefined);
                      const isUnread = !item.read;
                      const isSelected = selectedIds.has(item.id);

                      return (
                        <TouchableOpacity
                          key={item.id}
                          activeOpacity={0.7}
                          onPress={() => handleNotificationPress(item)}
                          onLongPress={() => {
                            if (!isSelectionMode) {
                              setIsSelectionMode(true);
                              setSelectedIds(new Set([item.id]));
                            }
                          }}
                          className={`py-3.5 px-3 rounded-2xl flex-row items-start gap-3.5 ${
                            isSelected ? 'bg-zinc-100/90' : 'bg-transparent'
                          }`}
                        >
                          {/* Selection Checkbox */}
                          {isSelectionMode && (
                            <View className="pt-2.5">
                              {isSelected ? (
                                <View className="w-5 h-5 rounded-full bg-[#101828] items-center justify-center">
                                  <Feather name="check" size={13} color="white" />
                                </View>
                              ) : (
                                <View className="w-5 h-5 rounded-full border-2 border-zinc-300 bg-white" />
                              )}
                            </View>
                          )}

                          {/* Category Icon Badge */}
                          <View className={`w-12 h-12 rounded-2xl items-center justify-center border ${theme.bg} ${theme.border}`}>
                            <Feather name={(item.icon as any) || theme.icon} size={20} color={theme.color} />
                          </View>
                          
                          {/* Main Content */}
                          <View className="flex-1">
                            {/* Category Tag & Time / Status Header */}
                            <View className="flex-row items-center justify-between mb-1.5">
                              <View className="flex-row items-center gap-2">
                                {Boolean(category) && (
                                  <View className={`px-2.5 py-0.5 rounded-md border ${theme.badgeBg}`}>
                                    <Text className={`text-xs font-extrabold uppercase tracking-wider ${theme.badgeText}`}>
                                      {category}
                                    </Text>
                                  </View>
                                )}
                                {item.priority === 'high' && (
                                  <View className="bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md flex-row items-center gap-1">
                                    <View className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                    <Text className="text-rose-600 text-[10.5px] font-black uppercase">Urgent</Text>
                                  </View>
                                )}
                              </View>
                              
                              <View className="flex-row items-center gap-2">
                                {isUnread && (
                                  <View className="flex-row items-center gap-1 bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded-full">
                                    <View className="w-1.5 h-1.5 rounded-full bg-[#4F46E5]" />
                                    <Text className="text-[#4F46E5] text-[10px] font-black uppercase tracking-wide">New</Text>
                                  </View>
                                )}
                                <Text className="text-zinc-400 text-xs font-semibold">{item.timestamp}</Text>
                              </View>
                            </View>
                            
                            {/* Title - Bigger typography */}
                            <Text className={`text-base tracking-tight leading-snug ${isUnread ? 'font-black text-zinc-950' : 'font-bold text-zinc-800'}`}>
                              {item.title}
                            </Text>

                            {/* Message Body - Bigger typography */}
                            <Text className={`text-sm leading-relaxed mt-1.5 ${isUnread ? 'font-medium text-zinc-700' : 'font-normal text-zinc-500'}`}>
                              {item.body}
                            </Text>

                            {/* Call to Action Button */}
                            {item.actionLabel && (
                              <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => handleNotificationPress(item)}
                                className="bg-zinc-950 px-4 py-2 rounded-xl self-start mt-2.5 flex-row items-center gap-1.5 shadow-xs"
                              >
                                <Text className="text-white text-sm font-bold">
                                  {item.actionLabel}
                                </Text>
                                <Feather name="arrow-right" size={13} color="white" />
                              </TouchableOpacity>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {/* Pagination Load More */}
            {hasMore && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setPageSize(prev => prev + 15)}
                className="w-full py-4 items-center justify-center mt-2 mb-4"
              >
                <Text className="text-zinc-600 text-xs font-extrabold uppercase tracking-wider">
                  Load More Notifications
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : searchQuery.trim().length > 0 ? (
          <View className="flex-1 justify-center items-center py-16 gap-3">
            <View className="w-14 h-14 rounded-full bg-zinc-100 items-center justify-center">
              <Feather name="search" size={24} color="#9CA3AF" />
            </View>
            <Text className="text-zinc-900 text-base font-black">No results found</Text>
            <Text className="text-zinc-500 text-xs text-center px-8 leading-relaxed">
              We couldn&apos;t find any notifications matching &ldquo;{searchQuery}&rdquo;.
            </Text>
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              className="mt-2 px-4 py-2 rounded-full bg-zinc-900"
            >
              <Text className="text-white text-xs font-bold">Clear Search</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="flex-1 justify-center items-center py-12">
            <EmptyState 
              type="no-notifications" 
              showCard={false}
              message="Your notification center is clear. We’ll alert you on upcoming workout schedules and trainer updates."
            />
          </View>
        )}
      </ScrollView>

      {/* Floating Bottom Selection Actions Bar */}
      {isSelectionMode && (
        <View 
          style={{ paddingBottom: Math.max(insets.bottom, 16) }} 
          className="px-5 pt-3 bg-white border-t border-zinc-100 flex-row items-center gap-3 shadow-md"
        >
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={selectedIds.size === 0}
            onPress={handleDeleteSelected}
            className={`flex-1 py-3.5 rounded-2xl flex-row items-center justify-center gap-2 ${
              selectedIds.size > 0 ? 'bg-[#E11D48]' : 'bg-zinc-200'
            }`}
          >
            <Feather name="trash-2" size={16} color={selectedIds.size > 0 ? 'white' : '#9CA3AF'} />
            <Text className={`text-sm font-black uppercase tracking-wider ${
              selectedIds.size > 0 ? 'text-white' : 'text-zinc-400'
            }`}>
              Delete {selectedIds.size > 0 ? `(${selectedIds.size})` : 'Selected'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              setIsSelectionMode(false);
              setSelectedIds(new Set());
            }}
            className="px-5 py-3.5 rounded-2xl bg-zinc-100 items-center justify-center"
          >
            <Text className="text-zinc-700 text-xs font-bold uppercase tracking-wider">Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
