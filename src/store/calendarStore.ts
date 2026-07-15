import { create } from 'zustand';

interface CalendarState {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  getAvailableDates: () => string[];
}

export const useCalendarStore = create<CalendarState>((set) => ({
  selectedDate: '',
  setSelectedDate: (date) => set({ selectedDate: date }),
  getAvailableDates: () => {
    const dates: string[] = [];
    const today = new Date();
    
    // Generate next 30 days
    for (let i = 0; i < 30; i++) {
      const nextDate = new Date(today);
      nextDate.setDate(today.getDate() + i);
      
      const dayOfWeek = nextDate.getDay();
      // Skip weekends (Saturday=6, Sunday=0) for available highlight
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const formatted = nextDate.toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
        });
        dates.push(formatted);
      }
    }
    return dates;
  },
}));
