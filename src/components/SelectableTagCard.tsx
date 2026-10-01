import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Vibration,
  Image,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export interface SelectableTagItem {
  id: string;
  label: string;
  description?: string;
  iconName?: string;
  iconFamily?: 'Ionicons' | 'Feather' | 'MaterialCommunityIcons';
  iconColor?: string;
  iconBgColor?: string;
  iconSource?: any;
}

export const DIET_RESTRICTIONS_DATA: SelectableTagItem[] = [
  {
    id: 'Diabetes',
    label: 'Diabetes',
    description: 'Sugar & glycemic care',
    iconName: 'water-outline',
    iconFamily: 'Ionicons',
    iconColor: '#0284C7',
    iconBgColor: '#F0F9FF',
  },
  {
    id: 'Hypertension',
    label: 'Hypertension',
    description: 'Low sodium & BP care',
    iconName: 'pulse-outline',
    iconFamily: 'Ionicons',
    iconColor: '#E11D48',
    iconBgColor: '#FFF1F2',
  },
  {
    id: 'High Cholesterol',
    label: 'High Cholesterol',
    description: 'Heart-healthy & low fat',
    iconName: 'shield-checkmark-outline',
    iconFamily: 'Ionicons',
    iconColor: '#D97706',
    iconBgColor: '#FEF9C3',
  },
  {
    id: 'Lactose Intolerant',
    label: 'Lactose Intolerant',
    description: 'Dairy & whey-free',
    iconName: 'wine-outline',
    iconFamily: 'Ionicons',
    iconColor: '#7C3AED',
    iconBgColor: '#F5F3FF',
  },
  {
    id: 'Gluten Free',
    label: 'Gluten Free',
    description: 'Wheat & barley free',
    iconName: 'leaf-outline',
    iconFamily: 'Ionicons',
    iconColor: '#059669',
    iconBgColor: '#ECFDF5',
  },
  {
    id: 'Nut Allergy',
    label: 'Nut Allergy',
    description: 'Peanut & tree nut safe',
    iconName: 'alert-circle-outline',
    iconFamily: 'Ionicons',
    iconColor: '#EA580C',
    iconBgColor: '#FFF7ED',
  },
  {
    id: 'No Restrictions',
    label: 'No Restrictions',
    description: 'No dietary limitations or allergens',
    iconName: 'shield-checkmark-outline',
    iconFamily: 'Ionicons',
    iconColor: '#059669',
    iconBgColor: '#ECFDF5',
  },
];

export const PHYSICAL_CONDITIONS_DATA: SelectableTagItem[] = [
  {
    id: 'Lower Back Pain',
    label: 'Lower Back Pain',
    description: 'Spine & lumbar care',
    iconName: 'body-outline',
    iconFamily: 'Ionicons',
    iconColor: '#D97706',
    iconBgColor: '#FEF9C3',
  },
  {
    id: 'Knee Stiffness',
    label: 'Knee Stiffness',
    description: 'Low impact & joint care',
    iconName: 'walk-outline',
    iconFamily: 'Ionicons',
    iconColor: '#0284C7',
    iconBgColor: '#F0F9FF',
  },
  {
    id: 'Shoulder / Neck',
    label: 'Shoulder / Neck',
    description: 'Cervical & upper mobility',
    iconName: 'fitness-outline',
    iconFamily: 'Ionicons',
    iconColor: '#8B5CF6',
    iconBgColor: '#F5F3FF',
  },
  {
    id: 'Asthma',
    label: 'Asthma',
    description: 'Breathing & pacing care',
    iconName: 'cloud-outline',
    iconFamily: 'Ionicons',
    iconColor: '#06B6D4',
    iconBgColor: '#ECFEFF',
  },
  {
    id: 'Thyroid',
    label: 'Thyroid',
    description: 'Metabolic & fatigue care',
    iconName: 'pulse-outline',
    iconFamily: 'Ionicons',
    iconColor: '#E11D48',
    iconBgColor: '#FFF1F2',
  },
  {
    id: 'Other Condition',
    label: 'Other Condition',
    description: 'Specify injury / rehab',
    iconName: 'add-circle-outline',
    iconFamily: 'Ionicons',
    iconColor: '#EA580C',
    iconBgColor: '#FFF7ED',
  },
  {
    id: 'None',
    label: 'None / No Health Issues',
    description: 'Fit with no limitations or injuries',
    iconName: 'shield-checkmark-outline',
    iconFamily: 'Ionicons',
    iconColor: '#059669',
    iconBgColor: '#ECFDF5',
  },
];

export const SUPPLEMENTS_DATA: SelectableTagItem[] = [
  {
    id: 'Protein',
    label: 'Whey / Plant Protein',
    description: 'Muscle repair & daily targets',
    iconSource: require('../../assets/images/goal/whey.png'),
    iconName: 'shaker-outline',
    iconFamily: 'MaterialCommunityIcons',
    iconColor: '#0284C7',
    iconBgColor: '#F0F9FF',
  },
  {
    id: 'Creatine',
    label: 'Creatine',
    description: 'Strength, power & cellular energy',
    iconSource: require('../../assets/images/goal/creatine.png'),
    iconName: 'dumbbell',
    iconFamily: 'MaterialCommunityIcons',
    iconColor: '#E11D48',
    iconBgColor: '#FFF1F2',
  },
  {
    id: 'Omega-3',
    label: 'Omega-3 / Fish Oil',
    description: 'Heart, brain & joint health',
    iconName: 'water-outline',
    iconFamily: 'Ionicons',
    iconColor: '#059669',
    iconBgColor: '#ECFDF5',
  },
  {
    id: 'Multivitamins',
    label: 'Daily Multivitamin',
    description: 'Essential micronutrients & vitality',
    iconName: 'shield-checkmark-outline',
    iconFamily: 'Ionicons',
    iconColor: '#D97706',
    iconBgColor: '#FEF9C3',
  },
  {
    id: 'Vitamin D3',
    label: 'Vitamin D3 + K2',
    description: 'Bone density, mood & immunity',
    iconName: 'sunny-outline',
    iconFamily: 'Ionicons',
    iconColor: '#EA580C',
    iconBgColor: '#FFF7ED',
  },
  {
    id: 'Pre-Workout',
    label: 'Pre-Workout',
    description: 'Energy, focus & training pump',
    iconName: 'flame-outline',
    iconFamily: 'Ionicons',
    iconColor: '#DC2626',
    iconBgColor: '#FEF2F2',
  },
  {
    id: 'Magnesium',
    label: 'Magnesium / Sleep',
    description: 'Muscle relaxation & deep sleep',
    iconName: 'moon-outline',
    iconFamily: 'Ionicons',
    iconColor: '#7C3AED',
    iconBgColor: '#F5F3FF',
  },
  {
    id: 'Other',
    label: 'Other Supplement',
    description: 'Specify custom stack',
    iconName: 'add-circle-outline',
    iconFamily: 'Ionicons',
    iconColor: '#6366F1',
    iconBgColor: '#EEF2FF',
  },
  {
    id: 'None',
    label: 'None / No Supplements',
    description: 'Relying exclusively on whole natural foods',
    iconName: 'shield-checkmark-outline',
    iconFamily: 'Ionicons',
    iconColor: '#059669',
    iconBgColor: '#ECFDF5',
  },
];

interface SelectableCardProps {
  item: SelectableTagItem;
  isSelected: boolean;
  onToggle: () => void;
  index?: number;
}

/**
 * Render icon based on icon family
 */
function RenderIcon({
  item,
  size = 22,
}: {
  item: SelectableTagItem;
  size?: number;
}) {
  if (item.iconSource) {
    return (
      <Image
        source={item.iconSource}
        style={{ width: size <= 26 ? 28 : 36, height: size <= 26 ? 28 : 36 }}
        resizeMode="contain"
      />
    );
  }
  if (item.iconFamily === 'Feather') {
    return <Feather name={item.iconName as any} size={size} color={item.iconColor} />;
  }
  if (item.iconFamily === 'MaterialCommunityIcons') {
    return <MaterialCommunityIcons name={item.iconName as any} size={size} color={item.iconColor} />;
  }
  return <Ionicons name={item.iconName as any} size={size} color={item.iconColor} />;
}

/**
 * Symmetrical 2-column grid card matching exact design in screenshot
 */
export function SelectableGridCard({
  item,
  isSelected,
  onToggle,
  index = 0,
}: SelectableCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const selectAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  const checkAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  const iconScaleAnim = useRef(new Animated.Value(isSelected ? 1.1 : 1)).current;
  const mountAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = Animated.timing(mountAnim, {
      toValue: 1,
      duration: 350,
      delay: 40 + index * 40,
      useNativeDriver: true,
    });
    t.start();
    return () => t.stop();
  }, [index]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(selectAnim, {
        toValue: isSelected ? 1 : 0,
        friction: 6,
        tension: 80,
        useNativeDriver: false,
      }),
      Animated.spring(checkAnim, {
        toValue: isSelected ? 1 : 0,
        friction: 5,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.spring(iconScaleAnim, {
        toValue: isSelected ? 1.1 : 1,
        friction: 5,
        tension: 90,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isSelected]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 8,
    }).start();
  };

  const handlePress = () => {
    try {
      Vibration.vibrate(10);
    } catch {}

    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 60, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1.02, friction: 3, tension: 90, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
    ]).start();

    onToggle();
  };

  const animatedBorderWidth = selectAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1.5, 2.2],
  });

  const checkRotate = checkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-45deg', '0deg'],
  });

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: mountAnim,
        transform: [
          { translateY: mountAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          { scale: scaleAnim },
        ],
      }}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={{ flex: 1 }}
      >
        <Animated.View
          style={{
            flex: 1,
            minHeight: 128,
            height: 128,
            backgroundColor: isSelected ? '#FFF5F6' : '#FFFFFF',
            borderColor: isSelected ? '#E11D48' : '#F1F5F9',
            borderWidth: isSelected ? 2 : 1.4,
            borderRadius: 22,
            paddingVertical: 14,
            paddingHorizontal: 8,
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            shadowColor: isSelected ? '#E11D48' : '#0F172A',
            shadowOffset: { width: 0, height: isSelected ? 4 : 2 },
            shadowOpacity: isSelected ? 0.16 : 0.04,
            shadowRadius: isSelected ? 10 : 5,
            elevation: isSelected ? 3.5 : 1.5,
          }}
        >
          {/* Top-Right Radio / Checkbox Indicator */}
          <View
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              width: 22,
              height: 22,
              borderRadius: 11,
              borderWidth: isSelected ? 0 : 1.5,
              borderColor: '#E2E8F0',
              backgroundColor: isSelected ? 'transparent' : '#F8FAFC',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Animated Active State */}
            <Animated.View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: '#E11D48',
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale: checkAnim }, { rotate: checkRotate }],
                opacity: checkAnim,
              }}
            >
              <Feather name="check" size={12} color="#FFFFFF" />
            </Animated.View>
          </View>

          {/* Centered Icon without background circle */}
          <Animated.View
            style={{
              width: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 8,
              transform: [{ scale: iconScaleAnim }],
            }}
          >
            <RenderIcon item={item} size={28} />
          </Animated.View>

          {/* Title */}
          <Text
            numberOfLines={1}
            style={{
              fontSize: 14,
              fontWeight: '700',
              color: isSelected ? '#E11D48' : '#0F172A',
              letterSpacing: -0.2,
              textAlign: 'center',
              paddingHorizontal: 4,
              marginBottom: 2,
            }}
          >
            {item.label}
          </Text>

          {/* Subtitle */}
          {item.description ? (
            <Text
              numberOfLines={1}
              style={{
                fontSize: 11,
                fontWeight: '400',
                color: isSelected ? '#E11D48' : '#64748B',
                opacity: isSelected ? 0.85 : 1,
                letterSpacing: -0.1,
                textAlign: 'center',
                paddingHorizontal: 4,
              }}
            >
              {item.description}
            </Text>
          ) : null}
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * Full-width banner card matching bottom card in design (e.g. "No Restrictions")
 */
export function SelectableBannerCard({
  item,
  isSelected,
  onToggle,
  index = 0,
}: SelectableCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const selectAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  const checkAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  const iconScaleAnim = useRef(new Animated.Value(isSelected ? 1.08 : 1)).current;
  const mountAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = Animated.timing(mountAnim, {
      toValue: 1,
      duration: 350,
      delay: 40 + index * 40,
      useNativeDriver: true,
    });
    t.start();
    return () => t.stop();
  }, [index]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(selectAnim, {
        toValue: isSelected ? 1 : 0,
        friction: 6,
        tension: 80,
        useNativeDriver: false,
      }),
      Animated.spring(checkAnim, {
        toValue: isSelected ? 1 : 0,
        friction: 5,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.spring(iconScaleAnim, {
        toValue: isSelected ? 1.08 : 1,
        friction: 5,
        tension: 90,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isSelected]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 8,
    }).start();
  };

  const handlePress = () => {
    try {
      Vibration.vibrate(10);
    } catch {}

    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 60, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1.02, friction: 3, tension: 90, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
    ]).start();

    onToggle();
  };

  const animatedBorderWidth = selectAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1.5, 2.2],
  });

  const checkRotate = checkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-45deg', '0deg'],
  });

  return (
    <Animated.View
      style={{
        width: '100%',
        opacity: mountAnim,
        transform: [
          { translateY: mountAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          { scale: scaleAnim },
        ],
      }}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={{ width: '100%' }}
      >
        <Animated.View
          style={{
            width: '100%',
            minHeight: 68,
            height: 68,
            backgroundColor: isSelected ? '#FFF5F6' : '#FFFFFF',
            borderColor: isSelected ? '#E11D48' : '#F1F5F9',
            borderWidth: isSelected ? 2 : 1.4,
            borderRadius: 22,
            paddingHorizontal: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            shadowColor: isSelected ? '#E11D48' : '#0F172A',
            shadowOffset: { width: 0, height: isSelected ? 4 : 2 },
            shadowOpacity: isSelected ? 0.16 : 0.04,
            shadowRadius: isSelected ? 10 : 5,
            elevation: isSelected ? 3.5 : 1.5,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 8 }}>
            <Animated.View
              style={{
                width: 36,
                height: 36,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale: iconScaleAnim }],
              }}
            >
              <RenderIcon item={item} size={26} />
            </Animated.View>

            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 14.5,
                  fontWeight: '700',
                  color: isSelected ? '#E11D48' : '#0F172A',
                  letterSpacing: -0.2,
                }}
              >
                {item.label}
              </Text>
              {item.description ? (
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 11,
                    color: isSelected ? '#E11D48' : '#64748B',
                    opacity: isSelected ? 0.85 : 1,
                    fontWeight: '400',
                    marginTop: 2,
                    letterSpacing: -0.1,
                  }}
                >
                  {item.description}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Radio / Checkbox Indicator */}
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              borderWidth: isSelected ? 0 : 1.5,
              borderColor: '#E2E8F0',
              backgroundColor: isSelected ? 'transparent' : '#F8FAFC',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Animated.View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: '#E11D48',
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale: checkAnim }, { rotate: checkRotate }],
                opacity: checkAnim,
              }}
            >
              <Feather name="check" size={12} color="#FFFFFF" />
            </Animated.View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

interface SelectableTagCardProps extends SelectableCardProps {
  fullWidth?: boolean;
}

export function SelectableTagCard({
  item,
  isSelected,
  onToggle,
  index = 0,
  fullWidth = false,
}: SelectableTagCardProps) {
  if (fullWidth) {
    return (
      <SelectableBannerCard
        item={item}
        isSelected={isSelected}
        onToggle={onToggle}
        index={index}
      />
    );
  }

  return (
    <SelectableGridCard
      item={item}
      isSelected={isSelected}
      onToggle={onToggle}
      index={index}
    />
  );
}
