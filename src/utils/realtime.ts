import { supabase } from '../database/supabaseClient';
import { Database, mapBooking, mapCoach, mapChatMessage, mapNotificationItem } from '../database/Database';
import { useBookingStore } from '../store/bookingStore';
import { useCoachStore } from '../store/coachStore';
import { useNotificationStore } from '../store/notificationStore';
import { useUserStore } from '../store/userStore';

let realtimeChannel: any = null;

export function setupRealtimeSubscriptions() {
  if (realtimeChannel) {
    return; // Already subscribed
  }

  console.log('[REALTIME] Initializing Supabase Realtime event listeners...');

  realtimeChannel = supabase
    .channel('virla-postgres-changes')
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
      useBookingStore.getState().syncFromDB();
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
      } else if (eventType === 'DELETE') {
        Database.schema.slot_reservations = Database.schema.slot_reservations.filter((r: any) => r.id !== oldRow.id);
      }
      
      // Notify stores
      useBookingStore.getState().syncFromDB();
    })
    let isInitialSubscription = true;
    realtimeChannel.subscribe(async (status: string) => {
      console.log('[REALTIME] Subscription status channel callback:', status);
      if (status === 'SUBSCRIBED') {
        if (!isInitialSubscription) {
          console.log('[REALTIME] Reconnected. Reloading database collections...');
          try {
            await Database.reload();
            useBookingStore.getState().syncFromDB();
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
}
