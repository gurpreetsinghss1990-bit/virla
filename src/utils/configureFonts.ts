import React from 'react';
import { Text as RNText, StyleSheet, TextProps, TextStyle } from 'react-native';

// Cache of weight-to-font mapping for Inter
const INTER_FONT_MAP: Record<string, string> = {
  '100': 'Inter_100Thin',
  '200': 'Inter_200ExtraLight',
  '300': 'Inter_300Light',
  '400': 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
  '900': 'Inter_900Black',
  normal: 'Inter_400Regular',
  bold: 'Inter_700Bold',
};

let isGlobalTextConfigured = false;

export function configureGlobalInterFont() {
  if (isGlobalTextConfigured) return;
  isGlobalTextConfigured = true;

  const originalRender = (RNText as any).render;
  if (!originalRender) return;

  (RNText as any).render = function (props: TextProps, ref: any) {
    const flatStyle: TextStyle = StyleSheet.flatten(props?.style) || {};

    // Preserve custom font if explicitly set (e.g. PlaywriteCAGuides, monospace, or brand font)
    if (flatStyle.fontFamily && flatStyle.fontFamily !== 'System' && flatStyle.fontFamily !== 'normal') {
      return originalRender.call(this, props, ref);
    }

    const weightKey = String(flatStyle.fontWeight || '400');
    const interFontFamily = INTER_FONT_MAP[weightKey] || 'Inter_400Regular';

    // Inter fonts already have weight baked into the font file.
    // Explicitly setting the fontFamily ensures crisp, un-glitched rendering on Android.
    const enhancedStyle: TextStyle = {
      ...flatStyle,
      fontFamily: interFontFamily,
      fontWeight: undefined, // remove artificial weight simulation that glitches custom fonts
    };

    const newProps = {
      ...props,
      style: enhancedStyle,
    };

    return originalRender.call(this, newProps, ref);
  };
}
