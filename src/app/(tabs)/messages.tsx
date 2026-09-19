import React, { useState, useMemo } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBookingStore } from '../../store/bookingStore';
import { useUserStore } from '../../store/userStore';
import { Database } from '../../database/Database';
import { EmptyState } from '../../components/EmptyState';
import { getBookingISTDateRange } from '../../utils/date';

interface ChatItem {
  id: string;
  bookingId?: string;
  name: string;
  subtitle?: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: boolean;
  isOnline?: boolean;
  type: 'coach' | 'concierge';
}

export default function MessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bookings } = useBookingStore();
  const { role } = useUserStore();
  const [searchQuery, setSearchQuery] = useState('');

  // ponytail: "live" = upcoming session inside the 60-min window. Same rule as chat/call lock.
  const getMinutesToSession = (b: (typeof bookings)[number]): number => {
    try {
      return (getBookingISTDateRange(b).start.getTime() - Date.now()) / 60000;
    } catch {
      return Infinity;
    }
  };

  // Build dynamic chats list from bookings + concierge support
  const chatsList = useMemo((): ChatItem[] => {
    const list: ChatItem[] = [];

    // Dedicated Concierge Support Line (no fake Live/dot — shows presence only when a session is live)
    list.push({
      id: 'concierge-support',
      name: 'VIRLA 24/7 Concierge',
      subtitle: 'Priority Concierge & Safety',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      lastMessage: 'Welcome to Virla Private Concierge. How can we assist with your schedule today?',
      time: '',
      unread: false,
      isOnline: false,
      type: 'concierge',
    });

    // Group bookings by person so each coach/client appears exactly once
    const isTrainer = role === 'trainer';
    const personMap = new Map<string, typeof bookings>();

    const getCoachKey = (trainerId?: string, trainerName?: string) => {
      let raw = trainerName;
      if (!raw && trainerId) {
        const coach = Database.getCoaches().find((c) => c.id === trainerId);
        if (coach?.name) raw = coach.name;
      }
      return (raw || trainerId || 'coach')
        .toLowerCase()
        .replace(/^coach\s+/i, '')
        .trim()
        .replace(/[^a-z0-9]/g, '_');
    };

    const getClientKey = (clientId?: string, clientName?: string) => {
      return (clientId || clientName || 'client')
        .toLowerCase()
        .replace(/^client\s+/i, '')
        .trim()
        .replace(/[^a-z0-9]/g, '_');
    };

    bookings.forEach((b) => {
      // Exclude unassigned/searching bookings and placeholder/test trainers
      if (!isTrainer) {
        const tName = (b.trainerName || '').toLowerCase().trim();
        const tId = (b.trainerId || '').toLowerCase().trim();

        // Remove "No Trainer Available", unassigned, or searching
        if (
          !tName ||
          tName === 'no trainer available' ||
          tName.includes('no trainer') ||
          tName.includes('no timer') ||
          tName.includes('searching') ||
          tId === 'searching'
        ) {
          return;
        }

        // Remove "Test Admin" / admin accounts
        if (
          tName.includes('admin') ||
          tName.includes('test admin') ||
          tId.includes('admin')
        ) {
          return;
        }
      } else {
        const cName = (b.clientName || '').toLowerCase().trim();
        if (cName.includes('admin') || cName.includes('test admin')) {
          return;
        }
      }

      const personKey = isTrainer 
        ? getClientKey(b.clientId, b.clientName) 
        : getCoachKey(b.trainerId, b.trainerName);

      if (!personMap.has(personKey)) {
        personMap.set(personKey, []);
      }
      personMap.get(personKey)!.push(b);
    });

    const coachChats: ChatItem[] = [];

    const statusPriority: Record<string, number> = {
      upcoming: 4,
      confirmed: 3,
      completed: 2,
      cancelled: 1,
    };

    personMap.forEach((personBookings, personKey) => {
      // Sort bookings for this person: upcoming/active first, then by date/time descending
      const sortedBookings = [...personBookings].sort((a, b) => {
        const priorityA = statusPriority[a.status] ?? 0;
        const priorityB = statusPriority[b.status] ?? 0;
        if (priorityA !== priorityB) {
          return priorityB - priorityA;
        }
        const timeA = new Date(a.date ? `${a.date}T${a.time || '00:00'}` : 0).getTime() || 0;
        const timeB = new Date(b.date ? `${b.date}T${b.time || '00:00'}` : 0).getTime() || 0;
        return timeB - timeA;
      });

      const primaryBooking = sortedBookings[0];
      const rawName = isTrainer 
        ? (primaryBooking.clientName || 'Client') 
        : (primaryBooking.trainerName || 'Virla Partner');
      const personName = isTrainer
        ? rawName
        : (rawName.toLowerCase().startsWith('coach') ? rawName : `Coach ${rawName}`);

      let lastMsg = "Your session line is ready. Feel free to coordinate logistics.";
      let lastTime = '';
      const targetBookingId = primaryBooking.id;

      // Query all messages across all sessions and unified thread with this person
      const unifiedChatId = isTrainer ? `chat-client-${personKey}` : `chat-coach-${personKey}`;
      const relatedIds = [unifiedChatId, ...sortedBookings.map((b) => b.id)];
      const allMsgs = Database.getUnifiedChatMessages(relatedIds);

      if (allMsgs.length > 0) {
        const last = allMsgs[allMsgs.length - 1];
        lastMsg = last.text;
        try {
          const d = new Date(last.timestamp);
          if (!isNaN(d.getTime())) {
            lastTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } else {
            lastTime = last.timestamp;
          }
        } catch {}
      }

      const hasUnread = sortedBookings.some((b) => b.status === 'upcoming') && allMsgs.length > 0;
      // ponytail: green dot only when this person's session is actually live, not merely upcoming.
      const isOnline = primaryBooking.status === 'upcoming' && getMinutesToSession(primaryBooking) <= 60;

      coachChats.push({
        id: `person-${personKey}`,
        bookingId: targetBookingId,
        name: personName,
        subtitle: `${primaryBooking.workoutTitle || 'Fitness Training'} • ${primaryBooking.sessionType === 'COUPLE' ? 'Couple' : 'Solo'}`,
        avatar: isTrainer 
          ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'
          : (primaryBooking.trainerPhoto || 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=200&q=80'),
        lastMessage: lastMsg,
        time: lastTime,
        unread: hasUnread,
        isOnline,
        type: 'coach',
      });
    });

    list.push(...coachChats);

    // Fallback coach chats ONLY if no active coach bookings exist at all
    if (coachChats.length === 0) {
      list.push(
        {
          id: 'mock-1',
          name: 'Coach Karan Sharma',
          subtitle: 'Strength & Conditioning Master',
          avatar: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=200&q=80',
          lastMessage: "I'll be bringing the resistance bands today. See you at 10 AM!",
          time: '',
          unread: true,
          isOnline: false,
          type: 'coach',
        },
        {
          id: 'mock-2',
          name: 'Coach Priya Patel',
          subtitle: 'Holistic Yoga & Mobility Coach',
          avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
          lastMessage: 'Great job during yesterday yoga session! Take plenty of fluids.',
          time: '',
          unread: false,
          isOnline: false,
          type: 'coach',
        }
      );
    }

    return list;
  }, [bookings, role]);

  // Search logic
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chatsList;
    const q = searchQuery.toLowerCase().trim();
    return chatsList.filter((chat) => {
      return (
        chat.name.toLowerCase().includes(q) ||
        chat.lastMessage.toLowerCase().includes(q) ||
        (chat.subtitle && chat.subtitle.toLowerCase().includes(q))
      );
    });
  }, [chatsList, searchQuery]);

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
      {/* Top Header */}
      <View className="px-6 pt-3 pb-3 flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-zinc-400 text-xs font-black uppercase tracking-wider">
            Direct Line
          </Text>
          <Text className="text-zinc-950 text-2xl font-black tracking-tight mt-0.5">
            Messages & Logs
          </Text>
        </View>

        {/* Live Support Indicator — only when a session is actually live */}
        {chatsList.some((c) => c.isOnline) && (
          <View className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-150">
            <View className="w-2 h-2 rounded-full bg-emerald-500" />
            <Text className="text-emerald-700 text-xs font-extrabold uppercase">Live Line</Text>
          </View>
        )}
      </View>

      {/* Search Input Bar */}
      <View className="px-6 pt-1 pb-3">
        <View className="flex-row items-center bg-zinc-100/90 border border-zinc-200/70 px-4 py-2.5 rounded-2xl">
          <Feather name="search" size={16} color="#9CA3AF" />
          <TextInput
            placeholder="Search coaches, chats, workouts..."
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

      {/* Chats List - Clean borderless stream */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 120, flexGrow: 1 }}
      >
        {filteredChats.length > 0 ? (
          <View className="gap-2">
            {filteredChats.map((chat) => (
              <TouchableOpacity
                key={chat.id}
                activeOpacity={0.7}
                onPress={() => router.push({
                  pathname: '/communication' as any,
                  params: { id: chat.bookingId || chat.id, name: chat.name }
                })}
                className="py-3.5 px-3 rounded-2xl flex-row items-center gap-3.5 active:bg-zinc-50"
              >
                {/* Avatar with Online indicator */}
                <View className="relative">
                  <Image
                    source={{ uri: chat.avatar }}
                    className="w-13 h-13 rounded-2xl bg-zinc-100 border border-zinc-200"
                    style={{ width: 52, height: 52, borderRadius: 18 }}
                  />
                  {chat.isOnline && (
                    <View className="absolute right-0 bottom-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                  )}
                </View>

                {/* Chat Details */}
                <View className="flex-1">
                  <View className="flex-row items-center justify-between mb-0.5">
                    <Text 
                      numberOfLines={1} 
                      className={`text-base tracking-tight flex-1 pr-2 ${
                        chat.unread ? 'font-black text-zinc-950' : 'font-bold text-zinc-900'
                      }`}
                    >
                      {chat.name}
                    </Text>
                    <Text className="text-xs font-semibold text-zinc-400">
                      {chat.time}
                    </Text>
                  </View>

                  {chat.subtitle && (
                    <Text numberOfLines={1} className="text-xs font-semibold text-zinc-400 mb-1">
                      {chat.subtitle}
                    </Text>
                  )}

                  <View className="flex-row items-center justify-between">
                    <Text
                      numberOfLines={1}
                      className={`text-sm flex-1 pr-2 ${
                        chat.unread ? 'font-bold text-zinc-900' : 'text-zinc-500 font-normal'
                      }`}
                    >
                      {chat.lastMessage}
                    </Text>
                    {chat.unread && (
                      <View className="w-2.5 h-2.5 rounded-full bg-[#E11D48]" />
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View className="flex-1 justify-center items-center py-16">
            <EmptyState
              type="no-messages"
              showCard={false}
              message="No conversations found matching your search. Your chats with assigned coaches and concierge will appear here."
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
