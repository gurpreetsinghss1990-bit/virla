import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, Platform, TouchableOpacity, Animated } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { parseBookingAddress } from '../utils/LocationParser';
import { calculateDistanceKm } from '../utils/distance';
import {
  fetchRoadRouteDirections,
  snapRouteToLiveOrigin,
  buildInterpolatedRoute,
  LatLng,
} from '../utils/routeDirections';

interface TrackingMapProps {
  liveTrainerCoords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    heading: number | null;
    speed: number | null;
    updatedAt: string;
  } | null;
  isStale: boolean;
  clientAddress?: string;
  viewerRole?: 'customer' | 'trainer' | 'admin';
  onRouteMetricsChange?: (metrics: { distanceKm: number; durationMins: number }) => void;
  onExpandPress?: () => void;
  isFullScreen?: boolean;
}

export default function TrackingMap({
  liveTrainerCoords,
  isStale,
  clientAddress,
  viewerRole = 'customer',
  onRouteMetricsChange,
  onExpandPress,
  isFullScreen = false,
}: TrackingMapProps) {
  const mapRef = useRef<MapView>(null);
  const [pulseAnim] = useState(() => new Animated.Value(1));
  const lastFetchedOriginRef = useRef<LatLng | null>(null);
  const hasFittedInitiallyRef = useRef(false);

  const [rawRouteCoords, setRawRouteCoords] = useState<LatLng[]>([]);
  const [tracksChanges, setTracksChanges] = useState(true);

  // Parse client venue coordinates from the booking's selected address
  const clientCoords = useMemo((): LatLng | null => {
    if (!clientAddress) return null;
    const loc = parseBookingAddress(clientAddress);
    if (loc.lat && loc.lng && !isNaN(loc.lat) && !isNaN(loc.lng) && !(loc.lat === 0 && loc.lng === 0)) {
      return {
        latitude: loc.lat,
        longitude: loc.lng,
      };
    }
    return null;
  }, [clientAddress]);

  const trainerLatLng = useMemo((): LatLng | null => {
    if (
      !liveTrainerCoords ||
      typeof liveTrainerCoords.latitude !== 'number' ||
      typeof liveTrainerCoords.longitude !== 'number' ||
      isNaN(liveTrainerCoords.latitude) ||
      isNaN(liveTrainerCoords.longitude)
    ) {
      return null;
    }
    return {
      latitude: liveTrainerCoords.latitude,
      longitude: liveTrainerCoords.longitude,
    };
  }, [liveTrainerCoords]);

  // Subtle radar pulse animation for the Mota Trainer Marker
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.22, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // Briefly enable tracksViewChanges when marker state updates so custom marker UI renders crisply on Android/iOS
  useEffect(() => {
    const startTimer = setTimeout(() => setTracksChanges(true), 0);
    const endTimer = setTimeout(() => setTracksChanges(false), 700);
    return () => {
      clearTimeout(startTimer);
      clearTimeout(endTimer);
    };
  }, [trainerLatLng?.latitude, trainerLatLng?.longitude, isStale, liveTrainerCoords?.heading]);

  // Fetch real road route (Google Directions / OSRM / Interpolated fallback) when trainer moves > 60m
  useEffect(() => {
    if (!trainerLatLng || !clientCoords) return;

    const prevOrigin = lastFetchedOriginRef.current;
    const movedKm = prevOrigin
      ? calculateDistanceKm(
          prevOrigin.latitude,
          prevOrigin.longitude,
          trainerLatLng.latitude,
          trainerLatLng.longitude
        )
      : Infinity;

    if (movedKm < 0.06 && rawRouteCoords.length >= 2) {
      return;
    }

    let cancelled = false;
    lastFetchedOriginRef.current = trainerLatLng;

    fetchRoadRouteDirections(trainerLatLng, clientCoords)
      .then((res) => {
        if (cancelled) return;
        setRawRouteCoords(res.coordinates);
        if (onRouteMetricsChange) {
          onRouteMetricsChange({
            distanceKm: res.distanceKm,
            durationMins: res.durationMins,
          });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setRawRouteCoords(buildInterpolatedRoute(trainerLatLng, clientCoords));
      });

    return () => {
      cancelled = true;
    };
  }, [trainerLatLng, clientCoords]);

  // Live snapped route line that starts directly from the trainer's current coordinate to the client's venue
  const activeRoutePolyline = useMemo((): LatLng[] => {
    if (!trainerLatLng || !clientCoords) return [];
    if (rawRouteCoords.length >= 2) {
      return snapRouteToLiveOrigin(rawRouteCoords, trainerLatLng, clientCoords);
    }
    return buildInterpolatedRoute(trainerLatLng, clientCoords);
  }, [rawRouteCoords, trainerLatLng, clientCoords]);

  const fitMapToRoute = useCallback(
    (animated = true) => {
      if (!mapRef.current) return;
      const pointsToFit: LatLng[] = [];
      if (activeRoutePolyline.length >= 2) {
        pointsToFit.push(...activeRoutePolyline);
      } else {
        if (trainerLatLng) pointsToFit.push(trainerLatLng);
        if (clientCoords) pointsToFit.push(clientCoords);
      }

      if (pointsToFit.length >= 2) {
        // Check physical distance between origin and destination
        const distKm = (trainerLatLng && clientCoords)
          ? calculateDistanceKm(
              trainerLatLng.latitude,
              trainerLatLng.longitude,
              clientCoords.latitude,
              clientCoords.longitude
            )
          : 0;

        // When side-by-side or very close (< 100 meters), provide extra tight zoom so both markers are clearly distinct
        if (distKm < 0.1 && trainerLatLng && clientCoords) {
          const midLat = (trainerLatLng.latitude + clientCoords.latitude) / 2;
          const midLng = (trainerLatLng.longitude + clientCoords.longitude) / 2;
          mapRef.current.animateToRegion(
            {
              latitude: midLat,
              longitude: midLng,
              latitudeDelta: 0.0018, // Extra high-detail zoom
              longitudeDelta: 0.0018,
            },
            animated ? 500 : 0
          );
        } else {
          mapRef.current.fitToCoordinates(pointsToFit, {
            edgePadding: isFullScreen
              ? { top: 90, right: 60, bottom: 200, left: 60 }
              : { top: 40, right: 40, bottom: 40, left: 40 },
            animated,
          });
        }
      } else if (pointsToFit.length === 1) {
        mapRef.current.animateToRegion(
          {
            latitude: pointsToFit[0].latitude,
            longitude: pointsToFit[0].longitude,
            latitudeDelta: 0.003, // Extra close zoom
            longitudeDelta: 0.003,
          },
          animated ? 500 : 0
        );
      }
    },
    [activeRoutePolyline, trainerLatLng, clientCoords, isFullScreen]
  );

  // Auto-fit when coordinates or route become available
  useEffect(() => {
    if (!trainerLatLng && !clientCoords) return;
    const delay = hasFittedInitiallyRef.current ? 150 : 350;
    const timer = setTimeout(() => {
      fitMapToRoute(hasFittedInitiallyRef.current);
      hasFittedInitiallyRef.current = true;
    }, delay);
    return () => clearTimeout(timer);
  }, [trainerLatLng?.latitude, trainerLatLng?.longitude, clientCoords?.latitude, clientCoords?.longitude, rawRouteCoords.length]);

  const initialRegion = trainerLatLng
    ? {
        latitude: trainerLatLng.latitude,
        longitude: trainerLatLng.longitude,
        latitudeDelta: 0.0035,
        longitudeDelta: 0.0035,
      }
    : clientCoords
    ? {
        latitude: clientCoords.latitude,
        longitude: clientCoords.longitude,
        latitudeDelta: 0.0035,
        longitudeDelta: 0.0035,
      }
    : {
        latitude: 19.1076,
        longitude: 72.8264,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      };

  const headingRotation =
    typeof liveTrainerCoords?.heading === 'number' && !isNaN(liveTrainerCoords.heading) && liveTrainerCoords.heading >= 0
      ? `${Math.round(liveTrainerCoords.heading)}deg`
      : '0deg';

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        onMapReady={() => fitMapToRoute(false)}
      >
        {/* 1. Zepto-Style Dual-Layer Road Route Polyline (Trainer <-> Client Venue) */}
        {activeRoutePolyline.length >= 2 && (
          <>
            {/* Dark outer border casing for high contrast on any map tile */}
            <Polyline
              coordinates={activeRoutePolyline}
              strokeColor="rgba(15, 23, 42, 0.85)"
              strokeWidth={9}
              lineCap="round"
              lineJoin="round"
              zIndex={1}
            />
            {/* Vibrant primary route path */}
            <Polyline
              coordinates={activeRoutePolyline}
              strokeColor={isStale ? '#64748B' : '#10B981'}
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
              zIndex={2}
            />
          </>
        )}

        {/* 2. Client Selected Booking Venue Marker */}
        {clientCoords && (
          <Marker
            coordinate={clientCoords}
            anchor={{ x: 0.5, y: 0.88 }}
            title="Workout Venue"
            description="Selected Booking Location"
            tracksViewChanges={tracksChanges}
            zIndex={10}
          >
            <View style={styles.markerWrapper}>
              <View style={styles.clientBadge}>
                <View style={styles.clientBadgeDot} />
                <Text style={styles.clientBadgeText}>
                  {viewerRole === 'trainer' ? 'CLIENT VENUE' : 'YOUR VENUE'}
                </Text>
              </View>
              <View style={styles.clientPinOuter}>
                <View style={styles.clientPinInner}>
                  <Ionicons name="home" size={18} color="#FFFFFF" />
                </View>
              </View>
              <View style={styles.pinStem} />
            </View>
          </Marker>
        )}

        {/* 3. Zepto-Style Mota (Bold & Prominent) Live Trainer Marker */}
        {trainerLatLng && (
          <Marker
            coordinate={trainerLatLng}
            anchor={{ x: 0.5, y: 0.58 }}
            title={viewerRole === 'trainer' ? 'You (Trainer)' : 'Coach Live Location'}
            description={isStale ? 'Last known GPS position' : 'Travelling to venue'}
            tracksViewChanges={tracksChanges}
            zIndex={25}
          >
            <View style={styles.markerWrapper}>
              {/* Top Floating Status Pill */}
              <View style={[styles.trainerBadge, isStale && styles.trainerBadgeStale]}>
                <View style={[styles.livePulseDot, isStale && { backgroundColor: '#CBD5E1' }]} />
                <Text style={styles.trainerBadgeText}>
                  {isStale
                    ? 'LAST SEEN'
                    : viewerRole === 'trainer'
                    ? 'YOU • LIVE'
                    : 'COACH LIVE'}
                </Text>
              </View>

              {/* Mota Circular Rider/Coach Marker with Outer Halo */}
              <View style={styles.trainerHaloContainer}>
                <Animated.View
                  style={[
                    styles.trainerOuterHalo,
                    isStale && styles.trainerOuterHaloStale,
                    { transform: [{ scale: pulseAnim }] },
                  ]}
                />
                <View style={[styles.trainerMotaCore, isStale && styles.trainerMotaCoreStale]}>
                  <View style={{ transform: [{ rotate: headingRotation }] }}>
                    <MaterialCommunityIcons name="navigation-variant" size={24} color="#FFFFFF" />
                  </View>
                </View>
              </View>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Map Floating Action Buttons (Recenter Route & Fullscreen) */}
      <View style={[styles.mapControls, isFullScreen && { top: 16 }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => fitMapToRoute(true)}
          style={styles.mapControlBtn}
        >
          <Ionicons name="locate" size={18} color="#0F172A" />
        </TouchableOpacity>

        {onExpandPress && !isFullScreen && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onExpandPress}
            style={styles.mapControlBtn}
          >
            <Ionicons name="expand" size={17} color="#0F172A" />
          </TouchableOpacity>
        )}
      </View>

      {/* Waiting for live GPS signal overlay badge */}
      {!trainerLatLng && (
        <View style={styles.staleOverlay}>
          <ActivityIndicator size="small" color="#E11D48" style={{ marginRight: 6 }} />
          <Text style={styles.staleText}>Connecting to live trainer GPS...</Text>
        </View>
      )}

      {/* Stale/Signal lost overlay badge */}
      {isStale && trainerLatLng && (
        <View style={styles.staleOverlay}>
          <Ionicons name="warning" size={14} color="#B45309" style={{ marginRight: 6 }} />
          <Text style={styles.staleText}>GPS signal weak • Showing last known position</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  markerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E11D48',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 3.5,
    elevation: 5,
  },
  clientBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginRight: 5,
  },
  clientBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  clientPinOuter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(225, 29, 72, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientPinInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E11D48',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
  pinStem: {
    width: 4,
    height: 7,
    backgroundColor: '#E11D48',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    marginTop: -2,
  },
  trainerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: '#10B981',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.32,
    shadowRadius: 4,
    elevation: 6,
  },
  trainerBadgeStale: {
    backgroundColor: '#475569',
    borderColor: '#94A3B8',
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  trainerBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  trainerHaloContainer: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainerOuterHalo: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(16, 185, 129, 0.28)',
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.55)',
  },
  trainerOuterHaloStale: {
    backgroundColor: 'rgba(100, 116, 139, 0.22)',
    borderColor: 'rgba(100, 116, 139, 0.45)',
  },
  trainerMotaCore: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 8,
  },
  trainerMotaCoreStale: {
    backgroundColor: '#64748B',
  },
  mapControls: {
    position: 'absolute',
    top: 10,
    right: 10,
    gap: 8,
  },
  mapControlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 4,
  },
  staleOverlay: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 251, 235, 0.96)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCD34D',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  staleText: {
    fontSize: 11,
    color: '#78350F',
    fontWeight: '700',
  },
});
