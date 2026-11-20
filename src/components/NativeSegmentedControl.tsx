import React from 'react';
import { View, Text as RNText, TouchableOpacity, Platform } from 'react-native';

import { softShadow } from '../utils/shadows';
export interface SegmentItem<T extends string> {
  key: T;
  label: string;
}

interface NativeSegmentedControlProps<T extends string> {
  items: SegmentItem<T>[];
  activeKey: T;
  onChangeKey: (key: T) => void;
  marginVertical?: number;
}

let JetpackCompose: any = null;
let ComposeModifiers: any = null;
if (Platform.OS === 'android') {
  try {
    JetpackCompose = require('@expo/ui/jetpack-compose');
    ComposeModifiers = require('@expo/ui/jetpack-compose/modifiers');
  } catch {}
}

let CommunitySegmentedControl: any = null;
if (Platform.OS === 'ios') {
  try {
    CommunitySegmentedControl = require('@expo/ui/community/segmented-control').SegmentedControl;
  } catch {}
}

export function NativeSegmentedControl<T extends string>({
  items,
  activeKey,
  onChangeKey,
  marginVertical = 6,
}: NativeSegmentedControlProps<T>) {
  // Android: Jetpack Compose SingleChoiceSegmentedButtonRow
  if (Platform.OS === 'android' && JetpackCompose?.SingleChoiceSegmentedButtonRow && JetpackCompose?.SegmentedButton) {
    const { Host, SingleChoiceSegmentedButtonRow, SegmentedButton, Text } = JetpackCompose;
    const fillMaxWidthMod = ComposeModifiers?.fillMaxWidth ? [ComposeModifiers.fillMaxWidth()] : undefined;
    const weightMod = ComposeModifiers?.weight ? [ComposeModifiers.weight(1)] : undefined;

    return (
      <View style={{ width: '100%', marginVertical }}>
        <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
          <SingleChoiceSegmentedButtonRow modifiers={fillMaxWidthMod}>
            {items.map((item) => {
              const isSelected = activeKey === item.key;
              return (
                <SegmentedButton
                  key={item.key}
                  selected={isSelected}
                  onClick={() => onChangeKey(item.key)}
                  modifiers={weightMod}
                  colors={{
                    activeContainerColor: '#101828',
                    activeContentColor: '#FFFFFF',
                    activeBorderColor: '#101828',
                    inactiveContainerColor: 'transparent',
                    inactiveContentColor: '#6B7280',
                    inactiveBorderColor: '#E5E7EB',
                  }}
                >
                  <SegmentedButton.Label>
                    <Text 
                      color={isSelected ? '#FFFFFF' : '#4B5563'}
                      fontWeight="900"
                      style={{ fontSize: 13, letterSpacing: 0.5 }}
                    >
                      {item.label}
                    </Text>
                  </SegmentedButton.Label>
                </SegmentedButton>
              );
            })}
          </SingleChoiceSegmentedButtonRow>
        </Host>
      </View>
    );
  }

  // iOS: Native iOS UISegmentedControl via @expo/ui/community/segmented-control
  if (Platform.OS === 'ios' && CommunitySegmentedControl) {
    const selectedIndex = items.findIndex((r) => r.key === activeKey);
    return (
      <View style={{ width: '100%', marginVertical }}>
        <CommunitySegmentedControl
          values={items.map((r) => r.label)}
          selectedIndex={selectedIndex >= 0 ? selectedIndex : 0}
          onChange={(event: any) => {
            const index = event?.nativeEvent?.selectedSegmentIndex;
            if (typeof index === 'number' && items[index]) {
              onChangeKey(items[index].key);
            }
          }}
          tintColor="#101828"
          style={{ height: 38 }}
        />
      </View>
    );
  }

  // Fallback: React Native Custom Segmented Buttons
  return (
    <View className="flex-row bg-[#E5E7EB]/40 border border-[#E5E7EB]/80 p-1.5 rounded-2xl" style={{ marginVertical }}>
      {items.map(({ key: r, label }) => {
        const isActive = activeKey === r;
        return (
          <TouchableOpacity
            key={r}
            activeOpacity={0.7}
            onPress={() => onChangeKey(r)}
            className="flex-1 py-3 rounded-xl items-center justify-center"
            style={{
              backgroundColor: isActive ? '#101828' : 'transparent',
              ...softShadow({ color: '#101828', opacity: isActive ? 0.15 : 0, radius: 4, offsetY: 2 }),
            }}
          >
            <RNText
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{
                color: isActive ? '#FFFFFF' : '#4B5563',
              }}
            >
              {label}
            </RNText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

