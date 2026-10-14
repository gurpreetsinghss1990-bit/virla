import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../database/supabaseClient';
import { Database, SupportTicket, ChatMessage } from '../database/Database';

interface SupportChatModalProps {
  visible: boolean;
  ticket: SupportTicket | null;
  currentRole: 'customer' | 'admin';
  onClose: () => void;
}

export function SupportChatModal({
  visible,
  ticket,
  currentRole,
  onClose,
}: SupportChatModalProps) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const chatId = ticket ? `support_ticket_${ticket.ticket_id || ticket.id}` : '';

  // Load and subscribe to real-time chat messages
  useEffect(() => {
    if (!visible || !chatId) return;

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('chat_id', chatId)
          .order('timestamp', { ascending: true });

        if (!error && data) {
          setMessages(
            data.map((m: any) => ({
              id: m.id,
              chatId: m.chat_id,
              sender: m.sender,
              text: m.text,
              timestamp: m.timestamp,
            }))
          );
        }
      } catch (err) {
        console.error('[SupportChatModal] Fetch error:', err);
      }
    };

    fetchMessages();

    // Setup Supabase Realtime channel
    const channelName = `realtime-support-${chatId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          const row = payload.new;
          if (row && row.chat_id === chatId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev;
              return [
                ...prev,
                {
                  id: row.id,
                  chatId: row.chat_id,
                  sender: row.sender,
                  text: row.text,
                  timestamp: row.timestamp,
                },
              ];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [visible, chatId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || !chatId || isSending) return;
    const textToSend = inputText.trim();
    setInputText('');
    setIsSending(true);

    try {
      const senderRole = currentRole === 'admin' ? 'virla' : 'customer';
      const newMsg = Database.sendChatMessage(chatId, textToSend, senderRole as any);
      setMessages((prev) => [...prev, newMsg]);
    } catch (err) {
      console.error('[SupportChatModal] Send message failed:', err);
    } finally {
      setIsSending(false);
    }
  };

  if (!ticket) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
        {/* Header */}
        <View className="h-16 px-5 border-b border-zinc-150 flex-row items-center justify-between bg-white">
          <View className="flex-row items-center gap-3 flex-1 mr-2">
            <TouchableOpacity
              onPress={onClose}
              className="w-9 h-9 rounded-full bg-zinc-100 items-center justify-center active:opacity-70"
            >
              <Ionicons name="arrow-back" size={20} color="#18181B" />
            </TouchableOpacity>
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <View className={`w-2 h-2 rounded-full ${ticket.status === 'OPEN' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider truncate">
                  {ticket.ticket_id}
                </Text>
                <View className="bg-zinc-100 px-2 py-0.5 rounded-md">
                  <Text className="text-zinc-600 text-[8px] font-black uppercase">{ticket.status}</Text>
                </View>
              </View>
              <Text className="text-zinc-500 text-[10px] font-semibold truncate" numberOfLines={1}>
                {currentRole === 'admin' ? `User: ${ticket.user_name} (${ticket.user_phone})` : 'Live Support Concierge'}
              </Text>
            </View>
          </View>
        </View>

        {/* Ticket Diagnostic Overview Header */}
        <View className="bg-zinc-50 border-b border-zinc-200/80 px-5 py-3 gap-1">
          <View className="flex-row justify-between items-center">
            <Text className="text-zinc-400 text-[8px] font-black uppercase tracking-wider">
              {ticket.category}
            </Text>
            {ticket.booking_id && (
              <Text className="text-indigo-600 text-[8px] font-black uppercase">
                Session #{ticket.booking_id.substring(0, 10)}
              </Text>
            )}
          </View>
          <Text className="text-zinc-900 text-xs font-black">
            Reason: {ticket.reason}
          </Text>
          <Text className="text-zinc-600 text-[10px] font-semibold">
            Target Resolution: <Text className="font-bold text-zinc-900">{ticket.preferred_resolution}</Text>
          </Text>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.bottom + 8 : 0}
        >
          {/* Messages Stream */}
          <ScrollView
            ref={scrollViewRef}
            className="flex-1 px-4 py-4"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingBottom: 20 }}
          >
            {messages.length === 0 ? (
              <View className="py-12 items-center justify-center gap-2">
                <Feather name="message-square" size={24} color="#9CA3AF" />
                <Text className="text-zinc-400 text-xs font-semibold">
                  Connecting to live concierge channel...
                </Text>
              </View>
            ) : (
              messages.map((m) => {
                const isMe = currentRole === 'admin' 
                  ? (m.sender === 'virla' || m.sender === 'coach') 
                  : (m.sender === 'customer' || m.sender === 'user');

                return (
                  <View
                    key={m.id}
                    className={`max-w-[82%] p-3.5 rounded-2xl ${
                      isMe
                        ? 'self-end bg-[#101828] rounded-br-xs'
                        : 'self-start bg-zinc-100 border border-zinc-200/60 rounded-bl-xs'
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium leading-relaxed ${
                        isMe ? 'text-white' : 'text-zinc-900'
                      }`}
                    >
                      {m.text}
                    </Text>
                    <Text
                      className={`text-[8px] font-bold mt-1.5 ${
                        isMe ? 'text-zinc-400 text-right' : 'text-zinc-400'
                      }`}
                    >
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Chat Input Bar */}
          <View
            className="px-4 py-3 bg-white border-t border-zinc-150 flex-row items-center gap-2"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder={currentRole === 'admin' ? "Reply to client as Support Admin..." : "Type your message to Virla Support..."}
              placeholderTextColor="#9CA3AF"
              className="flex-1 bg-zinc-100 border border-zinc-200/80 rounded-2xl px-4 py-3 text-xs font-semibold text-zinc-900 max-h-24"
              multiline
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!inputText.trim() || isSending}
              className={`w-11 h-11 rounded-2xl items-center justify-center ${
                inputText.trim() ? 'bg-[#101828]' : 'bg-zinc-200'
              }`}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="arrow-up" size={18} color={inputText.trim() ? '#FFFFFF' : '#9CA3AF'} />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
