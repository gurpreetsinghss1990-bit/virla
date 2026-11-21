import React from 'react';
import { View } from 'react-native';
import { Host, ProgressView } from '@expo/ui/swift-ui';
import { tint } from '@expo/ui/swift-ui/modifiers';
import { clampProgress } from './nativeProgressShared';
import type { NativeProgressBarProps } from './nativeProgressShared';

export type { NativeProgressBarProps } from './nativeProgressShared';

/**
 * iOS Native Linear Progress Bar powered by Apple SwiftUI ProgressView via @expo/ui/swift-ui.
 */
export function NativeProgressBar({ progress, color, height = 8 }: NativeProgressBarProps) {
  const value = clampProgress(progress);
  return (
    <View style={{ width: '100%', height, justifyContent: 'center' }}>
      <Host style={{ width: '100%' }} matchContents={{ vertical: true }}>
        <ProgressView
          value={value}
          modifiers={color ? [tint(color)] : []}
        />
      </Host>
    </View>
  );
}

export default NativeProgressBar;
