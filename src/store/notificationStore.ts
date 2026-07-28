import { create } from 'zustand';
import { NotificationItem } from '../types';
import { Database } from '../database/Database';

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  addNotification: (notification: Omit<NotificationItem, 'id' | 'read' | 'timestamp' | 'group'>) => void;
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
