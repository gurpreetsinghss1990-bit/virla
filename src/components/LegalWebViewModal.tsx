import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface LegalWebViewModalProps {
  visible: boolean;
  initialTab?: 'terms' | 'privacy';
  onClose: () => void;
}

export const LegalWebViewModal: React.FC<LegalWebViewModalProps> = ({
  visible,
  initialTab = 'terms',
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(initialTab);

  useEffect(() => {
    if (visible) {
      setActiveTab(initialTab);
    }
  }, [visible, initialTab]);

  const handleOpenBrowser = () => {
    const targetUrl =
      activeTab === 'terms'
        ? 'https://virla.in/terms.html'
        : 'https://virla.in/privacy.html';
    Linking.openURL(targetUrl).catch(() => { });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: '#F8F9FD',
          paddingTop: Platform.OS === 'android' ? insets.top : 0,
        }}
      >
        {/* Top App Header */}
        <View className="bg-white border-b border-zinc-200 px-5 py-3.5 flex-row items-center justify-between shadow-xs">
          <View className="flex-row items-center gap-3 flex-1">
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              className="w-9 h-9 rounded-full bg-zinc-100 items-center justify-center border border-zinc-200"
            >
              <Feather name="x" size={18} color="#18181B" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-zinc-900 text-base font-black tracking-tight" numberOfLines={1}>
                {activeTab === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
              </Text>
              <View className="flex-row items-center gap-1.5 mt-0.5">
                <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <Text className="text-zinc-400 text-[11px] font-medium tracking-wide">
                  virla.in • Verified Legal Policy
                </Text>
              </View>
            </View>
          </View>

          {/* Quick External Link */}
          <TouchableOpacity
            onPress={handleOpenBrowser}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            className="flex-row items-center gap-1 bg-zinc-50 border border-zinc-200 px-2.5 py-1.5 rounded-lg"
          >
            <Feather name="external-link" size={13} color="#71717A" />
            <Text className="text-zinc-600 text-[11px] font-bold">Browser</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Switcher (Terms vs Privacy) */}
        <View className="bg-white px-5 py-2.5 border-b border-zinc-100 flex-row gap-2">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab('terms')}
            className={`flex-1 py-2 rounded-xl items-center justify-center flex-row gap-1.5 border ${activeTab === 'terms'
                ? 'bg-rose-50 border-rose-200'
                : 'bg-zinc-50 border-zinc-100'
              }`}
          >
            <Feather
              name="file-text"
              size={13}
              color={activeTab === 'terms' ? '#E11D48' : '#71717A'}
            />
            <Text
              className={`text-xs font-black ${activeTab === 'terms' ? 'text-[#E11D48]' : 'text-zinc-600'
                }`}
            >
              Terms of Service
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab('privacy')}
            className={`flex-1 py-2 rounded-xl items-center justify-center flex-row gap-1.5 border ${activeTab === 'privacy'
                ? 'bg-rose-50 border-rose-200'
                : 'bg-zinc-50 border-zinc-100'
              }`}
          >
            <Feather
              name="shield"
              size={13}
              color={activeTab === 'privacy' ? '#E11D48' : '#71717A'}
            />
            <Text
              className={`text-xs font-black ${activeTab === 'privacy' ? 'text-[#E11D48]' : 'text-zinc-600'
                }`}
            >
              Privacy Policy
            </Text>
          </TouchableOpacity>
        </View>

        {/* Scrollable Document Content */}
        <ScrollView
          showsVerticalScrollIndicator
          className="flex-1 px-5 py-4"
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 32, 56) }}
        >
          {activeTab === 'terms' ? (
            <View className="gap-5">
              {/* Header Box */}
              <View className="bg-white border border-zinc-200 p-5 rounded-[22px] shadow-2xs">
                <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                  Last Updated: August 24, 2026
                </Text>
                <Text className="text-zinc-900 text-lg font-black tracking-tight mt-1">
                  Terms & Conditions
                </Text>
                <Text className="text-zinc-600 text-xs font-normal leading-relaxed mt-2">
                  Welcome to Virla. These Terms & Conditions constitute a legal agreement between you (&quot;User&quot;, &quot;Client&quot;) and the sole legal owner of the brand name and website virla.in. By browsing our website or utilizing our fitness coordination services, you agree to comply with and be bound by these terms.
                </Text>
              </View>

              {/* Section 1 */}
              <View className="bg-white border border-zinc-200 p-4 rounded-[20px] shadow-2xs gap-2">
                <Text className="text-zinc-900 text-sm font-black tracking-tight">
                  1. Legal Ownership Coordinates
                </Text>
                <Text className="text-zinc-600 text-xs leading-relaxed">
                  This website and brand are operated under the following corporate registration details:
                </Text>
                <View className="bg-zinc-50 border border-zinc-100 rounded-xl p-3 mt-1 gap-1">
                  <Text className="text-zinc-800 text-xs font-bold">Legal Name: Namratha Jauni</Text>
                  <Text className="text-zinc-800 text-xs font-bold">Brand: Virla</Text>
                  <Text className="text-zinc-800 text-xs font-bold">Phone: +91 22-49715552</Text>

                  <Text className="text-zinc-800 text-xs font-bold">Official Website: virla.in</Text>
                  <Text className="text-zinc-800 text-xs font-bold">Address : 35/151, Laxmi Vijay Industries,
                    SAB TV Lane, New Link Road,
                    Andheri West, Mumbai – 400053,
                    Maharashtra, India </Text>
                </View>
              </View>

              {/* Section 2 */}
              <View className="bg-white border border-zinc-200 p-4 rounded-[20px] shadow-2xs gap-2">
                <Text className="text-zinc-900 text-sm font-black tracking-tight">
                  2. Use of Website & Platform
                </Text>
                <Text className="text-zinc-600 text-xs leading-relaxed">
                  By accessing virla.in, you warrant that you are at least 18 years of age and possess the legal authority to enter into these terms. You agree to use the site solely for legitimate personal inquiries and non-commercial purposes.
                </Text>
              </View>

              {/* Section 3 */}
              <View className="bg-white border border-zinc-200 p-4 rounded-[20px] shadow-2xs gap-2">
                <Text className="text-zinc-900 text-sm font-black tracking-tight">
                  3. Virla Services
                </Text>
                <Text className="text-zinc-600 text-xs leading-relaxed">
                  Virla is a coordination platform that connects clients with certified fitness and wellness instructors. We list training categories (including Personal Training, Yoga, and Conditioning) and help arrange physical sessions in the client&apos;s home or workspace.
                </Text>
              </View>

              {/* Section 4 */}
              <View className="bg-white border border-zinc-200 p-4 rounded-[20px] shadow-2xs gap-2">
                <Text className="text-zinc-900 text-sm font-black tracking-tight">
                  4. User Responsibilities
                </Text>
                <Text className="text-zinc-600 text-xs leading-relaxed">
                  Clients scheduling training through our platform agree to:
                </Text>
                <View className="gap-1.5 pl-2 mt-1">
                  <Text className="text-zinc-600 text-xs leading-relaxed">
                    • Supply accurate name, contact coordinates, physical training addresses, and physical capacity profiles.
                  </Text>
                  <Text className="text-zinc-600 text-xs leading-relaxed">
                    • Prepare a secure, clean, and spacious physical area suitable for movement and exercise at their location.
                  </Text>
                  <Text className="text-zinc-600 text-xs leading-relaxed">
                    • Notify the trainer immediately of any pain, dizziness, or physical discomfort during a workout.
                  </Text>
                </View>
              </View>

              {/* Section 5 */}
              <View className="bg-white border border-zinc-200 p-4 rounded-[20px] shadow-2xs gap-2">
                <Text className="text-zinc-900 text-sm font-black tracking-tight">
                  5. Trainer & Service-Provider Relationship
                </Text>
                <Text className="text-zinc-600 text-xs leading-relaxed">
                  The fitness professionals coordinated through Virla operate as independent service providers. While we vet certifications and background records, Namratha Jauni does not control their specific day-to-day instructional methods and is not responsible for trainer actions outside of coordinate training sessions.
                </Text>
              </View>

              {/* Section 6 */}
              <View className="bg-white border border-zinc-200 p-4 rounded-[20px] shadow-2xs gap-2">
                <Text className="text-zinc-900 text-sm font-black tracking-tight">
                  6. Booking & Service Terms
                </Text>
                <Text className="text-zinc-600 text-xs leading-relaxed">
                  All session bookings are subject to trainer availability and coordinate scheduling. We reserve the right to reschedule sessions, adjust coordination schedules, or decline service requests to maintain operational safety.
                </Text>
              </View>

              {/* Section 7 */}
              <View className="bg-white border border-zinc-200 p-4 rounded-[20px] shadow-2xs gap-2">
                <Text className="text-zinc-900 text-sm font-black tracking-tight">
                  7. Payments, Cancellations & Refunds
                </Text>
                <Text className="text-zinc-600 text-xs leading-relaxed">
                  Any commercial payments for training sessions must be settled through authorized billing mechanisms before the session begins. Cancellations and refunds are governed strictly by our Cancellation & Refund Policy, which you agree to review before purchasing any packages.
                </Text>
              </View>

              {/* Section 8 */}
              <View className="bg-white border border-zinc-200 p-4 rounded-[20px] shadow-2xs gap-2">
                <Text className="text-zinc-900 text-sm font-black tracking-tight">
                  8. Limitation of Liability
                </Text>
                <Text className="text-zinc-600 text-xs leading-relaxed">
                  To the extent permitted by law, Namratha Jauni shall not be liable for any direct, indirect, incidental, or consequential damages resulting from your use of this website, or from injuries, accidents, or health conditions arising during coordinated fitness sessions.
                </Text>
              </View>

              {/* Section 9 */}
              <View className="bg-white border border-zinc-200 p-4 rounded-[20px] shadow-2xs gap-2">
                <Text className="text-zinc-900 text-sm font-black tracking-tight">
                  9. Intellectual Property
                </Text>
                <Text className="text-zinc-600 text-xs leading-relaxed">
                  The Virla logo, graphics, design system, layout, and written content are the exclusive intellectual property of Namratha Jauni. Copying, duplicating, or commercial distribution of these assets without written approval is prohibited.
                </Text>
              </View>

              {/* Section 10 */}
              <View className="bg-white border border-zinc-200 p-4 rounded-[20px] shadow-2xs gap-2">
                <Text className="text-zinc-900 text-sm font-black tracking-tight">
                  10. Contact Information
                </Text>
                <Text className="text-zinc-600 text-xs leading-relaxed">
                  For compliance queries or legal inquiries, reach out at virla.in or call +91 22-49715552.
                </Text>
                <View className="bg-zinc-50 border border-zinc-100 rounded-xl p-3 mt-1 gap-1">
                  <Text className="text-zinc-800 text-xs font-bold">Address: 35/151, Laxmi Vijay Industries,{`\n`}SAB TV Lane, New Link Road,{`\n`}Andheri West, Mumbai – 400053,{`\n`}Maharashtra, India.</Text>
                </View>
              </View>
            </View>
          ) : (
            <View className="gap-5">
              {/* Header Box */}
              <View className="bg-white border border-zinc-200 p-5 rounded-[22px] shadow-2xs">
                <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                  Last Updated: August 24, 2026
                </Text>
                <Text className="text-zinc-900 text-lg font-black tracking-tight mt-1">
                  Privacy Policy
                </Text>
                <Text className="text-zinc-600 text-xs font-normal leading-relaxed mt-2">
                  At Virla, accessible from virla.in, we prioritize the protection of our users&apos; personal details. This Privacy Policy outlines the types of information collected and recorded by Virla, and explains how we utilize it.
                </Text>
              </View>

              {/* Section 1 */}
              <View className="bg-white border border-zinc-200 p-4 rounded-[20px] shadow-2xs gap-2">
                <Text className="text-zinc-900 text-sm font-black tracking-tight">
                  1. Legal Ownership Coordinates
                </Text>
                <Text className="text-zinc-600 text-xs leading-relaxed">
                  This website and brand are operated under the following corporate registration details:
                </Text>
                <View className="bg-zinc-50 border border-zinc-100 rounded-xl p-3 mt-1 gap-1">
                  <Text className="text-zinc-800 text-xs font-bold">Legal Name: Namratha Jauni</Text>
                  <Text className="text-zinc-800 text-xs font-bold">Brand: Virla</Text>
                  <Text className="text-zinc-800 text-xs font-bold">Phone: +91 22-49715552</Text>
                  <Text className="text-zinc-800 text-xs font-bold">Official Website: virla.in</Text>
                  <Text className="text-zinc-800 text-xs font-bold">Address: 35/151, Laxmi Vijay Industries,{`\n`}SAB TV Lane, New Link Road,{`\n`}Andheri West, Mumbai – 400053,{`\n`}Maharashtra, India.</Text>
                </View>
              </View>

              {/* Section 2 */}
              <View className="bg-white border border-zinc-200 p-4 rounded-[20px] shadow-2xs gap-2">
                <Text className="text-zinc-900 text-sm font-black tracking-tight">
                  2. Information Collected
                </Text>
                <Text className="text-zinc-600 text-xs leading-relaxed">
                  We collect personal details that you provide directly to us when utilizing our platform or communicating with our support team, including:
                </Text>
                <View className="gap-1.5 pl-2 mt-1">
                  <Text className="text-zinc-600 text-xs leading-relaxed">
                    • <Text className="font-bold">Contact Information:</Text> Your name, email address, contact number, and scheduling preferences.
                  </Text>
                  <Text className="text-zinc-600 text-xs leading-relaxed">
                    • <Text className="font-bold">Account Information:</Text> Profile credentials, preferences, and booking selections registered on our systems.
                  </Text>
                  <Text className="text-zinc-600 text-xs leading-relaxed">
                    • <Text className="font-bold">Usage & Technical Data:</Text> Log files including device models, OS versions, IP addresses, and session flows to ensure safety and system reliability.
                  </Text>
                </View>
              </View>

              {/* Section 3 */}
              <View className="bg-white border border-zinc-200 p-4 rounded-[20px] shadow-2xs gap-2">
                <Text className="text-zinc-900 text-sm font-black tracking-tight">
                  3. Cookies & Session Storage
                </Text>
                <Text className="text-zinc-600 text-xs leading-relaxed">
                  Virla uses secure local storage and cookies to remember session credentials and user preferences. This information is used to optimize the user experience and ensure continuous authentication security.
                </Text>
              </View>

              {/* Section 4 */}
              <View className="bg-white border border-zinc-200 p-4 rounded-[20px] shadow-2xs gap-2">
                <Text className="text-zinc-900 text-sm font-black tracking-tight">
                  4. How Information Is Used
                </Text>
                <View className="gap-1.5 pl-2 mt-1">
                  <Text className="text-zinc-600 text-xs leading-relaxed">
                    • Providing, operating, and maintaining our wellness coordination platform.
                  </Text>
                  <Text className="text-zinc-600 text-xs leading-relaxed">
                    • Communicating with you regarding booking coordinates, schedule adjustments, and coach arrival notices.
                  </Text>
                  <Text className="text-zinc-600 text-xs leading-relaxed">
                    • Calculating nearest trainer travel radius and session timing.
                  </Text>
                  <Text className="text-zinc-600 text-xs leading-relaxed">
                    • Detecting and preventing unauthorized usage or security risks.
                  </Text>
                </View>
              </View>

              {/* Section 5 */}
              <View className="bg-white border border-zinc-200 p-4 rounded-[20px] shadow-2xs gap-2">
                <Text className="text-zinc-900 text-sm font-black tracking-tight">
                  5. Service Providers & Third Parties
                </Text>
                <Text className="text-zinc-600 text-xs leading-relaxed">
                  We may contract with reliable third-party service providers (such as hosting infrastructure or payment processors) to facilitate our services. These providers have access to your details solely to perform designated operations on our behalf and are obligated not to disclose or use them for other purposes.
                </Text>
              </View>

              {/* Section 6 */}
              <View className="bg-white border border-zinc-200 p-4 rounded-[20px] shadow-2xs gap-2">
                <Text className="text-zinc-900 text-sm font-black tracking-tight">
                  6. Data Security
                </Text>
                <Text className="text-zinc-600 text-xs leading-relaxed">
                  The security of your details is highly important to us. We employ standard administrative and technical safeguards to prevent unauthorized access, loss, or disclosure.
                </Text>
              </View>

              {/* Section 7 */}
              <View className="bg-white border border-zinc-200 p-4 rounded-[20px] shadow-2xs gap-2">
                <Text className="text-zinc-900 text-sm font-black tracking-tight">
                  7. User Rights & Data Erasure
                </Text>
                <Text className="text-zinc-600 text-xs leading-relaxed">
                  Under applicable data protection laws, you possess designated rights regarding your information, including the right to request copies of your files, correct inaccuracies, or request permanent erasure of your coordinates from our active files.
                </Text>
              </View>
            </View>
          )}

          {/* Bottom Dismiss Button */}
          <View className="mt-6 pt-4 border-t border-zinc-200">
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.8}
              className="w-full bg-[#18181B] py-3.5 rounded-2xl items-center justify-center shadow-sm"
            >
              <Text className="text-white text-xs font-black uppercase tracking-wider">
                I Understand & Close
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};
