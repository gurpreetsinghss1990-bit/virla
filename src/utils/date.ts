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
