import { create } from 'zustand';

export interface ToastData {
  id: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'booking';
  deepLink?: string;
  duration?: number;
}

interface ToastState {
  currentToast: ToastData | null;
  showToast: (toast: Omit<ToastData, 'id'>) => void;
  hideToast: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  currentToast: null,
  showToast: (toast) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    set({
      currentToast: {
        ...toast,
        id,
        duration: toast.duration ?? 4000,
      },
    });
  },
  hideToast: () => {
    set({ currentToast: null });
  },
}));
