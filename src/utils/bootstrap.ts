import { useUserStore } from '../store/userStore';

/**
 * Perform all application initializations in parallel.
 * Enforces a maximum wait time of 3 seconds.
 */
export async function bootstrapApp(): Promise<void> {
  const initPromise = Promise.all([
    initializeFirebase(),
    restoreAuthentication(),
    preloadOnboardingAssets(),
    fetchRemoteConfig(),
  ]);

  const timeoutPromise = new Promise<void>((resolve) =>
    setTimeout(() => {
      console.warn('App bootstrap timed out, continuing startup anyway.');
      resolve();
    }, 3000)
  );

  try {
    // Race our bootstrap promises against a 3-second maximum wait time
    await Promise.race([initPromise, timeoutPromise]);
  } catch (error) {
    console.error('App bootstrap error ignored to prevent startup freeze:', error);
  }
}

async function initializeFirebase(): Promise<void> {
  // Simulate Firebase initialization
  await new Promise((resolve) => setTimeout(resolve, 300));
  console.log('Firebase initialized successfully.');
}

async function restoreAuthentication(): Promise<void> {
  // Check store state (already hydrated by Zustand persist middleware)
  const isLoggedIn = useUserStore.getState().isLoggedIn;
  console.log(`Authentication restored. Logged In: ${isLoggedIn}`);
}

async function preloadOnboardingAssets(): Promise<void> {
  // Simulate asset preloading (fonts, icons, image placeholders)
  await new Promise((resolve) => setTimeout(resolve, 400));
  console.log('Onboarding assets preloaded successfully.');
}

async function fetchRemoteConfig(): Promise<void> {
  // Simulate fetching Remote Config
  await new Promise((resolve) => setTimeout(resolve, 200));
  console.log('Remote config fetched successfully.');
}
