import React, { useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';

export default function LegalCenterScreen() {
  const router = useRouter();

  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const legalDocs = [
    {
      id: 'terms',
      title: 'T&C: Terms & Conditions',
      desc: 'Account eligibility and platform utilization policies.',
      content: 'By scheduling workouts with VIRLA, you confirm that you are at least 18 years old, possess a verified mobile account, and permit the matching engine to utilize your coordinate radius to calculate certified trainer arrival timelines.'
    },
    {
      id: 'privacy',
      title: 'Privacy & GPS tracking policy',
      desc: 'How secure coordinates and data logs are managed.',
      content: 'VIRLA stores your medical history, health indications, and address profiles locally. GPS travel coordination is only activated during active workouts and is automatically terminated upon session completion.'
    },
    {
      id: 'cancel',
      title: 'Cancellation & Late penalty rules',
      desc: 'Free vs late cancellation guidelines.',
      content: 'Cancellations scheduled 2+ hours prior to the slot are refunded fully. Cancellations within the 2-hour window forfeit 1 credit, which is disbursed directly to the coach as travel compensation.'
    },
    {
      id: 'refund',
      title: 'Refund & Wallet Policy',
      desc: 'Credits expiry and package refund rules.',
      content: 'Wallet credits purchased via Single Session, Starter, Premium, or Elite packs do not expire for 12 months. Refund packages are evaluated on request by our VIP Concierge support team.'
    },
    {
      id: 'medical',
      title: 'Medical Liability Disclaimer',
      desc: 'Physical safety check requirements.',
      content: 'Home training sessions are physically demanding. You are required to disclose asthma, cardiac conditions, joint tightness, or pregnancies. Consult your physician before initiating conditioning programs.'
    },
    {
      id: 'trainer',
      title: 'Trainer Professional Code',
      desc: 'Code of conduct and safety regulations.',
      content: 'Associate, Certified, and Elite trainers must respect boundary rules, maintain professional guidelines during visits, and submit post-session reports within 24 hours to secure their session payouts.'
    }
  ];

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FB]">
      {/* Header */}
      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white justify-between">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text className="text-[#111827] text-sm font-black uppercase tracking-wider">
          Legal & Compliance
        </Text>
        <View className="w-8" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 60 }}>
        <View className="gap-6">
          
          <View>
            <Text className="text-zinc-900 text-2xl font-black tracking-tight leading-tight">Legal Center</Text>
            <Text className="text-zinc-500 text-xs font-semibold mt-1 leading-relaxed">
              Read carefully to understand credit utilization, medical limitations, and trainer codes.
            </Text>
          </View>

          {/* Docs list */}
          <View className="gap-4">
            {legalDocs.map((doc) => {
              const isOpen = expandedSection === doc.id;
              return (
                <TouchableOpacity
                  key={doc.id}
                  activeOpacity={0.9}
                  onPress={() => setExpandedSection(isOpen ? null : doc.id)}
                  className="bg-white border border-[#E5E7EB] p-4.5 rounded-[24px] shadow-sm gap-2"
                >
                  <View className="flex-row justify-between items-center">
                    <View className="flex-1 pr-3">
                      <Text className="text-zinc-950 text-xs font-black">{doc.title}</Text>
                      <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">{doc.desc}</Text>
                    </View>
                    <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} color="#6B7280" />
                  </View>
                  
                  {isOpen && (
                    <Text className="text-zinc-500 text-[10px] font-semibold leading-relaxed mt-2 pt-2 border-t border-zinc-50">
                      {doc.content}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* App Credits and Version */}
          <View className="items-center justify-center py-6 gap-1 border-t border-zinc-150">
            <Text className="text-zinc-950 text-xs font-black uppercase">VIRLA FitTech Pvt. Ltd.</Text>
            <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">Version: v3.0.0-PRO-MVP-SP10</Text>
            <Text className="text-zinc-400 text-[7px] text-center mt-2 leading-relaxed">
              All rights reserved. Apple Wallet, Airbnb UI styling indicators used as mock blueprints.
            </Text>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
