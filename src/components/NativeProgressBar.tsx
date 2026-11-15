import React from 'react';
import { View } from 'react-native';
import { clampProgress } from './nativeProgressShared';
import type { NativeProgressBarProps } from './nativeProgressShared';

export type { NativeProgressBarProps } from './nativeProgressShared';

export function NativeProgressBar({ progress, color, trackColor, height = 8 }: NativeProgressBarProps) {
  return (
    <View style={{ width: '100%', height, borderRadius: height / 2, backgroundColor: trackColor, overflow: 'hidden' }}>
      <View
        style={{
          height: '100%',
          width: `${clampProgress(progress) * 100}%`,
          borderRadius: height / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export default NativeProgressBar;
