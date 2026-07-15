import { create } from 'zustand';
import { NotificationItem } from '../types';

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  markAllAsRead: () => void;
  addNotification: (notification: Omit<NotificationItem, 'id' | 'read' | 'timestamp'>) => void;
}

const mockNotifications: NotificationItem[] = [
  {
    id: 'n-1',
    title: 'Welcome to VIRLA',
    body: "You're now a member! Explore our workouts and book sessions at home.",
    read: false,
    timestamp: '2 hours ago',
  },
  {
    id: 'n-2',
    title: 'Upcoming Session Reminder',
    body: 'Karan Sharma is booked for Strength Training on Jul 20, 2026.',
    read: false,
    timestamp: '1 day ago',
  },
];

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: mockNotifications,
  unreadCount: mockNotifications.filter((n) => !n.read).length,
  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),
  addNotification: (n) =>
    set((state) => {
      const newNotification: NotificationItem = {
        ...n,
        id: `n-${Date.now()}`,
        read: false,
        timestamp: 'Just now',
      };
      const updated = [newNotification, ...state.notifications];
      return {
        notifications: updated,
        unreadCount: updated.filter((item) => !item.read).length,
      };
    }),
}));
