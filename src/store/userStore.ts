import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Invoice } from '../types';
import { Database } from '../database/Database';
import { useUserProfileStore } from './userProfileStore';
import { useBookingStore } from './bookingStore';
import { useCoachStore } from './coachStore';
import { useWorkoutStore } from './workoutStore';
import { useWalletStore } from './walletStore';
import { useMembershipStore } from './membershipStore';
import { useNotificationStore } from './notificationStore';
import { useAIStore } from './aiStore';
import { useAddressStore } from './addressStore';
import { PushNotificationService } from '../services/PushNotificationService';

let SecureStore: any = null;
try {
  SecureStore = require('expo-secure-store');
} catch (e) {
  // Gracefully catch missing native modules or build errors in dev-client
}

const isSecureStoreSupported = async (): Promise<boolean> => {
  try {
    if (!SecureStore || typeof SecureStore.isAvailableAsync !== 'function') {
      return false;
    }
    return await SecureStore.isAvailableAsync();
  } catch (e) {
    return false;
  }
};

const secureStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const supported = await isSecureStoreSupported();
      if (supported) {
        return (await SecureStore.getItemAsync(name)) || null;
      }
    } catch (e) {
      console.warn('[secureStorage] SecureStore retrieve error, falling back to AsyncStorage:', e);
    }
    return (await AsyncStorage.getItem(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      const supported = await isSecureStoreSupported();
      if (supported) {
        await SecureStore.setItemAsync(name, value);
        return;
      }
    } catch (e) {
      console.warn('[secureStorage] SecureStore write error, falling back to AsyncStorage:', e);
    }
    await AsyncStorage.setItem(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      const supported = await isSecureStoreSupported();
      if (supported) {
        await SecureStore.deleteItemAsync(name);
        return;
      }
    } catch (e) {
      console.warn('[secureStorage] SecureStore remove error, falling back to AsyncStorage:', e);
    }
    await AsyncStorage.removeItem(name);
  },
};

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
  setLoggedIn: (loggedIn: boolean) => void | Promise<void>;
  setCompletedOnboarding: (completed: boolean) => void;
  // Sprint 6 additions
  role: 'customer' | 'trainer' | 'admin';
  setRole: (role: 'customer' | 'trainer' | 'admin') => void;
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
            Database.updateUser(updatedUser.id, {
              name: updatedUser.name,
              email: updatedUser.email,
              avatar: updatedUser.avatar,
            });
          return { user: updatedUser };
        }),
      isLoggedIn: false,
      hasCompletedOnboarding: false,
      setLoggedIn: async (loggedIn) => {
        if (loggedIn) {
          set({ isLoggedIn: loggedIn });
          try {
            await Database.reload();
          } catch (e) {
            console.error('Failed to reload database collections on login:', e);
          }
          get().syncFromDB();
          
          // Sync push token with backend after user is populated
          const userId = Database.getCurrentUserId();
          if (userId) {
            PushNotificationService.syncTokenWithBackend(userId).then();
          }

          useUserProfileStore.getState().syncFromDB();
          useBookingStore.getState().syncFromDB();
          useCoachStore.getState().syncFromDB();
          useWorkoutStore.getState().syncFromDB();
          useWalletStore.getState().syncFromDB();
          useMembershipStore.getState().syncFromDB();
          useNotificationStore.getState().syncFromDB();
          useAIStore.getState().syncFromDB();
          useAddressStore.getState().syncFromDB();
        } else {
          // Remove push token on logout before local data wipes
          const userId = Database.getCurrentUserId();
          if (userId) {
            await PushNotificationService.removeTokenFromBackend(userId).catch(console.error);
          }
          
          set({ isLoggedIn: loggedIn });
          set({ user: emptyUser, familyMembers: [], invoices: [] });
          try {
            await Database.resetAndClearLocalOnly();
          } catch (e) {
            console.error('Failed to clear local caches on logout:', e);
          }
          useUserProfileStore.getState().syncFromDB();
          useBookingStore.getState().syncFromDB();
          useCoachStore.getState().syncFromDB();
          useWorkoutStore.getState().syncFromDB();
          useWalletStore.getState().syncFromDB();
          useMembershipStore.getState().syncFromDB();
          useNotificationStore.getState().syncFromDB();
          useAIStore.getState().syncFromDB();
          useAddressStore.getState().syncFromDB();
        }
      },
      setCompletedOnboarding: (completed) => set({ hasCompletedOnboarding: completed }),
      role: 'customer',
      setRole: (r) => set((state) => {
        let canonicalRole = r;

        // Guard: block unapproved customer promoting to trainer
        if (r === 'trainer') {
          let isApproved = state.user.role === 'trainer';
          if (!isApproved) {
            const coachRecord = Database.schema.coaches.find(c => c.id === state.user.id || c.name === state.user.name);
            if (coachRecord) {
              isApproved = true;
            } else {
              const userPhone = Database.schema.users.find(u => u.id === state.user.id)?.phone;
              const application = Database.schema.trainer_applications.find(a => (a.userId === state.user.id || (userPhone && a.phone === userPhone)) && a.status === 'approved');
              if (application) {
                isApproved = true;
              }
            }
          }
          if (!isApproved) {
            console.warn('[SECURITY] Denied self-promotion to trainer role.');
            canonicalRole = 'customer';
          }
        }

        // Guard: approved trainers must remain trainers
        if (state.user.role === 'trainer') {
          canonicalRole = 'trainer';
        }

        const updatedUser = { ...state.user, role: canonicalRole };
        if (updatedUser.id) {
          Database.updateUser(updatedUser.id, { role: canonicalRole });
        }
        return {
          role: canonicalRole,
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
          if (!Database.getIsLoaded()) {
            console.warn('[UserStore] syncFromDB called before database finished loading. Skipping sync.');
            return;
          }
          const profile = Database.getProfile(userId);
          const userDb = Database.schema.users.find(u => u.id === userId);
          
          if (userDb) {
            // Detect if approved trainer status exists
            let isApprovedTrainer = userDb.role === 'trainer';
            if (!isApprovedTrainer) {
              const coachRecord = Database.schema.coaches.find(c => c.id === userId || c.name === userDb.name);
              if (coachRecord) {
                isApprovedTrainer = true;
              } else {
                const application = Database.schema.trainer_applications.find(a => (a.userId === userId || a.phone === userDb.phone) && a.status === 'approved');
                if (application) {
                  isApprovedTrainer = true;
                }
              }
            }

            // Sync user role in database if not set
            if (isApprovedTrainer && userDb.role !== 'trainer') {
              userDb.role = 'trainer';
              Database.updateUser(userId, { role: 'trainer' });
              console.log(`[SYNC] Synchronized trainer role for user ID ${userId} in database.`);
            }

            const activeRole = isApprovedTrainer ? 'trainer' : userDb.role;

            const userObj: User = {
              id: userDb.id,
              name: userDb.name,
              email: userDb.email,
              avatar: userDb.avatar,
              location: 'Mumbai, India',
              role: activeRole,
              registrationStatus: userDb.registrationStatus || 'PROFILE_NAME_PENDING',
            };

            const dbInvoices = Database.getLedgerTransactions(userId);
            const emergencyObj = profile?.emergencyContact ? JSON.parse(profile.emergencyContact) : null;
            const familiesList: FamilyMember[] = emergencyObj 
              ? [{ id: 'fm-1', name: emergencyObj.name, relation: emergencyObj.relationship }]
              : [];

            set({
              user: userObj,
              role: activeRole,
              invoices: dbInvoices,
              familyMembers: familiesList
            });
          }
        }
      }
    }),
    {
      name: 'virla-user-storage',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
