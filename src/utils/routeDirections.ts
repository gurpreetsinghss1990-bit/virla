import { calculateDistanceKm } from './distance';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RouteDirectionsResult {
  coordinates: LatLng[];
  distanceKm: number;
  durationMins: number;
  source: 'google' | 'osrm' | 'fallback';
}

/**
 * Decodes an encoded Google / OSRM polyline string into an array of LatLng coordinates.
 */
export function decodePolyline(encoded: string): LatLng[] {
  if (!encoded || typeof encoded !== 'string') return [];
  const poly: LatLng[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < len);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < len);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    poly.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return poly;
}

/**
 * Builds a clean multi-point interpolated path between origin and destination
 * when offline or if routing APIs are unreachable.
 */
export function buildInterpolatedRoute(origin: LatLng, destination: LatLng): LatLng[] {
  const steps = 16;
  const coords: LatLng[] = [];
  const dLat = destination.latitude - origin.latitude;
  const dLng = destination.longitude - origin.longitude;

  // Slight natural curve offset perpendicular to the line
  const perpLat = -dLng * 0.08;
  const perpLng = dLat * 0.08;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const curveFactor = Math.sin(t * Math.PI);
    coords.push({
      latitude: origin.latitude + dLat * t + perpLat * curveFactor,
      longitude: origin.longitude + dLng * t + perpLng * curveFactor,
    });
  }
  return coords;
}

/**
 * Trims an existing route polyline so that it starts smoothly from the trainer's
 * latest live position and leads to the client destination.
 */
export function snapRouteToLiveOrigin(
  routeCoords: LatLng[],
  liveOrigin: LatLng,
  destination: LatLng
): LatLng[] {
  if (!routeCoords || routeCoords.length < 2) {
    return [liveOrigin, destination];
  }

  let closestIdx = 0;
  let minDistance = Infinity;

  for (let i = 0; i < routeCoords.length; i++) {
    const pt = routeCoords[i];
    const dist = calculateDistanceKm(liveOrigin.latitude, liveOrigin.longitude, pt.latitude, pt.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      closestIdx = i;
    }
  }

  // Slice from the closest point forward and prepend the exact live trainer position
  const remaining = routeCoords.slice(Math.min(closestIdx + 1, routeCoords.length - 1));
  return [liveOrigin, ...remaining, destination];
}

/**
 * Fetches actual road driving directions between Trainer's live coordinates and Client's booking venue.
 * Tries:
 * 1. Google Maps Directions API
 * 2. OSRM Driving Route API (real street geometry fallback)
 * 3. Smooth interpolated route fallback
 */
export async function fetchRoadRouteDirections(
  origin: LatLng,
  destination: LatLng
): Promise<RouteDirectionsResult> {
  const straightDistKm = calculateDistanceKm(
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude
  );

  // If trainer is practically at destination (< 25 meters)
  if (straightDistKm < 0.025) {
    return {
      coordinates: [origin, destination],
      distanceKm: 0,
      durationMins: 0,
      source: 'fallback',
    };
  }

  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  // 1. Try Google Routes API (New) first, then Legacy Directions API
  if (apiKey && !apiKey.includes('YOUR_KEY')) {
    try {
      const routesV2Res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
        },
        body: JSON.stringify({
          origin: {
            location: {
              latLng: { latitude: origin.latitude, longitude: origin.longitude },
            },
          },
          destination: {
            location: {
              latLng: { latitude: destination.latitude, longitude: destination.longitude },
            },
          },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
        }),
      });

      if (routesV2Res.ok) {
        const v2Data = await routesV2Res.json();
        const route = v2Data?.routes?.[0];
        const encodedPoints = route?.polyline?.encodedPolyline;
        const decoded = encodedPoints ? decodePolyline(encodedPoints) : [];
        if (decoded.length >= 2) {
          const distMeters = route?.distanceMeters ?? straightDistKm * 1300;
          const rawDurationStr = typeof route?.duration === 'string' ? route.duration.replace('s', '') : '';
          const durSeconds = parseFloat(rawDurationStr) || (distMeters / 1000) * 210;
          return {
            coordinates: [origin, ...decoded, destination],
            distanceKm: Math.max(0.1, Number((distMeters / 1000).toFixed(1))),
            durationMins: Math.max(1, Math.ceil(durSeconds / 60)),
            source: 'google',
          };
        }
      }
    } catch {}

    try {
      const googleUrl =
        `https://maps.googleapis.com/maps/api/directions/json` +
        `?origin=${origin.latitude},${origin.longitude}` +
        `&destination=${destination.latitude},${destination.longitude}` +
        `&mode=driving&key=${apiKey}`;

      const res = await fetch(googleUrl);
      if (res.ok) {
        const data = await res.json();
        if (data?.status === 'OK' && data.routes?.length > 0) {
          const route = data.routes[0];
          const points = route.overview_polyline?.points;
          const leg = route.legs?.[0];
          const decoded = points ? decodePolyline(points) : [];

          if (decoded.length >= 2) {
            const distMeters = leg?.distance?.value ?? straightDistKm * 1300;
            const durSeconds = leg?.duration_in_traffic?.value ?? leg?.duration?.value ?? (distMeters / 1000) * 210;
            return {
              coordinates: [origin, ...decoded, destination],
              distanceKm: Math.max(0.1, Number((distMeters / 1000).toFixed(1))),
              durationMins: Math.max(1, Math.ceil(durSeconds / 60)),
              source: 'google',
            };
          }
        }
      }
    } catch (err) {
      console.warn('[RouteDirections] Google Directions fetch error, trying OSRM fallback:', err);
    }
  }

  // 2. Try OSRM Driving Route API for real road geometry
  try {
    const osrmUrl =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}` +
      `?overview=full&geometries=polyline`;

    const res = await fetch(osrmUrl);
    if (res.ok) {
      const data = await res.json();
      if (data?.code === 'Ok' && data.routes?.length > 0) {
        const route = data.routes[0];
        const decoded = route.geometry ? decodePolyline(route.geometry) : [];
        if (decoded.length >= 2) {
          const distKm = route.distance ? route.distance / 1000 : straightDistKm * 1.25;
          // City driving ETA (~4 mins per km in Indian city traffic)
          const estMins = Math.max(1, Math.ceil(distKm * 3.8));
          return {
            coordinates: [origin, ...decoded, destination],
            distanceKm: Math.max(0.1, Number(distKm.toFixed(1))),
            durationMins: estMins,
            source: 'osrm',
          };
        }
      }
    }
  } catch (err) {
    console.warn('[RouteDirections] OSRM fallback failed, using interpolated path:', err);
  }

  // 3. Offline / Fallback interpolated route
  const estimatedRoadKm = Math.max(0.1, Number((straightDistKm * 1.25).toFixed(1)));
  const estimatedMins = straightDistKm < 0.08 ? 1 : Math.max(1, Math.ceil(estimatedRoadKm * 4));
  return {
    coordinates: buildInterpolatedRoute(origin, destination),
    distanceKm: estimatedRoadKm,
    durationMins: estimatedMins,
    source: 'fallback',
  };
}
