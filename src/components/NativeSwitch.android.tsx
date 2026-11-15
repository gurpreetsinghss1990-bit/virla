import React from 'react';
import { View } from 'react-native';
import { Host, Switch } from '@expo/ui/jetpack-compose';
import { SWITCH_COLORS, type NativeSwitchProps } from './switchShared';

export type { NativeSwitchProps } from './switchShared';

export function NativeSwitch({ value, onValueChange, disabled, trackColor, thumbColor, style }: NativeSwitchProps) {
  return (
    <View style={style}>
      <Host matchContents>
        <Switch
          value={value}
          enabled={!disabled}
          onCheckedChange={onValueChange}
          colors={{
            checkedTrackColor: trackColor?.true ?? SWITCH_COLORS.trackOn,
            uncheckedTrackColor: trackColor?.false ?? SWITCH_COLORS.trackOff,
            checkedThumbColor: thumbColor ?? SWITCH_COLORS.thumb,
            uncheckedThumbColor: thumbColor ?? SWITCH_COLORS.thumb,
            checkedBorderColor: trackColor?.true ?? SWITCH_COLORS.trackOn,
            uncheckedBorderColor: trackColor?.false ?? SWITCH_COLORS.trackOff,
          }}
        />
      </Host>
    </View>
  );
}

export default NativeSwitch;
