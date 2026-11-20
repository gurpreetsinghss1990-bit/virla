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
      {selected && <Feather name="check" size={isSmall ? 11 : 13} color="#E11D48" />}
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
    backgroundColor: '#FFF1F2', // subtle soft crimson wash matching Stitch DESIGN.md
    borderColor: '#FECDD3',     // soft crimson border
  },
  capsuleUnselected: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',     // subtle outline
  },
  capsuleText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12.5,
  },
  capsuleTextSmall: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11.5,
  },
  capsuleTextSelected: {
    color: '#E11D48', // Virla Athletic Crimson Red
  },
  capsuleTextUnselected: {
    color: '#475569',
  },
});


