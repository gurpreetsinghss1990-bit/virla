import React from 'react';
import { Host, FilterChip, Text as ComposeText } from '@expo/ui/jetpack-compose';

export interface NativeGoalChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
  size?: 'small' | 'regular';
}

export const NativeGoalChip = React.memo(({ label, selected, onPress }: NativeGoalChipProps) => {
  return (
    <Host matchContents>
      <FilterChip selected={selected} onClick={onPress}>
        <FilterChip.Label>
          <ComposeText>{label}</ComposeText>
        </FilterChip.Label>
      </FilterChip>
    </Host>
  );
});

