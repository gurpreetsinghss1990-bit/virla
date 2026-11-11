import { create } from 'zustand';
import { AppState, Platform } from 'react-native';
import { NotificationItem } from '../types';
import { Database } from '../database/Database';
import { useToastStore } from './toastStore';
import { PushNotificationService, NOTIFICATION_CHANNELS } from '../services/PushNotificationService';

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  addNotification: (notification: Omit<NotificationItem, 'id' | 'read' | 'timestamp' | 'group'>) => void;
  deleteNotification: (id: string) => void;
  deleteNotifications: (ids: string[]) => void;
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
          deepLink: n.deepLink || '/notifications',
          type: (n.type?.toLowerCase().includes('booking') ? 'booking' : 'info') as any,
        });
      } catch (err) {
        console.warn('[NOTIFICATION STORE] Failed to trigger toast:', err);
      }

      // If user is not actively inside the app (background/inactive/locked), send OS Push Notification
      try {
        const isAppBackgrounded = (AppState.currentState ?? '').match(/inactive|background/);
        if (isAppBackgrounded && PushNotificationService.isNotificationsSupported()) {
          const Notifications = require('expo-notifications');
          Notifications.scheduleNotificationAsync({
            content: {
              title: 'VIRLA Notification',
              body: 'You have a 1 new notification in app',
              data: {
                deepLink: '/notifications',
                type: n.type || 'info',
              },
              sound: 'default',
            },
            trigger: null, // deliver immediately
          }).catch((pushErr: any) => {
            console.warn('[NOTIFICATION STORE] Background push notification trigger error:', pushErr);
          });
        }
      } catch (pushErr) {
        console.warn('[NOTIFICATION STORE] Push notification exception:', pushErr);
      }
    }
  },
  deleteNotification: (id) => {
    get().deleteNotifications([id]);
  },
  deleteNotifications: (ids) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    const remaining = get().notifications.filter((n) => !idSet.has(n.id));
    // Optimistic: the list updates even if the network call fails.
    set({ notifications: remaining, unreadCount: remaining.filter((n) => !n.read).length });

    const userId = Database.getCurrentUserId();
    if (userId) {
      Database.deleteNotifications(userId, ids);
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
