import React from 'react';
import { Text, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { NativePressable } from './NativePressable';

export interface NativeGoalChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
  size?: 'small' | 'regular';
}

export const NativeGoalChip = React.memo(({ label, selected, onPress, size = 'small' }: NativeGoalChipProps) => {
  const isSmall = size === 'small';

  return (
    <NativePressable
      rippleColor={selected ? 'rgba(5, 150, 105, 0.2)' : 'rgba(100, 116, 139, 0.15)'}
      onPress={onPress}
      style={[
        styles.capsule,
        isSmall && styles.capsuleSmall,
        selected ? styles.capsuleSelected : styles.capsuleUnselected,
      ]}
    >
      <Text
        style={[
          styles.capsuleText,
          isSmall && styles.capsuleTextSmall,
          selected ? styles.capsuleTextSelected : styles.capsuleTextUnselected,
        ]}
      >
        {label}
      </Text>
      {selected && <Feather name="check" size={isSmall ? 11 : 13} color="#065F46" />}
    </NativePressable>
  );
});

const styles = StyleSheet.create({
  capsule: {
    borderRadius: 9999, // fully rounded pill
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    overflow: 'hidden',
  },
  capsuleSmall: {
    paddingHorizontal: 13,
    paddingVertical: 5.5,
    borderRadius: 9999,
  },
  capsuleSelected: {
    backgroundColor: '#ECFDF5', // subtle light emerald
    borderColor: '#10B981',     // green border
  },
  capsuleUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',     // subtle outline
  },
  capsuleText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  capsuleTextSmall: {
    fontSize: 11,
    fontWeight: '700',
  },
  capsuleTextSelected: {
    color: '#065F46', // deep readable emerald
  },
  capsuleTextUnselected: {
    color: '#475569',
  },
});


