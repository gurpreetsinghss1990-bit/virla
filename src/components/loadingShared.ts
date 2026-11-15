import type { StyleProp, ViewStyle } from 'react-native';

export const LOADING_SIZES = { small: 20, large: 36 } as const;

export type LoadingProps = {
  size?: 'small' | 'large' | number;
  color?: string;
  containerColor?: string;
  animating?: boolean;
  hidesWhenStopped?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  className?: string;
};

export function resolveLoadingSize(size: LoadingProps['size']): number {
  if (typeof size === 'number') return size;
  return LOADING_SIZES[size ?? 'small'];
}
