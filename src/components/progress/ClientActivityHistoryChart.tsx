import React from 'react';
import { View, Text } from 'react-native';
import { softShadow } from '../../utils/shadows';

export interface ChartDataItem {
  label: string;
  val: number;
}

export interface ClientActivityHistoryChartProps {
  activeRange: 'weekly' | 'monthly' | 'yearly';
  chartData: ChartDataItem[];
}

export const ClientActivityHistoryChart = React.memo(function ClientActivityHistoryChart({
  activeRange,
  chartData,
}: ClientActivityHistoryChartProps) {
  const maxVal = Math.max(...chartData.map((c) => c.val));

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(15, 23, 42, 0.06)',
        ...softShadow({ color: '#0F172A', opacity: 0.04, radius: 12, offsetY: 4 }),
      }}
      className="gap-4"
    >
      <View className="flex-row justify-between items-center">
        <View>
          <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#0F172A] text-xs font-bold uppercase tracking-wider">
            Activity History
          </Text>
          <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-slate-400 text-xs mt-0.5">
            {activeRange === 'weekly' ? 'Daily intensity & consistency' : activeRange === 'monthly' ? '4-Week progression' : 'Annual volume overview'}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5 px-2.5 py-1 bg-indigo-50 rounded-full border border-indigo-100">
          <View className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
          <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-indigo-600 text-[10px] font-bold uppercase tracking-wider">
            {activeRange === 'weekly' ? '7-Day View' : activeRange === 'monthly' ? 'Monthly' : 'Yearly'}
          </Text>
        </View>
      </View>

      <View style={{ height: 160, justifyContent: 'flex-end', paddingTop: 10 }}>
        <View className="flex-row items-end justify-between">
          {chartData.map((d, index) => {
            const isPeak = d.val > 0 && d.val === maxVal;
            const heightPercent = d.val ? `${Math.max(12, d.val)}%` : '12%';
            const barWidth = 24;
            return (
              <View key={index} className="items-center flex-1">
                {/* Floating Peak / Value Indicator */}
                <View style={{ height: 22, justifyContent: 'center', marginBottom: 6 }}>
                  {d.val > 0 ? (
                    <View
                      style={{
                        backgroundColor: isPeak ? '#4338CA' : 'transparent',
                        paddingHorizontal: isPeak ? 6 : 0,
                        paddingVertical: isPeak ? 1.5 : 0,
                        borderRadius: 5,
                        ...softShadow({ color: '#4338CA', opacity: isPeak ? 0.35 : 0, radius: 4, offsetY: 2 }),
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: 'Outfit_700Bold',
                          color: isPeak ? '#FFFFFF' : '#94A3B8',
                          fontSize: 9,
                          fontWeight: '800',
                        }}
                      >
                        {d.val}%
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ color: '#CBD5E1', fontSize: 10, fontWeight: '600' }}>
                      -
                    </Text>
                  )}
                </View>

                {/* Consistency Capsule Outer Track */}
                <View
                  style={{
                    width: barWidth,
                    height: 108,
                    borderRadius: barWidth / 2,
                    backgroundColor: '#F1F5F9',
                    justifyContent: 'flex-end',
                    overflow: 'hidden',
                    padding: 2,
                    borderWidth: isPeak ? 1.5 : 0,
                    borderColor: isPeak ? '#818CF8' : 'transparent',
                  }}
                >
                  {/* Inner Filled Capsule Pill with Indigo Gradient */}
                  {d.val > 0 && (
                    <View
                      style={{
                        height: heightPercent as any,
                        width: '100%',
                        borderRadius: (barWidth - 4) / 2,
                        backgroundColor: isPeak ? '#4338CA' : '#4F46E5',
                        ...softShadow({ color: '#4338CA', opacity: 0.4, radius: 6, offsetY: 0 }),
                      }}
                    />
                  )}
                </View>

                <Text
                  style={{
                    fontFamily: isPeak ? 'Outfit_700Bold' : 'Outfit_500Medium',
                    color: isPeak ? '#0F172A' : '#64748B',
                    fontSize: 10.5,
                    fontWeight: isPeak ? '700' : '500',
                    marginTop: 6,
                  }}
                >
                  {d.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
});

