import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface ClientSessionsTitleProps {
  onOpenTickets: () => void;
}

export const ClientSessionsTitle: React.FC<ClientSessionsTitleProps> = React.memo(
  function ClientSessionsTitle({ onOpenTickets }) {
    return (
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
    );
  }
);
