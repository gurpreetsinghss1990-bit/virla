import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { NativePressable } from './NativePressable';

export interface NativeGoalChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
  size?: 'small' | 'regular';
}

export const NativeGoalChip = React.memo(({ label, selected, onPress, color, size = 'small' }: NativeGoalChipProps) => {
  const activeColor = color || '#059669'; // default emerald green
  const isSmall = size === 'small';

  return (
    <NativePressable
      rippleColor={selected ? 'rgba(255, 255, 255, 0.4)' : 'rgba(5, 150, 105, 0.25)'}
      onPress={onPress}
      style={[
        styles.capsule,
        isSmall && { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
        selected
          ? [styles.capsuleSelected, { backgroundColor: activeColor, borderColor: activeColor }]
          : styles.capsuleUnselected,
      ]}
    >
      <Text
        style={[
          styles.capsuleText,
          isSmall && { fontSize: 11 },
          selected ? styles.capsuleTextSelected : styles.capsuleTextUnselected,
        ]}
      >
        {label}
      </Text>
      {selected && <Feather name="check" size={isSmall ? 10 : 13} color="#FFFFFF" />}
    </NativePressable>
  );
});

const styles = StyleSheet.create({
  capsule: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  capsuleSelected: {
    backgroundColor: '#E11D48',
    borderColor: '#E11D48',
  },
  capsuleUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E4E7',
  },
  capsuleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  capsuleTextSelected: {
    color: '#FFFFFF',
  },
  capsuleTextUnselected: {
    color: '#27272A',
  },
});

