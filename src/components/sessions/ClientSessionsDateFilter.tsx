import React from 'react';
import { View, Text, Pressable } from 'react-native';
import AnimatedReanimated from 'react-native-reanimated';
import { softShadow } from '../../utils/shadows';
import { ClientDateFilterType } from './ClientSessionsHeader';

interface ClientSessionsDateFilterProps {
  clientDateFilter: ClientDateFilterType;
  onDateFilterChange: (dateFilter: ClientDateFilterType) => void;
}

export const ClientSessionsDateFilter: React.FC<ClientSessionsDateFilterProps> = React.memo(
  function ClientSessionsDateFilter({
    clientDateFilter,
    onDateFilterChange,
  }) {
    return (
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
    );
  }
);
