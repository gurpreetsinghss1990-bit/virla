import React, { useState, useEffect, useRef } from 'react';
import { View, Platform, StyleSheet, AppState } from 'react-native';
import { useIsFocused } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';

interface BackgroundVideoLoopProps {
  source: any;
  style?: any;
}

export const BackgroundVideoLoop: React.FC<BackgroundVideoLoopProps> = ({ source, style }) => {
  const [uri, setUri] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setAppActive(st === 'active'));
    return () => sub.remove();
  }, []);

  const shouldPlay = isFocused && appActive;

  // Pause when app is backgrounded or this tab is not focused; resume otherwise
  useEffect(() => {
    if (Platform.OS === 'web' || !webViewRef.current) return;
    webViewRef.current.injectJavaScript(`
      (function() {
        var v = document.querySelector('video');
        if (v) { ${shouldPlay ? "v.play().catch(function(){});" : "v.pause();"} }
      })();
      true;
    `);
  }, [shouldPlay, uri]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (typeof source === 'string') {
          if (isMounted) setUri(source);
          return;
        }
        const asset = Asset.fromModule(source);
        if (!asset.localUri && !asset.uri) {
          await asset.downloadAsync();
        }
        if (isMounted) {
          setUri(asset.localUri || asset.uri);
        }
      } catch (err) {
        console.warn('Failed to resolve background video asset:', err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [source]);

  if (!uri) {
    return null;
  }

  if (Platform.OS === 'web') {
    return (
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
        <video
          src={uri}
          autoPlay
          loop
          muted
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </View>
    );
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body {
            width: 100%;
            height: 100%;
            overflow: hidden;
            background-color: transparent;
          }
          video {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
          }
        </style>
      </head>
      <body>
        <video
          src="${uri}"
          autoplay
          loop
          muted
          playsinline
          webkit-playsinline
        ></video>
      </body>
    </html>
  `;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, style]}>
      <WebView
        ref={webViewRef}
        source={{ html, baseUrl: '' }}
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
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'transparent',
        }}
        containerStyle={{
          backgroundColor: 'transparent',
        }}
      />
    </View>
  );
};

