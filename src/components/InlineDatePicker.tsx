import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import Reanimated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

interface InlineDatePickerProps {
  value: string; // "DD/MM/YYYY" or ""
  onChange: (dateStr: string) => void;
  onClose?: () => void;
}

export const InlineDatePicker: React.FC<InlineDatePickerProps> = React.memo(({
  value,
  onChange,
  onClose,
}) => {
  // Parse initial DD/MM/YYYY
  const { initialDay, initialMonth, initialYear } = useMemo(() => {
    if (value && value.includes('/')) {
      const parts = value.split('/');
      if (parts.length === 3) {
        return {
          initialDay: parseInt(parts[0], 10) || 1,
          initialMonth: parseInt(parts[1], 10) || 1,
          initialYear: parseInt(parts[2], 10) || 1995,
        };
      }
    }
    return { initialDay: 1, initialMonth: 1, initialYear: 1995 };
  }, [value]);

  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedYear, setSelectedYear] = useState(initialYear);

  // Available days in selected month and year
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 0).getDate();
  }, [selectedYear, selectedMonth]);

  const daysList = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  }, [daysInMonth]);

  const yearsList = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const minYear = 1945;
    const maxYear = currentYear - 10; // at least 10 years old
    const list: number[] = [];
    for (let y = maxYear; y >= minYear; y--) {
      list.push(y);
    }
    return list;
  }, []);

  const handleSelect = useCallback((d: number, m: number, y: number) => {
    const dayStr = String(d).padStart(2, '0');
    const monthStr = String(m).padStart(2, '0');
    onChange(`${dayStr}/${monthStr}/${y}`);
  }, [onChange]);

  const updateDay = (d: number) => {
    setSelectedDay(d);
    handleSelect(d, selectedMonth, selectedYear);
  };

  const updateMonth = (m: number) => {
    const maxD = new Date(selectedYear, m, 0).getDate();
    const safeDay = selectedDay > maxD ? maxD : selectedDay;
    setSelectedMonth(m);
    setSelectedDay(safeDay);
    handleSelect(safeDay, m, selectedYear);
  };

  const updateYear = (y: number) => {
    const maxD = new Date(y, selectedMonth, 0).getDate();
    const safeDay = selectedDay > maxD ? maxD : selectedDay;
    setSelectedYear(y);
    setSelectedDay(safeDay);
    handleSelect(safeDay, selectedMonth, y);
  };

  return (
    <Reanimated.View 
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      layout={LinearTransition.duration(200)}
      style={styles.card}
    >
      {/* Month Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Month</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollRow}
        >
          {MONTH_NAMES.map((name, idx) => {
            const m = idx + 1;
            const isSelected = selectedMonth === m;
            return (
              <TouchableOpacity
                key={name}
                activeOpacity={0.7}
                onPress={() => updateMonth(m)}
                style={[styles.pill, isSelected && styles.pillSelected]}
              >
                <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                  {name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Day Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Day</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollRow}
        >
          {daysList.map((d) => {
            const isSelected = selectedDay === d;
            return (
              <TouchableOpacity
                key={d}
                activeOpacity={0.7}
                onPress={() => updateDay(d)}
                style={[styles.dayPill, isSelected && styles.pillSelected]}
              >
                <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                  {d}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Year Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Year</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollRow}
        >
          {yearsList.map((y) => {
            const isSelected = selectedYear === y;
            return (
              <TouchableOpacity
                key={y}
                activeOpacity={0.7}
                onPress={() => updateYear(y)}
                style={[styles.pill, isSelected && styles.pillSelected]}
              >
                <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                  {y}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Footer / Confirm */}
      {onClose && (
        <View style={styles.footer}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onClose}
            style={styles.doneButton}
          >
            <Feather name="check" size={14} color="#FFFFFF" />
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </Reanimated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    marginTop: 4,
  },
  section: {
    gap: 6,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#64748B',
  },
  scrollRow: {
    gap: 6,
    paddingVertical: 2,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayPill: {
    width: 36,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pillSelected: {
    backgroundColor: '#090D16',
    borderColor: '#090D16',
  },
  pillText: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    color: '#475569',
  },
  pillTextSelected: {
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#090D16',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  doneButtonText: {
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
    color: '#FFFFFF',
  },
});

export default InlineDatePicker;

