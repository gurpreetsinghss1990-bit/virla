import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ScreenHeader } from '../components/ScreenHeader';

export default function HelpSupportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [ticketCategory, setTicketCategory] = useState<string>('Credits / Wallet');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDetails, setTicketDetails] = useState('');
  const [showTicketForm, setShowTicketForm] = useState(false);

  const categories = ['Credits / Wallet', 'Booking Issue', 'Coach Feedback', 'Other'];

  const faqs = [
    {
      q: 'How do credit wallet balances work?',
      a: '1 Credit allows you to schedule a complete 60-minute training session across any workout category (Strength, Yoga, Boxing, HIIT, Rehab) with a certified coach at your home.'
    },
    {
      q: 'What is the booking cancellation policy?',
      a: 'Cancellations are completely free up to 2 hours before the scheduled session. Cancellations within 2 hours are marked as late and forfeit 1 credit to compensate the coach for travel and reserved slot time.'
    },
    {
      q: 'How are coaches assigned to bookings?',
      a: 'Our intelligent matching engine filters certified coaches based on your workout category, target address, and availability slot, automatically pairing you with top-rated trainers.'
    },
    {
      q: 'Can I pause or freeze my membership?',
      a: 'Yes. Depending on your active package, memberships allow freeze periods (Starter: 5 days, Active Pack: 15 days, Elite: up to 30 days). Contact concierge support to initiate a pause.'
    }
  ];

  const handleRaiseTicket = () => {
    if (!ticketSubject.trim() || !ticketDetails.trim()) {
      Alert.alert('Incomplete Fields', 'Please provide a subject summary and detailed description of the issue.');
      return;
    }
    const ticketId = `TK-${Math.floor(1000 + Math.random() * 9000)}`;
    Alert.alert(
      'Support Ticket Submitted',
      `Ticket #${ticketId} has been logged under "${ticketCategory}". Our senior concierge lead will respond within 15 minutes.`
    );
    setTicketSubject('');
    setTicketDetails('');
    setShowTicketForm(false);
  };

  const handleAction = (label: string, detail: string) => {
    Alert.alert(label, detail);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="Help & Support" category="VIRLA CONCIERGE" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: Math.max((insets.bottom || 0) + 32, 48)
          }}
        >
          {/* Hero Header */}
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#059669', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Concierge Active • 15m Response
              </Text>
            </View>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#09090B', letterSpacing: -0.5 }}>
              How can we help you?
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '400', color: '#71717A', marginTop: 4, lineHeight: 19 }}>
              Our dedicated support team is available 24/7 for booking assistance, credit queries, or trainer coordination.
            </Text>
          </View>

          {/* Quick Support Channels (Call & Email) */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            {/* Call Support Card */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleAction('Secure Line', 'Connecting to client concierge hotline (+91 99999 88888)...')}
              style={{
                flex: 1,
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                padding: 16,
                borderWidth: 1,
                borderColor: '#E4E4E7',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.03,
                shadowRadius: 6,
                elevation: 1,
              }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Feather name="phone-call" size={18} color="#4F46E5" />
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#09090B' }}>
                Direct Call
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '500', color: '#71717A', marginTop: 2 }}>
                +91 99999 88888
              </Text>
              <View style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#EEF2FF', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#4F46E5' }}>Instant</Text>
              </View>
            </TouchableOpacity>

            {/* Email Support Card */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleAction('Email Support', 'Opening email draft to support@virla.fit...')}
              style={{
                flex: 1,
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                padding: 16,
                borderWidth: 1,
                borderColor: '#E4E4E7',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.03,
                shadowRadius: 6,
                elevation: 1,
              }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Feather name="mail" size={18} color="#059669" />
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#09090B' }}>
                Email Desk
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '500', color: '#71717A', marginTop: 2 }}>
                support@virla.fit
              </Text>
              <View style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#ECFDF5', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#059669' }}>&lt; 15 mins</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Raise Support Ticket Toggle Card */}
          <View style={{ marginBottom: 20 }}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setShowTicketForm(!showTicketForm)}
              style={{
                backgroundColor: '#121214',
                borderRadius: 20,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="file-text" size={18} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>
                    Raise Support Ticket
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '400', color: '#A1A1AA', marginTop: 1 }}>
                    {showTicketForm ? 'Tap to close inquiry form' : 'Submit formal report or discrepancy'}
                  </Text>
                </View>
              </View>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                <Feather name={showTicketForm ? 'chevron-up' : 'chevron-down'} size={15} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            {/* Ticket Submission Form */}
            {showTicketForm && (
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 20,
                  padding: 18,
                  marginTop: 10,
                  borderWidth: 1,
                  borderColor: '#E4E4E7',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.04,
                  shadowRadius: 10,
                  elevation: 2,
                  gap: 14,
                }}
              >
                {/* Category Selector Chips */}
                <View>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#71717A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    Category
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {categories.map((cat) => {
                      const isCatSelected = ticketCategory === cat;
                      return (
                        <TouchableOpacity
                          key={cat}
                          activeOpacity={0.8}
                          onPress={() => setTicketCategory(cat)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 7,
                            borderRadius: 10,
                            backgroundColor: isCatSelected ? '#18181B' : '#F4F4F5',
                          }}
                        >
                          <Text style={{ fontSize: 11.5, fontWeight: isCatSelected ? '700' : '500', color: isCatSelected ? '#FFFFFF' : '#52525B' }}>
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Subject Summary */}
                <View>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#71717A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                    Subject Summary
                  </Text>
                  <TextInput
                    value={ticketSubject}
                    onChangeText={setTicketSubject}
                    placeholder="e.g. Session reschedule or credit discrepancy"
                    placeholderTextColor="#A1A1AA"
                    style={{
                      borderWidth: 1,
                      borderColor: '#E4E4E7',
                      backgroundColor: '#F9FAFB',
                      paddingHorizontal: 14,
                      paddingVertical: 11,
                      borderRadius: 12,
                      fontSize: 13,
                      fontWeight: '500',
                      color: '#09090B',
                    }}
                  />
                </View>

                {/* Issue Details */}
                <View>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#71717A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                    Describe the Issue
                  </Text>
                  <TextInput
                    value={ticketDetails}
                    onChangeText={setTicketDetails}
                    placeholder="Please include session date, coach name, or reference ID..."
                    placeholderTextColor="#A1A1AA"
                    multiline
                    numberOfLines={4}
                    style={{
                      borderWidth: 1,
                      borderColor: '#E4E4E7',
                      backgroundColor: '#F9FAFB',
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderRadius: 12,
                      fontSize: 13,
                      fontWeight: '500',
                      color: '#09090B',
                      minHeight: 88,
                      textAlignVertical: 'top',
                    }}
                  />
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={handleRaiseTicket}
                  style={{
                    backgroundColor: '#4F46E5',
                    borderRadius: 14,
                    paddingVertical: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 8,
                    marginTop: 4,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                    Submit Ticket
                  </Text>
                  <Feather name="arrow-right" size={15} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Frequently Asked Questions */}
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 22,
              padding: 18,
              borderWidth: 1,
              borderColor: '#E4E4E7',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.03,
              shadowRadius: 6,
              elevation: 1,
              marginBottom: 20,
            }}
          >
            {/* FAQ Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F4F4F5', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#F4F4F5', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="help-circle" size={15} color="#18181B" />
                </View>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#09090B', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                  Frequently Asked Questions
                </Text>
              </View>
              <View style={{ backgroundColor: '#F4F4F5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#71717A' }}>{faqs.length} FAQs</Text>
              </View>
            </View>

            {/* FAQ Items */}
            <View style={{ gap: 8 }}>
              {faqs.map((faq, idx) => {
                const isOpen = expandedFaq === idx;
                return (
                  <View
                    key={idx}
                    style={{
                      borderRadius: 14,
                      backgroundColor: isOpen ? '#F9FAFB' : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: isOpen ? '#E4E4E7' : '#F4F4F5',
                      overflow: 'hidden',
                    }}
                  >
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setExpandedFaq(isOpen ? null : idx)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 13,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text style={{ fontSize: 13.5, fontWeight: '600', color: '#18181B', flex: 1, paddingRight: 10, lineHeight: 18 }}>
                        {faq.q}
                      </Text>
                      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: isOpen ? '#E4E4E7' : '#F4F4F5', alignItems: 'center', justifyContent: 'center' }}>
                        <Feather name={isOpen ? 'minus' : 'plus'} size={12} color="#52525B" />
                      </View>
                    </TouchableOpacity>

                    {isOpen && (
                      <View style={{ paddingHorizontal: 14, paddingBottom: 14, paddingTop: 2 }}>
                        <Text style={{ fontSize: 12.5, fontWeight: '400', color: '#52525B', lineHeight: 19 }}>
                          {faq.a}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Safety & Emergency SOS Card */}
          <View
            style={{
              backgroundColor: '#FFF1F2',
              borderRadius: 22,
              padding: 18,
              borderWidth: 1,
              borderColor: '#FFE4E6',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="alert-octagon" size={16} color="#E11D48" />
              </View>
              <View>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#E11D48', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                  Safety & Emergency Assistance
                </Text>
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#881337', marginTop: 1 }}>
                  Workout SOS Hotline
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 12, fontWeight: '400', color: '#9F1239', lineHeight: 17 }}>
              If you experience any cardiac symptoms, severe breathlessness, or immediate acute injury during your home training session, trigger dispatch immediately.
            </Text>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleAction('🚨 Emergency Hotline', 'Connecting dispatch hotline... emergency units will route GPS coordinates immediately.')}
              style={{
                backgroundColor: '#E11D48',
                borderRadius: 14,
                paddingVertical: 13,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
                shadowColor: '#E11D48',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.25,
                shadowRadius: 6,
                elevation: 2,
              }}
            >
              <Feather name="phone-forwarded" size={15} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Emergency Dispatch SOS
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer Note */}
          <View style={{ alignItems: 'center', marginTop: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '500', color: '#A1A1AA' }}>
              VIRLA Concierge • 256-bit Encrypted Support Channel
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
