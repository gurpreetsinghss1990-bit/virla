import React from 'react';
import { View } from 'react-native';
import { clampProgress } from './nativeProgressShared';
import type { NativeProgressBarProps } from './nativeProgressShared';

export type { NativeProgressBarProps } from './nativeProgressShared';

const BAR_THICKNESS = 4;
const STOP_DOT = 3;

/** Mirrors the stock Material 3 linear indicator: thin track, flat caps, end stop dot. */
export function NativeProgressBar({ progress, color, trackColor, height = 8 }: NativeProgressBarProps) {
  const filled = clampProgress(progress);

  return (
    <View style={{ width: '100%', height, justifyContent: 'center' }}>
      <View style={{ width: '100%', height: BAR_THICKNESS, borderRadius: 2, backgroundColor: trackColor, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${filled * 100}%`, backgroundColor: color }} />
      </View>
      <View
        style={{
          position: 'absolute',
          right: 1,
          width: STOP_DOT,
          height: STOP_DOT,
          borderRadius: STOP_DOT / 2,
          backgroundColor: color,
          opacity: filled >= 1 ? 0 : 0.5,
        }}
      />
    </View>
  );
}

export default NativeProgressBar;
