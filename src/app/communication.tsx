import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, Alert, Animated, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useBookingStore } from '../store/bookingStore';
import { useNotificationStore } from '../store/notificationStore';
import { useWalletStore } from '../store/walletStore';
import { Ionicons, Feather } from '@expo/vector-icons';

import { Database } from '../database/Database';
import { useUserStore } from '../store/userStore';
import { supabase } from '../database/supabaseClient';

interface ChatMessage {
  id: string;
  sender: 'customer' | 'trainer';
  text: string;
  timestamp: string;
  pending?: boolean;
}

export default function CommunicationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const bookingId = params.id as string;

  const { bookings, cancelSession } = useBookingStore();
  const { addNotification } = useNotificationStore();
  const { refundCredit } = useWalletStore();

  const booking = bookings.find((b) => b.id === bookingId) || bookings[0];

  const getSessionStartDate = (): Date => {
    try {
      if (!booking) return new Date();
      let datePart = booking.date;
      if (datePart.startsWith('Today, ')) {
        datePart = datePart.replace('Today, ', '');
      } else if (datePart.startsWith('Tomorrow, ')) {
        datePart = datePart.replace('Tomorrow, ', '');
      }

      const timePart = booking.time.split('-')[0].trim();
      const combined = `${datePart} ${timePart}`;
      const d = new Date(combined);
      if (!isNaN(d.getTime())) {
        return d;
      }
    } catch (e) {
      console.log('Error parsing date:', e);
    }
    const fallback = new Date();
    fallback.setHours(fallback.getHours() + 2);
    return fallback;
  };

  const getMinutesToSession = () => {
    if (!booking) return 0;
    const sessionDate = getSessionStartDate();
    const now = new Date();
    return (sessionDate.getTime() - now.getTime()) / (1000 * 60);
  };

  const { user, role } = useUserStore();
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!booking) return;
    
    const loadAndFilterMessages = () => {
      const dbMsgs = Database.getChatMessages(booking.id);
      const isMoreThan60Mins = getMinutesToSession() > 60;
      const now = Date.now();
      
      const filtered = dbMsgs.map((msg) => {
        let localSender: 'customer' | 'trainer' = 'customer';
        if (msg.sender === 'trainer' || msg.sender === 'coach') {
          localSender = 'trainer';
        }
        
        return {
          id: msg.id,
          sender: localSender,
          text: msg.text,
          timestamp: msg.timestamp,
        };
      }).filter((msg) => {
        const isMyMsg = (role === 'trainer' && msg.sender === 'trainer') ||
                        (role === 'customer' && msg.sender === 'customer');
        if (isMyMsg) return true;
        
        let msgTime = now;
        try {
          const d = new Date(msg.timestamp);
          if (!isNaN(d.getTime())) {
            msgTime = d.getTime();
          }
        } catch (e) {}
        
        if (isMoreThan60Mins) {
          return now - msgTime >= 120000;
        }
        return true;
      });
      
      setMessages(filtered);
    };

    loadAndFilterMessages();
    const interval = setInterval(loadAndFilterMessages, 1000);
    return () => clearInterval(interval);
  }, [booking, role]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, isTyping]);

  if (!booking) {
    return (
      <View style={{ flex: 1, backgroundColor: 'white', paddingTop: insets.top }} className="justify-center items-center">
        <Text className="text-zinc-400 font-semibold">No booking details found.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 bg-zinc-900 px-6 py-2 rounded-full">
          <Text className="text-white font-bold text-xs">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleSendMessage = () => {
    if (!messageText.trim() || !booking) return;

    const sender = role === 'trainer' ? 'trainer' : 'customer';
    Database.sendChatMessage(booking.id, messageText.trim(), sender);

    setMessageText('');
  };

  const handleCall = () => {
    Alert.alert(
      'Voice Call Simulated',
      `Connecting secure line to Coach ${booking.trainerName} (+91 99999 88888)...`
    );
  };

  const handleShareLocation = () => {
    Alert.alert(
      'Live Location Shared',
      'Your real-time GPS coordinate route is now visible to the coach.'
    );
  };

  const handleSOS = () => {
    Alert.alert(
      '🚨 SOS Emergency Support',
      'Emergency support initiated. Dispatching local response support units and alerting emergency contact (Neha Sharma: +91 98200 11223).'
    );
  };

  // Enforce late cancellation business rules
  const handleCancelBooking = () => {
    const isLate = booking.timelineStatus === 'trainer_travelling' || booking.timelineStatus === 'trainer_arrived';
    
    Alert.alert(
      'Cancel Workout Appointment',
      isLate
        ? '⚠️ Warning: Your trainer is already travelling. Cancelling now forfeits 1 credit as travel compensation for the coach.'
        : 'Are you sure you want to cancel this session? Your credit will be fully refunded to your wallet.',
      [
        { text: 'Keep Session', style: 'cancel' },
        {
          text: 'Confirm Cancellation',
          style: 'destructive',
          onPress: () => {
            cancelSession(booking.id);
            Alert.alert('Booking Cancelled', 'Session has been successfully cancelled.');
            router.back();
          }
        }
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FC', paddingTop: insets.top }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white justify-between">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#101828" />
        </TouchableOpacity>
        
        <View className="items-center">
          <Text className="text-[#101828] text-xs font-black uppercase tracking-wider">
            {role === 'trainer' ? `Client (${booking ? 'VIRLA-C' + booking.id.slice(-6).toUpperCase() : ''})` : `Coach ${booking.trainerName}`}
          </Text>
          <Text className="text-zinc-400 text-[8px] font-bold uppercase">
            {role === 'trainer' ? `Solo Session` : `${booking.trainerSpeciality} • ${booking.trainerLevel}`}
          </Text>
        </View>

        <TouchableOpacity onPress={handleSOS} className="bg-red-50 px-3 py-1.5 rounded-full border border-red-150">
          <Text className="text-red-500 text-[8px] font-black uppercase">SOS</Text>
        </TouchableOpacity>
      </View>

      {/* Communications Top Tool Bar */}
      <View className="bg-white border-b border-zinc-150 p-4 flex-row justify-around gap-2.5">
        <TouchableOpacity
          onPress={getMinutesToSession() <= 60 ? handleCall : () => Alert.alert('Secure Line Locked', 'Voice calling is masked and locked until 60 minutes before the session starts.')}
          activeOpacity={getMinutesToSession() <= 60 ? 0.8 : 0.5}
          className={`flex-1 py-3 rounded-2xl items-center flex-row justify-center gap-2 ${
            getMinutesToSession() <= 60 ? 'bg-zinc-50 border border-zinc-100' : 'bg-zinc-100 border border-zinc-200 opacity-60'
          }`}
        >
          <Feather name="phone" size={12} color={getMinutesToSession() <= 60 ? '#101828' : '#9CA3AF'} />
          <Text className={`text-[8px] font-black uppercase ${getMinutesToSession() <= 60 ? 'text-zinc-950' : 'text-[#9CA3AF]'}`}>
            {role === 'trainer' ? 'Call Client' : 'Call Coach'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleShareLocation} className="flex-1 bg-zinc-50 border border-zinc-100 py-3 rounded-2xl items-center flex-row justify-center gap-2">
          <Feather name="navigation" size={12} color="#101828" />
          <Text className="text-zinc-950 text-[8px] font-black uppercase">Share Live GPS</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleCancelBooking} className="flex-1 bg-rose-50 border border-rose-100 py-3 rounded-2xl items-center flex-row justify-center gap-2">
          <Feather name="x-circle" size={12} color="#EF4444" />
          <Text className="text-rose-600 text-[8px] font-black uppercase">Cancel Session</Text>
        </TouchableOpacity>
      </View>

      {/* Chat Messages List */}
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        className="flex-1 px-6 pt-4"
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        <View className="gap-4">
          
          <Text className="text-zinc-400 text-[8px] font-bold uppercase text-center my-2">Security check-in line enabled</Text>

          {messages.map((msg) => {
            const isMe = (role === 'customer' && msg.sender === 'customer') ||
                         (role === 'trainer' && msg.sender === 'trainer');
            
            let timeDisplay = msg.timestamp || '';
            try {
              const d = new Date(msg.timestamp);
              if (!isNaN(d.getTime())) {
                timeDisplay = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              }
            } catch (e) {}

            const isPending = (msg.sender === 'customer' && role === 'customer' || msg.sender === 'trainer' && role === 'trainer') &&
                              (getMinutesToSession() > 60) &&
                              // eslint-disable-next-line react-hooks/purity
                              (Date.now() - new Date(msg.timestamp).getTime() < 120000);

            return (
              <View
                key={msg.id}
                className={`max-w-[80%] p-4.5 rounded-[24px] ${
                  isMe 
                    ? 'bg-zinc-950 self-end rounded-tr-none' 
                    : 'bg-white border border-zinc-200 self-start rounded-tl-none'
                }`}
              >
                <Text className={`text-xs font-semibold leading-relaxed ${isMe ? 'text-white' : 'text-zinc-900'}`}>
                  {msg.text}
                </Text>
                <View className="flex-row items-center gap-1 mt-1 justify-end flex-wrap">
                  <Text className={`text-[7px] font-bold uppercase text-zinc-400`}>
                    {timeDisplay}
                  </Text>
                  {isPending && (
                    <View className="flex-row items-center gap-0.5 ml-1 bg-zinc-800 px-1 py-0.5 rounded">
                      <Feather name="clock" size={7} color="#9CA3AF" />
                      <Text className="text-[6px] text-zinc-400 font-black uppercase">Pending (2m delay)</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <View className="bg-white border border-zinc-200 p-4 rounded-[24px] rounded-tl-none self-start max-w-[50%] flex-row gap-1 items-center">
              <View className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
              <View className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
              <View className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Quick Messages Bar */}
      <View className="bg-zinc-50 border-t border-zinc-100 py-2.5 px-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
          {["I've arrived.", "I'm running 5 minutes late.", "Please come downstairs.", "I'm at the gate."].map((msgText, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => {
                if (!booking) return;
                const sender = role === 'trainer' ? 'trainer' : 'customer';
                Database.sendChatMessage(booking.id, msgText, sender);
              }}
              className="bg-white border border-zinc-200 px-3.5 py-1.5 rounded-full mr-2"
            >
              <Text className="text-zinc-700 text-[9px] font-bold">{msgText}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Bottom Message Input Bar */}
      <View 
        style={{ paddingBottom: Math.max(insets.bottom, 16), paddingTop: 12, paddingHorizontal: 16 }}
        className="border-t border-zinc-150 bg-white flex-row gap-3 items-center"
      >
        <TextInput
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Type message secure to coach..."
          placeholderTextColor="#9CA3AF"
          className="flex-1 bg-zinc-50 border border-zinc-150 p-4.5 rounded-2xl text-zinc-900 text-xs font-semibold"
        />
        <TouchableOpacity
          onPress={handleSendMessage}
          className="w-12 h-12 rounded-2xl bg-zinc-950 items-center justify-center shadow-xs"
        >
          <Feather name="send" size={16} color="white" />
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
    </View>
  );
}
