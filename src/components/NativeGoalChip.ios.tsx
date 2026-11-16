import React from 'react';
import { Host, Button } from '@expo/ui/swift-ui';
import { buttonStyle, tint, controlSize } from '@expo/ui/swift-ui/modifiers';

export interface NativeGoalChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
  size?: 'small' | 'regular';
}

export const NativeGoalChip = React.memo(({ label, selected, onPress, color, size = 'small' }: NativeGoalChipProps) => {
  const activeColor = color || '#059669'; // default emerald green
  return (
    <Host matchContents>
      <Button
        label={selected ? `${label} ✓` : label}
        onPress={onPress}
        modifiers={[
          buttonStyle(selected ? 'borderedProminent' : 'bordered'),
          tint(selected ? activeColor : '#475569'),
          controlSize(size === 'small' ? 'small' : 'regular'),
        ]}
      />
    </Host>
  );
});

