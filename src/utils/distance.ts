/**
 * Calculates the geodetic distance between two points on the Earth's surface
 * using the Haversine formula. Returns the distance in kilometers.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
      
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Fallback geocoder used strictly for offline/deterministic testing.
 * NOT to be used in production flows.
 */
export function geocodeAddressSync(address: string): { lat: number; lng: number } {
  if (!address) {
    return { lat: 19.0176, lng: 72.8164 }; // Default Mumbai center
  }

  // Check if string contains coordinates pattern, e.g. "(19.0596, 72.8295)"
  const match = address.match(/\((-?\d+\.\d+),\s*(-?\d+\.\d+)\)/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }

  const lower = address.toLowerCase();
  if (lower.includes('juhu')) {
    return { lat: 19.1076, lng: 72.8264 };
  }
  if (lower.includes('bandra')) {
    return { lat: 19.0596, lng: 72.8295 };
  }
  if (lower.includes('worli')) {
    return { lat: 18.9986, lng: 72.8174 };
  }
  if (lower.includes('andheri')) {
    return { lat: 19.1136, lng: 72.8697 };
  }
  if (lower.includes('powai')) {
    return { lat: 19.1176, lng: 72.9060 };
  }
  if (lower.includes('colaba')) {
    return { lat: 18.9067, lng: 72.8147 };
  }
  return { lat: 19.0176, lng: 72.8164 };
}

export interface AutocompleteSuggestion {
  placeId: string;
  description: string;
}

/**
 * Searches for real addresses using the Google Places API (New).
 * Restricted to region IN (India) for Virla.
 */
export async function fetchGooglePlacesAutocomplete(
  input: string,
  sessionToken: string
): Promise<AutocompleteSuggestion[]> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('Google Maps API Key is not configured.');
  }

  const url = 'https://places.googleapis.com/v1/places:autocomplete';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify({
        input,
        includedRegionCodes: ['IN'],
        sessionToken
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`Autocomplete HTTP ${res.status}: ${errText}`);
      return [];
    }

    const data = await res.json();
    if (data && data.suggestions) {
      return data.suggestions.map((s: any) => {
        const pred = s.placePrediction;
        return {
          placeId: pred.placeId || pred.place.replace('places/', ''),
          description: pred.text.text
        };
      });
    }
    return [];
  } catch (error) {
    console.error('Autocomplete error:', error);
    return [];
  }
}

/**
 * Resolves coordinates and exact address details for a Google Place ID.
 */
export async function fetchGooglePlaceDetails(placeId: string): Promise<{
  address: string;
  latitude: number;
  longitude: number;
}> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('Google Maps API Key is not configured.');
  }

  const url = `https://places.googleapis.com/v1/places/${placeId}`;
  const res = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'id,formattedAddress,location'
    }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Place Details failed: HTTP ${res.status} - ${errText}`);
  }

  const data = await res.json();
  if (data && data.location) {
    return {
      address: data.formattedAddress || '',
      latitude: data.location.latitude,
      longitude: data.location.longitude
    };
  }
  throw new Error('No coordinates resolved for the selected place.');
}

/**
 * Performs reverse geocoding using Google Geocoding API with a native expo-location fallback.
 */
export async function reverseGeocodeCoords(
  latitude: number,
  longitude: number
): Promise<{ address: string; placeId?: string }> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  if (apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && data.results && data.results.length > 0) {
          const result = data.results[0];
          return {
            address: result.formatted_address,
            placeId: result.place_id
          };
        }
      }
    } catch (e) {
      console.warn('Google reverse geocode failed, falling back to native geocoder:', e);
    }
  }

  // Native Expo Location fallback
  try {
    const Location = require('expo-location');
    const addressList = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (addressList && addressList.length > 0) {
      const addr = addressList[0];
      const parts = [
        addr.name,
        addr.street,
        addr.district,
        addr.subregion,
        addr.city,
        addr.region,
        addr.postalCode,
        addr.country
      ].filter(p => !!p);
      return {
        address: parts.join(', ') || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
      };
    }
  } catch (error: any) {
    console.error('Native reverse geocode failed:', error);
  }

  return {
    address: `Coords: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
  };
}

/**
 * Geocodes an address string using the Google Geocoding API.
 */
export async function geocodeAddress(address: string): Promise<{
  address: string;
  latitude: number;
  longitude: number;
  placeId?: string;
}> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('Google Maps API Key is not configured.');
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Geocoding failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  if (data && data.results && data.results.length > 0) {
    const result = data.results[0];
    return {
      address: result.formatted_address,
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      placeId: result.place_id
    };
  }
  throw new Error('Could not geocode the address.');
}


