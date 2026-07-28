import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Invoice } from '../types';
import { Database } from '../database/Database';

interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  age?: number;
  gender?: string;
  notes?: string;
}

interface UserState {
  user: User;
  familyMembers: FamilyMember[];
  updateProfile: (profile: Partial<User>) => void;
  // Startup & Authentication states
  isLoggedIn: boolean;
  hasCompletedOnboarding: boolean;
  setLoggedIn: (loggedIn: boolean) => void;
  setCompletedOnboarding: (completed: boolean) => void;
  // Sprint 6 additions
  role: 'customer' | 'trainer';
  setRole: (role: 'customer' | 'trainer') => void;
  invoices: Invoice[];
  addInvoice: (invoice: Omit<Invoice, 'id' | 'date'>) => void;
  syncFromDB: () => void;
}

const emptyUser: User = {
  id: '',
  name: 'Guest User',
  email: '',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  location: 'Mumbai, India',
  role: 'customer',
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: emptyUser,
      familyMembers: [],
      updateProfile: (profile) =>
        set((state) => {
          const updatedUser = { ...state.user, ...profile };
          if (updatedUser.id) {
            Database.updateProfile(updatedUser.id, {
              name: updatedUser.name,
              email: updatedUser.email,
              avatar: updatedUser.avatar,
            } as any);
          }
          return { user: updatedUser };
        }),
      isLoggedIn: false,
      hasCompletedOnboarding: false,
      setLoggedIn: (loggedIn) => {
        set({ isLoggedIn: loggedIn });
        if (loggedIn) {
          get().syncFromDB();
        } else {
          set({ user: emptyUser, familyMembers: [], invoices: [] });
          Database.setCurrentUserId(null);
        }
      },
      setCompletedOnboarding: (completed) => set({ hasCompletedOnboarding: completed }),
      role: 'customer',
      setRole: (r) => set((state) => {
        const updatedUser = { ...state.user, role: r };
        if (updatedUser.id) {
          Database.updateProfile(updatedUser.id, { role: r } as any);
        }
        return {
          role: r,
          user: updatedUser
        };
      }),
      invoices: [],
      addInvoice: (inv) => set((state) => {
        const newInv: Invoice = {
          ...inv,
          id: `inv-${Date.now().toString().slice(-4)}`,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        };
        const userId = state.user.id;
        if (userId) {
          Database.addLedgerTransaction(userId, newInv);
        }
        return { invoices: [newInv, ...state.invoices] };
      }),
      syncFromDB: () => {
        const userId = Database.getCurrentUserId();
        if (userId) {
          const profile = Database.getProfile(userId);
          const userDb = Database.getWorkouts() // arbitrary call to database load assurance
            ? Database.schema.users.find(u => u.id === userId)
            : null;
          
          if (userDb) {
            const userObj: User = {
              id: userDb.id,
              name: userDb.name,
              email: userDb.email,
              avatar: userDb.avatar,
              location: 'Mumbai, India',
              role: userDb.role,
            };

            const dbInvoices = Database.getLedgerTransactions(userId);
            const emergencyObj = profile?.emergencyContact ? JSON.parse(profile.emergencyContact) : null;
            const familiesList: FamilyMember[] = emergencyObj 
              ? [{ id: 'fm-1', name: emergencyObj.name, relation: emergencyObj.relationship }]
              : [];

            set({
              user: userObj,
              role: userDb.role,
              invoices: dbInvoices,
              familyMembers: familiesList
            });
          }
        }
      }
    }),
    {
      name: 'virla-user-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
