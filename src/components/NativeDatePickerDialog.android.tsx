import React from 'react';
import { StyleSheet } from 'react-native';
import { Host, DatePickerDialog } from '@expo/ui/jetpack-compose';

export interface NativeDatePickerDialogProps {
  visible: boolean;
  initialDate?: string | Date | null;
  onDateSelected: (date: Date) => void;
  onDismiss: () => void;
}

export const NativeDatePickerDialog: React.FC<NativeDatePickerDialogProps> = ({
  visible,
  initialDate,
  onDateSelected,
  onDismiss,
}) => {
  if (!visible) return null;

  let parsedDate: string | undefined;
  if (initialDate) {
    if (initialDate instanceof Date) {
      parsedDate = initialDate.toISOString();
    } else if (typeof initialDate === 'string') {
      // Check if it's DD/MM/YYYY
      const parts = initialDate.trim().split('/');
      if (parts.length === 3) {
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        const y = parts[2];
        parsedDate = `${y}-${m}-${d}T00:00:00.000Z`;
      } else {
        parsedDate = initialDate;
      }
    }
  }

  return (
    <Host style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <DatePickerDialog
        initialDate={parsedDate}
        selectableDates={{
          end: new Date(), // Date of birth cannot be in the future
        }}
        confirmButtonLabel="Select"
        dismissButtonLabel="Cancel"
        onDateSelected={(date: Date) => {
          onDateSelected(date);
        }}
        onDismissRequest={onDismiss}
      />
    </Host>
  );
};

export default NativeDatePickerDialog;
