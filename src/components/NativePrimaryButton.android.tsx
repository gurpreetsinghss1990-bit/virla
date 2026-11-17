import React from 'react';
import { Host, Button, Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';

export interface NativePrimaryButtonProps {
  label: string;
  onPress: () => void;
  color?: string;
  compact?: boolean;
}

export const NativePrimaryButton = React.memo(({ label, onPress, color = '#E11D48', compact = false }: NativePrimaryButtonProps) => {
  return (
    <Host matchContents={compact ? true : { vertical: true }} style={compact ? undefined : { width: '100%' }}>
      <Button
        onClick={onPress}
        colors={{ containerColor: color, contentColor: '#FFFFFF' }}
        modifiers={compact ? [] : [fillMaxWidth()]}
      >
        <Text>{label}</Text>
      </Button>
    </Host>
  );
});

