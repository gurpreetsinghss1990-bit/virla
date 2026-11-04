import { create } from 'zustand';

export interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface CustomAlertData {
  id: string;
  title?: string;
  message?: string;
  buttons?: AlertButton[];
  cancelable?: boolean;
}

interface CustomAlertState {
  currentAlert: CustomAlertData | null;
  showAlert: (data: Omit<CustomAlertData, 'id'>) => void;
  hideAlert: () => void;
}

export const useCustomAlertStore = create<CustomAlertState>((set) => ({
  currentAlert: null,
  showAlert: (data) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    set({
      currentAlert: {
        ...data,
        id,
      },
    });
  },
  hideAlert: () => {
    set({ currentAlert: null });
  },
}));

