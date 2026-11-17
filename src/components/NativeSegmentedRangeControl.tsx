import React from 'react';
import { NativeSegmentedControl } from './NativeSegmentedControl';

export type RangeType = 'weekly' | 'monthly' | 'yearly';

interface NativeSegmentedControlProps {
  activeRange: RangeType;
  onChangeRange: (range: RangeType) => void;
}

const RANGES = [
  { key: 'weekly' as RangeType, label: 'WEEKLY' },
  { key: 'monthly' as RangeType, label: 'MONTHLY' },
  { key: 'yearly' as RangeType, label: 'YEARLY' },
];

export const NativeSegmentedRangeControl: React.FC<NativeSegmentedControlProps> = ({
  activeRange,
  onChangeRange,
}) => {
  return (
    <NativeSegmentedControl
      items={RANGES}
      activeKey={activeRange}
      onChangeKey={onChangeRange}
      marginVertical={6}
    />
  );
};
