import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
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
    <View
      style={[
        styles.capsuleWrapper,
        isSmall && { borderRadius: 20 },
        selected ? styles.capsuleSelected : styles.capsuleUnselected,
      ]}
    >
      <NativePressable
        rippleColor={selected ? 'rgba(5, 150, 105, 0.2)' : 'rgba(100, 116, 139, 0.15)'}
        onPress={onPress}
        style={[
          styles.capsule,
          isSmall && { paddingHorizontal: 12, paddingVertical: 6 },
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
        {selected && <Feather name="check" size={isSmall ? 10 : 13} color="#E11D48" />}
      </NativePressable>
    </View>
  );
});

const styles = StyleSheet.create({
  capsuleWrapper: {
    borderRadius: 9999,
    overflow: 'hidden',
    borderWidth: 1,
    flexShrink: 0,
  },
  capsule: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  capsuleSelected: {
    backgroundColor: '#FFF1F2', // subtle soft crimson wash
    borderColor: '#FECDD3',     // light crimson border
  },
  capsuleUnselected: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  capsuleText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12.5,
  },
  capsuleTextSelected: {
    color: '#E11D48', // Virla Crimson Red
  },
  capsuleTextUnselected: {
    color: '#475569',
  },
});

