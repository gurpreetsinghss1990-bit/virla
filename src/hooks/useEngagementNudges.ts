import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBookingStore } from '../store/bookingStore';
import { useWalletStore } from '../store/walletStore';
import { useUserStore } from '../store/userStore';
import { useNotificationStore } from '../store/notificationStore';
import { getBookingISTDateRange } from '../utils/date';

// ponytail: pure selector, no store access — unit-checkable without RN
export interface NudgeInput {
  nowMs: number;
  nextUpcomingStartMs: number | null;
  upcomingCount: number;
  totalCount: number;
  credits: number;
  lastEndMs: number | null;
  firstNudgeDone: boolean;
  exploreDone: boolean;
}

export interface Nudge {
  key: string;
  title: string;
  body: string;
  icon: string;
  type: 'Bookings' | 'Credits' | 'Promotions';
  priority: 'low' | 'medium' | 'high';
}

export function selectNudges(inp: NudgeInput): Nudge[] {
  const out: Nudge[] = [];
  const HOUR = 3600000;

  if (inp.nextUpcomingStartMs !== null) {
    const msLeft = inp.nextUpcomingStartMs - inp.nowMs;
    if (msLeft > 0 && msLeft <= 24 * HOUR) {
      const hrs = Math.max(1, Math.round(msLeft / HOUR));
      out.push({
        key: 'session_soon',
        title: hrs <= 2 ? 'Coach Arriving Soon 🏠' : 'Session Tomorrow 💪',
        body:
          hrs <= 2
            ? `Your coach reaches in ~${hrs} hr. Keep your workout space ready.`
            : `Your home session is in ~${hrs} hrs. Hydrate and warm up lightly.`,
        icon: 'clock',
        type: 'Bookings',
        priority: 'high',
      });
      return out; // ponytail: one timely nudge beats a noisy stack
    }
  }

  if (inp.credits <= 0 && inp.totalCount > 0) {
    out.push({
      key: 'low_credits',
      title: 'Out of Session Credits 💳',
      body: 'Recharge once and keep your training streak alive.',
      icon: 'zap',
      type: 'Credits',
      priority: 'high',
    });
    return out;
  }

  if (inp.upcomingCount === 0 && inp.lastEndMs !== null && inp.nowMs - inp.lastEndMs > 14 * 24 * HOUR) {
    out.push({
      key: 'comeback',
      title: 'Your Mat Misses You 🧘',
      body: 'It has been 2+ weeks. Book a light recovery session to restart.',
      icon: 'heart',
      type: 'Promotions',
      priority: 'medium',
    });
    return out;
  }

  if (inp.upcomingCount === 0 && inp.totalCount === 0) {
    if (!inp.firstNudgeDone) {
      out.push({
        key: 'first_session',
        title: 'Start Your Fitness Journey 🔥',
        body: 'Certified coaches at your doorstep. Book your first home session today.',
        icon: 'award',
        type: 'Promotions',
        priority: 'medium',
      });
    } else if (!inp.exploreDone) {
      out.push({
        key: 'explore_app',
        title: 'Explore VIRLA ✨',
        body: 'Try the AI Wellness Coach, check your Recovery Score and browse Strength, Yoga & Boxing sessions.',
        icon: 'compass',
        type: 'Promotions',
        priority: 'medium',
      });
    }
  }

  return out;
}

const dayKey = () => new Date().toISOString().slice(0, 10);

// Fires at most one engagement nudge per day via the existing notification store
// (which persists it AND shows the in-app toast — no new UI needed).
export function useEngagementNudges() {
  const bookings = useBookingStore((s) => s.bookings);
  const credits = useWalletStore((s) => s.creditBalance);
  const role = useUserStore((s) => s.role);

  useEffect(() => {
    if (role !== 'customer') return;
    let cancelled = false;

    (async () => {
      const nowMs = Date.now();
      let nextUpcomingStartMs: number | null = null;
      let upcomingCount = 0;
      let lastEndMs: number | null = null;

      for (const b of bookings) {
        const range = getBookingISTDateRange(b as any);
        if (b.status === 'upcoming' && range.start.getTime() > nowMs) {
          upcomingCount++;
          const t = range.start.getTime();
          if (nextUpcomingStartMs === null || t < nextUpcomingStartMs) nextUpcomingStartMs = t;
        }
        const endT = range.end.getTime();
        if (endT <= nowMs && (lastEndMs === null || endT > lastEndMs)) lastEndMs = endT;
      }

      // first_session fired on an earlier run counts as done (incl. today's daily flag)
      const firstNudgeDone =
        (await AsyncStorage.getItem('virla_nudge_first_session_done')) === '1' ||
        (await AsyncStorage.getItem(`virla_nudge_first_session_${dayKey()}`)) === '1';
      const exploreDone = (await AsyncStorage.getItem('virla_nudge_explore_done')) === '1';
      const nudges = selectNudges({        nowMs,
        nextUpcomingStartMs,
        upcomingCount,
        totalCount: bookings.length,
        credits,
        lastEndMs,
        firstNudgeDone,
        exploreDone,
      });
      if (nudges.length === 0 || cancelled) return;
      const nudge = nudges[0];
      const flag = `virla_nudge_${nudge.key}_${dayKey()}`;
      if (await AsyncStorage.getItem(flag)) return;
      await AsyncStorage.setItem(flag, '1');
      if (nudge.key === 'first_session') {
        await AsyncStorage.setItem('virla_nudge_first_session_done', '1');
      }
      if (nudge.key === 'explore_app') {
        await AsyncStorage.setItem('virla_nudge_explore_done', '1');
      }

      useNotificationStore.getState().addNotification({
        title: nudge.title,
        body: nudge.body,
        icon: nudge.icon,
        type: nudge.type,
        priority: nudge.priority,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [bookings, credits, role]);
}
