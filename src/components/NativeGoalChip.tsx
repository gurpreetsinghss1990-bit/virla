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
  const isSmall = size === 'small';

  return (
    <NativePressable
      rippleColor={selected ? 'rgba(5, 150, 105, 0.2)' : 'rgba(100, 116, 139, 0.15)'}
      onPress={onPress}
      style={[
        styles.capsule,
        isSmall && { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
        selected
          ? styles.capsuleSelected
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
      {selected && <Feather name="check" size={isSmall ? 10 : 13} color="#059669" />}
    </NativePressable>
  );
});

const styles = StyleSheet.create({
  capsule: {
    borderRadius: 9999,
    overflow: 'hidden',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  capsuleSelected: {
    backgroundColor: '#ECFDF5', // subtle soft light green
    borderColor: '#A7F3D0', // light emerald border
  },
  capsuleUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  capsuleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  capsuleTextSelected: {
    color: '#065F46', // deep readable green
  },
  capsuleTextUnselected: {
    color: '#475569',
  },
});

