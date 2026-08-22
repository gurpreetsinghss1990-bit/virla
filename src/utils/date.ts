import { getCurrentServerTime, getISTDateInfo } from '../database/Database';

/**
 * Normalizes a date representation from any of the formats:
 * - "Aug 20, 2026" or "Today, Aug 14, 2026" or "Tomorrow, Aug 15, 2026"
 * - "2026-08-20"
 * - Date object
 * into standard canonical "YYYY-MM-DD" string.
 */
export function normalizeDate(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return '';
  if (dateInput instanceof Date) {
    const y = dateInput.getFullYear();
    const m = String(dateInput.getMonth() + 1).padStart(2, '0');
    const d = String(dateInput.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    // 1. If it is already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    
    // 2. If it is YYYY-M-D or similar, normalize it
    const parts = trimmed.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }

    // 2b. If it contains slashes (e.g. YYYY/MM/DD, DD/MM/YYYY, MM/DD/YYYY)
    if (trimmed.includes('/')) {
      const slashParts = trimmed.split('/');
      if (slashParts.length === 3) {
        if (slashParts[0].length === 4) {
          return `${slashParts[0]}-${slashParts[1].padStart(2, '0')}-${slashParts[2].padStart(2, '0')}`;
        }
        if (slashParts[2].length === 4) {
          const year = slashParts[2];
          const part1 = parseInt(slashParts[0], 10);
          const part2 = parseInt(slashParts[1], 10);
          if (part1 > 12) {
            return `${year}-${String(part2).padStart(2, '0')}-${String(part1).padStart(2, '0')}`;
          }
          if (part2 > 12) {
            return `${year}-${String(part1).padStart(2, '0')}-${String(part2).padStart(2, '0')}`;
          }
          return `${year}-${String(slashParts[0]).padStart(2, '0')}-${String(slashParts[1]).padStart(2, '0')}`;
        }
      }
    }

    // 3. Clean prepended day descriptors (e.g., "Today, Aug 14, 2026")
    let cleaned = trimmed;
    if (cleaned.includes(',')) {
      const commaParts = cleaned.split(',');
      if (commaParts.length > 2) {
        cleaned = commaParts.slice(1).join(',').trim();
      } else if (commaParts.length === 2) {
        const firstPart = commaParts[0].trim();
        if (firstPart === 'Today' || firstPart === 'Tomorrow') {
          cleaned = commaParts[1].trim();
        }
      }
    }

    // 4. Match "Aug 16, 2026" or "August 16, 2026"
    const mmmMatch = cleaned.match(/^([A-Za-z]+)\s+(\d+),\s+(\d{4})$/);
    if (mmmMatch) {
      const monthStr = mmmMatch[1].substring(0, 3).toLowerCase();
      const day = mmmMatch[2].padStart(2, '0');
      const year = mmmMatch[3];
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const monthIdx = months.indexOf(monthStr);
      if (monthIdx >= 0) {
        const month = String(monthIdx + 1).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }

    // 5. Match "16 Aug 2026" or "16 August 2026"
    const ddMmmMatch = cleaned.match(/^(\d+)\s+([A-Za-z]+)\s+(\d{4})$/);
    if (ddMmmMatch) {
      const day = ddMmmMatch[1].padStart(2, '0');
      const monthStr = ddMmmMatch[2].substring(0, 3).toLowerCase();
      const year = ddMmmMatch[3];
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const monthIdx = months.indexOf(monthStr);
      if (monthIdx >= 0) {
        const month = String(monthIdx + 1).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }

    // Fallback to JS Date parser if other formats match
    const dObj = new Date(cleaned);
    if (!isNaN(dObj.getTime())) {
      if (!cleaned.match(/\d{4}/)) {
        dObj.setFullYear(new Date().getFullYear());
      }
      const y = dObj.getFullYear();
      const m = String(dObj.getMonth() + 1).padStart(2, '0');
      const d = String(dObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  return '';
}

/**
 * Parses and normalizes time slot ranges to prevent mismatches from dash differences or hour paddings.
 */
export function canonicalizeTimeRange(timeStr: string | undefined | null): string {
  if (!timeStr) return '';
  // Unify en-dashes/em-dashes to a standard ASCII hyphen
  let cleaned = timeStr.replace(/[\u2013\u2014]/g, '-');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  const parts = cleaned.split('-');
  if (parts.length === 2) {
    const formatPart = (p: string) => {
      const match = p.trim().match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (match) {
        const hh = String(parseInt(match[1])).padStart(2, '0');
        const mm = match[2];
        const ampm = match[3].toUpperCase();
        return `${hh}:${mm} ${ampm}`;
      }
      return p.trim();
    };
    return `${formatPart(parts[0])} - ${formatPart(parts[1])}`;
  }
  return cleaned;
}



export function getBookingISTDateRange(b: { date?: string; time?: string }) {
  const dateStr = b.date;
  const monthsMap: { [key: string]: number } = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };
  
  let year = new Date().getFullYear();
  let month = new Date().getMonth();
  let day = new Date().getDate();
  
  if (dateStr && !dateStr.includes('Today') && !dateStr.includes('Tomorrow')) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
      const parts = dateStr.trim().split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else {
      const cleanDate = dateStr.replace(/,/g, '');
      const parts = cleanDate.trim().split(/\s+/);
      if (parts.length >= 3) {
        const mStr = parts[0].substring(0, 3).toLowerCase();
        if (monthsMap[mStr] !== undefined) {
          month = monthsMap[mStr];
        }
        day = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      }
    }
  } else if (dateStr && dateStr.includes('Tomorrow')) {
    const istNow = getCurrentServerTime();
    const istTomorrow = new Date(istNow.getTime() + 24 * 60 * 60 * 1000);
    const istInfo = getISTDateInfo(istTomorrow);
    year = istInfo.year;
    month = istInfo.month - 1;
    day = istInfo.day;
  } else {
    const istNow = getCurrentServerTime();
    const istInfo = getISTDateInfo(istNow);
    year = istInfo.year;
    month = istInfo.month - 1;
    day = istInfo.day;
  }
  
  const timeStr = b.time || '';
  const timeParts = timeStr.split('-');
  const startPart = timeParts[0]?.trim();
  const endPart = timeParts[1]?.trim();
  
  function parseTimePart(part: string) {
    const match = part.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return { hour: 0, minute: 0 };
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return { hour: h, minute: m };
  }
  
  const startInfo = parseTimePart(startPart);
  const endInfo = parseTimePart(endPart);
  
  const start = new Date(year, month, day, startInfo.hour, startInfo.minute, 0, 0);
  const end = new Date(year, month, day, endInfo.hour, endInfo.minute, 0, 0);
  
  return { start, end };
}

export function getDisplayWorkoutTitle(title: string): string {
  if (!title) return '';
  const t = title.toLowerCase();
  if (t === 'rhythmx' || t === 'rhythm burn') return 'Rhythm Dance';
  if (t === 'zenflow') return 'Flow Motion';
  if (t === 'powerforge') return 'Forge Strength';
  if (t === 'kinetix') return 'Reset Studio';
  if (t === 'fightlab') return 'Combat Core';
  return title;
}


