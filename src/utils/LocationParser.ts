export interface ParsedLocation {
  addressLine: string;
  lat: number | null;
  lng: number | null;
  place_id?: string;
  buildingName?: string;
  flatNumber?: string;
  floor?: string;
  landmark?: string;
  arrivalInstructions?: string;
}

/**
 * Robust utility to parse coordinates and structured information from a booking's address string.
 * Handles:
 * 1. New Option A JSON format: '{"addressLine":"...","lat":19.0123,"lng":72.8123,...}'
 * 2. Legacy Option B / parenthesized coordinate format: 'Address Name, Mumbai (19.0123, 72.8123)'
 * 3. Fallback plain text addresses without coordinates.
 */
export function parseBookingAddress(addressStr: string | null | undefined): ParsedLocation {
  if (!addressStr || addressStr.trim() === '') {
    return {
      addressLine: '',
      lat: null,
      lng: null,
    };
  }

  const trimmed = addressStr.trim();

  // 1. Try to parse as JSON (Option A)
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        const lat = typeof parsed.lat === 'number' ? parsed.lat : parsed.latitude ? parseFloat(parsed.latitude) : null;
        const lng = typeof parsed.lng === 'number' ? parsed.lng : parsed.longitude ? parseFloat(parsed.longitude) : null;
        return {
          addressLine: parsed.addressLine || parsed.formatted_address || parsed.address || '',
          lat: (lat !== null && !isNaN(lat)) ? lat : null,
          lng: (lng !== null && !isNaN(lng)) ? lng : null,
          place_id: parsed.place_id || parsed.placeId,
          buildingName: parsed.buildingName || parsed.building,
          flatNumber: parsed.flatNumber || parsed.apartment || parsed.houseNumber || parsed.flat_number || parsed.house_number,
          floor: parsed.floor,
          landmark: parsed.landmark,
          arrivalInstructions: parsed.arrivalInstructions || parsed.notes || parsed.instructions,
        };
      }
    } catch {
      // Ignore JSON error, let it fall through to legacy matchers
    }
  }

  // 2. Try to parse legacy parenthesized coordinates (Option B)
  // Matches "(19.0123, 72.8123)" or "(-19.0123, -72.8123)"
  const match = trimmed.match(/\(([-\d.]+),\s*([-\d.]+)\)/);
  if (match) {
    const latVal = parseFloat(match[1]);
    const lngVal = parseFloat(match[2]);
    const cleanAddress = trimmed.replace(/\s*\(([-\d.]+),\s*([-\d.]+)\)/, '').trim();
    return {
      addressLine: cleanAddress,
      lat: isNaN(latVal) ? null : latVal,
      lng: isNaN(lngVal) ? null : lngVal,
    };
  }

  // 3. Fallback to raw text without coordinates
  return {
    addressLine: trimmed,
    lat: null,
    lng: null,
  };
}
