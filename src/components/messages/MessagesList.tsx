import React from 'react';
import { View, ScrollView } from 'react-native';
import { EmptyState } from '../EmptyState';
import { ChatItem } from './types';
import { MessagesListItem } from './MessagesListItem';

interface MessagesListProps {
  filteredChats: ChatItem[];
  onChatPress: (chat: ChatItem) => void;
}

export const MessagesList: React.FC<MessagesListProps> = React.memo(
  function MessagesList({ filteredChats, onChatPress }) {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 110, flexGrow: 1 }}
      >
        {filteredChats.length > 0 ? (
          <View className="bg-white">
            {filteredChats.map((chat, idx) => (
              <MessagesListItem
                key={chat.id}
                chat={chat}
                isLast={idx === filteredChats.length - 1}
                onPress={onChatPress}
              />
            ))}
          </View>
        ) : (
          <View className="flex-1 justify-center items-center py-16">
            <EmptyState
              type="no-messages"
              showCard={false}
              message="No conversations found matching your search. Your chats with assigned coaches and concierge will appear here."
            />
          </View>
        )}
      </ScrollView>
    );
  }
);
