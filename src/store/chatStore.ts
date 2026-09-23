import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotificationStore } from './notificationStore';

interface ChatStoreState {
  version: number;
  readTimestamps: Record<string, number>;
  readMessageIds: Record<string, boolean>;
  readSessionIds: Record<string, number>; // Maps bookingId -> epoch ms when session was read

  markSessionAsRead: (bookingId: string, threadKeys?: string[], messageIds?: string[]) => void;
  markAsRead: (threadKeys: string | string[], messageIds?: string[]) => void;
  isMessageRead: (messageId: string, threadKeys?: string[], messageTimestamp?: string | number) => boolean;
  hasUnreadForKeys: (
    threadKeys: string[],
    messages: Array<{ id: string; sender: string; timestamp?: string }>,
    currentRole: 'customer' | 'trainer' | 'admin',
    bookingId?: string
  ) => boolean;
  clearAllReadState: () => void;
}

export const useChatStore = create<ChatStoreState>()(
  persist(
    (set, get) => ({
      version: 0,
      readTimestamps: {},
      readMessageIds: {},
      readSessionIds: {},

      markSessionAsRead: (bookingId, threadKeys = [], messageIds = []) => {
        if (!bookingId && (!threadKeys || threadKeys.length === 0)) return;
        const now = Date.now();
        const allKeys = Array.from(new Set([bookingId, ...(threadKeys || [])].filter(Boolean) as string[]));

        set((state) => {
          const updatedTimestamps = { ...state.readTimestamps };
          allKeys.forEach((k) => {
            updatedTimestamps[k] = now;
          });

          const updatedSessionIds = { ...state.readSessionIds };
          if (bookingId) {
            updatedSessionIds[bookingId] = now;
          }

          const updatedMessageIds = { ...state.readMessageIds };
          (messageIds || []).forEach((id) => {
            if (id) updatedMessageIds[id] = true;
          });

          return {
            version: state.version + 1,
            readTimestamps: updatedTimestamps,
            readSessionIds: updatedSessionIds,
            readMessageIds: updatedMessageIds,
          };
        });

        // Mark any matching notifications as read
        try {
          const notifStore = useNotificationStore.getState();
          const unreadNotifs = notifStore.notifications.filter((n) => !n.read);
          unreadNotifs.forEach((n) => {
            const isMatch = allKeys.some((k) => {
              const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              const titleClean = (n.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              const bodyClean = (n.body || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              return (
                titleClean.includes(cleanK) ||
                bodyClean.includes(cleanK) ||
                (n.deepLink && n.deepLink.includes(k)) ||
                (cleanK.includes('coach') && (titleClean.includes('coach') || bodyClean.includes('coach'))) ||
                (cleanK.includes('session') && (titleClean.includes('session') || bodyClean.includes('session')))
              );
            });
            if (isMatch) {
              notifStore.markAsRead(n.id);
            }
          });
        } catch (e) {
          console.warn('[useChatStore] Error marking notifications as read:', e);
        }
      },

      markAsRead: (threadKeys, messageIds = []) => {
        const keys = (Array.isArray(threadKeys) ? threadKeys : [threadKeys]).filter(Boolean) as string[];
        const primaryId = keys[0] || '';
        get().markSessionAsRead(primaryId, keys, messageIds);
      },

      isMessageRead: (messageId, threadKeys = [], messageTimestamp) => {
        const { readMessageIds, readTimestamps } = get();
        if (readMessageIds[messageId]) {
          return true;
        }

        // Check timestamp against readTimestamps for any of the thread keys
        if (messageTimestamp) {
          const msgTime = new Date(messageTimestamp).getTime();
          if (!isNaN(msgTime) && msgTime > 0) {
            const isReadByTimestamp = threadKeys.some((k) => {
              const readAt = readTimestamps[k];
              return readAt && readAt >= msgTime;
            });
            if (isReadByTimestamp) return true;
          }
        }

        // If any of the associated thread keys has been marked as read, consider historical messages read
        const isThreadRead = threadKeys.some((k) => {
          const readAt = readTimestamps[k];
          return Boolean(readAt && readAt > 0);
        });

        return Boolean(isThreadRead);
      },

      hasUnreadForKeys: (threadKeys, messages, currentRole, bookingId) => {
        const { readSessionIds, isMessageRead } = get();

        // 1. If this session was explicitly marked as read
        if (bookingId && readSessionIds[bookingId] && readSessionIds[bookingId] > 0) {
          const sessionReadAt = readSessionIds[bookingId];
          // Check if any incoming message is NEWER than when the session was read
          const hasNewerIncomingMessage = messages.some((m) => {
            const isIncoming = currentRole === 'trainer'
              ? (m.sender === 'customer' || m.sender === 'user')
              : (m.sender === 'coach' || m.sender === 'trainer' || m.sender === 'virla');
            if (!isIncoming) return false;

            const msgTime = new Date(m.timestamp || '').getTime();
            if (!isNaN(msgTime) && msgTime > 0) {
              return msgTime > sessionReadAt;
            }
            // If timestamp cannot be parsed into epoch (like '10:05 AM'), check readMessageIds
            return !get().readMessageIds[m.id];
          });

          return hasNewerIncomingMessage;
        }

        // 2. Otherwise check each individual message
        return messages.some((m) => {
          const isIncoming = currentRole === 'trainer'
            ? (m.sender === 'customer' || m.sender === 'user')
            : (m.sender === 'coach' || m.sender === 'trainer' || m.sender === 'virla');
          if (!isIncoming) return false;

          return !isMessageRead(m.id, threadKeys, m.timestamp);
        });
      },

      clearAllReadState: () => {
        set((state) => ({
          version: state.version + 1,
          readTimestamps: {},
          readMessageIds: {},
          readSessionIds: {},
        }));
      },
    }),
    {
      name: 'virla-chat-read-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
