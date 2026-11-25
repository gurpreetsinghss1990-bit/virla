import React from 'react';
import { View } from 'react-native';
import {
  MessagesHeader,
  MessagesSearchBar,
  MessagesList,
  ChatItem,
} from './messages';

interface ClientMessagesViewProps {
  backgroundColor: string;
  insetsTop: number;
  hasOnlineChats: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  filteredChats: ChatItem[];
  onChatPress: (chat: ChatItem) => void;
}

export const ClientMessagesView: React.FC<ClientMessagesViewProps> = React.memo(
  function ClientMessagesView({
    backgroundColor,
    insetsTop,
    hasOnlineChats,
    searchQuery,
    onSearchChange,
    onClearSearch,
    filteredChats,
    onChatPress,
  }) {
    return (
      <View style={{ flex: 1, backgroundColor, paddingTop: insetsTop }}>
        {/* Top Header */}
        <MessagesHeader
          backgroundColor={backgroundColor}
          hasOnlineChats={hasOnlineChats}
        />

        {/* Lively Search Input Bar */}
        <MessagesSearchBar
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          onClearSearch={onClearSearch}
        />

        {/* Chats List */}
        <MessagesList
          filteredChats={filteredChats}
          onChatPress={onChatPress}
        />
      </View>
    );
  }
);

