import { Platform, AppState, AppStateStatus, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { supabase } from '../database/supabaseClient';

export const VIRLA_TRAINER_BG_LOCATION_TASK = 'VIRLA_TRAINER_BG_LOCATION_TASK';
const ACTIVE_BOOKING_STORAGE_KEY = '@virla_active_tracked_booking_id';

export interface LiveTrainerCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  updatedAt: string;
}

// Safely load expo-task-manager if native module is available in current binary
let TaskManager: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { requireOptionalNativeModule } = require('expo-modules-core');
  const hasNativeTaskManager = !!requireOptionalNativeModule('ExpoTaskManager');
  if (hasNativeTaskManager) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    TaskManager = require('expo-task-manager');
  }
} catch {
  TaskManager = null;
}

class LocationTrackerService {
  private activeSubscription: Location.LocationSubscription | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private backgroundIntervalFallback: any = null;
  private currentBookingId: string | null = null;
  private isStarting = false;
  private hasPromptedBackgroundPermission = false;
  private lastKnownCoords: Map<string, LiveTrainerCoordinates> = new Map();
  private localListeners: Map<string, Set<(coords: LiveTrainerCoordinates) => void>> = new Map();

  /**
   * Requests foreground permission first, then requests "Allow all the time" (background)
   * permission for the trainer so tracking continues when screen is locked or in Google Maps.
   */
  async ensureTrainerTravelPermissions(promptBackgroundIfNeeded = true): Promise<{
    foregroundGranted: boolean;
    backgroundGranted: boolean;
  }> {
    try {
      // 1. Foreground permission ("While using the app")
      let fg = await Location.getForegroundPermissionsAsync();
      if (fg.status !== 'granted') {
        fg = await Location.requestForegroundPermissionsAsync();
      }
      if (fg.status !== 'granted') {
        return { foregroundGranted: false, backgroundGranted: false };
      }

      if (Platform.OS === 'web') {
        return { foregroundGranted: true, backgroundGranted: false };
      }

      // 2. Background permission ("Allow all the time" / "Always Allow")
      let bg = await Location.getBackgroundPermissionsAsync();
      if (bg.status === 'granted') {
        return { foregroundGranted: true, backgroundGranted: true };
      }

      if (promptBackgroundIfNeeded && !this.hasPromptedBackgroundPermission) {
        this.hasPromptedBackgroundPermission = true;

        // Explain to trainer before opening OS "Allow all the time" permission prompt
        await new Promise<void>((resolve) => {
          Alert.alert(
            'Enable Live Travel Tracking 📍',
            Platform.OS === 'android'
              ? 'To share your live route with the client until you reach their location (even when your phone is locked or using Google Maps), please select "Allow all the time" on the next screen.\n\nTracking stops automatically as soon as you arrive.'
              : 'To share your live route with the client until you reach their location, please allow Background Location ("Always Allow").\n\nTracking stops automatically as soon as you arrive.',
            [
              {
                text: 'Continue',
                onPress: () => resolve(),
              },
            ],
            { cancelable: false }
          );
        });

        try {
          bg = await Location.requestBackgroundPermissionsAsync();
        } catch (bgErr) {
          console.warn('[LocationTracker] Background permission request warning:', bgErr);
        }
      }

      return {
        foregroundGranted: true,
        backgroundGranted: bg.status === 'granted',
      };
    } catch (err) {
      console.warn('[LocationTracker] Error requesting permissions:', err);
      return { foregroundGranted: false, backgroundGranted: false };
    }
  }

  /**
   * Starts tracking and publishing the trainer's live location for the active travel window.
   * Remains active across screens and in background until stopTracking() is called on arrival.
   */
  async startTracking(bookingId: string, promptBackground = false): Promise<boolean> {
    if (!bookingId) return false;

    // If already tracking this exact booking, just trigger an immediate location refresh
    if (this.currentBookingId === bookingId && (this.activeSubscription || this.isStarting)) {
      this.captureAndPublishImmediateFix(bookingId).catch(() => {});
      return true;
    }

    // If tracking a different booking, stop the old one first
    if (this.currentBookingId && this.currentBookingId !== bookingId) {
      await this.stopTracking();
    }

    this.isStarting = true;
    this.currentBookingId = bookingId;

    try {
      await AsyncStorage.setItem(ACTIVE_BOOKING_STORAGE_KEY, bookingId);
    } catch {}

    try {
      const perms = await this.ensureTrainerTravelPermissions(promptBackground);
      if (!perms.foregroundGranted) {
        console.warn('[LocationTracker] Foreground location permission denied.');
        this.isStarting = false;
        return false;
      }

      // 1. Immediately publish initial coordinate (0-second instant fix) so map never hangs
      await this.captureAndPublishImmediateFix(bookingId);

      // 2. Start high-accuracy foreground watcher (updates every ~4s or 5m movement)
      if (this.activeSubscription) {
        this.activeSubscription.remove();
        this.activeSubscription = null;
      }

      this.activeSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 4000,
          distanceInterval: 5,
        },
        async (location) => {
          if (this.currentBookingId === bookingId) {
            await this.publishLocation(bookingId, location.coords);
          }
        }
      );

      // 3. Start OS-level Background Location Updates (Android Foreground Service + iOS Background Indicator)
      if (Platform.OS !== 'web' && TaskManager) {
        try {
          const isRegistered = await Location.hasStartedLocationUpdatesAsync(VIRLA_TRAINER_BG_LOCATION_TASK);
          if (isRegistered) {
            await Location.stopLocationUpdatesAsync(VIRLA_TRAINER_BG_LOCATION_TASK);
          }

          await Location.startLocationUpdatesAsync(VIRLA_TRAINER_BG_LOCATION_TASK, {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 5000,
            distanceInterval: 8,
            showsBackgroundLocationIndicator: true,
            pausesUpdatesAutomatically: false,
            activityType: Location.ActivityType.AutomotiveNavigation,
            foregroundService: {
              notificationTitle: 'Virla • Active Travel to Client',
              notificationBody: 'Sharing your live route with your client until you reach the venue.',
              notificationColor: '#E11D48',
            },
          });
          console.log('[LocationTracker] Background location task started for booking:', bookingId);
        } catch (bgTaskErr) {
          console.warn('[LocationTracker] Native background task fallback to active watcher:', bgTaskErr);
        }
      }

      // 4. AppState listener + heartbeat timer so returning from background / Google Maps immediately refreshes
      if (this.appStateSubscription) {
        this.appStateSubscription.remove();
      }
      this.appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
        if (nextState === 'active' && this.currentBookingId === bookingId) {
          this.captureAndPublishImmediateFix(bookingId).catch(() => {});
        }
      });

      if (this.backgroundIntervalFallback) {
        clearInterval(this.backgroundIntervalFallback);
      }
      this.backgroundIntervalFallback = setInterval(() => {
        if (this.currentBookingId === bookingId) {
          this.captureAndPublishImmediateFix(bookingId).catch(() => {});
        }
      }, 8000);

      this.isStarting = false;
      return true;
    } catch (error) {
      console.error('[LocationTracker] Error starting tracking:', error);
      this.isStarting = false;
      return false;
    }
  }

  /**
   * Captures the fastest available GPS fix (lastKnown + currentPosition) and publishes it immediately.
   */
  async captureAndPublishImmediateFix(bookingId: string): Promise<LiveTrainerCoordinates | null> {
    try {
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown?.coords && this.currentBookingId === bookingId) {
        await this.publishLocation(bookingId, lastKnown.coords);
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      if (current?.coords && this.currentBookingId === bookingId) {
        return await this.publishLocation(bookingId, current.coords);
      }
      return this.lastKnownCoords.get(bookingId) || null;
    } catch (err) {
      console.warn('[LocationTracker] Immediate GPS fix warning:', err);
      return this.lastKnownCoords.get(bookingId) || null;
    }
  }

  /**
   * Publishes coordinates to local listeners and the trainer_travel_locations table in Supabase.
   */
  async publishLocation(
    bookingId: string,
    coords: {
      latitude: number;
      longitude: number;
      accuracy?: number | null;
      heading?: number | null;
      speed?: number | null;
    }
  ): Promise<LiveTrainerCoordinates> {
    const payloadData: LiveTrainerCoordinates = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy ?? 0,
      heading: coords.heading ?? null,
      speed: coords.speed ?? null,
      updatedAt: new Date().toISOString(),
    };

    this.lastKnownCoords.set(bookingId, payloadData);

    // 1. Instantly notify local memory listeners
    const listeners = this.localListeners.get(bookingId);
    if (listeners) {
      listeners.forEach((cb) => cb(payloadData));
    }

    // Guard: Verify if the booking is currently in active travelling status.
    // If not travelling, kill tracking and abort upsert to avoid RLS / background leaks.
    try {
      // Check Zustand bookingStore state first (instant in-memory check)
      const { useBookingStore } = require('../store/bookingStore');
      const booking = useBookingStore.getState().bookings.find((b: any) => b.id === bookingId);
      if (booking && booking.timelineStatus !== 'trainer_travelling') {
        console.log(`[LocationTracker] Booking ${bookingId} status is '${booking.timelineStatus}' (not 'trainer_travelling'). Halting location tracking.`);
        await this.stopTracking();
        return payloadData;
      }
    } catch {}

    // 2. Publish to Supabase for real-time client map updates
    try {
      const { error } = await supabase.from('trainer_travel_locations').upsert({
        booking_id: bookingId,
        latitude: payloadData.latitude,
        longitude: payloadData.longitude,
        accuracy: payloadData.accuracy,
        heading: payloadData.heading,
        speed: payloadData.speed,
        updated_at: payloadData.updatedAt,
      });

      if (error) {
        // If RLS blocked insert/update because booking is not active/trainer not matching, stop tracking immediately
        if (error.message?.includes('violates row-level security policy') || error.code === '42501') {
          console.warn('[LocationTracker] Supabase RLS restricted upsert (no active travel session). Stopping background tracking for:', bookingId);
          await this.stopTracking();
          return payloadData;
        }
        console.warn('[LocationTracker] Supabase upsert warning:', error.message);
      }
    } catch (e) {
      console.warn('[LocationTracker] Exception during location publish:', e);
    }

    return payloadData;
  }

  /**
   * Subscribes to realtime location updates for a specific booking (used by both Client and Trainer maps).
   * Uses Supabase Realtime + a 4s polling fallback so mobile network switches never freeze the map.
   */
  subscribeToLocation(
    bookingId: string,
    onUpdate: (data: LiveTrainerCoordinates) => void,
    onStaleOrDisconnect?: () => void
  ): () => void {
    // Register local memory listener
    if (!this.localListeners.has(bookingId)) {
      this.localListeners.set(bookingId, new Set());
    }
    this.localListeners.get(bookingId)!.add(onUpdate);

    // Immediately emit in-memory cached location if available
    const cached = this.lastKnownCoords.get(bookingId);
    if (cached) {
      onUpdate(cached);
    }

    const fetchLatestFromSupabase = async () => {
      try {
        const { data, error } = await supabase
          .from('trainer_travel_locations')
          .select('*')
          .eq('booking_id', bookingId)
          .maybeSingle();

        if (data && !error && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          const fresh: LiveTrainerCoordinates = {
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: data.accuracy ?? 0,
            heading: data.heading ?? null,
            speed: data.speed ?? null,
            updatedAt: data.updated_at || new Date().toISOString(),
          };
          this.lastKnownCoords.set(bookingId, fresh);
          onUpdate(fresh);
        }
      } catch {}
    };

    // 1. Initial fetch from DB
    fetchLatestFromSupabase();

    // 2. Realtime subscription on trainer_travel_locations
    const channel = supabase
      .channel(`location-changes:${bookingId}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trainer_travel_locations',
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            if (onStaleOrDisconnect) onStaleOrDisconnect();
          } else if (payload.new) {
            const row = payload.new as any;
            if (typeof row.latitude === 'number' && typeof row.longitude === 'number') {
              const updated: LiveTrainerCoordinates = {
                latitude: row.latitude,
                longitude: row.longitude,
                accuracy: row.accuracy ?? 0,
                heading: row.heading ?? null,
                speed: row.speed ?? null,
                updatedAt: row.updated_at || new Date().toISOString(),
              };
              this.lastKnownCoords.set(bookingId, updated);
              onUpdate(updated);
            }
          }
        }
      )
      .subscribe();

    // 3. Reliable 4-second poll fallback so client map always stays live even if WebSocket drops
    const pollInterval = setInterval(fetchLatestFromSupabase, 4000);

    return () => {
      clearInterval(pollInterval);
      const set = this.localListeners.get(bookingId);
      if (set) {
        set.delete(onUpdate);
        if (set.size === 0) this.localListeners.delete(bookingId);
      }
      supabase.removeChannel(channel);
    };
  }

  /**
   * Stops all foreground and background location tracking as soon as the trainer arrives at the client's venue.
   */
  async stopTracking(deleteFromDb = true): Promise<void> {
    const trackedId = this.currentBookingId;
    this.currentBookingId = null;
    this.isStarting = false;

    if (this.activeSubscription) {
      console.log('[LocationTracker] Stopping foreground tracking for booking:', trackedId);
      this.activeSubscription.remove();
      this.activeSubscription = null;
    }

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    if (this.backgroundIntervalFallback) {
      clearInterval(this.backgroundIntervalFallback);
      this.backgroundIntervalFallback = null;
    }

    if (Platform.OS !== 'web' && TaskManager) {
      try {
        const isRegistered = await Location.hasStartedLocationUpdatesAsync(VIRLA_TRAINER_BG_LOCATION_TASK);
        if (isRegistered) {
          await Location.stopLocationUpdatesAsync(VIRLA_TRAINER_BG_LOCATION_TASK);
          console.log('[LocationTracker] Stopped background location task');
        }
      } catch {}
    }

    try {
      await AsyncStorage.removeItem(ACTIVE_BOOKING_STORAGE_KEY);
    } catch {}

    if (trackedId && deleteFromDb) {
      this.lastKnownCoords.delete(trackedId);
      try {
        await supabase
          .from('trainer_travel_locations')
          .delete()
          .eq('booking_id', trackedId);
      } catch (e) {
        console.warn('[LocationTracker] Error deleting location row on stop:', e);
      }
    }
  }

  getTrackedBookingId(): string | null {
    return this.currentBookingId;
  }

  getLastKnownCoords(bookingId: string): LiveTrainerCoordinates | null {
    return this.lastKnownCoords.get(bookingId) || null;
  }

  /**
   * Cleans up any dangling background or foreground tracking tasks if there is no session
   * currently in 'trainer_travelling' status. Safe to invoke during app bootstrap.
   */
  async cleanupZombieTracking(): Promise<void> {
    try {
      const storedBookingId = await AsyncStorage.getItem(ACTIVE_BOOKING_STORAGE_KEY);
      if (!storedBookingId && !this.currentBookingId) {
        // Also ensure background task is stopped if running with no booking ID
        if (Platform.OS !== 'web' && TaskManager) {
          const isRegistered = await Location.hasStartedLocationUpdatesAsync(VIRLA_TRAINER_BG_LOCATION_TASK).catch(() => false);
          if (isRegistered) {
            await Location.stopLocationUpdatesAsync(VIRLA_TRAINER_BG_LOCATION_TASK).catch(() => {});
          }
        }
        return;
      }

      const activeId = storedBookingId || this.currentBookingId;
      if (activeId) {
        let isTravelling = false;
        try {
          const { useBookingStore } = require('../store/bookingStore');
          const booking = useBookingStore.getState().bookings.find((b: any) => b.id === activeId);
          if (booking && booking.timelineStatus === 'trainer_travelling') {
            isTravelling = true;
          }
        } catch {}

        if (!isTravelling) {
          console.log('[LocationTracker] Cleaning up zombie tracking on startup for booking:', activeId);
          await this.stopTracking(true);
        }
      }
    } catch (e) {
      console.warn('[LocationTracker] Cleanup zombie tracking error:', e);
    }
  }
}

export const locationTrackerService = new LocationTrackerService();

// Register OS background task handler if TaskManager is supported in the runtime
if (Platform.OS !== 'web' && TaskManager) {
  try {
    if (!TaskManager.isTaskDefined(VIRLA_TRAINER_BG_LOCATION_TASK)) {
      TaskManager.defineTask(VIRLA_TRAINER_BG_LOCATION_TASK, async ({ data, error }: any) => {
        if (error) {
          console.warn('[LocationTracker BG Task] Error:', error.message || error);
          return;
        }
        if (data?.locations && Array.isArray(data.locations) && data.locations.length > 0) {
          const latestLocation = data.locations[data.locations.length - 1];
          let bookingId = locationTrackerService.getTrackedBookingId();
          if (!bookingId) {
            try {
              bookingId = await AsyncStorage.getItem(ACTIVE_BOOKING_STORAGE_KEY);
            } catch {}
          }
          if (bookingId && latestLocation?.coords) {
            // Guard: stop background task immediately if booking is no longer travelling
            try {
              const { useBookingStore } = require('../store/bookingStore');
              const booking = useBookingStore.getState().bookings.find((b: any) => b.id === bookingId);
              if (booking && booking.timelineStatus !== 'trainer_travelling') {
                console.log(`[LocationTracker BG Task] Booking ${bookingId} is in '${booking.timelineStatus}'. Stopping background updates.`);
                await locationTrackerService.stopTracking();
                return;
              }
            } catch {}

            await locationTrackerService.publishLocation(bookingId, latestLocation.coords);
          } else if (!bookingId) {
            // No booking ID associated with running task, stop it
            try {
              await Location.stopLocationUpdatesAsync(VIRLA_TRAINER_BG_LOCATION_TASK).catch(() => {});
            } catch {}
          }
        }
      });
    }
  } catch (err) {
    console.warn('[LocationTracker] Could not define background task:', err);
  }
}
