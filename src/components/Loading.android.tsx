import React from 'react';
import { View } from 'react-native';
import { Host, ContainedLoadingIndicator, LoadingIndicator } from '@expo/ui/jetpack-compose';
import { resolveLoadingSize, type LoadingProps } from './loadingShared';

// Jetpack Compose draws the M3 Expressive shape at ~40dp; scale the host to the size we are asked for.
const NATIVE_BASE = 40;

export type { LoadingProps } from './loadingShared';

export function Loading({
  size = 'small',
  color = '#E11D48',
  containerColor,
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
      <Host matchContents style={{ transform: [{ scale }], opacity: animating ? 1 : 0.6 }}>
        {containerColor ? (
          <ContainedLoadingIndicator color={color} containerColor={containerColor} />
        ) : (
          <LoadingIndicator color={color} />
        )}
      </Host>
    </View>
  );
}

export const Spinner = Loading;
export default Loading;
