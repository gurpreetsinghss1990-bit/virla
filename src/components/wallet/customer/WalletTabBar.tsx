import React from 'react';
import { View, Text, Pressable } from 'react-native';

export type WalletTab = 'ledger' | 'transfer' | 'lots';

const TABS: { key: WalletTab; label: string }[] = [
  { key: 'ledger', label: 'LEDGER' },
  { key: 'transfer', label: 'TRANSFER' },
  { key: 'lots', label: 'LOTS' },
];

interface WalletTabBarProps {
  activeTab: WalletTab;
  setActiveTab: (tab: WalletTab) => void;
}

export const WalletTabBar = React.memo(function WalletTabBar({
  activeTab,
  setActiveTab,
}: WalletTabBarProps) {
  return (
    <View className="flex-row border-b border-slate-200/80 mt-1">
      {TABS.map(({ key, label }) => {
        const isActive = activeTab === key;
        return (
          <Pressable
            key={key}
            onPress={() => setActiveTab(key)}
            className={`flex-1 pb-3 items-center justify-center border-b-2 ${
              isActive ? 'border-slate-900 -mb-[1px]' : 'border-transparent'
            }`}
          >
            <Text
              numberOfLines={1}
              style={{
                fontFamily: isActive ? 'Outfit_700Bold' : 'Outfit_500Medium',
                letterSpacing: 0.8,
              }}
              className={`text-xs uppercase ${
                isActive ? 'text-slate-900' : 'text-slate-400'
              }`}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

