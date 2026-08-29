import { supabase } from '../database/supabaseClient';
import * as Location from 'expo-location';

class LocationTrackerService {
  private activeSubscription: Location.LocationSubscription | null = null;
  private currentBookingId: string | null = null;

  /**
   * Starts tracking and publishing the trainer's location.
   */
  async startTracking(bookingId: string): Promise<boolean> {
    // If already tracking this booking, return true
    if (this.currentBookingId === bookingId && this.activeSubscription) {
      console.log('[LocationTracker] Already tracking booking:', bookingId);
      return true;
    }

    // Stop any existing tracker
    await this.stopTracking();

    console.log('[LocationTracker] Starting tracking for booking:', bookingId);
    this.currentBookingId = bookingId;

    try {
      // 1. Request foreground permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[LocationTracker] Location permission denied.');
        return false;
      }

      // 2. Start watching position with time/distance throttling
      this.activeSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 10000,  // Poll approximately every 10 seconds
          distanceInterval: 20, // Threshhold of approximately 20 meters movement
        },
        async (location) => {
          await this.publishLocation(bookingId, location.coords);
        }
      );

      return true;
    } catch (error) {
      console.error('[LocationTracker] Error starting tracking:', error);
      return false;
    }
  }

  /**
   * Publishes coordinates to the trainer_travel_locations table in Supabase.
   */
  private async publishLocation(bookingId: string, coords: Location.LocationObjectCoords) {
    try {
      console.log('[LocationTracker] Publishing location for booking:', bookingId, coords.latitude, coords.longitude);
      const { error } = await supabase.from('trainer_travel_locations').upsert({
        booking_id: bookingId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy ?? 0,
        heading: coords.heading ?? null,
        speed: coords.speed ?? null,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error('[LocationTracker] Supabase upsert failed:', error);
      }
    } catch (e) {
      console.error('[LocationTracker] Exception during location publish:', e);
    }
  }

  /**
   * Subscribes to realtime location updates for a specific booking.
   * Returns an unsubscribe function.
   */
  subscribeToLocation(
    bookingId: string,
    onUpdate: (data: { latitude: number; longitude: number; accuracy: number; heading: number | null; speed: number | null; updatedAt: string }) => void,
    onStaleOrDisconnect?: () => void
  ): () => void {
    console.log('[LocationTracker] Setting up subscription for booking:', bookingId);

    // 1. Fetch current/latest location first from database (cache recovery/initial state)
    supabase
      .from('trainer_travel_locations')
      .select('*')
      .eq('booking_id', bookingId)
      .single()
      .then(({ data, error }) => {
        if (data && !error) {
          onUpdate({
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: data.accuracy,
            heading: data.heading,
            speed: data.speed,
            updatedAt: data.updated_at,
          });
        }
      });

    // 2. Set up realtime postgres_changes channel filtered by the specific booking_id
    const channel = supabase
      .channel(`location-changes:${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE to react to lifecycle updates
          schema: 'public',
          table: 'trainer_travel_locations',
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          console.log('[LocationTracker] Realtime location payload received:', payload);
          if (payload.eventType === 'DELETE') {
            if (onStaleOrDisconnect) onStaleOrDisconnect();
          } else if (payload.new) {
            const row = payload.new as any;
            onUpdate({
              latitude: row.latitude,
              longitude: row.longitude,
              accuracy: row.accuracy,
              heading: row.heading,
              speed: row.speed,
              updatedAt: row.updated_at,
            });
          }
        }
      );

    channel.subscribe((status) => {
      console.log(`[LocationTracker] Realtime subscription status for ${bookingId}:`, status);
      if (status === 'TIMED_OUT' || status === 'CLOSED') {
        if (onStaleOrDisconnect) onStaleOrDisconnect();
      }
    });

    // 3. Return cleanup/unsubscribe callback
    return () => {
      console.log('[LocationTracker] Cleaning up subscription for booking:', bookingId);
      channel.unsubscribe();
    };
  }

  /**
   * Stops tracking and cleans up subscription.
   */
  async stopTracking(): Promise<void> {
    if (this.activeSubscription) {
      console.log('[LocationTracker] Stopping tracking for booking:', this.currentBookingId);
      this.activeSubscription.remove();
      this.activeSubscription = null;
    }

    if (this.currentBookingId) {
      try {
        // Delete coordinate record immediately from transient location table upon travel completion
        await supabase
          .from('trainer_travel_locations')
          .delete()
          .eq('booking_id', this.currentBookingId);
      } catch (e) {
        console.error('[LocationTracker] Error deleting location row:', e);
      }
      this.currentBookingId = null;
    }
  }

  /**
   * Returns the current booking ID being tracked.
   */
  getTrackedBookingId(): string | null {
    return this.currentBookingId;
  }
}

export const locationTrackerService = new LocationTrackerService();
