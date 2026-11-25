import React from 'react';
import { View } from 'react-native';
import { SkeletonLoader } from './SkeletonLoader';
import {
  ClientSessionsHeader,
  ClientSessionsList,
  type ClientFilterType,
  type ClientDateFilterType,
  type CursorPageData,
} from './sessions';
import { Booking } from '../types';

export interface ClientSessionsViewProps {
  loading: boolean;
  insetsTop: number;
  insetsBottom: number;
  activeFilter: ClientFilterType;
  filterOptions: ClientFilterType[];
  getFilterLabel: (filter: ClientFilterType) => string;
  onFilterChange: (filter: ClientFilterType) => void;
  clientDateFilter: ClientDateFilterType;
  onDateFilterChange: (dateFilter: ClientDateFilterType) => void;
  activeTabCount: number;
  onOpenTickets: () => void;
  renderedFilter: ClientFilterType;
  cursorPage: CursorPageData;
  cursorHistory: (string | null)[];
  currentCursor: string | null;
  onPrevPage: () => void;
  onNextPage: () => void;
  onOpenSupport: (booking: Booking) => void;
  onResetDateFilter: () => void;
}

export const ClientSessionsView = React.memo(function ClientSessionsView({
  loading,
  insetsTop,
  insetsBottom,
  activeFilter,
  filterOptions,
  getFilterLabel,
  onFilterChange,
  clientDateFilter,
  onDateFilterChange,
  activeTabCount,
  onOpenTickets,
  renderedFilter,
  cursorPage,
  cursorHistory,
  currentCursor,
  onPrevPage,
  onNextPage,
  onOpenSupport,
  onResetDateFilter,
}: ClientSessionsViewProps) {
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8F9FC' }}>
        <SkeletonLoader layout="bookings" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F9FC' }}>
      <View style={{ flex: 1 }}>
        <ClientSessionsHeader
          insetsTop={insetsTop}
          activeFilter={activeFilter}
          filterOptions={filterOptions}
          getFilterLabel={getFilterLabel}
          onFilterChange={onFilterChange}
          clientDateFilter={clientDateFilter}
          onDateFilterChange={onDateFilterChange}
          activeTabCount={activeTabCount}
          onOpenTickets={onOpenTickets}
        />

        <ClientSessionsList
          insetsBottom={insetsBottom}
          renderedFilter={renderedFilter}
          clientDateFilter={clientDateFilter}
          cursorPage={cursorPage}
          cursorHistory={cursorHistory}
          currentCursor={currentCursor}
          onPrevPage={onPrevPage}
          onNextPage={onNextPage}
          onOpenSupport={onOpenSupport}
          onResetDateFilter={onResetDateFilter}
        />
      </View>
    </View>
  );
});
