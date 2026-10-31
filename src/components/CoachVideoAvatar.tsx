import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, TouchableOpacity, Image, Platform, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import { Feather } from '@expo/vector-icons';
import Svg, { Defs, RadialGradient, Stop, Rect, Line } from 'react-native-svg';
import { BUNNY_CDN_ASSETS, getCachedVideoUri } from '../services/bunnyCdnService';

// Default CDN URLs with ultra-fast edge delivery
const DEFAULT_VIDEO_URL = BUNNY_CDN_ASSETS.TRAINER_VIDEO_KALPESH;
const DEFAULT_POSTER_URL = BUNNY_CDN_ASSETS.TRAINER_IMAGE_KALPESH;

interface CoachVideoAvatarProps {
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

  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [resolvedUri, setResolvedUri] = useState<string | null>(videoUri || null);
  const webViewRef = useRef<WebView>(null);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    let mounted = true;
    const targetSource = videoUri || DEFAULT_VIDEO_URL;

    if (typeof targetSource === 'string') {
      // If it's a remote URL (BunnyCDN), ensure it's cached locally on device
      if (targetSource.startsWith('http://') || targetSource.startsWith('https://')) {
        getCachedVideoUri(targetSource).then((cached) => {
          if (mounted) setResolvedUri(cached);
        }).catch(() => {
          if (mounted) setResolvedUri(targetSource);
        });
      } else {
        setResolvedUri(targetSource);
      }
      return;
    }

    (async () => {
      try {
        const asset = Asset.fromModule(targetSource);
        if (!asset.localUri && !asset.uri) {
          await asset.downloadAsync();
        }
        if (mounted) {
          setResolvedUri(asset.localUri || asset.uri);
        }
      } catch {
        // Fallback handled by transparent WebP image
      }
    })();
    return () => {
      mounted = false;
    };
  }, [videoUri]);

  // Handle app background/inactive: Pause video and audio immediately
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState.match(/inactive|background/)) {
        setIsPlaying(false);
        if (Platform.OS === 'web') {
          if (webVideoRef.current) {
            webVideoRef.current.pause();
            webVideoRef.current.currentTime = 0;
          }
        } else if (webViewRef.current) {
          const js = `
            (function() {
              var v = document.getElementById('coachVid');
              if (v) {
                v.pause();
                v.currentTime = 0;
              }
            })();
            true;
          `;
          webViewRef.current.injectJavaScript(js);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  const togglePlaybackAndVoice = useCallback(() => {
    const nextPlaying = !isPlaying;
    setIsPlaying(nextPlaying);

    if (Platform.OS === 'web') {
      if (webVideoRef.current) {
        if (nextPlaying) {
          webVideoRef.current.currentTime = 0;
          webVideoRef.current.muted = false;
          webVideoRef.current.play().catch(() => {});
        } else {
          webVideoRef.current.pause();
          webVideoRef.current.currentTime = 0;
        }
      }
    } else if (webViewRef.current) {
      const js = `
        (function() {
          var v = document.getElementById('coachVid');
          if (v) {
            if (${nextPlaying}) {
              v.currentTime = 0;
              v.muted = false;
              v.play().catch(function(){});
            } else {
              v.pause();
              v.currentTime = 0;
            }
          }
        })();
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    }
  }, [isPlaying]);

  const htmlContent = React.useMemo(() => {
    if (!resolvedUri) return '';
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body {
              width: 100%;
              height: 100%;
              background-color: #FFFFFF;
              overflow: hidden;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            video {
              width: 100%;
              height: 100%;
              object-fit: contain;
              object-position: center bottom;
              background-color: #FFFFFF;
              filter: brightness(1.03) contrast(1.02);
              transform: scale(${scale});
              transform-origin: center bottom;
            }
          </style>
        </head>
        <body>
          <video
            id="coachVid"
            src="${resolvedUri}"
            preload="auto"
            muted
            playsinline
            webkit-playsinline
          ></video>
          <script>
            var vid = document.getElementById('coachVid');
            if (vid) {
              vid.addEventListener('timeupdate', function() {
                if (vid.currentTime >= 9.0) {
                  vid.pause();
                  vid.currentTime = 0;
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage('ENDED');
                  }
                }
              });
              vid.addEventListener('ended', function() {
                vid.currentTime = 0;
                vid.pause();
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage('ENDED');
                }
              });
            }
          </script>
        </body>
      </html>
    `;
  }, [resolvedUri, scale]);

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

        {/* Underlying Video Player (preloaded and ready to play immediately on tap) */}
        {resolvedUri ? (
          Platform.OS === 'web' ? (
            <video
              ref={(el) => {
                webVideoRef.current = el;
              }}
              src={resolvedUri}
              preload="auto"
              muted={!isPlaying}
              playsInline
              onTimeUpdate={(e) => {
                if (e.currentTarget.currentTime >= 9.0) {
                  e.currentTarget.pause();
                  e.currentTarget.currentTime = 0;
                  setIsPlaying(false);
                }
              }}
              onEnded={() => {
                setIsPlaying(false);
                if (webVideoRef.current) {
                  webVideoRef.current.currentTime = 0;
                }
              }}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                objectPosition: 'center bottom',
                backgroundColor: '#FFFFFF',
                filter: 'brightness(1.03) contrast(1.02)',
                transform: [{ scale }],
                transformOrigin: 'center bottom',
                opacity: isPlaying ? 1 : 0,
              }}
            />
          ) : (
            <WebView
              ref={webViewRef}
              source={{ html: htmlContent, baseUrl: '' }}
              originWhitelist={['*']}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              scrollEnabled={false}
              bounces={false}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              allowFileAccess={true}
              allowFileAccessFromFileURLs={true}
              allowUniversalAccessFromFileURLs={true}
              onMessage={(event) => {
                if (event.nativeEvent.data === 'ENDED') {
                  setIsPlaying(false);
                }
              }}
              style={{
                width: frameWidth,
                height: frameHeight,
                backgroundColor: '#FFFFFF',
                opacity: isPlaying ? 1 : 0,
              }}
              containerStyle={{
                width: frameWidth,
                height: frameHeight,
                backgroundColor: '#FFFFFF',
              }}
            />
          )
        ) : null}

        {/* Initial Transparent WebP Cutout in the exact same frame (visible when video is not playing) */}
        {!isPlaying && (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'flex-end',
              },
            ]}
          >
            <Image
              source={
                posterUri
                  ? typeof posterUri === 'number'
                    ? posterUri
                    : { uri: posterUri }
                  : { uri: DEFAULT_POSTER_URL }
              }
              style={{
                width: frameWidth,
                height: frameHeight,
                transform: [{ translateY: 6 }],
              }}
              resizeMode="contain"
            />
          </View>
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
          backgroundColor: isPlaying ? '#101828' : '#FFFFFF',
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
          name={isPlaying ? 'volume-2' : 'volume-x'}
          size={11}
          color={isPlaying ? '#FFFFFF' : '#6B7280'}
        />
      </View>
    </TouchableOpacity>
  );
};
