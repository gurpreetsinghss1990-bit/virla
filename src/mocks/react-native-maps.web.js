import React from 'react';
import { View, StyleSheet } from 'react-native';

const MockView = React.forwardRef((props, ref) => {
  return <View ref={ref} {...props} />;
});

export const Marker = React.forwardRef((props, ref) => <View ref={ref} {...props} />);
export const Overlay = MockView;
export const Polyline = MockView;
export const Heatmap = MockView;
export const Polygon = MockView;
export const Circle = MockView;
export const UrlTile = MockView;
export const WMSTile = MockView;
export const LocalTile = MockView;
export const Callout = MockView;
export const CalloutSubview = MockView;
export const AnimatedRegion = class {};
export const Geojson = MockView;
export const MarkerAnimated = Marker;
export const OverlayAnimated = Overlay;

export const PROVIDER_DEFAULT = 'default';
export const PROVIDER_GOOGLE = 'google';
export const MAP_TYPES = {
  STANDARD: 'standard',
  SATELLITE: 'satellite',
  HYBRID: 'hybrid',
  TERRAIN: 'terrain',
  NONE: 'none',
  MUTEDSTANDARD: 'mutedStandard',
};

const MapView = React.forwardRef((props, ref) => {
  return (
    <View ref={ref} style={[styles.mapFallback, props.style]}>
      {props.children}
    </View>
  );
});

MapView.Animated = MapView;

const styles = StyleSheet.create({
  mapFallback: {
    backgroundColor: '#1E293B',
    overflow: 'hidden',
  },
});

export {
  MapView,
  Marker as MapMarker,
  Overlay as MapOverlay,
  Polyline as MapPolyline,
  Heatmap as MapHeatmap,
  Polygon as MapPolygon,
  Circle as MapCircle,
  UrlTile as MapUrlTile,
  WMSTile as MapWMSTile,
  LocalTile as MapLocalTile,
  Callout as MapCallout,
  CalloutSubview as MapCalloutSubview,
};

export default MapView;
