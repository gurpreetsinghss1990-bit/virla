import React from 'react';
import { Host, Button } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';

export interface NativePrimaryButtonProps {
  label: string;
  onPress: () => void;
  color?: string;
  compact?: boolean;
}

export const NativePrimaryButton = React.memo(({ label, onPress, compact = false }: NativePrimaryButtonProps) => {
  return (
    <Host matchContents={compact ? true : { vertical: true }} style={compact ? undefined : { width: '100%' }}>
      <Button onClick={onPress} modifiers={compact ? [] : [fillMaxWidth()]}>
        {label}
      </Button>
    </Host>
  );
});

