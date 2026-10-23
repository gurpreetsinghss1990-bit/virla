import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../database/supabaseClient';
import { Database, mapBooking, mapCoach, mapChatMessage, mapNotificationItem, mapWorkoutAssignment } from '../database/Database';
import { useCoachStore } from '../store/coachStore';
import { useNotificationStore } from '../store/notificationStore';
import { useUserStore } from '../store/userStore';

let realtimeChannel: any = null;
let smartPollTimer: any = null;
let appStateSubscription: any = null;
let currentAppState: AppStateStatus = AppState.currentState;

/**
 * Broadcasts a lightweight socket ping over Supabase Realtime so all connected clients
 * (Customer, Trainer, Admin) immediately sync the updated booking state without waiting
 * for postgres_changes RLS headers.
 */
export function broadcastBookingUpdate(bookingId?: string, status?: string) {
  if (!realtimeChannel) return;
  try {
    realtimeChannel.send({
      type: 'broadcast',
      event: 'booking-sync',
      payload: { bookingId, status, ts: Date.now() },
    });
  } catch (e) {
    // Non-critical socket broadcast error
  }
}

const syncBookingStore = () => {
  try {
    const { useBookingStore } = require('../store/bookingStore');
    useBookingStore.getState().syncFromDB();
  } catch (_) {}
};

async function performSmartBookingSync() {
  // 1. Never poll when app is in background or inactive (prevents battery drain / heating)
  if (currentAppState !== 'active') return;

  // 2. Only poll if user is logged in
  const userId = Database.getCurrentUserId();
  if (!userId || !Database.getIsLoaded()) return;

  // 3. Smart check: Only poll if user is a trainer OR has at least one upcoming/active booking
  const role = useUserStore.getState().role;
  const hasUpcomingBooking = Database.schema.bookings.some((b) => b.status === 'upcoming');
  if (role !== 'trainer' && role !== 'admin' && !hasUpcomingBooking) {
    return;
  }

  const changed = await Database.syncBookingsOnly();
  if (changed) {
    syncBookingStore();
  }
}

export function setupRealtimeSubscriptions() {
  if (realtimeChannel) {
    return; // Already subscribed
  }

  console.log('[REALTIME] Initializing Supabase Realtime event listeners...');

  realtimeChannel = supabase
    .channel('virla-postgres-changes', {
      config: {
        broadcast: { self: false },
      },
    })
    // 0. Listen to direct Socket Broadcasts (bypasses RLS header drop on WebSocket)
    .on('broadcast', { event: 'booking-sync' }, async () => {
      const changed = await Database.syncBookingsOnly();
      if (changed) {
        syncBookingStore();
        useUserStore.getState().syncFromDB();
      }
    })
    // 1. Listen to Bookings changes
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload: any) => {
      console.log('[REALTIME] postgres_change Event on Bookings:', payload);
      const { eventType, new: newRow, old: oldRow } = payload;
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const mapped = mapBooking(newRow);
        const idx = Database.schema.bookings.findIndex((b: any) => b.id === mapped.id);
        if (idx >= 0) {
          Database.schema.bookings[idx] = mapped;
        } else {
          Database.schema.bookings.push(mapped);
        }
      } else if (eventType === 'DELETE') {
        Database.schema.bookings = Database.schema.bookings.filter((b: any) => b.id !== oldRow.id);
      }
      
      // Notify stores to re-sync state immediately
      syncBookingStore();
      useUserStore.getState().syncFromDB();
    })
    // 2. Listen to Trainers changes
    .on('postgres_changes', { event: '*', schema: 'public', table: 'trainers' }, (payload: any) => {
      console.log('[REALTIME] postgres_change Event on Trainers:', payload);
      const { eventType, new: newRow } = payload;
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const mapped = mapCoach(newRow);
        const idx = Database.schema.coaches.findIndex((c: any) => c.id === mapped.id);
        if (idx >= 0) {
          Database.schema.coaches[idx] = mapped;
        } else {
          Database.schema.coaches.push(mapped);
        }
      }
      
      // Notify stores
      useCoachStore.getState().syncFromDB();
    })
    // 3. Listen to Chat Messages changes
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, (payload: any) => {
      console.log('[REALTIME] postgres_change Event on Chat Messages:', payload);
      const { eventType, new: newRow } = payload;
      if (eventType === 'INSERT') {
        const mapped = mapChatMessage(newRow);
        const idx = Database.schema.messages.findIndex((m: any) => m.id === mapped.id);
        if (idx === -1) {
          Database.schema.messages.push(mapped);
        }
      }
    })
    // 4. Listen to Notifications changes
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, (payload: any) => {
      console.log('[REALTIME] postgres_change Event on Notifications:', payload);
      const { eventType, new: newRow } = payload;
      if (eventType === 'INSERT') {
        const mapped = mapNotificationItem(newRow);
        const idx = Database.schema.notifications.findIndex((n: any) => n.id === mapped.id);
        if (idx === -1) {
          Database.schema.notifications.push(mapped);
        }
        
        // Notify stores
        useNotificationStore.getState().syncFromDB();
      }
    })
    // 5. Listen to Slot Reservations changes
    .on('postgres_changes', { event: '*', schema: 'public', table: 'slot_reservations' }, (payload: any) => {
      console.log('[REALTIME] postgres_change Event on Slot Reservations:', payload);
      const { eventType, new: newRow, old: oldRow } = payload;
      if (eventType === 'INSERT') {
        const idx = Database.schema.slot_reservations.findIndex((r: any) => r.id === newRow.id);
        if (idx === -1) {
          Database.schema.slot_reservations.push(newRow);
        }
      } else if (eventType === 'UPDATE') {
        const idx = Database.schema.slot_reservations.findIndex((r: any) => r.id === newRow.id);
        if (idx >= 0) {
          Database.schema.slot_reservations[idx] = newRow;
        } else {
          Database.schema.slot_reservations.push(newRow);
        }
      } else if (eventType === 'DELETE') {
        Database.schema.slot_reservations = Database.schema.slot_reservations.filter((r: any) => r.id !== oldRow.id);
      }
      
      // Notify stores
      syncBookingStore();
    })
    // 6. Listen to Trainer Workout Assignments changes
    .on('postgres_changes', { event: '*', schema: 'public', table: 'trainer_workout_assignments' }, (payload: any) => {
      console.log('[REALTIME] postgres_change Event on Trainer Workout Assignments:', payload);
      const { eventType, new: newRow, old: oldRow } = payload;
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const mapped = mapWorkoutAssignment(newRow);
        if (!Database.schema.trainer_workout_assignments) {
          Database.schema.trainer_workout_assignments = [];
        }
        const idx = Database.schema.trainer_workout_assignments.findIndex((a: any) => a.id === mapped.id);
        if (idx >= 0) {
          Database.schema.trainer_workout_assignments[idx] = mapped;
        } else {
          Database.schema.trainer_workout_assignments.unshift(mapped);
        }
      } else if (eventType === 'DELETE') {
        Database.schema.trainer_workout_assignments = (Database.schema.trainer_workout_assignments || []).filter((a: any) => a.id !== oldRow.id);
      }
      
      // Notify stores to re-sync
      useCoachStore.getState().syncFromDB();
      syncBookingStore();
    });

  let isInitialSubscription = true;
  realtimeChannel.subscribe(async (status: string) => {
    console.log('[REALTIME] Subscription status channel callback:', status);
    if (status === 'SUBSCRIBED') {
      if (!isInitialSubscription) {
        console.log('[REALTIME] Reconnected. Syncing bookings...');
        try {
          await Database.syncBookingsOnly();
          syncBookingStore();
          useCoachStore.getState().syncFromDB();
          useNotificationStore.getState().syncFromDB();
          useUserStore.getState().syncFromDB();
        } catch (e) {
          console.error('[REALTIME] Reconnection reload failed:', e);
        }
      }
      isInitialSubscription = false;
    }
  });

  // Smart low-power foreground polling fallback (every 8 seconds ONLY when app is active and has active bookings)
  if (!smartPollTimer) {
    smartPollTimer = setInterval(performSmartBookingSync, 8000);
  }

  if (!appStateSubscription) {
    appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const wasBackground = currentAppState.match(/inactive|background/);
      currentAppState = nextState;
      if (wasBackground && nextState === 'active') {
        // Sync immediately when user brings app back to foreground
        performSmartBookingSync();
      }
    });
  }
}
