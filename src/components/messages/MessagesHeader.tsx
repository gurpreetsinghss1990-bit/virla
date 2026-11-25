import React from 'react';
import { View, Text } from 'react-native';

interface MessagesHeaderProps {
  backgroundColor: string;
  hasOnlineChats: boolean;
}

export const MessagesHeader: React.FC<MessagesHeaderProps> = React.memo(
  function MessagesHeader({ backgroundColor, hasOnlineChats }) {
    return (
      <View style={{ backgroundColor }} className="px-5 pt-3 pb-2 flex-row items-center justify-between">
        <View>
          <Text className="text-zinc-950 text-2xl font-black tracking-tight">
            Chats
          </Text>
        </View>

        {hasOnlineChats && (
          <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
            <View className="w-2 h-2 rounded-full bg-emerald-500" />
            <Text className="text-emerald-700 text-xs font-bold">Online</Text>
          </View>
        )}
      </View>
    );
  }
);
