import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { ScreenHeader } from '../components/ScreenHeader';
import * as WebBrowser from 'expo-web-browser';

interface LegalDoc {
  id: string;
  title: string;
  desc: string;
  icon: string;
  content: string;
  url?: string;
  urlLabel?: string;
}

export default function LegalCenterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const handleOpenLink = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
      });
    } catch (err) {
      console.error('Failed to open WebBrowser:', err);
      Linking.openURL(url).catch(() => {});
    }
  };

  const legalDocs: LegalDoc[] = [
    {
      id: 'terms',
      title: 'Terms & Conditions',
      desc: 'Account eligibility and platform utilization policies.',
      icon: 'file-text',
      content: 'By scheduling workouts with VIRLA, you confirm that you are at least 18 years old, possess a verified mobile account, and permit the matching engine to utilize your coordinate radius to calculate certified trainer arrival timelines.',
      url: 'https://virla.in/terms.html',
      urlLabel: 'Open Terms of Service on virla.in'
    },
    {
      id: 'privacy',
      title: 'Privacy & Location Policy',
      desc: 'How secure coordinates and data logs are managed.',
      icon: 'shield',
      content: 'VIRLA stores your medical history, health indications, and address profiles securely. GPS travel coordination is only activated during active workouts and is automatically terminated upon session completion.',
      url: 'https://virla.in/privacy.html',
      urlLabel: 'Open Privacy Policy on virla.in'
    },
    {
      id: 'cancel',
      title: 'Cancellation & Rescheduling',
      desc: 'Free vs late cancellation guidelines.',
      icon: 'clock',
      content: 'Cancellations scheduled 2+ hours prior to the slot are refunded fully. Cancellations within the 2-hour window forfeit 1 credit, which is disbursed directly to the coach as travel compensation.',
      url: 'https://virla.in/terms.html#cancellation',
      urlLabel: 'Open Cancellation Policy on virla.in'
    },
    {
      id: 'refund',
      title: 'Refund & Credit Policy',
      desc: 'Credits expiry and package refund rules.',
      icon: 'credit-card',
      content: 'Wallet credits purchased via Single Session, Starter, Premium, or Elite packs do not expire for 12 months. Refund packages are evaluated on request by our VIP Concierge support team.',
      url: 'https://virla.in/terms.html#cancellation',
      urlLabel: 'Open Refund Policy on virla.in'
    },
    {
      id: 'medical',
      title: 'Health & Medical Disclaimer',
      desc: 'Physical safety check requirements.',
      icon: 'heart',
      content: 'Home training sessions are physically demanding. You are required to disclose asthma, cardiac conditions, joint tightness, or pregnancies. Consult your physician before initiating conditioning programs.'
    },
    {
      id: 'trainer',
      title: 'Trainer Code of Conduct',
      desc: 'Professional conduct and safety regulations.',
      icon: 'award',
      content: 'Associate, Certified, and Elite trainers must respect boundary rules, maintain professional guidelines during visits, and submit post-session reports within 24 hours to secure their session payouts.',
      url: 'https://virla.in/partner-terms-and-professional-standards.html',
      urlLabel: 'Open Partner Standards on virla.in'
    }
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FC' }}>
      <ScreenHeader title="Legal & Compliance" category="VIRLA LEGAL" />

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        className="flex-1 p-6" 
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 24, 48) }}
      >
        <View className="gap-6">
          
          <View>
            <Text className="text-zinc-900 text-2xl font-bold tracking-tight">Legal Center</Text>
            <Text className="text-zinc-500 text-sm font-normal mt-1 leading-relaxed">
              Read carefully to understand credit utilization, health disclosures, and trainer codes.
            </Text>
          </View>

          {/* Official Website Deep Links Card */}
          <View className="bg-white border border-[#E5E7EB] p-4 rounded-[22px] shadow-sm gap-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <View className="w-2 h-2 rounded-full bg-emerald-500" />
                <Text className="text-zinc-900 text-xs font-bold uppercase tracking-wider">
                  Official Website Policies
                </Text>
              </View>
              <Feather name="globe" size={14} color="#6B7280" />
            </View>

            <Text className="text-zinc-500 text-xs leading-relaxed">
              Access the complete legal contracts, privacy disclosures, and platform terms hosted on virla.in.
            </Text>

            <View className="flex-row gap-2.5 pt-0.5">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleOpenLink('https://virla.in/terms.html')}
                className="flex-1 bg-zinc-50 border border-zinc-200 py-2.5 px-3 rounded-xl flex-row items-center justify-center gap-1.5"
              >
                <Text className="text-zinc-800 text-xs font-bold">Terms of Service</Text>
                <Feather name="external-link" size={12} color="#4B5563" />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleOpenLink('https://virla.in/privacy.html')}
                className="flex-1 bg-zinc-50 border border-zinc-200 py-2.5 px-3 rounded-xl flex-row items-center justify-center gap-1.5"
              >
                <Text className="text-zinc-800 text-xs font-bold">Privacy Policy</Text>
                <Feather name="external-link" size={12} color="#4B5563" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Docs list */}
          <View className="gap-3.5">
            {legalDocs.map((doc) => {
              const isOpen = expandedSection === doc.id;
              return (
                <TouchableOpacity
                  key={doc.id}
                  activeOpacity={0.85}
                  onPress={() => setExpandedSection(isOpen ? null : doc.id)}
                  className="bg-white border border-[#E5E7EB] p-4 rounded-[22px] shadow-sm gap-2"
                  style={{
                    shadowColor: '#101828',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.02,
                    shadowRadius: 6,
                    elevation: 1,
                  }}
                >
                  <View className="flex-row justify-between items-center">
                    <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                      <View className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 items-center justify-center">
                        <Feather name={doc.icon as any} size={16} color="#E11D48" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-zinc-900 text-sm font-bold tracking-tight">{doc.title}</Text>
                        <Text className="text-zinc-500 text-xs font-normal mt-0.5 leading-snug">{doc.desc}</Text>
                      </View>
                    </View>
                    <View className={`w-7 h-7 rounded-full items-center justify-center ${isOpen ? 'bg-rose-50' : 'bg-zinc-50'}`}>
                      <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} color={isOpen ? '#E11D48' : '#6B7280'} />
                    </View>
                  </View>
                  
                  {isOpen && (
                    <View className="mt-2 pt-3 border-t border-zinc-100 gap-3">
                      <Text className="text-zinc-600 text-xs font-normal leading-relaxed">
                        {doc.content}
                      </Text>
                      {doc.url && (
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => handleOpenLink(doc.url!)}
                          className="flex-row items-center gap-1.5 self-start bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-full"
                        >
                          <Text className="text-[#E11D48] text-xs font-bold">
                            {doc.urlLabel || 'View on virla.in'}
                          </Text>
                          <Feather name="external-link" size={12} color="#E11D48" />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* App Credits and Version */}
          <View className="items-center justify-center py-6 gap-1 border-t border-zinc-200 mt-2">
            <Text className="text-zinc-900 text-xs font-bold tracking-wide">VIRLA FitTech Pvt. Ltd.</Text>
            <Text className="text-zinc-400 text-xs font-medium mt-0.5">Version 3.0.0 (Build 57)</Text>
            <Text className="text-zinc-400 text-xs text-center mt-1 leading-relaxed max-w-[85%]">
              All rights reserved. Dedicated to safety, security, and certified training excellence.
            </Text>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}
