import React, { useRef } from 'react';
import { Animated, TouchableWithoutFeedback, View, StyleSheet, StyleProp, ViewStyle } from 'react-native';

interface LuxuryCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  className?: string;
  style?: StyleProp<ViewStyle>;
  interactive?: boolean; // Enable tap animation even if onPress is not passed
}

export function LuxuryCard({
  children,
  onPress,
  className = '',
  style,
  interactive = true,
}: LuxuryCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isClickable = !!onPress;

  const handlePressIn = () => {
    if (!interactive) return;
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      tension: 100,
      friction: 6,
    }).start();
  };

  const handlePressOut = () => {
    if (!interactive) return;
    Animated.spring(scaleAnim, {
      toValue: 1.0,
      useNativeDriver: true,
      tension: 100,
      friction: 6,
    }).start();
  };

  const cardContent = (
    <Animated.View
      style={[
        {
          transform: [{ scale: scaleAnim }],
          shadowColor: '#101828',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.04,
          shadowRadius: 18,
          elevation: 2,
        },
        styles.cardShadow,
        style,
      ]}
      className={`bg-white border border-[#E5E7EB]/60 rounded-[24px] overflow-hidden ${className}`}
    >
      {children}
    </Animated.View>
  );

  if (isClickable) {
    return (
      <TouchableWithoutFeedback
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {cardContent}
      </TouchableWithoutFeedback>
    );
  }

  return cardContent;
}

const styles = StyleSheet.create({
  cardShadow: {
    // Soft layered shadow structure
    shadowColor: '#101828',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
  },
});
export default LuxuryCard;
