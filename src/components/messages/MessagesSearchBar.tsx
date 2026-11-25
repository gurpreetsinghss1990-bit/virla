import React from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface MessagesSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
}

export const MessagesSearchBar: React.FC<MessagesSearchBarProps> = React.memo(
  function MessagesSearchBar({ searchQuery, onSearchChange, onClearSearch }) {
    return (
      <View className="px-5 pt-1 pb-2.5">
        <View className="flex-row items-center bg-white px-3.5 py-2.5 rounded-full shadow-sm">
          <Feather name="search" size={17} color="#71717A" />
          <TextInput
            maxLength={250}
            placeholder="Search chats or messages..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={onSearchChange}
            className="flex-1 text-[15px] font-medium text-zinc-900 ml-2.5 py-0"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={onClearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <View className="w-4 h-4 rounded-full bg-zinc-300 items-center justify-center">
                <Feather name="x" size={10} color="white" />
              </View>
            </Pressable>
          )}
        </View>
      </View>
    );
  }
);
