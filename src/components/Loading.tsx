import React from 'react';
import { ActivityIndicator } from 'react-native';
import { resolveLoadingSize, type LoadingProps } from './loadingShared';

export type { LoadingProps } from './loadingShared';
export { LOADING_SIZES, resolveLoadingSize } from './loadingShared';

export function Loading({
  size = 'small',
  color = '#E11D48',
  animating = true,
  hidesWhenStopped = false,
  style,
}: LoadingProps) {
  const px = resolveLoadingSize(size);
  if (!animating && hidesWhenStopped) return null;
  return <ActivityIndicator size={px} color={color} animating={animating} style={style} />;
}

export const Spinner = Loading;
export default Loading;
