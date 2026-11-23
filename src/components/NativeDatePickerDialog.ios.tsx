import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { NativeSheet } from './NativeSheet';
import { DatePicker, Host } from '@expo/ui/swift-ui';

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
  const [selectedDate, setSelectedDate] = React.useState<Date>(() => {
    if (initialDate instanceof Date) return initialDate;
    if (typeof initialDate === 'string' && initialDate.includes('/')) {
      const parts = initialDate.trim().split('/');
      if (parts.length === 3) {
        return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      }
    }
    return new Date(2000, 0, 1);
  });

  if (!visible) return null;

  return (
    <NativeSheet visible={visible} onClose={onDismiss} backgroundColor="#FFFFFF">
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onDismiss}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>Select Date of Birth</Text>
          <Pressable
            onPress={() => {
              onDateSelected(selectedDate);
              onDismiss();
            }}
          >
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
        <Host style={styles.pickerHost}>
          <DatePicker
            selection={selectedDate}
            onDateChange={(d: Date) => setSelectedDate(d)}
            displayedComponents={['date']}
          />
        </Host>
      </View>
    </NativeSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  cancelText: {
    fontSize: 15,
    color: '#64748B',
  },
  doneText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E11D48',
  },
  pickerHost: {
    height: 220,
    width: '100%',
  },
});

export default NativeDatePickerDialog;
