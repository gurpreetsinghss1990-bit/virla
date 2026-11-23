import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Reanimated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Feather, Ionicons } from '@expo/vector-icons';

interface InlineFitnessDropdownProps {
  value: string;
  onSelect: (level: string) => void;
  onClose: () => void;
}

const FITNESS_LEVELS = [
  { level: 'Beginner', desc: 'Starting out or returning after a break' },
  { level: 'Intermediate', desc: 'Regular workouts for 6+ months' },
  { level: 'Advanced', desc: 'Consistent intense training 4+ days/week' },
  { level: 'Athlete', desc: 'Competitive sport / peak conditioning' },
];

export const InlineFitnessDropdown: React.FC<InlineFitnessDropdownProps> = React.memo(({
  value,
  onSelect,
  onClose,
}) => {
  return (
    <Reanimated.View 
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(120)}
      layout={LinearTransition.duration(180)}
      style={styles.card}
    >
      {FITNESS_LEVELS.map((item, index) => {
        const isSelected = value.toLowerCase() === item.level.toLowerCase();
        return (
          <Pressable
            key={item.level}
            onPress={() => {
              onSelect(item.level);
              onClose();
            }}
            style={[
              styles.optionRow,
              index > 0 && styles.borderTop,
              isSelected && styles.optionSelected,
            ]}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.levelTitle, isSelected && styles.levelTitleSelected]}>
                  {item.level}
                </Text>
                {isSelected && (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedBadgeText}>SELECTED</Text>
                  </View>
                )}
              </View>
              <Text style={styles.descText}>{item.desc}</Text>
            </View>

            <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
              {isSelected && <View style={styles.radioInnerDot} />}
            </View>
          </Pressable>
        );
      })}
    </Reanimated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  borderTop: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F1F5F9',
  },
  optionSelected: {
    backgroundColor: '#F8FAFC',
  },
  levelTitle: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    color: '#0F172A',
  },
  levelTitleSelected: {
    color: '#E11D48',
  },
  selectedBadge: {
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  selectedBadgeText: {
    fontSize: 9,
    fontFamily: 'Outfit_700Bold',
    color: '#E11D48',
    letterSpacing: 0.5,
  },
  descText: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
    color: '#64748B',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#E11D48',
  },
  radioInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E11D48',
  },
});

export default InlineFitnessDropdown;

