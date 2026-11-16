import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { NativePressable } from './NativePressable';

export interface NativePrimaryButtonProps {
  label: string;
  onPress: () => void;
  color?: string;
  compact?: boolean;
}

export const NativePrimaryButton = React.memo(({ label, onPress, color = '#E11D48', compact = false }: NativePrimaryButtonProps) => {
  return (
    <NativePressable
      rippleColor="rgba(255, 255, 255, 0.25)"
      onPress={onPress}
      style={[
        styles.saveButton,
        { backgroundColor: color },
        compact && { minHeight: 44, paddingVertical: 10, paddingHorizontal: 16 },
      ]}
    >
      <Text style={[styles.saveButtonText, compact && { fontSize: 13 }]}>{label}</Text>
    </NativePressable>
  );
});

const styles = StyleSheet.create({
  saveButton: {
    backgroundColor: '#E11D48',
    borderRadius: 16,
    minHeight: 56,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});

