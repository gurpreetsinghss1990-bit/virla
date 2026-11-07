import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Tracks whether the app is in the foreground so media can be paused the moment
 * the user leaves it, without waiting for the next render cycle.
 */
export function useIsAppActive(): boolean {
  const [isActive, setIsActive] = useState(() => AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      setIsActive(nextState === 'active');
    });
    return () => subscription.remove();
  }, []);

  return isActive;
}
