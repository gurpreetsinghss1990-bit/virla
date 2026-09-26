import { create } from 'zustand';
import { NotificationItem } from '../types';
import { Database } from '../database/Database';
import { useToastStore } from './toastStore';

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  addNotification: (notification: Omit<NotificationItem, 'id' | 'read' | 'timestamp' | 'group'>) => void;
  deleteNotification: (id: string) => void;
  syncFromDB: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  markAsRead: (id) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      Database.markNotificationAsRead(userId, id);
      get().syncFromDB();
    }
  },
  markAllAsRead: () => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      Database.markAllNotificationsRead(userId);
      get().syncFromDB();
    }
  },
  clearAll: () => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      Database.clearAllNotifications(userId);
      get().syncFromDB();
    }
  },
  addNotification: (n) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      Database.addNotification(userId, n);
      get().syncFromDB();

      // Trigger custom in-app Top Toast banner
      try {
        useToastStore.getState().showToast({
          title: n.title,
          message: n.body,
          deepLink: n.deepLink,
          type: (n.type?.toLowerCase().includes('booking') ? 'booking' : 'info') as any,
        });
      } catch (err) {
        console.warn('[NOTIFICATION STORE] Failed to trigger toast:', err);
      }
    }
  },
  deleteNotification: (id) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      Database.deleteNotification(userId, id);
      get().syncFromDB();
    }
  },
  syncFromDB: () => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      const list = Database.getNotifications(userId);
      set({
        notifications: list,
        unreadCount: list.filter((n) => !n.read).length
      });
    } else {
      set({
        notifications: [],
        unreadCount: 0
      });
    }
  }
}));
