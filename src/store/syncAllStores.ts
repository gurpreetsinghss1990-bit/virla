import { useUserProfileStore } from './userProfileStore';
import { useBookingStore } from './bookingStore';
import { useCoachStore } from './coachStore';
import { useWorkoutStore } from './workoutStore';
import { useWalletStore } from './walletStore';
import { useMembershipStore } from './membershipStore';
import { useNotificationStore } from './notificationStore';
import { useAIStore } from './aiStore';
import { useAddressStore } from './addressStore';

/**
 * Centrally synchronizes all domain stores from the local database cache.
 * Kept separate from userStore to prevent circular require cycles.
 */
export function syncAllDomainStores(): void {
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
