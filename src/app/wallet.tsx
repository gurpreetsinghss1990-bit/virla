import React, { useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useWalletStore } from '../store/walletStore';
import { useBookingStore } from '../store/bookingStore';
import { Ionicons, Feather } from '@expo/vector-icons';
import Svg, { Rect, Path } from 'react-native-svg';

export default function WalletScreen() {
  const router = useRouter();
  const { creditBalance, lifetimePurchased, creditsUsed, ledger } = useWalletStore();
  const { bookings } = useBookingStore();

  const upcomingCount = bookings.filter(b => b.status === 'upcoming').length;

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FB]">
      {/* Header */}
      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-[#111827] text-sm font-black uppercase tracking-wider mr-8">
          Credit Wallet
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="gap-6">

          {/* Apple Wallet inspired Credit Card (Feature 3) */}
          <View className="bg-zinc-950 rounded-[32px] p-6 border border-zinc-800 shadow-xl gap-6 relative overflow-hidden">
            {/* Shimmer overlay styling */}
            <View className="absolute top-0 left-0 right-0 bottom-0 bg-indigo-500/5" />

            <View className="flex-row justify-between items-start">
              <View>
                <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-widest">★ VIRLA Wallet Card</Text>
                <Text className="text-white text-base font-black mt-1">Universal Session Pass</Text>
              </View>
              {/* Card NFC Wave indicator */}
              <Feather name="rss" size={16} color="white" />
            </View>

            <View className="my-2">
              <Text className="text-white text-3xl font-black tracking-tight">{creditBalance} Credits</Text>
              <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-wider mt-1">Available check-in balance</Text>
            </View>

            <View className="flex-row justify-between items-center border-t border-zinc-850 pt-4">
              <View>
                <Text className="text-zinc-600 text-[7px] font-black uppercase">Card Holder</Text>
                <Text className="text-white text-xs font-black mt-0.5">Viral</Text>
              </View>
              <View className="items-end">
                <Text className="text-zinc-600 text-[7px] font-black uppercase">Expiry Date</Text>
                <Text className="text-white text-xs font-black mt-0.5">Aug 15, 2026</Text>
              </View>
            </View>
          </View>

          {/* Stats metrics rows */}
          <View className="flex-row justify-between gap-y-4">
            <View className="w-[47%] bg-white border border-[#E5E7EB] p-4.5 rounded-[24px] shadow-xs gap-1.5">
              <Text className="text-zinc-400 text-[8px] font-black uppercase">Lifetime Bought</Text>
              <Text className="text-zinc-900 text-sm font-black">{lifetimePurchased} Credits</Text>
            </View>
            <View className="w-[47%] bg-white border border-[#E5E7EB] p-4.5 rounded-[24px] shadow-xs gap-1.5">
              <Text className="text-zinc-400 text-[8px] font-black uppercase">Credits Consumed</Text>
              <Text className="text-zinc-900 text-sm font-black">{creditsUsed} Credits</Text>
            </View>
            <View className="w-full bg-white border border-[#E5E7EB] p-4.5 rounded-[24px] shadow-xs flex-row justify-between items-center">
              <View className="flex-row items-center gap-3">
                <Feather name="calendar" size={14} color="#4F46E5" />
                <Text className="text-zinc-950 text-xs font-black uppercase">Upcoming Bookings</Text>
              </View>
              <Text className="text-[#4F46E5] text-xs font-black">{upcomingCount} active</Text>
            </View>
          </View>

          {/* Credit ledger ledger logs transaction list (Feature 4) */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
            <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider border-b border-zinc-50 pb-3">Wallet transaction ledger</Text>
            
            <View className="gap-4">
              {ledger.map((tx) => {
                const isAdd = tx.change >= 0;
                return (
                  <View key={tx.id} className="flex-row justify-between items-center py-1">
                    <View className="flex-1 pr-3 gap-0.5">
                      <Text className="text-zinc-900 text-xs font-black leading-tight">{tx.title}</Text>
                      <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">{tx.date}</Text>
                    </View>
                    <View className="items-end gap-1.5">
                      <Text className={`text-xs font-black ${isAdd ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isAdd ? '+' : ''}{tx.change} {Math.abs(tx.change) === 1 ? 'Credit' : 'Credits'}
                      </Text>
                      
                      {/* Type Badge */}
                      <View className={`px-1.5 py-0.5 rounded-md ${
                        tx.type === 'purchase'
                          ? 'bg-blue-50 border border-blue-100'
                          : tx.type === 'refund'
                          ? 'bg-emerald-50 border border-emerald-100'
                          : tx.type === 'penalty'
                          ? 'bg-red-50 border border-red-100'
                          : 'bg-zinc-50 border border-zinc-150'
                      }`}>
                        <Text className={`text-[6px] font-black uppercase ${
                          tx.type === 'purchase' ? 'text-blue-600' : tx.type === 'refund' ? 'text-emerald-600' : tx.type === 'penalty' ? 'text-red-500' : 'text-zinc-500'
                        }`}>
                          {tx.type}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
