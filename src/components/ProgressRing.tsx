import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

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
  const animValue = useRef(new Animated.Value(0)).current;
  const [displayProgress, setDisplayProgress] = useState(animated ? 0 : progress);

  useEffect(() => {
    const clamped = Math.max(0, Math.min(1, progress));
    if (!animated) {
      setDisplayProgress(clamped);
      return;
    }

    const listenerId = animValue.addListener(({ value }) => {
      setDisplayProgress(value);
    });

    Animated.timing(animValue, {
      toValue: clamped,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    return () => {
      animValue.removeListener(listenerId);
    };
  }, [progress, animated]);

  // Give generous SVG canvas buffer to prevent Android clipping of 3D shadows and pearl caps
  const svgPadding = 8;
  const svgSize = size + svgPadding * 2;
  const center = svgSize / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  const clampedProgress = Math.max(0, Math.min(1, displayProgress));
  const strokeDashoffset = circumference - clampedProgress * circumference;

  // Calculate coordinates for the 3D spherical tip cap
  // Ring starts at top (-90 degrees / -PI / 2) and sweeps clockwise
  const angle = clampedProgress * 2 * Math.PI - Math.PI / 2;
  const tipX = center + radius * Math.cos(angle);
  const tipY = center + radius * Math.sin(angle);

  // Start point (top center)
  const startX = center;
  const startY = center - radius;

  // Unique gradient ID per instance
  const gradId = useRef(`ringGrad_${Math.random().toString(36).substring(2, 8)}`).current;

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
          {enable3D && clampedProgress > 0 && (
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke="rgba(15, 23, 42, 0.16)"
              strokeWidth={strokeWidth + 3}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="none"
            />
          )}

          {/* 5. Primary Active Volumetric Cylinder */}
          {clampedProgress > 0 && (
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={activeColor || `url(#${gradId})`}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="none"
            />
          )}

          {/* 6. 3D Cylindrical Specular Glaze (Glassy reflection line along the tube) */}
          {enable3D && clampedProgress > 0 && (
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke="rgba(255, 255, 255, 0.52)"
              strokeWidth={Math.max(2, strokeWidth * 0.24)}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="none"
            />
          )}
        </Svg>

        {/* 7. 3D Start Point Specular Shine */}
        {enable3D && clampedProgress > 0.04 && (
          <Circle
            cx={startX}
            cy={startY}
            r={Math.max(1.5, strokeWidth * 0.2)}
            fill="#FFFFFF"
            opacity={0.7}
          />
        )}

        {/* 8. 3D Glowing Spherical Jewel Cap at the Moving Tip */}
        {enable3D && clampedProgress > 0.02 && (
          <>
            {/* Contact drop shadow under the tip */}
            <Circle
              cx={tipX}
              cy={tipY + 1.2}
              r={strokeWidth / 2}
              fill="rgba(15, 23, 42, 0.24)"
            />
            {/* Main 3D Sphere Bead */}
            <Circle
              cx={tipX}
              cy={tipY}
              r={strokeWidth / 2 - 0.4}
              fill={activeColor || '#4F46E5'}
            />
            {/* 3D Specular Highlight Dot on the sphere */}
            <Circle
              cx={tipX - strokeWidth * 0.16}
              cy={tipY - strokeWidth * 0.16}
              r={Math.max(1.4, strokeWidth * 0.22)}
              fill="#FFFFFF"
              opacity={0.88}
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
