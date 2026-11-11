import React, { useCallback, useEffect, useState } from 'react';
import { AppState, TouchableOpacity, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useIsFocused } from 'expo-router';
import { Asset } from 'expo-asset';
import { Feather } from '@expo/vector-icons';
import Svg, { Defs, RadialGradient, Stop, Rect, Line } from 'react-native-svg';
import { CachedVideo } from './CachedVideo';
import { useIsAppActive } from '../hooks/useIsAppActive';
import { getCachedMediaUri } from '../services/mediaCache';
import { BUNNY_CDN_ASSETS } from '../services/bunnyCdnService';

// Module-level manager for Single Active Playback across all CoachVideoAvatar instances
type PlaybackListener = (activeId: string | null) => void;
let currentPlayingId: string | null = null;
const playbackListeners = new Set<PlaybackListener>();

function setGlobalActivePlayer(id: string | null) {
  currentPlayingId = id;
  playbackListeners.forEach((listener) => listener(id));
}

// Default CDN URLs with ultra-fast edge delivery
const DEFAULT_VIDEO_URL = BUNNY_CDN_ASSETS.TRAINER_VIDEO_KALPESH;
const DEFAULT_POSTER_URL = BUNNY_CDN_ASSETS.TRAINER_IMAGE_KALPESH;

interface CoachVideoAvatarProps {
  /** Unique ID for the trainer/player to ensure only one video plays at a time */
  id?: string;
  /** Optional remote video URL or local asset module (e.g. require(...)). Falls back to the bundled coach preview video. */
  videoUri?: any;
  /** Fallback static photo URI or local require source while loading or if video fails */
  posterUri?: any;
  /** Size in px (if square/circular) */
  size?: number;
  /** Custom width in px (overrides size) */
  width?: number;
  /** Custom height in px (overrides size) */
  height?: number;
  /** Custom border radius (defaults to circular or rounded frame) */
  borderRadius?: number;
  /** Whether video should autoplay on mount (default false = shows transparent WebP until tapped) */
  autoPlay?: boolean;
  /** Zoom scale of the person inside the video (e.g. 1.25 to bring closer / zoom in) */
  scale?: number;
  /** Sunburst / rays scrim effect around frame */
  showSunburstScrim?: boolean;
}

export const CoachVideoAvatar: React.FC<CoachVideoAvatarProps> = ({
  id,
  videoUri,
  posterUri,
  size = 110,
  width,
  height,
  borderRadius,
  autoPlay = false,
  scale = 1.0,
  showSunburstScrim = false,
}) => {
  const frameWidth = width ?? size;
  const frameHeight = height ?? size;
  const frameRadius = borderRadius ?? Math.min(frameWidth, frameHeight) / 2;

  // Use passed id or fallback to videoUri string or unique generated key
  const [instanceId] = useState<string>(
    () => id || (typeof videoUri === 'string' ? videoUri : `coach-${Math.random()}`)
  );

  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [videoSource, setVideoSource] = useState<string | null>(null);
  const isFocused = useIsFocused();
  const isAppActive = useIsAppActive();

  // Playback only happens while the screen is focused and the app is in the foreground
  const shouldPlay = isPlaying && isFocused && isAppActive;

  // Stop playback when the tab/screen loses focus (cleanup runs on blur)
  useFocusEffect(
    useCallback(() => {
      return () => {
        setIsPlaying(false);
        if (currentPlayingId === instanceId) setGlobalActivePlayer(null);
      };
    }, [instanceId])
  );

  // Pause the moment the app leaves the foreground, before the next render
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') return;
      setIsPlaying(false);
      if (currentPlayingId === instanceId) setGlobalActivePlayer(null);
    });
    return () => subscription.remove();
  }, [instanceId]);

  // Subscribe to Global Single Active Player Manager
  // If another coach begins playing, this instance immediately pauses
  useEffect(() => {
    const handleActiveChange = (activeId: string | null) => {
      if (activeId !== instanceId) {
        setIsPlaying(false);
      }
    };

    playbackListeners.add(handleActiveChange);
    return () => {
      playbackListeners.delete(handleActiveChange);
      if (currentPlayingId === instanceId) setGlobalActivePlayer(null);
    };
  }, [instanceId]);

  // Nothing is fetched until the user taps: the poster WebP is the only media in the default state.
  useEffect(() => {
    if (!isPlaying) return;

    let cancelled = false;
    (async () => {
      const target = videoUri || DEFAULT_VIDEO_URL;
      let remote: string | null = null;
      try {
        if (typeof target === 'string') {
          remote = target;
        } else {
          const asset = Asset.fromModule(target);
          if (!asset.localUri && !asset.uri) {
            await asset.downloadAsync();
          }
          remote = asset.localUri || asset.uri || null;
        }
      } catch {
        remote = DEFAULT_VIDEO_URL;
      }
      if (!remote) return;
      const cached = await getCachedMediaUri(remote);
      if (!cancelled) setVideoSource(cached);
    })();

    return () => {
      cancelled = true;
    };
  }, [isPlaying, videoUri, autoPlay]);

  const togglePlaybackAndVoice = useCallback(() => {
    const nextPlaying = !isPlaying;
    setIsPlaying(nextPlaying);
    setGlobalActivePlayer(nextPlaying ? instanceId : null);
  }, [isPlaying, instanceId]);

  const posterSource = posterUri
    ? typeof posterUri === 'string'
      ? { uri: posterUri }
      : posterUri
    : { uri: DEFAULT_POSTER_URL };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={togglePlaybackAndVoice}
      style={{
        width: frameWidth,
        height: frameHeight,
        borderRadius: frameRadius,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Circular Avatar / Frame Container */}
      <View
        style={{
          width: frameWidth,
          height: frameHeight,
          borderRadius: frameRadius,
          overflow: 'hidden',
          backgroundColor: '#FFFFFF',
          position: 'relative',
        }}
      >
        {/* White sunburst rays scrim effect around frame if enabled */}
        {showSunburstScrim && (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Svg width={frameWidth} height={frameHeight} viewBox={`0 0 ${frameWidth} ${frameHeight}`}>
              <Defs>
                <RadialGradient id="scrimCenter" cx="50%" cy="50%" rx="50%" ry="50%">
                  <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0} />
                  <Stop offset="65%" stopColor="#FFFFFF" stopOpacity={0.15} />
                  <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.8} />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width={frameWidth} height={frameHeight} fill="url(#scrimCenter)" />
              {/* Elegant white sun-ray radial lines */}
              {Array.from({ length: 18 }).map((_, i) => {
                const angle = (i * 360) / 18;
                const rad = (angle * Math.PI) / 180;
                const cx = frameWidth / 2;
                const cy = frameHeight / 2;
                const r1 = Math.min(frameWidth, frameHeight) * 0.35;
                const r2 = Math.max(frameWidth, frameHeight) * 0.7;
                return (
                  <Line
                    key={i}
                    x1={cx + r1 * Math.cos(rad)}
                    y1={cy + r1 * Math.sin(rad)}
                    x2={cx + r2 * Math.cos(rad)}
                    y2={cy + r2 * Math.sin(rad)}
                    stroke="#FFFFFF"
                    strokeWidth={1.2}
                    strokeOpacity={0.7}
                  />
                );
              })}
            </Svg>
          </View>
        )}

        {/* Video layer: mounted only after a tap, played from the on-disk cache */}
        {videoSource ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: frameWidth,
              height: frameHeight,
              backgroundColor: '#FFFFFF',
              opacity: shouldPlay ? 1 : 0,
            }}
          >
            <CachedVideo
              uri={videoSource}
              playing={shouldPlay}
              loop={false}
              muted={false}
              contentFit="contain"
              onEnded={() => setIsPlaying(false)}
              style={{
                transform: [{ scale }],
                transformOrigin: 'center bottom',
              }}
            />
          </View>
        ) : null}

        {/* Initial Transparent WebP Cutout in the exact same frame (visible when video is not playing) */}
        {!shouldPlay && (
          <Image
            source={posterSource}
            style={{
              position: 'absolute',
              width: frameWidth,
              height: frameHeight,
              backgroundColor: '#FFFFFF',
              transform: [{ translateY: 6 }],
            }}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={120}
          />
        )}

        {/* Soft Radial Edge Vignette to seamlessly blend the edges into the pure #FFFFFF card */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width={frameWidth} height={frameHeight}>
            <Defs>
              <RadialGradient id="whiteEdgeBlend" cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="82%" stopColor="#FFFFFF" stopOpacity={0} />
                <Stop offset="94%" stopColor="#FFFFFF" stopOpacity={0.4} />
                <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={1} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width={frameWidth} height={frameHeight} fill="url(#whiteEdgeBlend)" />
          </Svg>
        </View>
      </View>

      {/* Voice / Play Toggle Badge (bottom-right) */}
      <View
        style={{
          position: 'absolute',
          bottom: 4,
          right: 4,
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: shouldPlay ? '#101828' : '#FFFFFF',
          borderWidth: 1.5,
          borderColor: '#E5E7EB',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#101828',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <Feather
          name={shouldPlay ? 'volume-2' : 'volume-x'}
          size={11}
          color={shouldPlay ? '#FFFFFF' : '#6B7280'}
        />
      </View>
    </TouchableOpacity>
  );
};
