import React, { useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, TextInput, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';

export default function HelpSupportScreen() {
  const router = useRouter();

  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDetails, setTicketDetails] = useState('');
  const [showTicketForm, setShowTicketForm] = useState(false);

  const faqs = [
    { q: 'How do credit wallet balances work?', a: '1 Credit allows you to schedule a complete 1-hour session of any training experience (Strength, Yoga, Recover, Cardio, Boxing) with a certified coach at your home.' },
    { q: 'What is the booking cancellation policy?', a: 'Cancellations are free up to 2 hours before the scheduled time slot. Cancellations within 2 hours are marked as late and forfeit 1 credit to compensate the coach for travel.' },
    { q: 'How are coaches assigned to bookings?', a: 'Our engine identifies certified coaches available in your selected slot, filters by target distance, and sorts by average rating to automatically assign the ideal trainer.' },
    { q: 'Can I pause or freeze my membership?', a: 'Yes! Memberships (Starter, Premium, Elite) come with pause allowances. Starter permits 5 freeze days, Premium permits 15 days, and Elite permits up to 30 days.' }
  ];

  const handleRaiseTicket = () => {
    if (!ticketSubject.trim() || !ticketDetails.trim()) {
      Alert.alert('Empty Fields', 'Please add a subject and detailed description of the problem.');
      return;
    }
    Alert.alert('Support Ticket Raised', `Ticket TK-${Math.floor(1000 + Math.random() * 9000)} has been logged. Our concierge will reach out in 15 minutes.`);
    setTicketSubject('');
    setTicketDetails('');
    setShowTicketForm(false);
  };

  const handleAction = (label: string, detail: string) => {
    Alert.alert(label, detail);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FB]">
      {/* Header */}
      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white justify-between">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text className="text-[#111827] text-sm font-black uppercase tracking-wider">
          Help & Support Center
        </Text>
        <View className="w-8" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 60 }}>
        <View className="gap-6">
          
          <View>
            <Text className="text-zinc-900 text-2xl font-black tracking-tight leading-tight">Concierge Support</Text>
            <Text className="text-zinc-500 text-xs font-semibold mt-1 leading-relaxed">
              We respond to active support requests and tickets in 15 minutes or less.
            </Text>
          </View>

          {/* 1. Quick Support Channels */}
          <View className="flex-row justify-between gap-y-4 flex-wrap">
            <TouchableOpacity
              onPress={() => handleAction('Secure Line', 'Connecting to client hot-line (+91 99999 88888)...')}
              className="w-[47%] bg-white border border-[#E5E7EB] p-4.5 rounded-[24px] shadow-xs items-center gap-2"
            >
              <Feather name="phone" size={16} color="#4F46E5" />
              <Text className="text-zinc-950 text-[10px] font-black uppercase">Call Support</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleAction('Email Support', 'Opening email ticket draft to support@virla.fit...')}
              className="w-[47%] bg-white border border-[#E5E7EB] p-4.5 rounded-[24px] shadow-xs items-center gap-2"
            >
              <Feather name="mail" size={16} color="#10B981" />
              <Text className="text-zinc-950 text-[10px] font-black uppercase">Email Support</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowTicketForm(!showTicketForm)}
              className="w-full bg-zinc-950 p-4.5 rounded-[24px] shadow-sm flex-row justify-between items-center"
            >
              <View className="flex-row items-center gap-3">
                <Feather name="file-text" size={16} color="white" />
                <Text className="text-white text-xs font-black uppercase">Raise support ticket</Text>
              </View>
              <Feather name={showTicketForm ? 'chevron-up' : 'chevron-down'} size={14} color="white" />
            </TouchableOpacity>
          </View>

          {/* Ticket Form */}
          {showTicketForm && (
            <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-3.5">
              <View className="gap-1">
                <Text className="text-zinc-500 text-[8px] font-black uppercase">Subject Summary</Text>
                <TextInput
                  value={ticketSubject}
                  onChangeText={setTicketSubject}
                  placeholder="e.g. Credit balance discrepancy"
                  className="border border-[#E5E7EB] bg-[#F8F9FB] p-3 rounded-xl text-xs font-semibold text-zinc-900"
                />
              </View>

              <View className="gap-1">
                <Text className="text-zinc-500 text-[8px] font-black uppercase">Describe the Issue</Text>
                <TextInput
                  value={ticketDetails}
                  onChangeText={setTicketDetails}
                  placeholder="Add context or session IDs..."
                  className="border border-[#E5E7EB] bg-[#F8F9FB] p-3 rounded-xl text-xs font-semibold text-zinc-900 h-16"
                  multiline
                />
              </View>

              <TouchableOpacity
                onPress={handleRaiseTicket}
                className="w-full bg-[#4F46E5] py-3.5 rounded-xl items-center"
              >
                <Text className="text-white text-xs font-black uppercase">Submit Ticket</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 2. FAQ list */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
            <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider border-b border-zinc-50 pb-2">Frequently Asked Questions</Text>
            
            <View className="gap-3.5">
              {faqs.map((faq, idx) => {
                const isOpen = expandedFaq === idx;
                return (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.9}
                    onPress={() => setExpandedFaq(isOpen ? null : idx)}
                    className="gap-1.5"
                  >
                    <View className="flex-row justify-between items-center">
                      <Text className="text-zinc-900 text-xs font-black flex-1 pr-3 leading-relaxed">{faq.q}</Text>
                      <Feather name={isOpen ? 'minus' : 'plus'} size={12} color="#6B7280" />
                    </View>
                    {isOpen && (
                      <Text className="text-zinc-500 text-[10px] font-semibold leading-relaxed mt-1 bg-[#F8F9FB] p-3 rounded-xl border border-zinc-100">
                        {faq.a}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 3. Safety Guidelines & Hotline */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-3">
            <Text className="text-rose-600 text-xs font-black uppercase tracking-wider pl-1">Safety & Emergency Help</Text>
            <Text className="text-zinc-500 text-[10px] font-semibold leading-relaxed">
              If you experience any cardiac issues, breathlessness, or immediate muscular injury during home workouts, tap the SOS hotline immediately.
            </Text>
            <TouchableOpacity
              onPress={() => handleAction('🚨 Emergency Hotline', 'Connecting dispatch hotline... emergency units will route GPS coordinates immediately.')}
              className="bg-red-50 border border-red-100 py-3.5 rounded-2xl items-center"
            >
              <Text className="text-red-500 text-[10px] font-black uppercase">Emergency Dispatch SOS</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
