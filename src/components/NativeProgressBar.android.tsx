import React from 'react';
import { View } from 'react-native';
import { Host, LinearProgressIndicator } from '@expo/ui/jetpack-compose';
import { clip, fillMaxWidth, height as heightModifier, Shapes } from '@expo/ui/jetpack-compose/modifiers';
import { clampProgress } from './nativeProgressShared';
import type { NativeProgressBarProps } from './nativeProgressShared';

export type { NativeProgressBarProps } from './nativeProgressShared';

export function NativeProgressBar({ progress, color, trackColor, height = 8 }: NativeProgressBarProps) {
  const radius = height / 2;

  return (
    <View style={{ width: '100%', height, justifyContent: 'center' }}>
      <Host style={{ width: '100%' }} matchContents={{ vertical: true }}>
        <LinearProgressIndicator
          progress={clampProgress(progress)}
          color={color}
          trackColor={trackColor}
          strokeCap="round"
          gapSize={0}
          drawStopIndicator={{ color, strokeCap: 'round', stopSize: 0 }}
          modifiers={[fillMaxWidth(), heightModifier(height), clip(Shapes.RoundedCorner(radius))]}
        />
      </Host>
    </View>
  );
}

export default NativeProgressBar;
