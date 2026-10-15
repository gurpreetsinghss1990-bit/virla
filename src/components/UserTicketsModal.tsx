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
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
        {/* Header */}
        <View
          style={{ paddingTop: insets.top }}
          className="px-6 py-4 bg-white border-b border-zinc-150 flex-row items-center justify-between shadow-2xs"
        >
          <Text className="text-zinc-950 text-xl font-black tracking-tight">
            My Support Tickets
          </Text>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={loadTickets}
              activeOpacity={0.7}
              className="w-9 h-9 rounded-full bg-zinc-100 border border-zinc-200/60 items-center justify-center mr-0.5"
            >
              <Feather name="refresh-cw" size={14} color="#18181B" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              className="w-9 h-9 rounded-full bg-zinc-100 border border-zinc-200/60 items-center justify-center"
            >
              <Ionicons name="close" size={18} color="#18181B" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          className="flex-1 p-6"
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 40, 60) }}
        >
          {isLoading ? (
            <View className="py-24 items-center justify-center">
              <ActivityIndicator size="small" color="#101828" />
              <Text className="text-zinc-400 text-xs font-semibold mt-3">Loading support history...</Text>
            </View>
          ) : tickets.length === 0 ? (
            <View className="py-20 items-center justify-center gap-3">
              <View className="w-16 h-16 rounded-3xl bg-zinc-100 border border-zinc-200/80 items-center justify-center mb-1 shadow-2xs">
                <Feather name="shield" size={26} color="#9CA3AF" />
              </View>
              <Text className="text-zinc-900 text-base font-black">
                No Support Tickets Found
              </Text>
              <Text className="text-zinc-500 text-xs text-center px-10 leading-relaxed font-medium">
                All your session feedback, disputes, and support questions will appear here with live updates.
              </Text>
            </View>
          ) : (
            <View className="gap-3.5">
              {tickets.map((t) => {
                const isOpen = t.status === 'OPEN';
                return (
                  <TouchableOpacity
                    key={t.id}
                    activeOpacity={0.85}
                    onPress={() => {
                      onClose();
                      onSelectTicket(t);
                    }}
                    className="bg-white border border-zinc-200/90 p-4.5 rounded-2xl gap-3 shadow-xs active:bg-zinc-50/80"
                  >
                    <View className="flex-row justify-between items-center">
                      <View className="flex-row items-center gap-2">
                        <View className={`w-2.5 h-2.5 rounded-full ${isOpen ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                        <Text className="text-zinc-900 text-xs font-black tracking-wide">
                          #{t.ticket_id}
                        </Text>
                      </View>
                      <View className={`px-2.5 py-1 rounded-full border ${
                        isOpen 
                          ? 'bg-amber-50 border-amber-200 text-amber-700' 
                          : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      }`}>
                        <Text className={`text-[9px] font-black uppercase tracking-wider ${
                          isOpen ? 'text-amber-800' : 'text-emerald-800'
                        }`}>
                          {isOpen ? 'IN PROGRESS' : 'RESOLVED'}
                        </Text>
                      </View>
                    </View>

                    <View className="gap-1">
                      <Text className="text-zinc-950 text-sm font-black leading-snug">
                        {t.reason || 'General Session Inquiry'}
                      </Text>
                      <Text className="text-zinc-500 text-xs font-medium leading-relaxed" numberOfLines={2}>
                        {t.description || 'No additional details provided.'}
                      </Text>
                    </View>

                    <View className="flex-row justify-between items-center border-t border-zinc-100 pt-3 mt-0.5">
                      <View className="flex-row items-center gap-1.5">
                        <Feather name="clock" size={11} color="#94A3B8" />
                        <Text className="text-zinc-400 text-[10px] font-semibold">
                          {formatToDDMMYYYY(t.created_at)}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1.5 bg-zinc-900 px-3 py-1.5 rounded-xl shadow-2xs">
                        <Feather name="message-square" size={11} color="#FFFFFF" />
                        <Text className="text-white text-[10px] font-black uppercase tracking-wider">
                          Open Live Chat
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
