import React from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useWalletStore } from '../store/walletStore';
import { Ionicons, Feather } from '@expo/vector-icons';

export default function PaymentHistoryScreen() {
  const router = useRouter();
  const { payments } = useWalletStore();

  const handleInvoiceClick = (id: string) => {
    router.push({
      pathname: '/invoice' as any,
      params: { id }
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FB]">
      {/* Header */}
      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-[#111827] text-sm font-black uppercase tracking-wider mr-8">
          Billing History
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="gap-6">
          
          <View>
            <Text className="text-zinc-900 text-2xl font-black tracking-tight leading-tight">Payment Receipts</Text>
            <Text className="text-zinc-500 text-xs font-semibold mt-1 leading-relaxed">
              Tap any completed or refunded transaction to view invoice details.
            </Text>
          </View>

          {/* Timeline transaction items (Feature 7) */}
          <View className="pl-2 gap-5">
            {payments.map((pay, idx) => {
              const isCompleted = pay.status === 'completed';
              const isRefunded = pay.status === 'refunded';
              const isFailed = pay.status === 'failed';
              
              return (
                <View key={pay.id} className="flex-row items-start gap-4">
                  
                  {/* Timeline bullet dot */}
                  <View className="items-center">
                    <View className={`w-6 h-6 rounded-full items-center justify-center border ${
                      isCompleted 
                        ? 'bg-green-500 border-green-500' 
                        : isRefunded 
                        ? 'bg-blue-500 border-blue-500' 
                        : 'bg-red-500 border-red-500'
                    }`}>
                      {isCompleted ? (
                        <Feather name="check" size={11} color="white" />
                      ) : isRefunded ? (
                        <Feather name="rotate-ccw" size={11} color="white" />
                      ) : (
                        <Feather name="x" size={11} color="white" />
                      )}
                    </View>
                    {idx < payments.length - 1 && (
                      <View className="w-[1.5px] h-16 bg-zinc-200 mt-2" />
                    )}
                  </View>

                  {/* Transaction content card */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={isFailed}
                    onPress={() => handleInvoiceClick(pay.id)}
                    className="flex-1 bg-white border border-[#E5E7EB] p-4.5 rounded-[24px] shadow-xs flex-row justify-between items-center"
                  >
                    <View className="flex-1 pr-3 gap-0.5">
                      <Text className="text-zinc-900 text-xs font-black">{pay.planName}</Text>
                      <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">Invoice: {pay.invoiceNo} • {pay.date}</Text>
                      <Text className="text-zinc-500 text-[9px] font-semibold mt-1">💳 {pay.method}</Text>
                    </View>
                    
                    <View className="items-end gap-1.5">
                      <Text className="text-zinc-950 text-xs font-black">{pay.total}</Text>
                      
                      {/* Status Tag */}
                      <View className={`px-2 py-0.5 rounded-full ${
                        isCompleted 
                          ? 'bg-green-50 border border-green-150' 
                          : isRefunded 
                          ? 'bg-blue-50 border border-blue-150' 
                          : 'bg-red-50 border border-red-150'
                      }`}>
                        <Text className={`text-[7px] font-black uppercase ${
                          isCompleted ? 'text-green-600' : isRefunded ? 'text-blue-600' : 'text-red-500'
                        }`}>
                          {pay.status}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                </View>
              );
            })}
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
