import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Database, SupportTicket } from '../database/Database';
import { formatToDDMMYYYY } from '../utils/date';

interface UserTicketsModalProps {
  visible: boolean;
  userId: string;
  onClose: () => void;
  onSelectTicket: (ticket: SupportTicket) => void;
}

export function UserTicketsModal({
  visible,
  userId,
  onClose,
  onSelectTicket,
}: UserTicketsModalProps) {
  const insets = useSafeAreaInsets();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadTickets = async () => {
    setIsLoading(true);
    try {
      const data = await Database.fetchUserSupportTickets(userId);
      setTickets(data);
    } catch (err) {
      console.error('[UserTicketsModal] Error fetching tickets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (visible && userId) {
      loadTickets();
    }
  }, [visible, userId]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
        {/* Header */}
        <View className="px-6 py-4 border-b border-zinc-100 flex-row items-center justify-between">
          <View>
            <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">
              Virla Concierge
            </Text>
            <Text className="text-zinc-900 text-lg font-black tracking-tight">
              My Support Tickets
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={loadTickets}
              className="w-8 h-8 rounded-full bg-zinc-100 items-center justify-center mr-1"
            >
              <Feather name="refresh-cw" size={14} color="#18181B" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-zinc-100 items-center justify-center"
            >
              <Ionicons name="close" size={18} color="#18181B" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          className="flex-1 p-6"
          contentContainerStyle={{ paddingBottom: 60 }}
        >
          {isLoading ? (
            <View className="py-20 items-center justify-center">
              <ActivityIndicator size="small" color="#101828" />
              <Text className="text-zinc-400 text-xs font-semibold mt-3">Loading your tickets...</Text>
            </View>
          ) : tickets.length === 0 ? (
            <View className="py-20 items-center justify-center gap-2">
              <View className="w-14 h-14 rounded-full bg-zinc-100 items-center justify-center mb-2">
                <Feather name="inbox" size={24} color="#9CA3AF" />
              </View>
              <Text className="text-zinc-900 text-sm font-bold">No Support Tickets</Text>
              <Text className="text-zinc-500 text-xs text-center px-8">
                You haven't raised any session dispute or concierge tickets yet.
              </Text>
            </View>
          ) : (
            <View className="gap-3.5">
              {tickets.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  activeOpacity={0.8}
                  onPress={() => {
                    onClose();
                    onSelectTicket(t);
                  }}
                  className="bg-zinc-50 border border-zinc-200/80 p-4 rounded-2xl gap-2.5 active:bg-zinc-100"
                >
                  <View className="flex-row justify-between items-center">
                    <View className="flex-row items-center gap-2">
                      <View className={`w-2 h-2 rounded-full ${t.status === 'OPEN' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider">
                        {t.ticket_id}
                      </Text>
                    </View>
                    <View className="bg-zinc-200/70 px-2 py-0.5 rounded-md">
                      <Text className="text-zinc-700 text-[8px] font-black uppercase">{t.status}</Text>
                    </View>
                  </View>

                  <View className="gap-1">
                    <Text className="text-zinc-800 text-xs font-bold">{t.reason}</Text>
                    <Text className="text-zinc-500 text-[11px] font-medium" numberOfLines={2}>
                      {t.description}
                    </Text>
                  </View>

                  <View className="flex-row justify-between items-center border-t border-zinc-200/50 pt-2.5 mt-1">
                    <Text className="text-zinc-400 text-[9px] font-semibold">
                      {new Date(t.created_at).toLocaleDateString()} · {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <View className="flex-row items-center gap-1">
                      <Feather name="message-square" size={12} color="#101828" />
                      <Text className="text-zinc-900 text-[10px] font-black uppercase">Open Chat</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
