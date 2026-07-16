import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Switch, Image, Alert, TouchableOpacity, TextInput, Animated, Platform } from 'react-native';
import { useUserStore } from '../../store/userStore';
import { useMembershipStore } from '../../store/membershipStore';
import { useCoachStore } from '../../store/coachStore';
import { useWalletStore } from '../../store/walletStore';
import { useUserProfileStore } from '../../store/userProfileStore';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import Svg, { Rect } from 'react-native-svg';

export default function ProfileScreen() {
  const router = useRouter();
  
  // Sprints 1-9 Stores
  const { user, role, setRole } = useUserStore();
  const { membership } = useMembershipStore();
  const { totalEarnings, earningsList } = useCoachStore();
  const { ledger } = useWalletStore();

  // Sprint 10 Store
  const profile = useUserProfileStore();

  const shimmerAnim = useRef(new Animated.Value(0.3)).current;
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Profile Edit fields local states
  const [editName, setEditName] = useState(profile.name);
  const [editMobile, setEditMobile] = useState(profile.mobile);
  const [editEmail, setEditEmail] = useState(profile.email);
  const [editGender, setEditGender] = useState(profile.gender);
  const [editDob, setEditDob] = useState(profile.dob);
  const [editHeight, setEditHeight] = useState(profile.height);
  const [editWeight, setEditWeight] = useState(profile.weight);
  const [editFitnessLevel, setEditFitnessLevel] = useState(profile.fitnessLevel);
  const [editTargetGoal, setEditTargetGoal] = useState(profile.targetGoal);
  const [editLanguage, setEditLanguage] = useState(profile.preferredLanguage);
  const [editCity, setEditCity] = useState(profile.city);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 0.7, duration: 1500, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0.3, duration: 1500, useNativeDriver: true })
      ])
    ).start();
  }, []);

  const handleSaveProfile = () => {
    profile.updateCoreProfile({
      name: editName,
      mobile: editMobile,
      email: editEmail,
      gender: editGender,
      dob: editDob,
      height: editHeight,
      weight: editWeight,
      fitnessLevel: editFitnessLevel,
      targetGoal: editTargetGoal,
      preferredLanguage: editLanguage,
      city: editCity
    });
    setIsEditingProfile(false);
    Alert.alert('Profile Saved', 'Your core details have been updated successfully.');
  };

  const renderPassQRCode = () => {
    const qrMatrix = [
      [1, 1, 1, 1, 0, 1, 1, 1, 1],
      [1, 0, 0, 1, 0, 1, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 1, 0, 1, 0, 0, 1],
      [1, 1, 1, 1, 0, 1, 1, 1, 1],
    ];
    const cellSize = 8;
    return (
      <View className="bg-white p-2 rounded-2xl items-center justify-center">
        <Svg width={cellSize * 9} height={cellSize * 5}>
          {qrMatrix.map((row, rIdx) =>
            row.map((val, cIdx) => (
              <Rect
                key={`${rIdx}-${cIdx}`}
                x={cIdx * cellSize}
                y={rIdx * cellSize}
                width={cellSize - 1.5}
                height={cellSize - 1.5}
                fill={val === 1 ? '#111827' : '#FFFFFF'}
              />
            ))
          )}
        </Svg>
      </View>
    );
  };

  return (
    <SafeAreaViewWrapper>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 140 }}
        className="bg-[#F8F9FB] flex-1"
      >
        <View className="px-6 pt-6 gap-6">

          {/* Dual Role Switcher at the top */}
          <View className="flex-row bg-[#E5E7EB]/40 border border-[#E5E7EB]/80 p-1.5 rounded-2xl">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setRole('customer')}
              className={`flex-1 py-3.5 rounded-xl items-center justify-center ${
                role === 'customer' ? 'bg-[#111827] shadow-sm' : ''
              }`}
            >
              <Text className={`text-[10px] font-black uppercase tracking-wider ${role === 'customer' ? 'text-white' : 'text-[#6B7280]'}`}>
                Client Account
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setRole('trainer')}
              className={`flex-1 py-3.5 rounded-xl items-center justify-center ${
                role === 'trainer' ? 'bg-[#111827] shadow-sm' : ''
              }`}
            >
              <Text className={`text-[10px] font-black uppercase tracking-wider ${role === 'trainer' ? 'text-white' : 'text-[#6B7280]'}`}>
                Trainer Account
              </Text>
            </TouchableOpacity>
          </View>

          {/* =============================================================== */}
          {/* ======================= CLIENT PROFILE ======================== */}
          {/* =============================================================== */}
          {role === 'customer' && (
            <>
              {/* Client Profile Header */}
              <View className="items-center mb-2">
                <Image
                  source={{ uri: profile.avatar }}
                  className="w-20 h-20 rounded-full border-2 border-white mb-3 shadow-md"
                />
                <Text className="text-[#111827] text-2xl font-black tracking-tight">{profile.name}</Text>
                <Text className="text-[#6B7280] text-xs font-semibold mt-0.5">{profile.email}</Text>
              </View>

              {/* Apple Wallet Membership Credit Card */}
              <View className="gap-3">
                <Text className="text-[#111827] text-xs font-black uppercase tracking-widest pl-1">
                  My Membership Pass
                </Text>

                <TouchableOpacity 
                  activeOpacity={0.95}
                  onPress={() => router.push('/wallet' as any)}
                  className="bg-zinc-950 rounded-[30px] p-6 shadow-xl relative overflow-hidden border border-zinc-800"
                >
                  <Animated.View style={{ opacity: shimmerAnim }} className="absolute top-0 left-0 right-0 bottom-0 bg-indigo-500/10" />

                  <View className="flex-row justify-between items-start mb-6">
                    <View>
                      <Text className="text-[#06B6D4] text-[9px] font-black uppercase tracking-widest">
                        ★ VIRLA Pass (Tap to open wallet)
                      </Text>
                      <Text className="text-white text-xl font-black mt-1 tracking-tight">
                        {membership.tier}
                      </Text>
                    </View>
                    {renderPassQRCode()}
                  </View>

                  <View className="h-[1px] bg-zinc-800 my-4" />

                  <View className="flex-row justify-between items-center">
                    <View className="gap-0.5">
                      <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-wider">Credits Left</Text>
                      <Text className="text-white text-base font-black">{membership.availableCredits} Credits</Text>
                    </View>
                    <View className="w-[1px] h-8 bg-zinc-850" />
                    <View className="gap-0.5">
                      <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-wider">Freeze status</Text>
                      <Text className="text-white text-base font-black">15 Days</Text>
                    </View>
                    <View className="w-[1px] h-8 bg-zinc-850" />
                    <View className="gap-0.5 items-end">
                      <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-wider">Expiry Date</Text>
                      <Text className="text-white text-xs font-black mt-0.5">{membership.renewalDate}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Complete User Core Profile editing panel (Feature 1) */}
              <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
                <View className="flex-row justify-between items-center border-b border-zinc-50 pb-2">
                  <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider">Personal Profile</Text>
                  <TouchableOpacity onPress={() => { if (isEditingProfile) { handleSaveProfile(); } else { setIsEditingProfile(true); } }}>
                    <Text className="text-indigo-600 text-xs font-black uppercase">{isEditingProfile ? 'Save' : 'Edit'}</Text>
                  </TouchableOpacity>
                </View>

                {isEditingProfile ? (
                  <View className="gap-3.5">
                    {[
                      { l: 'Full Name', val: editName, set: setEditName },
                      { l: 'Mobile Number', val: editMobile, set: setEditMobile, kt: 'phone-pad' as const },
                      { l: 'Email address', val: editEmail, set: setEditEmail, kt: 'email-address' as const },
                      { l: 'Gender', val: editGender, set: setEditGender },
                      { l: 'Date of Birth', val: editDob, set: setEditDob },
                      { l: 'Height', val: editHeight, set: setEditHeight },
                      { l: 'Weight', val: editWeight, set: setEditWeight },
                      { l: 'Fitness Level', val: editFitnessLevel, set: setEditFitnessLevel },
                      { l: 'Target Goal', val: editTargetGoal, set: setEditTargetGoal },
                      { l: 'Preferred Language', val: editLanguage, set: setEditLanguage },
                      { l: 'City', val: editCity, set: setEditCity }
                    ].map((f, idx) => (
                      <View key={idx} className="gap-1">
                        <Text className="text-zinc-500 text-[8px] font-black uppercase">{f.l}</Text>
                        <TextInput
                          value={f.val}
                          onChangeText={f.set}
                          keyboardType={f.kt}
                          className="border border-[#E5E7EB] bg-[#F8F9FB] p-3 rounded-xl text-xs text-zinc-900 font-semibold"
                        />
                      </View>
                    ))}
                  </View>
                ) : (
                  <View className="gap-3">
                    {[
                      { l: 'Full Name', val: profile.name },
                      { l: 'Mobile Number', val: profile.mobile },
                      { l: 'Email address', val: profile.email },
                      { l: 'Gender', val: profile.gender },
                      { l: 'Date of Birth', val: profile.dob },
                      { l: 'Height', val: profile.height },
                      { l: 'Weight', val: profile.weight },
                      { l: 'Fitness Level', val: profile.fitnessLevel },
                      { l: 'Target Goal', val: profile.targetGoal },
                      { l: 'Preferred Language', val: profile.preferredLanguage },
                      { l: 'City', val: profile.city },
                      { l: 'Member Since', val: profile.memberSince },
                      { l: 'Total Sessions completed', val: `${profile.totalSessions} Sessions` },
                      { l: 'Total Calories burned', val: `${profile.totalCalories.toLocaleString()} kcal` },
                      { l: 'Lifetime spendings', val: profile.lifetimeSpend }
                    ].map((f, idx) => (
                      <View key={idx} className="flex-row justify-between py-1 border-b border-zinc-50 pb-2">
                        <Text className="text-zinc-400 text-xs font-semibold">{f.l}</Text>
                        <Text className="text-zinc-950 text-xs font-black">{f.val}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Account Management & Personalization Menu */}
              <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-3">
                <Text className="text-[#111827] text-xs font-black uppercase tracking-wider border-b border-zinc-105 pb-3">Personalization Hub</Text>
                
                {[
                  { label: 'Health & Medical Profile', icon: 'activity', route: '/health-profile' as const, desc: 'Declare conditions, allergies and restrictions' },
                  { label: 'Target Fitness Goals', icon: 'zap', route: '/fitness-goals' as const, desc: 'Choose active conditioning workout metrics' },
                  { label: 'Saved Addresses', icon: 'map-pin', route: '/address-management' as const, desc: 'Manage home, office and gym GPS markers' },
                  { label: 'Emergency SOS Contacts', icon: 'shield', route: '/emergency-contacts' as const, desc: 'Add alternate contacts for check-in safety' },
                  { label: 'Analytics & Statistics', icon: 'trending-up', route: '/personal-statistics' as const, desc: 'View monthly charts and hours trained' },
                  { label: 'Achievements & Badges', icon: 'award', route: '/personal-achievements' as const, desc: 'Unlock milestones and streaks rewards' },
                  { label: 'Privacy & Security Controls', icon: 'lock', route: '/privacy-security' as const, desc: 'Update passwords, biometrics and logins' },
                  { label: 'Help & Support Desk', icon: 'help-circle', route: '/help-support' as const, desc: 'Raise support tickets and FAQ manuals' },
                  { label: 'Global App Settings', icon: 'settings', route: '/settings' as const, desc: 'Adjust time format, languages and themes' }
                ].map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.8}
                    onPress={() => router.push(item.route as any)}
                    className="bg-[#F8F9FB] border border-[#E5E7EB]/60 p-4.5 rounded-2xl flex-row justify-between items-center"
                  >
                    <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                      <Feather name={item.icon as any} size={15} color="#4F46E5" />
                      <View className="flex-1">
                        <Text className="text-[#111827] text-xs font-black leading-tight">{item.label}</Text>
                        <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5 leading-relaxed">{item.desc}</Text>
                      </View>
                    </View>
                    <Feather name="chevron-right" size={14} color="#6B7280" />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Booking Activity Feed Timeline */}
              <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
                <Text className="text-[#111827] text-xs font-black uppercase tracking-wider">Recent Activities</Text>
                
                {ledger.length > 0 ? (
                  <View className="gap-3.5 pl-1">
                    {ledger.map((item) => (
                      <View key={item.id} className="flex-row items-start gap-3">
                        <View className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5" />
                        <View className="flex-1">
                          <Text className="text-zinc-800 text-xs font-black leading-tight">
                            {item.title}
                          </Text>
                          <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">
                            {item.date} • {item.change >= 0 ? '+' : ''}{item.change} Credits
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text className="text-zinc-400 text-[10px] text-center py-4">No recent activity logs found.</Text>
                )}
              </View>
            </>
          )}

          {/* =============================================================== */}
          {/* ======================= TRAINER PROFILE ======================= */}
          {/* =============================================================== */}
          {role === 'trainer' && (
            <>
              {/* Trainer Profile Header */}
              <View className="items-center mb-2">
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=150&q=80' }}
                  className="w-20 h-20 rounded-full border-2 border-white mb-3 shadow-md"
                />
                <Text className="text-[#111827] text-2xl font-black tracking-tight">Coach Karan Sharma</Text>
                <Text className="text-[#6B7280] text-xs font-semibold mt-0.5">Certified Trainer • Strength & HIIT</Text>
              </View>

              {/* Trainer Ledger: Earnings List */}
              <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
                <Text className="text-[#111827] text-xs font-black uppercase tracking-wider border-b border-zinc-50 pb-3">Earnings & Payout Ledger</Text>
                
                <View className="gap-3.5">
                  {earningsList.map((earn) => (
                    <View key={earn.id} className="flex-row justify-between items-center py-2.5 border-b border-zinc-50/50 last:border-b-0">
                      <View className="flex-1 pr-3 gap-0.5">
                        <Text className="text-zinc-900 text-xs font-black leading-tight">
                          {earn.type === 'session' && `Visit Payout: ${earn.clientName}`}
                          {earn.type === 'no_show_compensation' && `No-Show compensation: ${earn.clientName}`}
                          {earn.type === 'penalty' && `Cancellation Penalty`}
                        </Text>
                        <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">ID: {earn.bookingId} • {earn.date}</Text>
                      </View>
                      <Text className={`text-xs font-black ${earn.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {earn.amount >= 0 ? '+' : ''}₹{earn.amount.toLocaleString('en-IN')}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Safety Rules & Travel Guidelines */}
              <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-3">
                <Text className="text-[#111827] text-xs font-black uppercase tracking-wider">Safety Guidelines</Text>
                <View className="gap-2.5 mt-1">
                  <View className="flex-row gap-2 items-start">
                    <Feather name="check" size={12} color="#10B981" className="mt-0.5" />
                    <Text className="text-[#6B7280] text-[10px] leading-relaxed flex-1">Keep client safety OTP verify check-ins active for travel authentication.</Text>
                  </View>
                  <View className="flex-row gap-2 items-start">
                    <Feather name="check" size={12} color="#10B981" className="mt-0.5" />
                    <Text className="text-[#6B7280] text-[10px] leading-relaxed flex-1">Complete mandatory post-session reports within 2 hours to release payout funds.</Text>
                  </View>
                </View>
              </View>
            </>
          )}

        </View>
      </ScrollView>
    </SafeAreaViewWrapper>
  );
}

function SafeAreaViewWrapper({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'ios') {
    return <View className="flex-1 bg-[#F8F9FB] pt-12">{children}</View>;
  }
  return <View className="flex-1 bg-[#F8F9FB]">{children}</View>;
}
