import React from 'react';
import { View, Text } from 'react-native';

export const ClientTopBar = React.memo(function ClientTopBar() {
  return (
    <View className="flex-row items-center justify-between pb-3 pt-1 z-20">
      <View className="flex-row items-center gap-1.5">
        <Text
          style={{ fontFamily: 'Outfit_700Bold' }}
          className="text-xs uppercase tracking-widest text-slate-400 font-bold"
        >
          VIRLA ATHLETIC
        </Text>
        <View className="w-1.5 h-1.5 rounded-full bg-[#E11D48] mb-0.5" />
      </View>
    </View>
  );
});

