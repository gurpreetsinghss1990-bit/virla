import type { StyleProp, ViewStyle } from 'react-native';

export type NativeSwitchProps = {
  value: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  trackColor?: { false?: string; true?: string };
  thumbColor?: string;
  ios_backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
};

export const SWITCH_COLORS = {
  trackOn: '#E11D48',
  trackOff: '#E5E7EB',
  thumb: '#FFFFFF',
} as const;
