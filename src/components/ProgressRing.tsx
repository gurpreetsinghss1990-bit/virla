import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  createAnimatedComponent,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const AnimatedCircle = createAnimatedComponent(Circle);

interface ProgressRingProps {
  progress: number; // Value between 0 and 1
  size?: number;
  strokeWidth?: number;
  activeColor?: string; // Fallback or override active color, default uses gradient
  inactiveColor?: string;
  enable3D?: boolean;
  animated?: boolean;
  children?: React.ReactNode;
}

export function ProgressRing({
  progress,
  size = 84,
  strokeWidth = 10,
  activeColor,
  inactiveColor = '#E2E8F0', // Slate-200
  enable3D = true,
  animated = true,
  children,
}: ProgressRingProps) {
  const animatedProgress = useSharedValue(animated ? 0 : Math.max(0, Math.min(1, progress)));

  useEffect(() => {
    const clamped = Math.max(0, Math.min(1, progress));
    if (!animated) {
      animatedProgress.value = clamped;
    } else {
      animatedProgress.value = withTiming(clamped, {
        duration: 700,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [progress, animated, animatedProgress]);

  // Give generous SVG canvas buffer to prevent Android clipping of 3D shadows and pearl caps
  const svgPadding = 8;
  const svgSize = size + svgPadding * 2;
  const center = svgSize / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  // Start point (top center)
  const startX = center;
  const startY = center - radius;

  // Unique gradient ID per instance
  const gradId = useRef(`ringGrad_${Math.random().toString(36).substring(2, 8)}`).current;

  // 100% UI-Thread animated props for the arc strokeDashoffset and opacity
  const arcAnimatedProps = useAnimatedProps(() => {
    'worklet';
    const clamped = Math.max(0, Math.min(1, animatedProgress.value));
    const offset = circumference - clamped * circumference;
    return {
      strokeDashoffset: offset,
      opacity: clamped > 0 ? 1 : 0,
    };
  });

  // UI-Thread animated props for the moving 3D tip cap (cx, cy)
  const tipBaseProps = useAnimatedProps(() => {
    'worklet';
    const clamped = Math.max(0, Math.min(1, animatedProgress.value));
    const angle = clamped * 2 * Math.PI - Math.PI / 2;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    return {
      cx: x,
      cy: y,
      opacity: clamped > 0.02 ? 1 : 0,
    };
  });

  const tipShadowProps = useAnimatedProps(() => {
    'worklet';
    const clamped = Math.max(0, Math.min(1, animatedProgress.value));
    const angle = clamped * 2 * Math.PI - Math.PI / 2;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle) + 1.2;
    return {
      cx: x,
      cy: y,
      opacity: clamped > 0.02 ? 1 : 0,
    };
  });

  const tipHighlightProps = useAnimatedProps(() => {
    'worklet';
    const clamped = Math.max(0, Math.min(1, animatedProgress.value));
    const angle = clamped * 2 * Math.PI - Math.PI / 2;
    const x = center + radius * Math.cos(angle) - strokeWidth * 0.16;
    const y = center + radius * Math.sin(angle) - strokeWidth * 0.16;
    return {
      cx: x,
      cy: y,
      opacity: clamped > 0.02 ? 0.88 : 0,
    };
  });

  const startPointProps = useAnimatedProps(() => {
    'worklet';
    const clamped = Math.max(0, Math.min(1, animatedProgress.value));
    return {
      opacity: clamped > 0.04 ? 0.7 : 0,
    };
  });

  return (
    <View style={{ width: size, height: size }} className="justify-center items-center relative">
      <Svg 
        width={svgSize} 
        height={svgSize} 
        style={{ 
          position: 'absolute',
          top: -svgPadding,
          left: -svgPadding,
        }}
      >
        <Defs>
          {/* Default Multi-stop Luxury 3D Gradient */}
          <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            {activeColor ? [
              <Stop key="s1" offset="0%" stopColor={activeColor} stopOpacity="1" />,
              <Stop key="s2" offset="50%" stopColor={activeColor} stopOpacity="0.95" />,
              <Stop key="s3" offset="100%" stopColor={activeColor} stopOpacity="0.8" />,
            ] : [
              <Stop key="d1" offset="0%" stopColor="#6366F1" />,
              <Stop key="d2" offset="40%" stopColor="#4F46E5" />,
              <Stop key="d3" offset="80%" stopColor="#7C3AED" />,
              <Stop key="d4" offset="100%" stopColor="#F59E0B" />,
            ]}
          </LinearGradient>

          {/* 3D Track Inset Groove Shadow Gradient */}
          <LinearGradient id="trackShadowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#CBD5E1" stopOpacity="0.75" />
            <Stop offset="100%" stopColor="#F1F5F9" stopOpacity="0.2" />
          </LinearGradient>
        </Defs>

        {/* 1. 3D Recessed Outer Track Groove */}
        {enable3D && (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke="url(#trackShadowGrad)"
            strokeWidth={strokeWidth + 2.5}
            fill="none"
          />
        )}

        {/* 2. Background Inactive Base Track */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={inactiveColor}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* 3. 3D Inner Bevel Highlight along the track interior edge */}
        {enable3D && (
          <Circle
            cx={center}
            cy={center}
            r={Math.max(1, radius - strokeWidth / 2 + 0.6)}
            stroke="rgba(255, 255, 255, 0.75)"
            strokeWidth={1}
            fill="none"
          />
        )}

        {/* Main Arc Group - Rotated -90deg */}
        <Svg
          width={svgSize}
          height={svgSize}
          style={{ transform: [{ rotate: '-90deg' }] }}
        >
          {/* 4. 3D Volumetric Arc Under-Shadow */}
          {enable3D && (
            <AnimatedCircle
              cx={center}
              cy={center}
              r={radius}
              stroke="rgba(15, 23, 42, 0.16)"
              strokeWidth={strokeWidth + 3}
              strokeDasharray={circumference}
              animatedProps={arcAnimatedProps}
              strokeLinecap="round"
              fill="none"
            />
          )}

          {/* 5. Primary Active Volumetric Cylinder */}
          <AnimatedCircle
            cx={center}
            cy={center}
            r={radius}
            stroke={activeColor || `url(#${gradId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            animatedProps={arcAnimatedProps}
            strokeLinecap="round"
            fill="none"
          />

          {/* 6. 3D Cylindrical Specular Glaze (Glassy reflection line along the tube) */}
          {enable3D && (
            <AnimatedCircle
              cx={center}
              cy={center}
              r={radius}
              stroke="rgba(255, 255, 255, 0.52)"
              strokeWidth={Math.max(2, strokeWidth * 0.24)}
              strokeDasharray={circumference}
              animatedProps={arcAnimatedProps}
              strokeLinecap="round"
              fill="none"
            />
          )}
        </Svg>

        {/* 7. 3D Start Point Specular Shine */}
        {enable3D && (
          <AnimatedCircle
            cx={startX}
            cy={startY}
            r={Math.max(1.5, strokeWidth * 0.2)}
            fill="#FFFFFF"
            animatedProps={startPointProps}
          />
        )}

        {/* 8. 3D Glowing Spherical Jewel Cap at the Moving Tip */}
        {enable3D && (
          <>
            {/* Contact drop shadow under the tip */}
            <AnimatedCircle
              r={strokeWidth / 2}
              fill="rgba(15, 23, 42, 0.24)"
              animatedProps={tipShadowProps}
            />
            {/* Main 3D Sphere Bead */}
            <AnimatedCircle
              r={strokeWidth / 2 - 0.4}
              fill={activeColor || '#4F46E5'}
              animatedProps={tipBaseProps}
            />
            {/* 3D Specular Highlight Dot on the sphere */}
            <AnimatedCircle
              r={Math.max(1.4, strokeWidth * 0.22)}
              fill="#FFFFFF"
              animatedProps={tipHighlightProps}
            />
          </>
        )}
      </Svg>

      {/* Children: Clean, seamlessly transparent center with NO white card */}
      {children && (
        <View 
          style={[
            StyleSheet.absoluteFill,
            { alignItems: 'center', justifyContent: 'center' }
          ]}
          pointerEvents="none"
        >
          {children}
        </View>
      )}
    </View>
  );
}

export default ProgressRing;
