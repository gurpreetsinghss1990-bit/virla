import React, { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const SPIKES = 12;
const POINTS = SPIKES * 2;
const OUTER = 40;
const INNER_MIN = 13;
const INNER_MAX = 26;
const CENTER = 50;

const COS: number[] = [];
const SIN: number[] = [];
for (let i = 0; i < POINTS; i++) {
  const angle = (Math.PI * 2 * i) / POINTS - Math.PI / 2;
  COS.push(Math.cos(angle));
  SIN.push(Math.sin(angle));
}

const SIZE_MAP = { small: 20, medium: 30, large: 44 } as const;

export type VirlaSpinnerProps = {
  size?: 'small' | 'medium' | 'large' | number;
  color?: string;
  bg?: string;
  style?: StyleProp<ViewStyle>;
  className?: string;
  speed?: number;
};

export function VirlaSpinner({
  size = 'small',
  color = '#E11D48',
  bg = 'transparent',
  style,
  className,
  speed = 2600,
}: VirlaSpinnerProps) {
  const progress = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withRepeat(withTiming(1, { duration: speed, easing: Easing.linear }), -1, false);
    spin.value = 0;
    spin.value = withRepeat(withTiming(1, { duration: speed * 4.6, easing: Easing.linear }), -1, false);
  }, [progress, spin, speed]);

  const animatedProps = useAnimatedProps(() => {
    'worklet';
    // 0 -> 1 -> 0 : shape breathes between the two spike depths
    const wave = 0.5 - 0.5 * Math.cos(progress.value * Math.PI * 2);
    const inner = INNER_MIN + wave * (INNER_MAX - INNER_MIN);
    let d = '';
    for (let i = 0; i < POINTS; i++) {
      const r = i % 2 === 0 ? OUTER : inner;
      const x = CENTER + COS[i] * r;
      const y = CENTER + SIN[i] * r;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2);
    }
    return { d: `${d}Z` };
  });

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    return { transform: [{ rotate: `${-spin.value * 360}deg` }] };
  });

  const px = typeof size === 'number' ? size : SIZE_MAP[size];

  return (
    <View
      className={className}
      style={[{ width: px, height: px, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    >
      <Animated.View style={[{ width: px, height: px }, animatedStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          {bg !== 'transparent' ? <Path d="M50 5 A45 45 0 1 0 50 95 A45 45 0 1 0 50 5 Z" fill={bg} /> : null}
          <AnimatedPath animatedProps={animatedProps} fill={color} />
        </Svg>
      </Animated.View>
    </View>
  );
}

export default VirlaSpinner;
