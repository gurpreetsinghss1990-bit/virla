import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface ClientSessionsPaginationProps {
  hasPrevPage: boolean;
  hasNextPage: boolean;
  hasNextCursor?: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export const ClientSessionsPagination: React.FC<ClientSessionsPaginationProps> = React.memo(
  function ClientSessionsPagination({
    hasPrevPage,
    hasNextPage,
    hasNextCursor,
    onPrevPage,
    onNextPage,
  }) {
    return (
      <View className="flex-row items-center justify-between mt-4 mb-2 pt-3 border-t border-zinc-200/80">
        <Pressable
          disabled={!hasPrevPage}
          onPress={onPrevPage}
          className={`px-4 py-2.5 rounded-full flex-row items-center gap-1.5 border ${
            hasPrevPage
              ? 'bg-white border-zinc-300'
              : 'bg-zinc-100 border-zinc-200 opacity-40'
          }`}
        >
          <Feather name="chevron-left" size={14} color="#101828" />
          <Text className="text-[#101828] text-xs font-bold">Prev</Text>
        </Pressable>

        <Pressable
          disabled={!hasNextPage || !hasNextCursor}
          onPress={onNextPage}
          className={`px-4 py-2.5 rounded-full flex-row items-center gap-1.5 ${
            hasNextPage
              ? 'bg-[#101828]'
              : 'bg-zinc-200 opacity-40'
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              hasNextPage ? 'text-white' : 'text-zinc-500'
            }`}
          >
            Next
          </Text>
          <Feather
            name="chevron-right"
            size={14}
            color={hasNextPage ? '#FFFFFF' : '#6B7280'}
          />
        </Pressable>
      </View>
    );
  }
);
