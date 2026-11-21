import React from 'react';

export interface NativeDatePickerDialogProps {
  visible: boolean;
  initialDate?: string | Date | null;
  onDateSelected: (date: Date) => void;
  onDismiss: () => void;
}

export const NativeDatePickerDialog: React.FC<NativeDatePickerDialogProps> = () => {
  return null;
};

export default NativeDatePickerDialog;

