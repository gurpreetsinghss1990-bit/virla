import React from 'react';
import { View } from 'react-native';

export const NativeAuthCard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <View
      className="rounded-[36px] border border-white/10 my-4"
      style={{ backgroundColor: 'rgba(15, 15, 18, 0.9)' }}
    >
      {children}
    </View>
  );
};

