import type { ReactNode } from 'react';

export type NativeSheetProps = {
  visible: boolean;
  onClose: () => void;
  backgroundColor?: string;
  contentColor?: string;
  fullHeight?: boolean;
  children: ReactNode;
};
