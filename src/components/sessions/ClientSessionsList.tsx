import React from 'react';
import { View } from 'react-native';
import AnimatedReanimated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { BookingCard } from '../BookingCard';
import { EmptyState } from '../EmptyState';
import { Booking } from '../../types';
import { ClientFilterType, ClientDateFilterType } from './ClientSessionsHeader';
import { ClientSessionsPagination } from './ClientSessionsPagination';

export interface CursorPageData {
  items: Booking[];
  hasPrevPage: boolean;
  hasNextPage: boolean;
  nextCursor?: string | null;
}

export interface ClientSessionsListProps {
  insetsBottom: number;
  renderedFilter: ClientFilterType;
  clientDateFilter: ClientDateFilterType;
  cursorPage: CursorPageData;
  cursorHistory: (string | null)[];
  currentCursor: string | null;
  onPrevPage: () => void;
  onNextPage: () => void;
  onOpenSupport: (booking: Booking) => void;
  onResetDateFilter: () => void;
}

export const ClientSessionsList = React.memo(function ClientSessionsList({
  insetsBottom,
  renderedFilter,
  clientDateFilter,
  cursorPage,
  onPrevPage,
  onNextPage,
  onOpenSupport,
  onResetDateFilter,
}: ClientSessionsListProps) {
  return (
    <View
      style={{
        flex: 1,
        borderTopLeftRadius: 48,
        borderTopRightRadius: 48,
        overflow: 'hidden',
        backgroundColor: '#F8F9FC',
      }}
    >
      {/* Scrollable Content: Pure UI Thread Scrolling for Cards */}
      <AnimatedReanimated.ScrollView
        showsVerticalScrollIndicator={false}
        decelerationRate={0.96}
        bounces={true}
        alwaysBounceVertical={true}
        overScrollMode="always"
        nestedScrollEnabled={true}
        style={{ flex: 1 }}
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: Math.max((insetsBottom || 0) + 40, 140),
          paddingHorizontal: 16,
        }}
        scrollEventThrottle={16}
      >
        {/* Bookings Render List with UI thread smooth fade animation on tab switch */}
        <AnimatedReanimated.View
          key={renderedFilter}
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(100)}
          className="min-h-[220px]"
        >
          {cursorPage.items.length > 0 ? (
            <>
              {cursorPage.items.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onOpenSupport={onOpenSupport}
                />
              ))}

              {(renderedFilter === 'completed' || renderedFilter === 'cancelled') &&
                (cursorPage.hasPrevPage || cursorPage.hasNextPage) && (
                  <ClientSessionsPagination
                    hasPrevPage={cursorPage.hasPrevPage}
                    hasNextPage={cursorPage.hasNextPage}
                    hasNextCursor={Boolean(cursorPage.nextCursor)}
                    onPrevPage={onPrevPage}
                    onNextPage={onNextPage}
                  />
                )}
            </>
          ) : (
            <EmptyState
              type={renderedFilter === 'completed' || renderedFilter === 'past' ? 'no-sessions' : 'no-bookings'}
              title={
                renderedFilter === 'cancelled'
                  ? 'No Cancelled Sessions'
                  : renderedFilter === 'completed'
                    ? 'No Completed Sessions'
                    : 'No Upcoming Sessions'
              }
              showCard={false}
              message={
                renderedFilter === 'cancelled' && clientDateFilter !== 'all'
                  ? 'No cancelled or missed visits found for this period.'
                  : renderedFilter === 'upcoming'
                    ? 'Schedule your next premium at-home training session from the home dashboard.'
                    : renderedFilter === 'cancelled'
                      ? 'You do not have any cancelled sessions logged in your profile.'
                      : `You do not have any ${renderedFilter} visits logged in your profile.`
              }
              actionText={clientDateFilter !== 'all' ? 'Show All' : undefined}
              onAction={clientDateFilter !== 'all' ? onResetDateFilter : undefined}
            />
          )}
        </AnimatedReanimated.View>
      </AnimatedReanimated.ScrollView>
    </View>
  );
});
