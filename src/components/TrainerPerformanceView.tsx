import React from 'react';
import { View, Text, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ProgressRing } from './ProgressRing';
import { NativeSegmentedRangeControl } from './NativeSegmentedRangeControl';

export interface TrainerPerformanceViewProps {
  activeRange: 'weekly' | 'monthly' | 'yearly';
  setActiveRange: (range: 'weekly' | 'monthly' | 'yearly') => void;
  fadeAnim: Animated.Value;
  currentStats: any;
}

export const TrainerPerformanceView: React.FC<TrainerPerformanceViewProps> = ({
  activeRange,
  setActiveRange,
  fadeAnim,
  currentStats,
}) => {
  return (
    <>
      {/* Trainer timeframe indicator */}
      <NativeSegmentedRangeControl
        activeRange={activeRange}
        onChangeRange={setActiveRange}
      />

      {/* Performance indicators - Seamless on canvas */}
      <Animated.View style={{ opacity: fadeAnim }} className="gap-4">
        <View className="flex-row justify-between items-center px-1">
          <Text className="text-[#101828] text-xs font-bold uppercase tracking-wider">
            Performance Indicators
          </Text>
        </View>

        <View className="flex-row flex-wrap justify-between gap-y-6 pt-1">
          {/* Ring 1: Rating */}
          <View className="items-center" style={{ width: '48%', paddingVertical: 8 }}>
            <ProgressRing progress={currentStats.trainerRatingProgress} size={84} strokeWidth={10} activeColor="#F59E0B" enable3D={true}>
              <Text className="text-[#101828] text-sm font-extrabold">{currentStats.trainerRating}</Text>
            </ProgressRing>
            <Text className="text-[#101828] text-xs font-bold mt-2.5">Rating</Text>
            <View className="mt-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200/80">
              <Text className="text-amber-700 text-[9px] font-bold uppercase">{currentStats.trainerRatingSub}</Text>
            </View>
          </View>

          {/* Ring 2: Completion Rate */}
          <View className="items-center" style={{ width: '48%', paddingVertical: 8 }}>
            <ProgressRing progress={currentStats.trainerCompletionProgress} size={84} strokeWidth={10} activeColor="#10B981" enable3D={true}>
              <Text className="text-[#101828] text-sm font-extrabold">{currentStats.trainerCompletion}</Text>
            </ProgressRing>
            <Text className="text-[#101828] text-xs font-bold mt-2.5">Completion</Text>
            <View className="mt-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80">
              <Text className="text-emerald-700 text-[9px] font-bold uppercase">{currentStats.trainerCompletionSub}</Text>
            </View>
          </View>

          {/* Ring 3: Active Jobs / Visits */}
          <View className="items-center" style={{ width: '48%', paddingVertical: 8 }}>
            <ProgressRing progress={currentStats.trainerVisitsProgress} size={84} strokeWidth={10} activeColor="#6366F1" enable3D={true}>
              <Text className="text-[#101828] text-sm font-extrabold">{currentStats.trainerVisits}</Text>
            </ProgressRing>
            <Text className="text-[#101828] text-xs font-bold mt-2.5">Visits</Text>
            <View className="mt-1 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200/80">
              <Text className="text-indigo-700 text-[9px] font-bold uppercase">{currentStats.trainerVisitsSub}</Text>
            </View>
          </View>

          {/* Ring 4: Earnings Goal */}
          <View className="items-center" style={{ width: '48%', paddingVertical: 8 }}>
            <ProgressRing progress={currentStats.trainerPayoutProgress} size={84} strokeWidth={10} activeColor="#8B5CF6" enable3D={true}>
              <Text className="text-[#101828] text-sm font-extrabold">{currentStats.trainerPayoutVal}</Text>
            </ProgressRing>
            <Text className="text-[#101828] text-xs font-bold mt-2.5">Payout Target</Text>
            <View className="mt-1 px-2.5 py-0.5 rounded-full bg-purple-50 border border-purple-200/80">
              <Text className="text-purple-700 text-[9px] font-bold uppercase">{currentStats.trainerPayoutSub}</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Weekly/Monthly Earnings chart - Seamless on canvas */}
      <Animated.View style={{ opacity: fadeAnim }} className="gap-4">
        <View className="flex-row justify-between items-center px-1">
          <View>
            <Text className="text-[#101828] text-xs font-bold uppercase tracking-wider">
              Sessions History Chart
            </Text>
            <Text className="text-zinc-500 text-[10px] font-medium mt-0.5">
              {activeRange === 'weekly' ? 'Daily session breakdown' : activeRange === 'monthly' ? '4-Week progression' : 'Quarterly trend'}
            </Text>
          </View>
          <View className="px-2.5 py-1 bg-[#101828]/5 rounded-full border border-[#101828]/10">
            <Text className="text-[#6B7280] text-[9px] font-bold uppercase tracking-wider">
              {activeRange === 'weekly' ? 'Daily Breakdown' : activeRange === 'monthly' ? '4-Week View' : 'Quarterly Trend'}
            </Text>
          </View>
        </View>

        <View style={{ height: 152, justifyContent: 'flex-end', paddingTop: 8 }}>
          <View className="flex-row items-end justify-between">
            {currentStats.chartData.map((d: any, index: number) => {
              const isPeak = d.val > 0 && d.val === Math.max(...currentStats.chartData.map((c: any) => c.val));
              const heightPercent = d.val ? `${d.val}%` : '6%';
              const barWidth = currentStats.chartData.length > 5 ? 24 : 30;
              const shadowWidth = currentStats.chartData.length > 5 ? 20 : 24;
              return (
                <View key={index} className="items-center flex-1">
                  {/* 3D Floating Peak Indicator */}
                  <View style={{ height: 20, justifyContent: 'center', marginBottom: 6 }}>
                    {isPeak ? (
                      <View
                        style={{
                          backgroundColor: '#E11D48',
                          paddingHorizontal: 6,
                          paddingVertical: 1.5,
                          borderRadius: 5,
                          shadowColor: '#E11D48',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.3,
                          shadowRadius: 3,
                          elevation: 3,
                        }}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 8.5, fontWeight: '800' }}>
                          {d.val}%
                        </Text>
                      </View>
                    ) : (
                      <Text style={{ color: '#94A3B8', fontSize: 8.5, fontWeight: '600' }}>
                        {d.val > 0 ? `${d.val}%` : ''}
                      </Text>
                    )}
                  </View>

                  {/* 3D Recessed Pillar Groove (Track) */}
                  <View
                    style={{
                      width: barWidth,
                      height: 88,
                      borderRadius: barWidth / 2,
                      backgroundColor: '#EAEFF5',
                      justifyContent: 'flex-end',
                      overflow: 'hidden',
                      borderTopWidth: 2,
                      borderLeftWidth: 1.5,
                      borderTopColor: '#CBD5E1',
                      borderLeftColor: '#CBD5E1',
                      borderBottomWidth: 1,
                      borderRightWidth: 1,
                      borderBottomColor: '#FFFFFF',
                      borderRightColor: '#FFFFFF',
                    }}
                  >
                    {/* 3D Cylindrical Pillar Bar */}
                    <View
                      style={{
                        height: heightPercent as any,
                        width: '100%',
                        borderRadius: (barWidth - 2) / 2,
                        backgroundColor: d.val === 0
                          ? '#E2E8F0'
                          : index % 2 === 0 ? '#E11D48' : '#BE123C',
                        borderLeftWidth: 1.5,
                        borderLeftColor: 'rgba(255, 255, 255, 0.45)',
                        borderRightWidth: 1.5,
                        borderRightColor: 'rgba(0, 0, 0, 0.22)',
                      }}
                    >
                      {/* 3D Glowing Oval Top Cap */}
                      {d.val > 0 && (
                        <View
                          style={{
                            width: '100%',
                            height: 5,
                            borderRadius: 2.5,
                            backgroundColor: '#FFFFFF',
                            opacity: 0.65,
                          }}
                        />
                      )}
                    </View>
                  </View>

                  {/* 3D Pillar Base Ground Shadow */}
                  <View
                    style={{
                      width: shadowWidth,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: d.val > 0 ? 'rgba(15, 23, 42, 0.16)' : 'rgba(15, 23, 42, 0.05)',
                      marginTop: 4,
                    }}
                  />

                  <Text
                    style={{
                      color: isPeak ? '#101828' : '#64748B',
                      fontSize: 10,
                      fontWeight: isPeak ? '800' : '600',
                      marginTop: 4,
                    }}
                  >
                    {d.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </Animated.View>

      {/* Client Review Feed Wall */}
      <View className="gap-3">
        <Text className="text-[#101828] text-xs font-bold uppercase tracking-wider pl-1">Client Review Wall</Text>
        <View className="py-2 gap-3">
          {[
            { id: 'r-1', clientName: 'Viral S.', rating: 5, comment: 'Excellent strength coaching session! Focus on form was perfect.', date: 'Today', workout: 'PowerForge' },
            { id: 'r-2', clientName: 'Amit M.', rating: 5, comment: 'Punctual, friendly and adjusted intensity perfectly for my shoulder recovery.', date: '2 days ago', workout: 'Zen Yoga Flow' },
            { id: 'r-3', clientName: 'Pooja K.', rating: 4, comment: 'Very intense HIIT session! Loved the energy and playlist recommendation.', date: 'Last week', workout: 'Apex HIIT' }
          ].map((rev) => (
            <View key={rev.id} className="py-3 border-b border-zinc-200/60 last:border-b-0 gap-1.5">
              <View className="flex-row justify-between items-center">
                <Text className="text-[#101828] text-xs font-bold">{rev.clientName} • {rev.workout}</Text>
                <Text className="text-zinc-400 text-[9px] font-semibold">{rev.date}</Text>
              </View>
              <Text className="text-[#6B7280] text-xs italic">&ldquo;{rev.comment}&rdquo;</Text>
              <View className="flex-row gap-0.5 mt-0.5">
                {Array.from({ length: rev.rating }).map((_, i) => (
                  <Feather key={i} name="star" size={10} color="#F5B942" style={{ marginRight: 2 }} />
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>
    </>
  );
};

