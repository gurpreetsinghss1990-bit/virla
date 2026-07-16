import React, { useState, useEffect, useRef } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, TextInput, Image, Alert, Animated } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useBookingStore } from '../store/bookingStore';
import { useNotificationStore } from '../store/notificationStore';
import { useWalletStore } from '../store/walletStore';
import { Ionicons, Feather } from '@expo/vector-icons';

interface ChatMessage {
  id: string;
  sender: 'customer' | 'trainer';
  text: string;
  time: string;
}

export default function CommunicationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const bookingId = params.id as string;

  const { bookings, cancelSession } = useBookingStore();
  const { addNotification } = useNotificationStore();
  const { refundCredit } = useWalletStore();

  const booking = bookings.find((b) => b.id === bookingId) || bookings[0];

  if (!booking) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <Text className="text-zinc-400 font-semibold">No booking details found.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 bg-zinc-900 px-6 py-2 rounded-full">
          <Text className="text-white font-bold text-xs">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-1',
      sender: 'trainer',
      text: `Hello Viral! I'm preparing for our ${booking.workoutTitle} session.`,
      time: '10:05 AM'
    },
    {
      id: 'm-2',
      sender: 'trainer',
      text: 'Do you have any specific areas of muscle soreness we should prioritize today?',
      time: '10:06 AM'
    }
  ]);

  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const handleSendMessage = () => {
    if (!messageText.trim()) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'customer',
      text: messageText.trim(),
      time: '10:10 AM'
    };

    setMessages(prev => [...prev, userMsg]);
    setMessageText('');

    // Trigger typing indicator and trainer auto-reply
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const replyMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'trainer',
        text: 'Got it! I am loading the gear and will target exactly that. See you shortly.',
        time: '10:11 AM'
      };
      setMessages(prev => [...prev, replyMsg]);
      
      // Push mock notify updates
      addNotification({
        title: `Message from ${booking.trainerName} 💬`,
        body: 'Got it! I am loading the gear and will target exactly that.',
        icon: 'user-check'
      });
    }, 2000);
  };

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, isTyping]);

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
    <SafeAreaView className="flex-1 bg-[#F8F9FB]">
      {/* Header */}
      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white justify-between">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        
        <View className="items-center">
          <Text className="text-[#111827] text-xs font-black uppercase tracking-wider">Coach {booking.trainerName}</Text>
          <Text className="text-zinc-400 text-[8px] font-bold uppercase">{booking.trainerSpeciality} • {booking.trainerLevel}</Text>
        </View>

        <TouchableOpacity onPress={handleSOS} className="bg-red-50 px-3 py-1.5 rounded-full border border-red-150">
          <Text className="text-red-500 text-[8px] font-black uppercase">SOS</Text>
        </TouchableOpacity>
      </View>

      {/* Communications Top Tool Bar */}
      <View className="bg-white border-b border-zinc-150 p-4 flex-row justify-around gap-2.5">
        <TouchableOpacity onPress={handleCall} className="flex-1 bg-zinc-50 border border-zinc-100 py-3 rounded-2xl items-center flex-row justify-center gap-2">
          <Feather name="phone" size={12} color="#111827" />
          <Text className="text-zinc-950 text-[8px] font-black uppercase">Call Trainer</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleShareLocation} className="flex-1 bg-zinc-50 border border-zinc-100 py-3 rounded-2xl items-center flex-row justify-center gap-2">
          <Feather name="navigation" size={12} color="#111827" />
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
            const isMe = msg.sender === 'customer';
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
                <Text className={`text-[7px] font-bold uppercase mt-1 text-right ${isMe ? 'text-zinc-400' : 'text-zinc-400'}`}>
                  {msg.time}
                </Text>
              </View>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <View className="bg-white border border-zinc-200 p-4 rounded-[24px] rounded-tl-none self-start max-w-[50%] flex-row gap-1 items-center">
              <View className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" />
              <View className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce delay-100" />
              <View className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce delay-200" />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Message Input Bar */}
      <View className="p-4 border-t border-zinc-150 bg-white flex-row gap-3 items-center">
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
    </SafeAreaView>
  );
}
