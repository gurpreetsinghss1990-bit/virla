import React from 'react';
import { View } from 'react-native';
import { NativeSegmentedControl } from '../NativeSegmentedControl';
import { ClientSessionsTitle } from './ClientSessionsTitle';
import { ClientSessionsDateFilter } from './ClientSessionsDateFilter';

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
      {/* 1. Header Title & Support Notepad */}
      <ClientSessionsTitle onOpenTickets={onOpenTickets} />

      {/* 2. Upcoming / Completed / Cancelled Segmented Control Tabs */}
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

      {/* 3. Date Filter Pills */}
      {activeTabCount > 0 && (
        <ClientSessionsDateFilter
          clientDateFilter={clientDateFilter}
          onDateFilterChange={onDateFilterChange}
        />
      )}
    </View>
  );
});
