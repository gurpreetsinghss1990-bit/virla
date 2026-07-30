import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Switch, Image, Alert, TouchableOpacity, TextInput, Animated, Platform, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserStore } from '../../store/userStore';
import { useMembershipStore } from '../../store/membershipStore';
import { useCoachStore } from '../../store/coachStore';
import { useWalletStore } from '../../store/walletStore';
import { useUserProfileStore } from '../../store/userProfileStore';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import Svg, { Rect } from 'react-native-svg';
import { LuxuryCard } from '../../components/LuxuryCard';
import { Database, TrainerApplication } from '../../database/Database';

export default function ProfileScreen() {
  const router = useRouter();
  
  // Sprints 1-9 Stores
  const { user, role, setRole, setLoggedIn } = useUserStore();
  const { membership } = useMembershipStore();
  const { totalEarnings, earningsList } = useCoachStore();
  const { ledger } = useWalletStore();
  const profile = useUserProfileStore();

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmLogout = window.confirm('Are you sure you want to sign out?');
      if (confirmLogout) {
        setLoggedIn(false);
        router.replace('/get-started' as any);
      }
    } else {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: () => {
              setLoggedIn(false);
              router.replace('/get-started' as any);
            }
          }
        ]
      );
    }
  };



  const [hasApplied, setHasApplied] = useState(false);
  const [userApplication, setUserApplication] = useState<TrainerApplication | null>(null);

  const checkApplicationStatus = async () => {
    const userPhone = profile.mobile;
    if (userPhone) {
      try {
        const apps = await Database.fetchAllTrainerApplications();
        const userApp = apps.find(a => a.phone === userPhone);
        if (userApp) {
          setHasApplied(true);
          setUserApplication(userApp);
        } else {
          setHasApplied(false);
          setUserApplication(null);
        }
      } catch (e) {}
    }
  };

  const shimmerAnim = useRef(new Animated.Value(0.3)).current;
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Profile Edit fields local states
  const [editName, setEditName] = useState(profile.name || '');
  const [editMobile, setEditMobile] = useState(profile.mobile || '');
  const [editEmail, setEditEmail] = useState(profile.email || '');
  const [editGender, setEditGender] = useState(profile.gender || '');
  const [editDob, setEditDob] = useState(profile.dob || '');
  const [editHeight, setEditHeight] = useState(profile.height || '');
  const [editWeight, setEditWeight] = useState(profile.weight || '');
  const [editFitnessLevel, setEditFitnessLevel] = useState(profile.fitnessLevel || '');
  const [editTargetGoal, setEditTargetGoal] = useState(profile.targetGoal || '');
  const [editLanguage, setEditLanguage] = useState(profile.preferredLanguage || '');
  const [editCity, setEditCity] = useState(profile.city || '');

  // Trainer local states
  const coach = Database.schema.coaches.find((c: any) => c.name === user.name || c.id === user.id) || null;
  let parsedBankDetails = { accountName: '', bankName: '', accountNumber: '', ifsc: '', upiId: '' };
  try {
    if (coach && coach.bankDetails) {
      parsedBankDetails = JSON.parse(coach.bankDetails);
    }
  } catch (e) {}

  const [isEditingTrainer, setIsEditingTrainer] = useState(false);
  const [trainerBio, setTrainerBio] = useState(coach?.shortBio || '');
  const [bankAccName, setBankAccName] = useState(parsedBankDetails.accountName || '');
  const [bankNameStr, setBankNameStr] = useState(parsedBankDetails.bankName || '');
  const [bankAccNumber, setBankAccNumber] = useState(parsedBankDetails.accountNumber || '');
  const [bankIfscStr, setBankIfscStr] = useState(parsedBankDetails.ifsc || '');
  const [bankUpiIdStr, setBankUpiIdStr] = useState(parsedBankDetails.upiId || '');

  const handleSaveTrainer = () => {
    const trainerId = user.id || coach?.id;
    if (trainerId) {
      Database.updateCoach(trainerId, {
        shortBio: trainerBio,
        bankDetails: JSON.stringify({
          accountName: bankAccName,
          bankName: bankNameStr,
          accountNumber: bankAccNumber,
          ifsc: bankIfscStr,
          upiId: bankUpiIdStr
        })
      });
      setIsEditingTrainer(false);
      Alert.alert('Trainer Details Updated', 'Your banking credentials and bio have been successfully updated.');
    }
  };

  useEffect(() => {
    profile.syncFromDB();
    checkApplicationStatus();
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 0.7, duration: 1500, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0.3, duration: 1500, useNativeDriver: true })
      ])
    ).start();
  }, []);

  useEffect(() => {
    setEditName(profile.name || '');
    setEditMobile(profile.mobile || '');
    setEditEmail(profile.email || '');
    setEditGender(profile.gender || '');
    setEditDob(profile.dob || '');
    setEditHeight(profile.height || '');
    setEditWeight(profile.weight || '');
    setEditFitnessLevel(profile.fitnessLevel || '');
    setEditTargetGoal(profile.targetGoal || '');
    setEditLanguage(profile.preferredLanguage || '');
    setEditCity(profile.city || '');
  }, [
    profile.name,
    profile.mobile,
    profile.email,
    profile.gender,
    profile.dob,
    profile.height,
    profile.weight,
    profile.fitnessLevel,
    profile.targetGoal,
    profile.preferredLanguage,
    profile.city
  ]);

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
                fill={val === 1 ? '#101828' : '#FFFFFF'}
              />
            ))
          )}
        </Svg>
      </View>
    );
  };

  return (
    <SafeAreaViewWrapper>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={{ paddingBottom: 140 }}
          className="bg-[#F7F8FC] flex-1"
        >
        <View className="px-6 pt-6 gap-6">

          {/* Dual Role Switcher at the top - ONLY for approved trainers */}
          {user.role === 'trainer' && (
            <View className="flex-row bg-[#E5E7EB]/40 border border-[#E5E7EB]/80 p-1.5 rounded-2xl">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setRole('customer')}
                className={`flex-1 py-3.5 rounded-xl items-center justify-center ${
                  role === 'customer' ? 'bg-[#101828] shadow-sm' : ''
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
                  role === 'trainer' ? 'bg-[#101828] shadow-sm' : ''
                }`}
              >
                <Text className={`text-[10px] font-black uppercase tracking-wider ${role === 'trainer' ? 'text-white' : 'text-[#6B7280]'}`}>
                  Trainer Account
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* =============================================================== */}
          {/* ======================= CLIENT PROFILE ======================== */}
          {/* =============================================================== */}
          {(role === 'customer' || role === 'admin') && (
            <>
              {/* Client Profile Header */}
              <View className="items-center mb-4">
                <Image
                  source={{ uri: profile.avatar }}
                  className="w-20 h-20 rounded-full border-2 border-[#F5B942] mb-3 shadow-lg"
                />
                <Text className="text-[#101828] text-2xl font-black tracking-tight">{profile.name}</Text>
                <Text className="text-[#6B7280] text-xs font-semibold mt-0.5">{profile.email}</Text>
                
                {/* Gold Luxury Member Badge */}
                <View className="bg-amber-500/10 border border-amber-500/20 px-3 py-0.5 rounded-full flex-row items-center gap-1.5 mt-2">
                  <Feather name="award" size={10} color="#F5B942" />
                  <Text className="text-[#F5B942] text-[8px] font-black uppercase tracking-wider">Elite Member</Text>
                </View>
              </View>



              {/* Apple Wallet Membership Credit Card */}
              <View className="gap-3">
                <Text className="text-[#101828] text-xs font-black uppercase tracking-widest pl-1">
                  My Membership Pass
                </Text>

                <TouchableOpacity 
                  activeOpacity={0.95}
                  onPress={() => router.push('/wallet' as any)}
                  className="bg-[#101828] rounded-[24px] p-6 shadow-xl relative overflow-hidden border border-zinc-800"
                  style={{
                    shadowColor: '#101828',
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.25,
                    shadowRadius: 20,
                    elevation: 8,
                  }}
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
                    <View className="w-[1px] h-8 bg-zinc-800" />
                    <View className="gap-0.5">
                      <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-wider">Freeze status</Text>
                      <Text className="text-white text-base font-black">15 Days</Text>
                    </View>
                    <View className="w-[1px] h-8 bg-zinc-800" />
                    <View className="gap-0.5 items-end">
                      <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-wider">Expiry Date</Text>
                      <Text className="text-white text-xs font-black mt-0.5">{membership.renewalDate}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Complete User Core Profile editing panel (Feature 1) */}
              <LuxuryCard className="p-5 gap-4" interactive={false}>
                <View className="flex-row justify-between items-center border-b border-zinc-100 pb-3">
                  <Text className="text-[#101828] text-xs font-black uppercase tracking-widest">Personal Profile</Text>
                  <TouchableOpacity onPress={() => { if (isEditingProfile) { handleSaveProfile(); } else { setIsEditingProfile(true); } }}>
                    <Text className="text-indigo-600 text-xs font-black uppercase tracking-widest">{isEditingProfile ? 'Save' : 'Edit'}</Text>
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
                          className="border border-[#E5E7EB] bg-[#F7F8FC] p-3 rounded-xl text-xs text-zinc-900 font-semibold"
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
                        <Text className="text-zinc-950 text-xs font-black">{f.val || 'Not provided'}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </LuxuryCard>

              {/* Account Management & Personalization Menu */}
              <LuxuryCard className="p-5 gap-3" interactive={false}>
                <Text className="text-[#101828] text-xs font-black uppercase tracking-widest border-b border-zinc-100 pb-3">Personalization Hub</Text>
                
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
                    className="bg-zinc-50 border border-zinc-200/60 p-4 rounded-xl flex-row justify-between items-center"
                  >
                    <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                      <Feather name={item.icon as any} size={15} color="#4F46E5" />
                      <View className="flex-1">
                        <Text className="text-[#101828] text-xs font-black leading-tight">{item.label}</Text>
                        <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5 leading-relaxed">{item.desc}</Text>
                      </View>
                    </View>
                    <Feather name="chevron-right" size={14} color="#6B7280" />
                  </TouchableOpacity>
                ))}
              </LuxuryCard>

              {/* Booking Activity Feed Timeline */}
              <LuxuryCard className="p-5 gap-4" interactive={false}>
                <Text className="text-[#101828] text-xs font-black uppercase tracking-widest">Recent Activities</Text>
                
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
              </LuxuryCard>

              {/* Become a Trainer Promo Card for regular clients */}
              {user.role !== 'trainer' && !hasApplied && (
                <LuxuryCard 
                  className="p-5 bg-rose-50 border border-rose-200/50"
                  onPress={() => router.push('/trainer-application')}
                >
                  <View className="flex-row items-center justify-between w-full">
                    <View className="flex-1 pr-4 gap-1">
                      <Text className="text-[#E11D48] text-[9px] font-black uppercase tracking-widest">Join our team</Text>
                      <Text className="text-zinc-950 text-sm font-black tracking-tight">Become a VIRLA Trainer</Text>
                      <Text className="text-[#6B7280] text-[10px] font-medium leading-relaxed mt-0.5">
                        Earn up to ₹1,200 per session with flexible hours and dedicated client matching.
                      </Text>
                    </View>
                    <View className="w-10 h-10 rounded-full bg-[#E11D48] items-center justify-center shadow-md">
                      <Feather name="chevron-right" size={18} color="white" />
                    </View>
                  </View>
                </LuxuryCard>
              )}

              {user.role !== 'trainer' && hasApplied && userApplication && (
                <LuxuryCard 
                  className={`p-5 border ${
                    userApplication.status === 'approved' ? 'bg-emerald-50 border-emerald-200' :
                    userApplication.status === 'rejected' ? 'bg-rose-50 border-rose-200' :
                    userApplication.status === 'info_requested' ? 'bg-amber-50 border-amber-200' :
                    'bg-[#F7F8FC] border-zinc-200'
                  }`}
                  onPress={() => router.push('/trainer-application')}
                >
                  <View className="flex-row items-center justify-between w-full">
                    <View className="flex-1 pr-4 gap-1">
                      <Text className="text-zinc-500 text-[9px] font-black uppercase tracking-widest">Trainer Application</Text>
                      
                      <View className="flex-row items-center gap-1.5 mt-0.5">
                        {userApplication.status === 'pending' && (
                          <View className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full flex-row items-center gap-1">
                            <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <Text className="text-emerald-800 text-[8px] font-black uppercase tracking-wider">Under Review</Text>
                          </View>
                        )}
                        {userApplication.status === 'info_requested' && (
                          <View className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full flex-row items-center gap-1">
                            <View className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <Text className="text-amber-800 text-[8px] font-black uppercase tracking-wider">Info Required</Text>
                          </View>
                        )}
                        {userApplication.status === 'rejected' && (
                          <View className="px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-full flex-row items-center gap-1">
                            <View className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            <Text className="text-rose-800 text-[8px] font-black uppercase tracking-wider">Rejected</Text>
                          </View>
                        )}
                        {userApplication.status === 'approved' && (
                          <View className="px-2.5 py-1 bg-emerald-100 border border-emerald-300 rounded-full flex-row items-center gap-1">
                            <View className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            <Text className="text-emerald-900 text-[8px] font-black uppercase tracking-wider">Approved</Text>
                          </View>
                        )}
                      </View>

                      {userApplication.status === 'info_requested' && userApplication.adminNotes && (
                        <View className="bg-white border border-amber-200 p-2 rounded-lg mt-1 w-full">
                          <Text className="text-amber-800 text-[8px] font-black uppercase tracking-wider mb-0.5">Admin Request:</Text>
                          <Text className="text-amber-950 text-[10px] font-semibold leading-relaxed">{userApplication.adminNotes}</Text>
                        </View>
                      )}

                      <Text className="text-[#6B7280] text-[10px] font-medium leading-relaxed mt-1">
                        {userApplication.status === 'info_requested' ? 'Tap to edit requested fields and resubmit.' :
                         userApplication.status === 'rejected' ? 'Tap to view feedback and modify application.' :
                         userApplication.status === 'approved' ? 'Congratulations! Tap to open trainer tools.' :
                         'Our team is reviewing your uploaded qualifications. Average response is 24-48 hours.'}
                      </Text>
                    </View>
                    <View className="w-10 h-10 rounded-full bg-zinc-900 items-center justify-center shadow-md">
                      <Feather name="chevron-right" size={18} color="white" />
                    </View>
                  </View>
                </LuxuryCard>
              )}
            </>
          )}

          {/* =============================================================== */}
          {/* ======================= TRAINER PROFILE ======================= */}
          {/* =============================================================== */}
          {role === 'trainer' && (
            <>
              {/* Trainer Profile Header */}
              <View className="items-center mb-4">
                <Image
                  source={{ uri: user.avatar || 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=150&q=80' }}
                  className="w-20 h-20 rounded-full border-2 border-[#E11D48] mb-3 shadow-lg"
                />
                <Text className="text-[#101828] text-2xl font-black tracking-tight">{user.name}</Text>
                <Text className="text-[#6B7280] text-xs font-semibold mt-0.5">
                  {coach?.level || 'Associate'} • {coach?.specialty || 'Not specified'}
                </Text>
              </View>

              {(!bankAccName || !bankAccNumber) && (
                <LuxuryCard 
                  className="p-5 bg-amber-50 border border-amber-200/50 mb-4"
                  onPress={() => router.push('/payout-setup')}
                >
                  <View className="flex-row items-center justify-between w-full">
                    <View className="flex-1 pr-4 gap-1">
                      <Text className="text-amber-800 text-[9px] font-black uppercase tracking-widest">Action Required</Text>
                      <Text className="text-zinc-950 text-sm font-black tracking-tight">Configure Payout Account</Text>
                      <Text className="text-[#6B7280] text-[10px] font-medium leading-relaxed mt-0.5">
                        Please complete your payout details to receive payments for your sessions.
                      </Text>
                    </View>
                    <View className="w-10 h-10 rounded-full bg-amber-500 items-center justify-center shadow-md">
                      <Feather name="alert-triangle" size={18} color="white" />
                    </View>
                  </View>
                </LuxuryCard>
              )}

              {/* Editable Trainer Console Credentials */}
              <LuxuryCard className="p-5 gap-4" interactive={false}>
                <View className="flex-row justify-between items-center border-b border-zinc-100 pb-3">
                  <Text className="text-[#101828] text-xs font-black uppercase tracking-widest">Onboarding Credentials</Text>
                  <TouchableOpacity onPress={() => { if (isEditingTrainer) { handleSaveTrainer(); } else { setIsEditingTrainer(true); } }}>
                    <Text className="text-indigo-600 text-xs font-black uppercase tracking-widest">{isEditingTrainer ? 'Save' : 'Edit'}</Text>
                  </TouchableOpacity>
                </View>

                {isEditingTrainer ? (
                  <View className="gap-3.5">
                    <View className="gap-1">
                      <Text className="text-zinc-500 text-[8px] font-black uppercase">Coach Short Bio</Text>
                      <TextInput
                        value={trainerBio}
                        onChangeText={setTrainerBio}
                        multiline
                        className="border border-[#E5E7EB] bg-[#F7F8FC] p-3 rounded-xl text-xs text-zinc-900 font-semibold"
                      />
                    </View>
                    <View className="gap-1">
                      <Text className="text-zinc-500 text-[8px] font-black uppercase">Account Holder Name</Text>
                      <TextInput
                        value={bankAccName}
                        onChangeText={setBankAccName}
                        className="border border-[#E5E7EB] bg-[#F7F8FC] p-3 rounded-xl text-xs text-zinc-900 font-semibold"
                      />
                    </View>
                    <View className="gap-1">
                      <Text className="text-zinc-500 text-[8px] font-black uppercase">Bank Name</Text>
                      <TextInput
                        value={bankNameStr}
                        onChangeText={setBankNameStr}
                        className="border border-[#E5E7EB] bg-[#F7F8FC] p-3 rounded-xl text-xs text-zinc-900 font-semibold"
                      />
                    </View>
                    <View className="gap-1">
                      <Text className="text-zinc-500 text-[8px] font-black uppercase">Account Number</Text>
                      <TextInput
                        value={bankAccNumber}
                        onChangeText={setBankAccNumber}
                        keyboardType="number-pad"
                        className="border border-[#E5E7EB] bg-[#F7F8FC] p-3 rounded-xl text-xs text-zinc-900 font-semibold"
                      />
                    </View>
                    <View className="gap-1">
                      <Text className="text-zinc-500 text-[8px] font-black uppercase">IFSC Code</Text>
                      <TextInput
                        value={bankIfscStr}
                        onChangeText={setBankIfscStr}
                        className="border border-[#E5E7EB] bg-[#F7F8FC] p-3 rounded-xl text-xs text-zinc-900 font-semibold"
                      />
                    </View>
                    <View className="gap-1">
                      <Text className="text-zinc-500 text-[8px] font-black uppercase">UPI ID</Text>
                      <TextInput
                        value={bankUpiIdStr}
                        onChangeText={setBankUpiIdStr}
                        className="border border-[#E5E7EB] bg-[#F7F8FC] p-3 rounded-xl text-xs text-zinc-900 font-semibold"
                      />
                    </View>
                  </View>
                ) : (
                  <View className="gap-3">
                    <View className="py-1 border-b border-zinc-50 pb-2">
                      <Text className="text-zinc-400 text-xs font-semibold">Coach Bio</Text>
                      <Text className="text-zinc-950 text-xs font-black mt-1 leading-normal">{trainerBio}</Text>
                    </View>
                    <View className="flex-row justify-between py-1 border-b border-zinc-50 pb-2">
                      <Text className="text-zinc-400 text-xs font-semibold">Bank Name</Text>
                      <Text className="text-zinc-950 text-xs font-black">{bankNameStr || 'Not Set'}</Text>
                    </View>
                    <View className="flex-row justify-between py-1 border-b border-zinc-50 pb-2">
                      <Text className="text-zinc-400 text-xs font-semibold">Account Number</Text>
                      <Text className="text-zinc-950 text-xs font-black">{bankAccNumber ? `•••• ${bankAccNumber.slice(-4)}` : 'Not Set'}</Text>
                    </View>
                    <View className="flex-row justify-between py-1 border-b border-zinc-50 pb-2">
                      <Text className="text-zinc-400 text-xs font-semibold">UPI ID</Text>
                      <Text className="text-zinc-950 text-xs font-black">{bankUpiIdStr || 'Not Set'}</Text>
                    </View>
                  </View>
                )}
              </LuxuryCard>

              {/* Trainer Ledger: Earnings List */}
              <LuxuryCard className="p-5 gap-4" interactive={false}>
                <Text className="text-[#101828] text-xs font-black uppercase tracking-widest border-b border-zinc-100 pb-3">Earnings & Payout Ledger</Text>
                
                <View className="gap-3.5">
                  {earningsList.map((earn) => (
                    <View key={earn.id} className="flex-row justify-between items-center py-2.5 border-b border-zinc-100 last:border-b-0">
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
              </LuxuryCard>

              {/* Safety Rules & Travel Guidelines */}
              <LuxuryCard className="p-5 gap-3" interactive={false}>
                <Text className="text-[#101828] text-xs font-black uppercase tracking-widest">Safety Guidelines</Text>
                <View className="gap-2.5 mt-1">
                  <View className="flex-row gap-2 items-start">
                    <Feather name="check" size={12} color="#16C784" style={{ marginTop: 2 }} />
                    <Text className="text-[#6B7280] text-[10px] leading-relaxed flex-1">Keep client safety OTP verify check-ins active for travel authentication.</Text>
                  </View>
                  <View className="flex-row gap-2 items-start">
                    <Feather name="check" size={12} color="#16C784" style={{ marginTop: 2 }} />
                    <Text className="text-[#6B7280] text-[10px] leading-relaxed flex-1">Complete mandatory post-session reports within 2 hours to release payout funds.</Text>
                  </View>
                </View>
              </LuxuryCard>
            </>
          )}



          {/* Sign Out Button */}
          <TouchableOpacity
            onPress={handleLogout}
            activeOpacity={0.8}
            className="bg-red-50 border border-red-200/50 p-4 rounded-xl flex-row justify-center items-center mt-2 mb-24"
          >
            <Feather name="log-out" size={15} color="#EF4444" style={{ marginRight: 8 }} />
            <Text className="text-red-600 text-xs font-black uppercase tracking-widest">Sign Out</Text>
          </TouchableOpacity>

        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaViewWrapper>
  );
}

function SafeAreaViewWrapper({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FC', paddingTop: insets.top }}>
      {children}
    </View>
  );
}
