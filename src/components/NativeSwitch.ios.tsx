import React from 'react';
import { Switch } from 'react-native';
import { SWITCH_COLORS, type NativeSwitchProps } from './switchShared';

export type { NativeSwitchProps } from './switchShared';

export function NativeSwitch({ value, onValueChange, disabled, trackColor, thumbColor, ios_backgroundColor, style }: NativeSwitchProps) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: trackColor?.false ?? SWITCH_COLORS.trackOff, true: trackColor?.true ?? SWITCH_COLORS.trackOn }}
      thumbColor={thumbColor}
      ios_backgroundColor={ios_backgroundColor}
      style={style}
    />
  );
}

export default NativeSwitch;
