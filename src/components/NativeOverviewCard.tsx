import React from 'react';
import { View, TouchableOpacity, Platform, ViewStyle, StyleProp } from 'react-native';

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
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={!onPress}
      className="w-[47%] h-[142px] p-4 rounded-3xl justify-between"
      style={[
        {
          backgroundColor,
          borderRadius: 24,
          borderWidth: Platform.OS === 'ios' ? 0.5 : 1,
          borderColor: borderColor || (Platform.OS === 'android' ? 'rgba(0, 0, 0, 0.04)' : 'rgba(60, 60, 67, 0.12)'),
          elevation: Platform.OS === 'android' ? 2 : 0,
          shadowColor: '#101828',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </TouchableOpacity>
  );
};
