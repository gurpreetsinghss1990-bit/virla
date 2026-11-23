import React from 'react';
import { View, Pressable, Platform, ViewStyle, StyleProp } from 'react-native';

import { softShadow } from '../utils/shadows';
interface NativeOverviewCardProps {
  backgroundColor: string;
  borderColor?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export const NativeOverviewCard: React.FC<NativeOverviewCardProps> = ({
  backgroundColor,
  borderColor,
  onPress,
  style,
  children,
}) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="w-[47%] h-[142px] p-4 rounded-3xl justify-between"
      style={[
        {
          backgroundColor,
          borderRadius: 24,
          borderWidth: Platform.OS === 'ios' ? 0.5 : 0,
          borderColor: borderColor || (Platform.OS === 'android' ? 'rgba(0, 0, 0, 0.04)' : 'rgba(60, 60, 67, 0.12)'),
          ...softShadow({ color: '#101828', opacity: 0.06, radius: 8, offsetY: 2 }),
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
};
