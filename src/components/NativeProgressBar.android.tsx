import React from 'react';
import { View } from 'react-native';
import { Host, LinearProgressIndicator } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { clampProgress } from './nativeProgressShared';
import type { NativeProgressBarProps } from './nativeProgressShared';

export type { NativeProgressBarProps } from './nativeProgressShared';

/**
 * Stock Material 3 (Jetpack Compose) LinearProgressIndicator: default thickness,
 * flat caps and the end stop indicator dot. Only the draw colours are themed.
 */
export function NativeProgressBar({ progress, color, trackColor, height = 8 }: NativeProgressBarProps) {
  return (
    <View style={{ width: '100%', height, justifyContent: 'center' }}>
      <Host style={{ width: '100%' }} matchContents={{ vertical: true }}>
        <LinearProgressIndicator
          progress={clampProgress(progress)}
          color={color}
          trackColor={trackColor}
          modifiers={[fillMaxWidth()]}
        />
      </Host>
    </View>
  );
}

export default NativeProgressBar;
