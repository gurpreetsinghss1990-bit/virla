import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

interface ProgressRingProps {
  progress: number; // Value between 0 and 1
  size?: number;
  strokeWidth?: number;
  activeColor?: string; // Fallback or override active color, default uses gradient
  inactiveColor?: string;
  children?: React.ReactNode;
}

export function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 8,
  activeColor,
  inactiveColor = '#E4E4E7', // Zinc-200
  children,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  // Limit progress to [0, 1]
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const strokeDashoffset = circumference - clampedProgress * circumference;

  return (
    <View style={{ width: size, height: size }} className="justify-center items-center relative">
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }} className="absolute">
        <Defs>
          {/* Luxury circular progress gradient (Blue -> Purple -> Gold) */}
          <LinearGradient id="ringProgressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#4F46E5" />
            <Stop offset="60%" stopColor="#6D5EF7" />
            <Stop offset="100%" stopColor="#F5B942" />
          </LinearGradient>
        </Defs>

        {/* Background Inactive Circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={inactiveColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Foreground Active Circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={activeColor || 'url(#ringProgressGrad)'}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      {children}
    </View>
  );
}
export default ProgressRing;
