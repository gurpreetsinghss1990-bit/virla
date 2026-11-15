import React from 'react';
import { View } from 'react-native';
import { Host, ProgressView } from '@expo/ui/swift-ui';
import { controlSize, tint } from '@expo/ui/swift-ui/modifiers';
import { resolveLoadingSize, type LoadingProps } from './loadingShared';

const NATIVE_BASE = 20;

export type { LoadingProps } from './loadingShared';

export function Loading({
  size = 'small',
  color = '#E11D48',
  animating = true,
  hidesWhenStopped = false,
  style,
  accessibilityLabel = 'Loading',
  className,
}: LoadingProps) {
  const px = resolveLoadingSize(size);
  if (!animating && hidesWhenStopped) return null;

  const scale = px / NATIVE_BASE;

  return (
    <View
      className={className}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      style={[{ width: px, height: px, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Host
        matchContents
        style={{ transform: [{ scale }], opacity: animating ? 1 : 0.6 }}
        modifiers={[controlSize(px >= 32 ? 'regular' : 'small')]}
      >
        <ProgressView modifiers={[tint(color)]} />
      </Host>
    </View>
  );
}

export const Spinner = Loading;
export default Loading;
