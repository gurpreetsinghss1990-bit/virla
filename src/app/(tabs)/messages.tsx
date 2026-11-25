import React, { useState, useMemo, useCallback } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBookingStore } from '../../store/bookingStore';
import { useUserStore } from '../../store/userStore';
import { useChatStore } from '../../store/chatStore';
import { Database } from '../../database/Database';
import { getBookingISTDateRange } from '../../utils/date';
import { ClientMessagesView } from '../../components/ClientMessagesView';
import { ChatItem } from '../../components/messages';

let useMaterialColorsSafe: any = null;
if (Platform.OS === 'android') {
  try {
    const compose = require('@expo/ui/jetpack-compose');
    useMaterialColorsSafe = compose.useMaterialColors;
  } catch {}
}

export default function MessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bookings } = useBookingStore();
  const { role } = useUserStore();
  const [searchQuery, setSearchQuery] = useState('');

  let materialColors: any = null;
  if (useMaterialColorsSafe) {
    try {
      materialColors = useMaterialColorsSafe();
    } catch {}
  }
  const backgroundColor = materialColors?.background || '#FFFFFF';

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
    const isTrainer = role === 'trainer';

    // Dedicated Concierge Support Line (only for users, not trainers)
    if (!isTrainer) {
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
    }

    // Group bookings by person so each coach/client appears exactly once
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

      // Query messages strictly for THIS specific session booking (never pulling old chats from previous sessions with the same trainer)
      const sId = (primaryBooking.id || 'session').trim().replace(/[^a-zA-Z0-9_.-]/g, '_');
      const cId = (primaryBooking.clientId || 'client').trim().replace(/[^a-zA-Z0-9_.-]/g, '_');
      const tId = (primaryBooking.trainerId || primaryBooking.trainerName || 'coach').trim().replace(/[^a-zA-Z0-9_.-]/g, '_');
      const symmetricChatId = `chat_${sId}_${cId}_${tId}`;
      const sUnderscore = (primaryBooking.id || 'session').toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
      const cUnderscore = (primaryBooking.clientId || 'client').toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
      const tUnderscore = (primaryBooking.trainerId || primaryBooking.trainerName || 'coach').toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
      const relatedIds = Array.from(new Set([
        symmetricChatId,
        primaryBooking.id,
        `chat_${sId}_${cUnderscore}_${tUnderscore}`,
        `chat_${sUnderscore}_${cUnderscore}_${tUnderscore}`,
      ].filter(Boolean)));
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

      const chatStore = useChatStore.getState();
      const hasUnread = chatStore.hasUnreadForKeys(relatedIds, allMsgs, role);
      // ponytail: green dot only when this person's session is actually live, not merely upcoming.
      const isOnline = primaryBooking.status === 'upcoming' && getMinutesToSession(primaryBooking) <= 60;

      coachChats.push({
        id: `person-${personKey}`,
        bookingId: targetBookingId,
        name: personName,
        subtitle: `${primaryBooking.workoutTitle || 'Fitness Training'} • ${primaryBooking.sessionType === 'COUPLE' ? 'Couple' : 'Solo'}`,
        avatar: primaryBooking.trainerPhoto || '',
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
      const isMock1Read = useChatStore.getState().isMessageRead('mock-1', ['mock-1', 'chat-c-1']);
      list.push(
        {
          id: 'mock-1',
          name: 'Coach Karan Sharma',
          subtitle: 'Strength & Conditioning Master',
          avatar: '',
          lastMessage: "I'll be bringing the resistance bands today. See you at 10 AM!",
          time: '',
          unread: !isMock1Read,
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

  const handleChatPress = useCallback((chat: ChatItem) => {
    if (chat.type === 'concierge') {
      router.push({
        pathname: '/(tabs)/bookings' as any,
        params: { filter: 'completed' }
      });
      return;
    }
    const targetId = chat.bookingId || chat.id;
    useChatStore.getState().markAsRead([targetId, chat.id]);
    router.push({
      pathname: '/communication' as any,
      params: { id: targetId, name: chat.name }
    });
  }, [router]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  return (
    <ClientMessagesView
      backgroundColor={backgroundColor}
      insetsTop={insets.top}
      hasOnlineChats={chatsList.some((c) => c.isOnline)}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onClearSearch={handleClearSearch}
      filteredChats={filteredChats}
      onChatPress={handleChatPress}
    />
  );
}
