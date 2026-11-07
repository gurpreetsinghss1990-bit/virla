import React, { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Asset } from 'expo-asset';
import { useIsFocused } from 'expo-router';
import { CachedVideo } from './CachedVideo';
import { useIsAppActive } from '../hooks/useIsAppActive';
import { getCachedMediaUri } from '../services/mediaCache';

interface BackgroundVideoLoopProps {
  source: any;
  style?: StyleProp<ViewStyle>;
}

/**
 * Looping background clip (e.g. the Strength workout card).
 * The mp4 is downloaded to the device cache once and replayed from disk, and it
 * only plays while this screen is focused and the app is in the foreground.
 */
export const BackgroundVideoLoop: React.FC<BackgroundVideoLoopProps> = ({ source, style }) => {
  const [uri, setUri] = useState<string | null>(null);
  const isFocused = useIsFocused();
  const isAppActive = useIsAppActive();

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        let remote: string | null = null;
        if (typeof source === 'string') {
          remote = source;
        } else {
          const asset = Asset.fromModule(source);
          if (!asset.localUri && !asset.uri) {
            await asset.downloadAsync();
          }
          remote = asset.localUri || asset.uri || null;
        }
        if (!remote) return;
        const cached = await getCachedMediaUri(remote);
        if (isMounted) setUri(cached);
      } catch (error) {
        console.warn('Failed to resolve background video asset:', error);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [source]);

  if (!uri) return null;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, style]}>
      <CachedVideo uri={uri} playing={isFocused && isAppActive} loop muted contentFit="cover" />
    </View>
  );
};
