import React from 'react';
import { View, Animated } from 'react-native';
import { CalculatedTargetsCard } from './CalculatedTargetsCard';
import {
  ClientWellnessIndicators,
  ClientActivityHistoryChart,
  ClientAchievementsBadges,
  type ChartDataItem,
  type AchievementItem,
} from './progress';

export interface ClientProgressViewProps {
  animatedFadeStyle: any;
  currentStats: {
    calories: number | string;
    caloriesProgress: number;
    attendance: number | string;
    sessions: number | string;
    sessionsProgress: number;
    recovery: number | string;
    chartData: ChartDataItem[];
  };
  activeRange: 'weekly' | 'monthly' | 'yearly';
  achievements: AchievementItem[];
}

export const ClientProgressView = React.memo(function ClientProgressView({
  animatedFadeStyle,
  currentStats,
  activeRange,
  achievements,
}: ClientProgressViewProps) {
  return (
    <>
      {/* Calculated Targets Hero Card */}
      <Animated.View style={animatedFadeStyle}>
        <CalculatedTargetsCard />
      </Animated.View>

      {/* Card 1: 4 Animated Rings - Wellness Indicators */}
      <Animated.View style={animatedFadeStyle}>
        <ClientWellnessIndicators currentStats={currentStats} />
      </Animated.View>

      {/* Card 2: 7-Day Consistency Capsules Chart inside clean white card */}
      <Animated.View style={animatedFadeStyle}>
        <ClientActivityHistoryChart activeRange={activeRange} chartData={currentStats.chartData} />
      </Animated.View>

      {/* Card 3: Achievements Badges Section matching Stitch Master Tokens */}
      <ClientAchievementsBadges achievements={achievements} />
    </>
  );
});
