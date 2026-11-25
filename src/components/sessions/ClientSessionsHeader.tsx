import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { NativeSegmentedControl } from '../NativeSegmentedControl';
import AnimatedReanimated from 'react-native-reanimated';
import { softShadow } from '../../utils/shadows';

export type ClientFilterType = 'upcoming' | 'completed' | 'cancelled' | 'today' | 'past';
export type ClientDateFilterType = 'all' | 'today' | 'this_week' | 'this_month';

export interface ClientSessionsHeaderProps {
  insetsTop: number;
  activeFilter: ClientFilterType;
  filterOptions: ClientFilterType[];
  getFilterLabel: (filter: ClientFilterType) => string;
  onFilterChange: (filter: ClientFilterType) => void;
  clientDateFilter: ClientDateFilterType;
  onDateFilterChange: (dateFilter: ClientDateFilterType) => void;
  activeTabCount: number;
  onOpenTickets: () => void;
}

export const ClientSessionsHeader = React.memo(function ClientSessionsHeader({
  insetsTop,
  activeFilter,
  filterOptions,
  getFilterLabel,
  onFilterChange,
  clientDateFilter,
  onDateFilterChange,
  activeTabCount,
  onOpenTickets,
}: ClientSessionsHeaderProps) {
  return (
    <View
      style={{
        backgroundColor: '#F8F9FC',
        paddingTop: insetsTop + 6,
        zIndex: 40,
      }}
    >
      {/* Top Navigation & Page Title matching Progress tab structure */}
      <View className="flex-row items-start justify-between pt-1 pb-2 px-5">
        <View className="flex-1 pr-3">
          <Text
            style={{ fontFamily: 'Outfit_800ExtraBold', color: '#E11D48', letterSpacing: -0.5, fontSize: 24 }}
            className="font-extrabold uppercase tracking-tight"
          >
            MY SCHEDULE
          </Text>
          <Text
            style={{ fontFamily: 'Inter_500Medium', color: '#64748B', fontSize: 11 }}
            className="font-medium leading-relaxed mt-0.5"
          >
            Track and manage all your scheduled home wellness visits.
          </Text>
        </View>

        {/* Right Action: Support Tickets Notepad */}
        <Pressable
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={onOpenTickets}
          style={{ marginTop: 2 }}
          className="w-10 h-10 rounded-full bg-white shadow-xs items-center justify-center relative border border-slate-200/80"
          accessibilityRole="button"
          accessibilityLabel="My Support Tickets"
        >
          <Feather name="file-text" size={17} color="#0F172A" />
        </Pressable>
      </View>

      {/* Upcoming / Completed / Cancelled Segmented Control Tabs */}
      <View className="px-5 pt-1.5">
        <NativeSegmentedControl
          items={filterOptions.map((opt) => ({
            key: opt,
            label: getFilterLabel(opt),
          }))}
          activeKey={activeFilter}
          onChangeKey={onFilterChange}
          marginVertical={0}
        />
      </View>

      {/* Date Filter Pills on pure UI thread */}
      {activeTabCount > 0 && (
        <View className="py-2.5">
          <AnimatedReanimated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            overScrollMode="always"
            bounces={true}
            alwaysBounceHorizontal={true}
            scrollEventThrottle={16}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
          >
            {(['all', 'today', 'this_week', 'this_month'] as const).map((filterKey) => {
              const isActive = clientDateFilter === filterKey;
              const labels = {
                all: 'All',
                today: 'Today',
                this_week: 'This Week',
                this_month: 'This Month',
              };
              return (
                <Pressable
                  key={filterKey}
                  onPress={() => onDateFilterChange(filterKey)}
                  style={[
                    {
                      paddingVertical: 6,
                      paddingHorizontal: isActive ? 18 : 15,
                      borderRadius: 9999,
                      borderWidth: 1,
                      borderColor: isActive ? '#0F172A' : 'rgba(226, 232, 240, 0.9)',
                      backgroundColor: isActive ? '#0F172A' : '#FFFFFF',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    },
                    !isActive && softShadow({ color: '#0F172A', opacity: 0.03, radius: 4, offsetY: 1 }),
                    isActive && softShadow({ color: '#0F172A', opacity: 0.18, radius: 6, offsetY: 2 }),
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: isActive ? 'Outfit_700Bold' : 'Outfit_600SemiBold',
                      fontSize: 12,
                      color: isActive ? '#FFFFFF' : '#475569',
                    }}
                  >
                    {labels[filterKey]}
                  </Text>
                </Pressable>
              );
            })}
          </AnimatedReanimated.ScrollView>
        </View>
      )}
    </View>
  );
});
