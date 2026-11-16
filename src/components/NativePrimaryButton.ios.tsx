import React from 'react';
import { Host, Button } from '@expo/ui/swift-ui';
import { buttonStyle, tint, controlSize, frame } from '@expo/ui/swift-ui/modifiers';

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
        label={label}
        onPress={onPress}
        modifiers={[
          buttonStyle('borderedProminent'),
          tint(color),
          controlSize(compact ? 'regular' : 'large'),
          ...(compact ? [] : [frame({ maxWidth: Infinity })]),
        ]}
      />
    </Host>
  );
});

