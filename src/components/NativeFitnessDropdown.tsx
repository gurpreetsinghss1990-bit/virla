import React from 'react';
import { View, Text } from 'react-native';
import { MenuView } from '@expo/ui/community/menu';
import { Feather } from '@expo/vector-icons';

export interface NativeFitnessDropdownProps {
  value: string;
  onSelect: (level: string) => void;
}

const FITNESS_OPTIONS = [
  { id: 'Beginner', title: 'Beginner' },
  { id: 'Intermediate', title: 'Intermediate' },
  { id: 'Advanced', title: 'Advanced' },
  { id: 'Athlete', title: 'Athlete' },
];

export const NativeFitnessDropdown: React.FC<NativeFitnessDropdownProps> = React.memo(({
  value,
  onSelect,
}) => {
  return (
    <MenuView
      title="Fitness Level"
      onPressAction={({ nativeEvent }) => {
        if (nativeEvent?.event) {
          onSelect(nativeEvent.event);
        }
      }}
      actions={FITNESS_OPTIONS.map((opt) => ({
        id: opt.id,
        title: opt.title,
        state: value && value.toLowerCase() === opt.id.toLowerCase() ? 'on' : 'off',
      }))}
      style={{ width: '100%' }}
    >
      <View
        style={{
          backgroundColor: '#F8FAFC',
          borderWidth: 1,
          borderColor: 'rgba(226, 232, 240, 0.9)',
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 13,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={{
            flex: 1,
            fontSize: 14,
            color: value ? '#0F172A' : '#94A3B8',
            fontFamily: 'Outfit_600SemiBold',
          }}
        >
          {value || 'Select Fitness Level'}
        </Text>
        <Feather name="chevron-down" size={16} color="#64748B" />
      </View>
    </MenuView>
  );
});

export default NativeFitnessDropdown;

