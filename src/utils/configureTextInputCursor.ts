import React from 'react';
import { TextInput, TextInputProps, Platform } from 'react-native';

let isPatched = false;

/**
 * Globally configures React Native's TextInput so that all input bars in the app
 * display a luxury black blinking cursor and matching teardrop pin selection handle.
 */
export function configureGlobalTextInputCursor() {
  if (isPatched) return;
  isPatched = true;

  const defaultCursorColor = '#18181B'; // Premium deep black / charcoal
  const defaultSelectionColor = Platform.OS === 'ios' ? '#18181B' : 'rgba(24, 24, 27, 0.2)';
  const defaultHandleColor = '#18181B'; // Bottom teardrop pin handle on Android

  // 1. Set React Native defaultProps if supported
  if ((TextInput as any).defaultProps == null) {
    (TextInput as any).defaultProps = {};
  }
  (TextInput as any).defaultProps.cursorColor = defaultCursorColor;
  (TextInput as any).defaultProps.selectionColor = defaultSelectionColor;
  if (Platform.OS === 'android') {
    (TextInput as any).defaultProps.selectionHandleColor = defaultHandleColor;
  }

  // 2. Hook into TextInput component render to guarantee props on modern React Native (Fabric & Paper)
  const OriginalTextInput = (TextInput as any).render;
  if (typeof OriginalTextInput === 'function') {
    (TextInput as any).render = function (props: TextInputProps, ref: any) {
      const mergedProps: TextInputProps = {
        cursorColor: props.cursorColor ?? defaultCursorColor,
        selectionColor: props.selectionColor ?? defaultSelectionColor,
        ...(Platform.OS === 'android'
          ? {
              selectionHandleColor: (props as any).selectionHandleColor ?? defaultHandleColor,
            }
          : {}),
        ...props,
      };
      return OriginalTextInput.call(this, mergedProps, ref);
    };
  }
}

