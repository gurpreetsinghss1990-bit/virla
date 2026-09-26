import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

interface ProgressRingProps {
  progress: number; // Value between 0 and 1
  size?: number;
  strokeWidth?: number;
  activeColor?: string; // Fallback or override active color, default uses gradient
  inactiveColor?: string;
  enable3D?: boolean;
  children?: React.ReactNode;
}

export function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 8,
  activeColor,
  inactiveColor = '#E2E8F0', // Slate-200
  enable3D = true,
  children,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  // Limit progress to [0, 1]
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const strokeDashoffset = circumference - clampedProgress * circumference;

  // Inner core size for 3D floating disc
  const coreSize = Math.max(28, size - strokeWidth * 2 - 8);

  return (
    <View style={{ width: size, height: size }} className="justify-center items-center relative">
      <Svg 
        width={size} 
        height={size} 
        style={{ transform: [{ rotate: '-90deg' }], overflow: 'visible' }} 
        className="absolute"
      >
        <Defs>
          {/* Luxury 3D circular progress gradient */}
          <LinearGradient id="ringProgressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#6366F1" />
            <Stop offset="40%" stopColor="#4F46E5" />
            <Stop offset="80%" stopColor="#7C3AED" />
            <Stop offset="100%" stopColor="#F59E0B" />
          </LinearGradient>
          {/* 3D Track Inset Shadow Gradient */}
          <LinearGradient id="trackShadowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#CBD5E1" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#F1F5F9" stopOpacity="0.3" />
          </LinearGradient>
        </Defs>

        {/* 3D Recessed Outer Track Groove */}
        {enable3D && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#trackShadowGrad)"
            strokeWidth={strokeWidth + 2}
            fill="none"
          />
        )}

        {/* Background Inactive Circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={inactiveColor}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* 3D Depth Under-Shadow for the Active Arc */}
        {enable3D && clampedProgress > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(15, 23, 42, 0.16)"
            strokeWidth={strokeWidth + 2}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
          />
        )}

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

      {children && (
        <View 
          style={[
            StyleSheet.absoluteFill,
            { alignItems: 'center', justifyContent: 'center' }
          ]}
        >
          {enable3D ? (
            <View
              style={{
                width: coreSize,
                height: coreSize,
                borderRadius: coreSize / 2,
                backgroundColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
                borderTopWidth: 1.5,
                borderLeftWidth: 1.5,
                borderTopColor: '#FFFFFF',
                borderLeftColor: '#FFFFFF',
                borderBottomWidth: 1.5,
                borderRightWidth: 1.5,
                borderBottomColor: '#E2E8F0',
                borderRightColor: '#E2E8F0',
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.12,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              {children}
            </View>
          ) : (
            children
          )}
        </View>
      )}
    </View>
  );
}
export default ProgressRing;
