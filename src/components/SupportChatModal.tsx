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
  Keyboard,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const chatId = ticket ? `support_ticket_${ticket.ticket_id || ticket.id}` : '';
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Fetch client user credits if admin
  useEffect(() => {
    if (!visible || !ticket?.user_id) return;
    
    // 1. Try local cache
    const profile = Database.getProfile(ticket.user_id);
    if (profile && typeof profile.creditsBalance === 'number') {
      setUserCredits(profile.creditsBalance);
    }

    // 2. Fetch fresh credits balance from Supabase
    supabase
      .from('user_profiles')
      .select('credits_balance')
      .eq('user_id', ticket.user_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data && typeof data.credits_balance === 'number') {
          setUserCredits(data.credits_balance);
        }
      })
      .catch((err) => {
        console.warn('[SupportChatModal] Fetch user credits error:', err);
      });
  }, [visible, ticket?.user_id]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const h = e.endCoordinates ? e.endCoordinates.height : 0;
      setKeyboardHeight(h);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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

          {/* User Credits Balance Tag (Visible to Admin in Support Chat) */}
          {currentRole === 'admin' && (
            <View className="flex-row items-center gap-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl">
              <Feather name="credit-card" size={11} color="#D97706" />
              <Text className="text-amber-800 text-[10px] font-black uppercase">
                {userCredits !== null ? `${userCredits} Credits` : 'Credits: ...'}
              </Text>
            </View>
          )}
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
          style={{ 
            flex: 1, 
            paddingBottom: Platform.OS === 'android' ? keyboardHeight : 0 
          }}
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
                const isTicketSummary = m.text?.startsWith('[Concierge Ticket #') || m.text?.includes('Issue regarding');
                
                // If it is the issue create message, show on left side for admin (as it comes from the user ticket)
                const isMe = isTicketSummary 
                  ? false 
                  : (currentRole === 'admin' 
                      ? (m.sender === 'virla' || m.sender === 'coach') 
                      : (m.sender === 'customer' || m.sender === 'user'));

                return (
                  <View
                    key={m.id}
                    style={{
                      maxWidth: '82%',
                      alignSelf: isMe ? 'flex-end' : 'flex-start',
                    }}
                    className={`max-w-[82%] p-3.5 rounded-2xl ${
                      isMe
                        ? 'self-end bg-[#101828] rounded-br-xs'
                        : isTicketSummary
                          ? 'self-start bg-rose-50/70 border border-rose-200/80 rounded-bl-xs'
                          : 'self-start bg-zinc-100 border border-zinc-200/60 rounded-bl-xs'
                    }`}
                  >
                    {isTicketSummary && (
                      <View className="flex-row items-center gap-1.5 mb-1 pb-1 border-b border-rose-200/60">
                        <Feather name="alert-circle" size={11} color="#E11D48" />
                        <Text className="text-[#E11D48] text-[9px] font-black uppercase tracking-wider">
                          Reported Issue
                        </Text>
                      </View>
                    )}
                    <Text
                      className={`text-xs font-medium leading-relaxed ${
                        isMe 
                          ? 'text-white' 
                          : isTicketSummary 
                            ? 'text-rose-950 font-semibold' 
                            : 'text-zinc-900'
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

                    {/* Admin option to view session details attached below the issue report card */}
                    {isTicketSummary && currentRole === 'admin' && ticket.booking_id && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          onClose();
                          router.push({
                            pathname: '/session-detail',
                            params: { id: ticket.booking_id },
                          });
                        }}
                        className="mt-2.5 pt-2 border-t border-rose-200/80 flex-row items-center justify-between"
                      >
                        <View className="flex-row items-center gap-1.5">
                          <Feather name="external-link" size={12} color="#E11D48" />
                          <Text className="text-[#E11D48] text-[10px] font-black uppercase tracking-wider">
                            User & Trainer Session Details
                          </Text>
                        </View>
                        <Feather name="chevron-right" size={12} color="#E11D48" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Chat Input Bar or Resolved/Closed Notice */}
          {ticket?.status === 'RESOLVED' || ticket?.status === 'CLOSED' ? (
            <View
              className="px-5 py-4 bg-zinc-50 border-t border-zinc-200 items-center justify-center gap-1.5"
              style={{ paddingBottom: Math.max(insets.bottom, 16) }}
            >
              <View className="flex-row items-center gap-1.5 bg-emerald-100/70 border border-emerald-200 px-3 py-1 rounded-full">
                <Feather name="check-circle" size={13} color="#059669" />
                <Text className="text-emerald-800 text-[11px] font-black uppercase tracking-wider">
                  Ticket {ticket.status}
                </Text>
              </View>
              <Text className="text-zinc-600 text-xs font-bold text-center mt-0.5">
                This Support was Resolved and Closed
              </Text>
              <Text className="text-zinc-400 text-[10px] font-medium text-center">
                New replies are disabled for this ticket.
              </Text>
            </View>
          ) : (
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
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
