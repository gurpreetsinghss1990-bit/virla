import React from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWalletStore } from '../store/walletStore';
import { Ionicons, Feather } from '@expo/vector-icons';

export default function InvoiceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const invoiceId = params.id as string;

  const { payments } = useWalletStore();
  const payment = payments.find(p => p.id === invoiceId) || payments[0];

  if (!payment) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <Text className="text-zinc-400 font-semibold">No invoice records found.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 bg-zinc-900 px-6 py-2 rounded-full">
          <Text className="text-white font-bold text-xs">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const handleDownloadInvoice = () => {
    Alert.alert('Invoice Downloaded', `Mock receipt download complete: ${payment.invoiceNo}.pdf has been saved.`);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FB]">
      {/* Header */}
      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-[#111827] text-sm font-black uppercase tracking-wider mr-8">
          Invoice Pass
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="gap-6">
          
          {/* Mock PDF Receipt Sheet (Feature 6) */}
          <View className="bg-white border border-[#E5E7EB] rounded-[30px] shadow-sm p-6 gap-6 relative overflow-hidden">
            
            {/* Header corporate */}
            <View className="flex-row justify-between items-start border-b border-zinc-150 pb-5">
              <View className="gap-0.5">
                <Text className="text-[#111827] text-sm font-black uppercase tracking-widest">VIRLA</Text>
                <Text className="text-zinc-400 text-[7px] font-bold uppercase leading-relaxed mt-0.5">
                  VIRLA FitTech Pvt. Ltd.{"\n"}Mumbai, MH, India
                </Text>
              </View>
              <View className="items-end gap-1">
                <View className="bg-zinc-950 px-2 py-0.5 rounded">
                  <Text className="text-white text-[7px] font-black uppercase">Tax Invoice</Text>
                </View>
                <Text className="text-zinc-900 text-[10px] font-black mt-1">{payment.invoiceNo}</Text>
              </View>
            </View>

            {/* Bill To details */}
            <View className="flex-row justify-between">
              <View className="gap-0.5">
                <Text className="text-zinc-400 text-[8px] font-black uppercase">Billed To</Text>
                <Text className="text-zinc-800 text-xs font-black mt-0.5">Viral</Text>
                <Text className="text-zinc-500 text-[8px] font-bold uppercase">Mumbai, MH, India</Text>
              </View>
              <View className="items-end gap-0.5">
                <Text className="text-zinc-400 text-[8px] font-black uppercase">Issue Date</Text>
                <Text className="text-zinc-800 text-xs font-black mt-0.5">{payment.date}</Text>
              </View>
            </View>

            {/* Line items table */}
            <View className="border-t border-b border-zinc-150 py-4 gap-2.5">
              {/* Table Header */}
              <View className="flex-row justify-between pb-1 border-b border-zinc-100">
                <Text className="w-[50%] text-zinc-400 text-[8px] font-black uppercase">Description</Text>
                <Text className="w-[15%] text-zinc-400 text-[8px] font-black uppercase text-center">Qty</Text>
                <Text className="w-[35%] text-zinc-400 text-[8px] font-black uppercase text-right">Amount</Text>
              </View>
              {/* Row */}
              <View className="flex-row justify-between items-center py-1">
                <Text className="w-[50%] text-zinc-900 text-[10px] font-black">{payment.planName} ({payment.credits} Credits)</Text>
                <Text className="w-[15%] text-zinc-800 text-[10px] font-bold text-center">1</Text>
                <Text className="w-[35%] text-zinc-900 text-[10px] font-black text-right">{payment.amount}</Text>
              </View>
            </View>

            {/* Financial summaries */}
            <View className="align-self-end w-[60%] ml-auto gap-2">
              <View className="flex-row justify-between">
                <Text className="text-zinc-500 text-[9px] font-bold">Taxable Amount</Text>
                <Text className="text-zinc-900 text-[9px] font-black">{payment.amount}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-zinc-500 text-[9px] font-bold">Integrated GST (18%)</Text>
                <Text className="text-zinc-900 text-[9px] font-black">{payment.gst}</Text>
              </View>
              <View className="h-[1px] bg-zinc-100 my-1" />
              <View className="flex-row justify-between">
                <Text className="text-zinc-950 text-xs font-black">Total Paid</Text>
                <Text className="text-[#4F46E5] text-xs font-black">{payment.total}</Text>
              </View>
            </View>

            {/* Footnote details */}
            <View className="border-t border-dashed border-zinc-200 pt-4 items-center gap-1">
              <Text className="text-zinc-500 text-[8px] font-bold uppercase tracking-wider text-center">Mock PDF Receipt Summary Only</Text>
              <Text className="text-zinc-400 text-[7px] text-center leading-relaxed">
                Thank you for training with VIRLA. Keep pushing your fitness limits!
              </Text>
            </View>
          </View>

          {/* Download invoice button (Feature 6) */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleDownloadInvoice}
            className="w-full bg-[#111827] py-4 rounded-2xl items-center justify-center shadow-xs"
          >
            <Text className="text-white text-xs font-black uppercase">Download Invoice PDF</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
