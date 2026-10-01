import { create } from 'zustand';

interface TabHistoryState {
  history: string[]; // e.g. ['index', 'progress', 'profile']
  pushTab: (tabName: string) => void;
  popTab: () => string | null;
  resetToTab: (tabName: string) => void;
}

export const useTabHistoryStore = create<TabHistoryState>((set, get) => ({
  history: ['index'],

  pushTab: (tabName: string) => {
    const current = get().history;
    const last = current[current.length - 1];
    if (last === tabName) return;

    // Filter out previous occurrences to avoid deep circular back-loops,
    // or keep a clean history stack where navigating back moves in reverse order
    const filtered = current.filter((t) => t !== tabName);
    set({ history: [...filtered, tabName] });
  },

  popTab: () => {
    const current = get().history;
    if (current.length <= 1) {
      return null;
    }
    const newHistory = [...current];
    newHistory.pop(); // Remove active tab
    const previousTab = newHistory[newHistory.length - 1];
    set({ history: newHistory });
    return previousTab;
  },

  resetToTab: (tabName: string) => {
    set({ history: [tabName] });
  },
}));
