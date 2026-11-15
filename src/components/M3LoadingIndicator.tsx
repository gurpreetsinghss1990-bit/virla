import React, { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const SIZE_PRESETS = { small: 20, large: 36 } as const;

export type LoaderSize = number | 'small' | 'large';

function resolveSize(size: LoaderSize): number {
  return typeof size === 'number' ? size : SIZE_PRESETS[size];
}

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduce(value);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduce;
}

function buildWavyPath(
  cx: number,
  cy: number,
  r: number,
  amp: number,
  waves: number,
  samples = 160,
): string {
  let d = '';
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * Math.PI * 2;
    const rr = r + amp * Math.sin(waves * t);
    const x = cx + rr * Math.cos(t - Math.PI / 2);
    const y = cy + rr * Math.sin(t - Math.PI / 2);
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return `${d}Z`;
}

type WavyProps = {
  size: number;
  color: string;
  trackColor?: string;
  strokeWidth?: number;
  duration?: number;
  animate: boolean;
  style?: StyleProp<ViewStyle>;
};

function WavyIndicator({
  size,
  color,
  trackColor,
  strokeWidth = 3,
  duration = 1400,
  animate,
  style,
}: WavyProps) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (!animate) {
      cancelAnimation(rotation);
      rotation.value = 0;
      return;
    }
    rotation.value = 0;
    rotation.value = withRepeat(withTiming(360, { duration, easing: Easing.linear }), -1, false);
  }, [animate, duration, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const c = size / 2;
  const stroke = Math.max(1.5, (size / 36) * strokeWidth);
  const r = Math.max(1, c - stroke);
  const amp = Math.max(1.2, r * 0.085);

  const track = useMemo(() => buildWavyPath(c, c, r, 0, 1), [c, r]);
  const wavy = useMemo(() => buildWavyPath(c, c, r, amp, 7), [c, r, amp]);

  return (
    <Animated.View style={[{ width: size, height: size }, animatedStyle, style]}>
      <Svg width={size} height={size}>
        <Path
          d={track}
          stroke={trackColor ?? color}
          strokeOpacity={0.28}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d={wavy}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

type ShapeDef = { base: number; waves: number; amp: number; rot: number };

const SHAPES: ShapeDef[] = [
  { base: 1.0, waves: 8, amp: 0.16, rot: 0.0 },
  { base: 0.96, waves: 9, amp: 0.11, rot: 0.25 },
  { base: 1.0, waves: 5, amp: 0.15, rot: 0.0 },
  { base: 0.98, waves: 2, amp: 0.24, rot: 0.0 },
  { base: 1.0, waves: 12, amp: 0.2, rot: 0.0 },
  { base: 0.95, waves: 4, amp: 0.14, rot: 0.4 },
  { base: 1.0, waves: 6, amp: 0.12, rot: 0.15 },
];

function buildMorphFrames(radius: number, points = 96, framesPerShape = 22): string[] {
  const frames: string[] = [];
  const n = SHAPES.length;

  for (let s = 0; s < n; s++) {
    const a = SHAPES[s];
    const b = SHAPES[(s + 1) % n];

    for (let f = 0; f < framesPerShape; f++) {
      const t = f / framesPerShape;
      const e = t * t * (3 - 2 * t);

      const base = a.base + (b.base - a.base) * e;
      const waves = a.waves + (b.waves - a.waves) * e;
      const amp = a.amp + (b.amp - a.amp) * e;
      const rot = a.rot + (b.rot - a.rot) * e;

      let d = '';
      for (let i = 0; i <= points; i++) {
        const th = (i / points) * Math.PI * 2;
        const rr = radius * (base + amp * Math.cos(waves * th + rot));
        const x = radius + rr * Math.cos(th);
        const y = radius + rr * Math.sin(th);
        d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      }
      frames.push(`${d}Z`);
    }
  }

  return frames;
}

type MorphProps = {
  size: number;
  color: string;
  containerColor?: string;
  duration?: number;
  animate: boolean;
  style?: StyleProp<ViewStyle>;
};

function MorphIndicator({
  size,
  color,
  containerColor,
  duration = 3200,
  animate,
  style,
}: MorphProps) {
  const radius = (size * 0.72) / 2;
  const frames = useMemo(() => buildMorphFrames(radius), [radius]);

  const progress = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    if (!animate) {
      cancelAnimation(progress);
      cancelAnimation(spin);
      progress.value = 0;
      spin.value = 0;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    spin.value = 0;
    spin.value = withRepeat(
      withTiming(360, { duration: duration * 3, easing: Easing.linear }),
      -1,
      false,
    );
  }, [animate, duration, progress, spin]);

  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const count = frames.length;
    const i = Math.min(count - 1, Math.max(0, Math.floor(progress.value * count)));
    return { d: frames[i] };
  });

  const spinStyle = useAnimatedStyle(() => {
    'worklet';
    return { transform: [{ rotate: `${spin.value}deg` }] };
  });

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, spinStyle]}>
        <Svg width={size} height={size}>
          {containerColor ? (
            <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={containerColor} />
          ) : null}
          <AnimatedPath animatedProps={animatedProps} fill={color} />
        </Svg>
      </Animated.View>
    </View>
  );
}

export type M3LoadingIndicatorProps = {
  variant?: 'wavy' | 'morph';
  size?: LoaderSize;
  color?: string;
  trackColor?: string;
  containerColor?: string;
  strokeWidth?: number;
  duration?: number;
  animating?: boolean;
  hidesWhenStopped?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function M3LoadingIndicator({
  variant = 'wavy',
  size = 'large',
  color = '#6750A4',
  trackColor,
  containerColor,
  strokeWidth = 3,
  duration,
  animating = true,
  hidesWhenStopped = false,
  accessibilityLabel = 'Loading',
  style,
}: M3LoadingIndicatorProps) {
  const reduceMotion = useReduceMotion();
  const px = resolveSize(size);
  const shouldAnimate = animating && !reduceMotion;

  if (!animating && hidesWhenStopped) return null;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      {variant === 'morph' ? (
        <MorphIndicator
          size={px}
          color={color}
          containerColor={containerColor}
          duration={duration ?? 3200}
          animate={shouldAnimate}
        />
      ) : (
        <WavyIndicator
          size={px}
          color={color}
          trackColor={trackColor}
          strokeWidth={strokeWidth}
          duration={duration ?? 1400}
          animate={shouldAnimate}
        />
      )}
    </View>
  );
}

export const Spinner = M3LoadingIndicator;

export default M3LoadingIndicator;
