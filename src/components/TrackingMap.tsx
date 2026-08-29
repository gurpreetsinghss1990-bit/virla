import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

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
}

export default function TrackingMap({ liveTrainerCoords, isStale, clientAddress }: TrackingMapProps) {
  const mapRef = useRef<MapView>(null);

  // Parse client coordinates from address string: "Address (lat, lng)"
  const getClientCoords = (): { latitude: number; longitude: number } | null => {
    if (!clientAddress) return null;
    const match = clientAddress.match(/\(([-\d.]+),\s*([-\d.]+)\)/);
    if (match) {
      return {
        latitude: parseFloat(match[1]),
        longitude: parseFloat(match[2]),
      };
    }
    return null;
  };

  const clientCoords = getClientCoords();

  // Auto-fit bounds to show both trainer and client markers
  useEffect(() => {
    if (mapRef.current && (liveTrainerCoords || clientCoords)) {
      const markers = [];
      if (liveTrainerCoords) markers.push({ latitude: liveTrainerCoords.latitude, longitude: liveTrainerCoords.longitude });
      if (clientCoords) markers.push(clientCoords);

      if (markers.length > 0) {
        mapRef.current.fitToCoordinates(markers, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    }
  }, [liveTrainerCoords, clientCoords]);

  if (!liveTrainerCoords && !clientCoords) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#9f1239" />
        <Text style={styles.loadingText}>Initializing map...</Text>
      </View>
    );
  }

  // Initial region centered on whatever coordinate is available
  const initialRegion = liveTrainerCoords
    ? {
        latitude: liveTrainerCoords.latitude,
        longitude: liveTrainerCoords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : clientCoords
    ? {
        latitude: clientCoords.latitude,
        longitude: clientCoords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : {
        latitude: 12.971598,
        longitude: 77.594562,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={true}
      >
        {/* Client destination marker */}
        {clientCoords && (
          <Marker
            coordinate={clientCoords}
            title="Destination"
            description="Your workout location"
          >
            <View style={styles.clientMarkerContainer}>
              <View style={styles.clientMarkerPin}>
                <Ionicons name="location" size={24} color="#9f1239" />
              </View>
            </View>
          </Marker>
        )}

        {/* Live trainer tracking marker */}
        {liveTrainerCoords && (
          <Marker
            coordinate={{
              latitude: liveTrainerCoords.latitude,
              longitude: liveTrainerCoords.longitude,
            }}
            title="Trainer"
            description={isStale ? "Last known location (signal lost)" : "On the way"}
          >
            <View style={[styles.trainerMarkerContainer, isStale && styles.staleMarker]}>
              <View style={styles.trainerMarkerOutline}>
                <View style={[styles.trainerMarkerCore, isStale && styles.staleCore]}>
                  <Ionicons name="barbell" size={14} color="#ffffff" />
                </View>
              </View>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Stale/Signal lost overlay badge */}
      {isStale && liveTrainerCoords && (
        <View style={styles.staleOverlay}>
          <Ionicons name="warning" size={14} color="#b45309" style={{ marginRight: 6 }} />
          <Text style={styles.staleText}>Connection Offline. Showing last known location.</Text>
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
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  clientMarkerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientMarkerPin: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 6,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  trainerMarkerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  trainerMarkerOutline: {
    backgroundColor: 'rgba(15, 118, 110, 0.2)',
    borderRadius: 24,
    padding: 6,
  },
  trainerMarkerCore: {
    backgroundColor: '#0f766e',
    borderRadius: 16,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  staleMarker: {
    opacity: 0.7,
  },
  staleCore: {
    backgroundColor: '#64748b',
  },
  staleOverlay: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(254, 243, 199, 0.95)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fcd34d',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  staleText: {
    fontSize: 11,
    color: '#78350f',
    fontWeight: '600',
  },
});
