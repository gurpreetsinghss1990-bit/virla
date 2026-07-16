import { create } from 'zustand';
import { NotificationItem } from '../types';

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  addNotification: (notification: Omit<NotificationItem, 'id' | 'read' | 'timestamp' | 'group'>) => void;
}

const mockNotifications: NotificationItem[] = [
  {
    id: 'n-1',
    title: 'Trainer Assigned',
    body: 'Coach Karan Sharma has been assigned to your Strength session.',
    read: false,
    timestamp: 'Just now',
    group: 'today',
    icon: 'user-check'
  },
  {
    id: 'n-2',
    title: 'OTP Code Ready',
    body: 'Secure entry code 5829 is active for check-in validation.',
    read: false,
    timestamp: '15 mins ago',
    group: 'today',
    icon: 'lock'
  },
  {
    id: 'n-3',
    title: 'Refund Issued ↩️',
    body: '1 Credit successfully refunded for your cancelled yoga session.',
    read: true,
    timestamp: '1 day ago',
    group: 'yesterday',
    icon: 'rotate-ccw'
  },
  {
    id: 'n-4',
    title: 'Wallet Credited',
    body: 'Elite Master Pack purchase receipt logged. +12 credits added.',
    read: true,
    timestamp: '1 day ago',
    group: 'yesterday',
    icon: 'plus-circle'
  },
  {
    id: 'n-5',
    title: 'Membership Activated',
    body: 'Welcome to VIRLA Fit! Annual Elite Member plan is now active.',
    read: true,
    timestamp: '3 days ago',
    group: 'earlier',
    icon: 'shopping-bag'
  },
  {
    id: 'n-6',
    title: 'Promotion Achieved 🏆',
    body: 'Karan Sharma completed Associate targets. Qualified forCertified review.',
    read: true,
    timestamp: '5 days ago',
    group: 'earlier',
    icon: 'award'
  }
];

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: mockNotifications,
  unreadCount: mockNotifications.filter((n) => !n.read).length,
  markAsRead: (id) =>
    set((state) => {
      const updated = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read).length,
      };
    }),
  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),
  clearAll: () =>
    set({
      notifications: [],
      unreadCount: 0,
    }),
  addNotification: (n) =>
    set((state) => {
      const newNotification: NotificationItem = {
        ...n,
        id: `n-${Date.now()}`,
        read: false,
        timestamp: 'Just now',
        group: 'today',
      };
      const updated = [newNotification, ...state.notifications];
      return {
        notifications: updated,
        unreadCount: updated.filter((item) => !item.read).length,
      };
    }),
}));
