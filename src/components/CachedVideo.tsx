import React, { useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

interface CachedVideoProps {
  /** Local `file://` URI (or remote fallback) to play. */
  uri: string;
  /** Playback is fully driven by the parent: true plays, false pauses. */
  playing: boolean;
  loop?: boolean;
  muted?: boolean;
  contentFit?: 'cover' | 'contain';
  style?: StyleProp<ViewStyle>;
  /** Called once the underlying player reports the video ended (non-looping only). */
  onEnded?: () => void;
}

export const CachedVideo: React.FC<CachedVideoProps> = ({
  uri,
  playing,
  loop = true,
  muted = false,
  contentFit = 'cover',
  style,
  onEnded,
}) => {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = loop;
    instance.muted = muted;
  });

  useEffect(() => {
    if (playing) {
      player.play();
    } else {
      player.pause();
    }
  }, [playing, player]);

  useEffect(() => {
    if (!onEnded) return;
    const subscription = player.addListener('playToEnd', onEnded);
    return () => subscription.remove();
  }, [player, onEnded]);

  useEffect(() => {
    return () => {
      player.pause();
    };
  }, [player]);

  return (
    <VideoView
      player={player}
      style={[StyleSheet.absoluteFill, style]}
      nativeControls={false}
      contentFit={contentFit}
      allowsPictureInPicture={false}
      pointerEvents="none"
    />
  );
};
