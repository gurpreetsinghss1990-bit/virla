import React from 'react';
import { Platform, Pressable } from 'react-native';
import type { GestureResponderEvent, PressableProps, StyleProp, ViewStyle } from 'react-native';

export type NativePressableProps = Omit<PressableProps, 'style' | 'android_ripple'> & {
  rippleColor: string;
  style?: StyleProp<ViewStyle>;
  /** iOS press highlight, like a native UIButton. Set 1 to disable. */
  pressedOpacity?: number;
};

const IOS_PRESSED_OPACITY = 0.62;

/**
 * Android: real platform ripple (RippleDrawable) through android_ripple.
 * iOS: iOS has no ripple, so the system convention is used instead — the whole
 * control dims while held (UIButton / UIControl highlight behaviour).
 */
export function NativePressable({
  rippleColor,
  pressedOpacity = IOS_PRESSED_OPACITY,
  style,
  disabled,
  onPress,
  onLongPress,
  children,
  ...rest
}: NativePressableProps) {
  const handlePress = (event: GestureResponderEvent) => {
    if (disabled) return;
    onPress?.(event);
  };

  if (Platform.OS === 'android') {
    return (
      <Pressable
        {...rest}
        disabled={disabled}
        onPress={handlePress}
        onLongPress={onLongPress}
        android_ripple={{ color: rippleColor, borderless: false, foreground: false }}
        style={style}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPress={handlePress}
      onLongPress={onLongPress}
      style={(state) => [style, state.pressed && !disabled && styles.iosHighlight(pressedOpacity)]}
    >
      {children}
    </Pressable>
  );
}

const styles = {
  iosHighlight: (opacity: number): ViewStyle => ({ opacity }),
};

export default NativePressable;
