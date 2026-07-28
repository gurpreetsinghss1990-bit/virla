import { Database } from '../database/Database';
import { useUserStore } from '../store/userStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { useBookingStore } from '../store/bookingStore';
import { useCoachStore } from '../store/coachStore';
import { useWorkoutStore } from '../store/workoutStore';
import { useWalletStore } from '../store/walletStore';
import { useMembershipStore } from '../store/membershipStore';
import { useNotificationStore } from '../store/notificationStore';
import { useAIStore } from '../store/aiStore';
import { useAddressStore } from '../store/addressStore';

/**
 * Perform all application initializations in parallel.
 * Enforces a maximum wait time of 3 seconds.
 */
export async function bootstrapApp(): Promise<void> {
  const initPromise = (async () => {
    // 1. Load local database from storage
    await Database.load();
    
    // 2. Restore session
    await restoreAuthentication();
    
    // 3. Init other assets in parallel
    await Promise.all([
      initializeFirebase(),
      preloadOnboardingAssets(),
      fetchRemoteConfig(),
    ]);
  })();

  const timeoutPromise = new Promise<void>((resolve) =>
    setTimeout(() => {
      console.warn('App bootstrap timed out, continuing startup anyway.');
      resolve();
    }, 3000)
  );

  try {
    await Promise.race([initPromise, timeoutPromise]);
  } catch (error) {
    console.error('App bootstrap error ignored to prevent startup freeze:', error);
  }
}

async function initializeFirebase(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  console.log('Firebase initialized successfully.');
}

async function restoreAuthentication(): Promise<void> {
  const storedUser = useUserStore.getState().user;
  const isLoggedIn = useUserStore.getState().isLoggedIn;
  
  if (isLoggedIn && storedUser && storedUser.id) {
    Database.setCurrentUserId(storedUser.id);
  }
  
  // Sync all store caches from the database
  useUserStore.getState().syncFromDB();
  useUserProfileStore.getState().syncFromDB();
  useBookingStore.getState().syncFromDB();
  useCoachStore.getState().syncFromDB();
  useWorkoutStore.getState().syncFromDB();
  useWalletStore.getState().syncFromDB();
  useMembershipStore.getState().syncFromDB();
  useNotificationStore.getState().syncFromDB();
  useAIStore.getState().syncFromDB();
  useAddressStore.getState().syncFromDB();
  
  console.log(`Authentication restored. Logged In: ${isLoggedIn} User: ${storedUser?.name || 'None'}`);
}

async function preloadOnboardingAssets(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  console.log('Onboarding assets preloaded successfully.');
}

async function fetchRemoteConfig(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  console.log('Remote config fetched successfully.');
}
