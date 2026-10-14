import { supabase } from '../database/supabaseClient';

let serverTimeOffset = 0;

export async function syncServerTime(): Promise<void> {
  try {
    const start = Date.now();
    const { data, error } = await supabase.rpc('get_server_time');
    if (data && !error) {
      const serverMs = new Date(data).getTime();
      const end = Date.now();
      const latency = (end - start) / 2;
      serverTimeOffset = (serverMs + latency) - end;
      console.log(`[NTP CLOCK] Synced with Supabase server. Offset: ${serverTimeOffset}ms (latency: ${latency}ms)`);
    } else if (error) {
      console.warn('[NTP CLOCK] get_server_time RPC error:', error);
    }
  } catch (e) {
    console.error('[NTP CLOCK] Failed to sync server time:', e);
  }
}

export function getCurrentServerTime(): Date {
  return new Date(Date.now() + serverTimeOffset);
}

export function getISTDateInfo(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const info: any = {};
  for (const part of parts) {
    info[part.type] = part.value;
  }

  const year = parseInt(info.year, 10);
  const month = parseInt(info.month, 10); // 1-12
  const day = parseInt(info.day, 10);
  const hour = parseInt(info.hour, 10);
  const minute = parseInt(info.minute, 10);
  const second = parseInt(info.second, 10);

  const dateString = `${info.year}-${info.month}-${info.day}`;

  return { year, month, day, hour, minute, second, dateString };
}

export function parseISTToUTCDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  return new Date(utcDate.getTime() - 330 * 60 * 1000);
}
