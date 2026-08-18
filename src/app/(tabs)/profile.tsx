import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, TextInput, Alert, Animated, Platform, KeyboardAvoidingView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useUserStore } from '../../store/userStore';
import { useMembershipStore } from '../../store/membershipStore';
import { useCoachStore } from '../../store/coachStore';
import { useWalletStore } from '../../store/walletStore';
import { useUserProfileStore } from '../../store/userProfileStore';
import { Database, TrainerApplication } from '../../database/Database';
import { AutocompleteSuggestion, fetchGooglePlacesAutocomplete, reverseGeocodeCoords } from '../../utils/distance';
import { LuxuryCard } from '../../components/LuxuryCard';
import * as Location from 'expo-location';

type TrainerSectionType = 'profile' | 'workout' | 'operating' | 'availability' | 'banking' | 'support' | 'safety' | 'kit';

const CATEGORY_DISPLAY_MAP: Record<string, string> = {
  'Strength': 'Strength Training',
  'Mind & Body': 'Yoga',
  'Cardio': 'Dance Fitness',
  'Conditioning': 'Stretching',
  'Boxing': 'Boxing',
  'All Workouts': 'All Workouts'
};

const DB_CATEGORIES = [
  { key: 'Strength', display: 'Strength Training' },
  { key: 'Mind & Body', display: 'Yoga' },
  { key: 'Cardio', display: 'Dance Fitness' },
  { key: 'Conditioning', display: 'Stretching' },
  { key: 'Boxing', display: 'Boxing' }
];

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // Stores
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

  useEffect(() => {
    setTimeout(() => {
      checkApplicationStatus();
    }, 0);
  }, [profile.mobile]);

  const shimmerAnim = useMemo(() => new Animated.Value(0.3), []);
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0.3, duration: 1500, useNativeDriver: true })
      ])
    ).start();
  }, [shimmerAnim]);

  // Client Profile Edit local states
  const [isEditingProfile, setIsEditingProfile] = useState(false);
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
    Alert.alert('Profile Saved', 'Your personal details have been updated.');
  };

  // Trainer local states & parsing
  const coach = Database.schema.coaches.find((c: any) => c.name === user.name || c.id === user.id) || null;
  let parsedBankDetails = { accountName: '', bankName: '', accountNumber: '', ifsc: '', upiId: '' };
  try {
    if (coach && coach.bankDetails) {
      parsedBankDetails = JSON.parse(coach.bankDetails);
    }
  } catch (e) {}

  const [isEditingTrainer, setIsEditingTrainer] = useState(false);
  const [trainerBio, setTrainerBio] = useState(coach?.shortBio || '');
  const [trainerName, setTrainerName] = useState(coach?.name || user.name);
  const [trainerEmail, setTrainerEmail] = useState(user.email || '');
  const [trainerGender, setTrainerGender] = useState(coach?.gender || 'Male');
  const [bankAccName, setBankAccName] = useState(parsedBankDetails.accountName || '');
  const [bankNameStr, setBankNameStr] = useState(parsedBankDetails.bankName || '');
  const [bankAccNumber, setBankAccNumber] = useState(parsedBankDetails.accountNumber || '');
  const [bankIfscStr, setBankIfscStr] = useState(parsedBankDetails.ifsc || '');
  const [bankUpiIdStr, setBankUpiIdStr] = useState(parsedBankDetails.upiId || '');

  // Expanded Section Accordion Toggle State
  const [expandedSection, setExpandedSection] = useState<TrainerSectionType | null>('profile');

  // Operating Area Change Request States
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [radiusInput, setRadiusInput] = useState<10 | 15>(15);
  const [searchSuggestions, setSearchSuggestions] = useState<Array<AutocompleteSuggestion>>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ address: string; lat: number; lng: number; placeId?: string } | null>(null);
  const [isLocationConfirmed, setIsLocationConfirmed] = useState(false);
  const [locationSessionToken, setLocationSessionToken] = useState('');

  // Workout Specialties Request States
  const [showSpecialtyForm, setShowSpecialtyForm] = useState(false);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [specialtyMessage, setSpecialtyMessage] = useState('');

  const getApprovedSpecialtyKeys = () => {
    if (!coach) return [];
    return Database.getWorkoutAssignments(coach.id)
      .filter(a => a.status === 'APPROVED')
      .map(a => a.workoutCategory);
  };

  // Availability Settings States
  const [availMode, setAvailMode] = useState<'weekly_fixed' | 'monthly_flexible'>('weekly_fixed');
  const [maxSessions, setMaxSessions] = useState(coach?.preferences?.maxDailySessions || 4);
  const [weeklyDays, setWeeklyDays] = useState<{ [day: string]: boolean }>({
    'Monday': true, 'Tuesday': true, 'Wednesday': true, 'Thursday': true, 'Friday': true, 'Saturday': false, 'Sunday': false
  });

  // Dispute Report States
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeCategory, setDisputeCategory] = useState<'payment' | 'safety' | 'behavior' | 'cancellation_dispute'>('payment');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [disputeBookingId, setDisputeBookingId] = useState('');
  const [disputesList, setDisputesList] = useState<any[]>([]);

  // Kit Request States
  const [showKitForm, setShowKitForm] = useState(false);
  const [kitSize, setKitSize] = useState<'S' | 'M' | 'L' | 'XL' | 'XXL'>('M');
  const [kitItems, setKitItems] = useState<{ [item: string]: boolean }>({ 'T-shirt': true, 'Towel': false, 'Duffel Bag': false });
  const [kitRequestsList, setKitRequestsList] = useState<any[]>([]);

  // Reload disputes and kit requests on user load
  const reloadDynamicLists = () => {
    if (coach) {
      setDisputesList(Database.getClientDisputes(coach.id));
      setKitRequestsList(Database.getKitRequests(coach.id));
    }
  };

  useFocusEffect(
    useCallback(() => {
      Database.load().then(() => {
        useCoachStore.getState().syncFromDB();
        reloadDynamicLists();
        const latestCoach = Database.schema.coaches.find((c: any) => c.name === user.name || c.id === user.id);
        if (latestCoach) {
          setTrainerName(latestCoach.name || '');
          setTrainerGender(latestCoach.gender || '');
          setTrainerBio(latestCoach.shortBio || '');
        }
      });
    }, [coach?.id])
  );

  useEffect(() => {
    setTimeout(() => {
      reloadDynamicLists();
    }, 0);
  }, [coach?.id]);

  useEffect(() => {
    if (showAddressForm) {
      setTimeout(() => {
        setLocationSessionToken(Math.random().toString(36).substring(2, 15) + Date.now().toString());
      }, 0);
    }
  }, [showAddressForm]);

  // Places search autocomplete
  useEffect(() => {
    if (addressInput.trim().length < 3) {
      setTimeout(() => {
        setSearchSuggestions([]);
      }, 0);
      return;
    }
    let active = true;
    const delayDebounceFn = setTimeout(async () => {
      setIsSearchingLocation(true);
      try {
        const suggestions = await fetchGooglePlacesAutocomplete(addressInput, locationSessionToken);
        if (active) {
          setSearchSuggestions(suggestions);
        }
      } catch (err) {
        console.warn(err);
      } finally {
        if (active) {
          setIsSearchingLocation(false);
        }
      }
    }, 450);
    return () => {
      active = false;
      clearTimeout(delayDebounceFn);
    };
  }, [addressInput, locationSessionToken]);

  const handleUseCurrentLocation = async () => {
    setIsSearchingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        setIsSearchingLocation(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      const res = await reverseGeocodeCoords(latitude, longitude);
      setSelectedLocation({ address: res.address, lat: latitude, lng: longitude, placeId: res.placeId || '' });
      setAddressInput(res.address);
    } catch (err) {
      console.warn(err);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const handleSelectSuggestion = async (item: AutocompleteSuggestion) => {
    setAddressInput(item.description);
    setSearchSuggestions([]);
    setIsSearchingLocation(true);
    try {
      setSelectedLocation({ address: item.description, lat: 12.9716, lng: 77.5946, placeId: item.placeId });
    } catch (err) {
      console.warn(err);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const handleSubmitAddressRequest = async () => {
    if (!coach || !selectedLocation) return;
    try {
      const updatedPrefs: any = {
        ...(coach.preferences || {}),
        addressChangeRequest: {
          requestedAddress: selectedLocation.address,
          requestedLatitude: selectedLocation.lat,
          requestedLongitude: selectedLocation.lng,
          requestedRadius: radiusInput,
          requestedPlaceId: selectedLocation.placeId || '',
          status: 'pending'
        },
        operatingLocationStatus: 'pending'
      };
      await Database.updateCoach(coach.id, { preferences: updatedPrefs });
      useCoachStore.getState().syncFromDB();
      setShowAddressForm(false);
      setSelectedLocation(null);
      setIsLocationConfirmed(false);
      Alert.alert('Request Submitted', 'Your operating location change request has been submitted for admin approval.');
    } catch (e) {
      Alert.alert('Error', 'Failed to submit location change.');
    }
  };

  const handleSaveTrainer = async () => {
    if (!coach) return;
    try {
      const bankDetails = JSON.stringify({
        accountName: bankAccName,
        bankName: bankNameStr,
        accountNumber: bankAccNumber,
        ifsc: bankIfscStr,
        upiId: bankUpiIdStr
      });
      await Database.updateCoach(coach.id, {
        shortBio: trainerBio,
        name: trainerName,
        bankDetails
      });
      useCoachStore.getState().syncFromDB();
      setIsEditingTrainer(false);
      Alert.alert('Details Saved', 'Your bio and banking information have been updated.');
    } catch (e) {
      Alert.alert('Error', 'Failed to save settings.');
    }
  };

  const handleSpecialtySubmit = async () => {
    if (!coach) return;
    try {
      const currentAssignments = Database.getWorkoutAssignments(coach.id);
      const approvedKeys = currentAssignments
        .filter(a => a.status === 'APPROVED')
        .map(a => a.workoutCategory);

      // Submit additions
      for (const cat of selectedSpecialties) {
        if (!approvedKeys.includes(cat)) {
          await Database.requestWorkoutAssignment(coach.id, cat);
        }
      }

      // Submit removals
      for (const cat of approvedKeys) {
        if (!selectedSpecialties.includes(cat)) {
          await Database.requestWorkoutRemoval(coach.id, cat);
        }
      }

      // Sync and close
      useCoachStore.getState().syncFromDB();
      setShowSpecialtyForm(false);
      setSpecialtyMessage('');
      Alert.alert('Request Submitted', 'Your workout specialties change request has been sent to review.');
    } catch (e: any) {
      Alert.alert('Error', 'Failed to submit changes: ' + e.message);
    }
  };

  const handleSaveAvailabilitySettings = async () => {
    if (!coach) return;
    try {
      const updatedPrefs: any = {
        ...(coach.preferences || {}),
        maxDailySessions: maxSessions,
        availabilityMode: availMode,
        defaultWorkingDays: Object.keys(weeklyDays).filter(k => weeklyDays[k])
      };
      await Database.updateCoach(coach.id, { preferences: updatedPrefs });
      useCoachStore.getState().syncFromDB();
      Alert.alert('Saved Successfully', 'Your default availability rules have been updated.');
    } catch (e) {
      Alert.alert('Error', 'Failed to update preferences.');
    }
  };

  const handleDisputeSubmit = () => {
    if (!coach || !disputeDescription) return;
    Database.addClientDispute(coach.id, {
      category: disputeCategory,
      description: disputeDescription,
      bookingId: disputeBookingId
    });
    setDisputeDescription('');
    setDisputeBookingId('');
    setShowDisputeForm(false);
    reloadDynamicLists();
    Alert.alert('Ticket Submitted', 'Our support team will review this case and reply within 24 hours.');
  };

  const handleKitSubmit = () => {
    if (!coach) return;
    const requestedItems = Object.keys(kitItems).filter(k => kitItems[k]);
    if (requestedItems.length === 0) {
      Alert.alert('Item Selection', 'Please check at least one kit item.');
      return;
    }
    Database.addKitRequest(coach.id, {
      items: requestedItems,
      size: kitSize
    });
    setShowKitForm(false);
    reloadDynamicLists();
    Alert.alert('Kit Requested', 'Brand kit accessories request submitted successfully.');
  };

  const renderPassQRCode = () => (
    <View className="bg-white p-1.5 rounded-xl">
      <View className="w-12 h-12 border border-zinc-200 justify-center items-center">
        <Feather name="qr-code" size={32} color="#101828" />
      </View>
    </View>
  );

  return (
    <SafeAreaViewWrapper>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView 
          showsVerticalScrollIndicator={false}
          className="flex-1 bg-[#F7F8FC]"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 140 }}
        >
          {/* Top Account Role Selector */}
          {user.role === 'trainer' && (
            <View className="flex-row bg-[#E5E7EB]/40 border border-[#E5E7EB]/80 p-1.5 rounded-2xl mb-6">
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
                  source={{ uri: profile.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80' }}
                  className="w-20 h-20 rounded-full border-2 border-[#F5B942] mb-3 shadow-lg"
                />
                <Text className="text-[#101828] text-2xl font-black tracking-tight">{profile.name}</Text>
                <Text className="text-[#6B7280] text-xs font-semibold mt-0.5">{profile.email}</Text>
                <View className="bg-amber-500/10 border border-amber-500/20 px-3 py-0.5 rounded-full flex-row items-center gap-1.5 mt-2">
                  <Feather name="award" size={10} color="#F5B942" />
                  <Text className="text-[#F5B942] text-[8px] font-black uppercase tracking-wider">Elite Member</Text>
                </View>
              </View>

              {/* Apple Wallet Membership Credit Card */}
              <View className="gap-3 mb-6">
                <Text className="text-[#101828] text-xs font-black uppercase tracking-widest pl-1">
                  My Membership Pass
                </Text>
                <TouchableOpacity 
                  activeOpacity={0.85}
                  onPress={() => router.push('/wallet' as any)}
                  className="bg-[#101828] rounded-[24px] p-6 shadow-xl relative overflow-hidden border border-zinc-800"
                >
                  <Animated.View style={{ opacity: shimmerAnim }} className="absolute top-0 left-0 right-0 bottom-0 bg-indigo-500/10" />
                  <View className="flex-row justify-between items-start mb-6">
                    <View>
                      <Text className="text-[#06B6D4] text-[9px] font-black uppercase tracking-widest">
                        ★ VIRLA Pass
                      </Text>
                      <Text className="text-white text-xl font-black mt-1 tracking-tight">
                        {membership.tier}
                      </Text>
                    </View>
                    {renderPassQRCode()}
                  </View>
                  <View className="h-[1px] bg-zinc-800 my-4" />
                  <View className="flex-row justify-between items-center mb-4">
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
                  <View className="h-[1px] bg-zinc-850 mt-1 mb-3" />
                  <View className="flex-row justify-end items-center gap-1.5 pr-0.5">
                    <Text className="text-cyan-400 text-[9px] font-black uppercase tracking-wider">Open Wallet</Text>
                    <Feather name="arrow-right" size={10} color="#22D3EE" />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Complete User Core Profile editing panel */}
              <View className="mb-6">
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
                          <Text className="text-zinc-450 text-xs font-semibold">{f.l}</Text>
                          <Text className="text-zinc-950 text-xs font-black">{f.val || 'Not provided'}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </LuxuryCard>
              </View>

              {/* Become a Trainer Option */}
              {user.role !== 'trainer' && !hasApplied && (
                <View className="mb-6">
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
                </View>
              )}

              {user.role !== 'trainer' && hasApplied && userApplication && (
                <View className="mb-6">
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
                </View>
              )}
            </>
          )}

          {/* =============================================================== */}
          {/* ======================= TRAINER PROFILE ======================= */}
          {/* =============================================================== */}
          {role === 'trainer' && coach && (
            <>
              {/* Trainer Profile Header Summary Card */}
              <View className="items-center mb-6">
                <Image
                  source={{ uri: user.avatar || 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=150&q=80' }}
                  className="w-20 h-20 rounded-full border-2 border-[#E11D48] mb-3 shadow-lg"
                />
                <Text className="text-[#101828] text-2xl font-black tracking-tight">{user.name}</Text>
                <Text className="text-[#6B7280] text-xs font-semibold mt-0.5">
                  {coach.level || 'Associate'} • {coach.specialty || 'General Training'}
                </Text>
                <Text className="text-[#E11D48] text-[9px] font-black uppercase tracking-widest mt-2 border border-[#E11D48]/35 px-3 py-1 rounded-full bg-[#E11D48]/5">
                  Trainer ID: VIRLA-PRO-{coach.id.slice(-6).toUpperCase()}
                </Text>
              </View>

              {/* Accordion Categories List Wrapper */}
              <View className="gap-4">
                
                {/* 1. Personal Profile Accordion */}
                <AccordionCard
                  title="Personal Details & Bio"
                  icon="user"
                  expanded={expandedSection === 'profile'}
                  onToggle={() => setExpandedSection(expandedSection === 'profile' ? null : 'profile')}
                >
                  <View className="flex-row justify-between items-center border-b border-zinc-100 pb-3 mb-4">
                    <Text className="text-zinc-950 text-[10px] font-black uppercase">Coach Identity Details</Text>
                    <TouchableOpacity onPress={() => { if (isEditingTrainer) { handleSaveTrainer(); } else { setIsEditingTrainer(true); } }}>
                      <Text className="text-indigo-600 text-xs font-black uppercase tracking-widest">{isEditingTrainer ? 'Save' : 'Edit'}</Text>
                    </TouchableOpacity>
                  </View>

                  {isEditingTrainer ? (
                    <View className="gap-3.5">
                      <View className="gap-1">
                        <Text className="text-zinc-500 text-[8px] font-black uppercase">Full Name</Text>
                        <TextInput value={trainerName} onChangeText={setTrainerName} className="border border-[#E5E7EB] bg-[#F7F8FC] p-3 rounded-xl text-xs text-zinc-900 font-semibold" />
                      </View>
                      <View className="gap-1">
                        <Text className="text-zinc-500 text-[8px] font-black uppercase">Email address</Text>
                        <TextInput value={trainerEmail} onChangeText={setTrainerEmail} keyboardType="email-address" className="border border-[#E5E7EB] bg-[#F7F8FC] p-3 rounded-xl text-xs text-zinc-900 font-semibold" />
                      </View>
                      <View className="gap-1">
                        <Text className="text-zinc-500 text-[8px] font-black uppercase">Gender (Locked)</Text>
                        <View className="border border-[#E5E7EB] bg-zinc-50 p-3.5 rounded-xl flex-row justify-between items-center">
                          <Text className="text-xs text-zinc-450 font-black uppercase tracking-wider">{trainerGender || 'Not Set'}</Text>
                          <Feather name="lock" size={10} color="#9CA3AF" />
                        </View>
                      </View>
                      <View className="gap-1">
                        <Text className="text-zinc-500 text-[8px] font-black uppercase">Coach Short Bio</Text>
                        <TextInput value={trainerBio} onChangeText={setTrainerBio} multiline numberOfLines={3} className="border border-[#E5E7EB] bg-[#F7F8FC] p-3 rounded-xl text-xs text-zinc-900 font-semibold" />
                      </View>
                    </View>
                  ) : (
                    <View className="gap-3">
                      <View className="flex-row justify-between py-1 border-b border-zinc-50 pb-2">
                        <Text className="text-zinc-400 text-xs font-semibold">Verification status</Text>
                        <Text className="text-emerald-600 text-xs font-black uppercase">Active Pro Partner</Text>
                      </View>
                      <View className="flex-row justify-between py-1 border-b border-zinc-50 pb-2">
                        <Text className="text-zinc-400 text-xs font-semibold">Email address</Text>
                        <Text className="text-zinc-950 text-xs font-black">{trainerEmail || 'Not Set'}</Text>
                      </View>
                      <View className="flex-row justify-between py-1 border-b border-zinc-50 pb-2">
                        <Text className="text-zinc-400 text-xs font-semibold">Gender</Text>
                        <View className="flex-row items-center gap-1">
                          <Text className="text-zinc-950 text-xs font-black capitalize">{trainerGender || 'Not Set'}</Text>
                          <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-tight">(Locked)</Text>
                        </View>
                      </View>
                      <View className="py-1 border-b border-zinc-50 pb-2">
                        <Text className="text-zinc-400 text-xs font-semibold">Professional Bio</Text>
                        <Text className="text-zinc-950 text-xs font-bold leading-relaxed mt-1">{trainerBio || 'No Bio Configured'}</Text>
                      </View>
                    </View>
                  )}
                </AccordionCard>

                {/* 2. Workout Specialties Accordion */}
                <AccordionCard
                  title="Workout Specialties & Specialties"
                  icon="zap"
                  expanded={expandedSection === 'workout'}
                  onToggle={() => setExpandedSection(expandedSection === 'workout' ? null : 'workout')}
                >
                  {(() => {
                    const assignments = Database.getWorkoutAssignments(coach.id);
                    const approvedCats = assignments
                      .filter(a => a.status === 'APPROVED')
                      .map(a => ({ id: a.id, name: CATEGORY_DISPLAY_MAP[a.workoutCategory] || a.workoutCategory }));
                    const pendingCats = assignments
                      .filter(a => a.status === 'PENDING' || a.status === 'REMOVAL_REQUESTED')
                      .map(a => ({ 
                        id: a.id, 
                        name: CATEGORY_DISPLAY_MAP[a.workoutCategory] || a.workoutCategory,
                        isRemoval: a.status === 'REMOVAL_REQUESTED'
                      }));
                    const rejectedCats = assignments
                      .filter(a => a.status === 'REJECTED')
                      .map(a => ({ id: a.id, name: CATEGORY_DISPLAY_MAP[a.workoutCategory] || a.workoutCategory, reason: a.rejectionReason }));

                    return (
                      <View className="gap-3">
                        <View className="py-1 border-b border-zinc-50 pb-2">
                          <Text className="text-zinc-400 text-xs font-semibold">Active Approved Workout Categories</Text>
                          {approvedCats.length > 0 ? (
                            <View className="flex-row flex-wrap gap-2 mt-2">
                              {approvedCats.map((spec, idx) => (
                                <View key={spec.id} className="bg-indigo-50 border border-indigo-150 px-3 py-1 rounded-full flex-row items-center gap-1.5">
                                  <Feather name="check" size={8} color="#4F46E5" />
                                  <Text className="text-indigo-700 text-[9px] font-black uppercase tracking-wider">{spec.name}</Text>
                                </View>
                              ))}
                            </View>
                          ) : (
                            <Text className="text-zinc-500 text-xs font-bold mt-2">No approved workout categories</Text>
                          )}
                        </View>

                        {pendingCats.length > 0 && (
                          <View className="py-1 border-b border-zinc-50 pb-2">
                            <Text className="text-zinc-400 text-xs font-semibold">Pending Approval Requests</Text>
                            <View className="flex-row flex-wrap gap-2 mt-2">
                              {pendingCats.map((spec, idx) => (
                                <View key={spec.id} className="bg-amber-50 border border-amber-150 px-3 py-1 rounded-full flex-row items-center gap-1.5">
                                  <Feather name="clock" size={8} color="#D97706" />
                                  <Text className="text-amber-700 text-[9px] font-black uppercase tracking-wider">
                                    {spec.name} ({spec.isRemoval ? 'Removal' : 'Addition'})
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}

                        {rejectedCats.length > 0 && (
                          <View className="py-1 border-b border-zinc-50 pb-2">
                            <Text className="text-zinc-400 text-xs font-semibold">Declined Category Requests</Text>
                            <View className="flex-row flex-wrap gap-2 mt-2">
                              {rejectedCats.map((spec, idx) => (
                                <View key={spec.id} className="bg-rose-50 border border-rose-150 px-3 py-1 rounded-full flex-row items-center gap-1.5">
                                  <Feather name="x" size={8} color="#EF4444" />
                                  <Text className="text-rose-700 text-[9px] font-black uppercase tracking-wider">
                                    {spec.name} {spec.reason ? `(${spec.reason})` : ''}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}

                        <View className="py-1 border-b border-zinc-50 pb-2">
                          <Text className="text-zinc-400 text-xs font-semibold">Specialization Specialty Target</Text>
                          <Text className="text-zinc-950 text-xs font-black mt-1 leading-normal">
                            {coach.specialization || 'Strength & Conditioning'}
                          </Text>
                        </View>

                        {!showSpecialtyForm && (
                          <TouchableOpacity
                            onPress={() => {
                              setSelectedSpecialties(getApprovedSpecialtyKeys());
                              setShowSpecialtyForm(true);
                            }}
                            className="bg-indigo-50 border border-indigo-200/50 p-3 rounded-xl flex-row justify-center items-center mt-2"
                          >
                            <Feather name="edit-2" size={12} color="#4F46E5" style={{ marginRight: 6 }} />
                            <Text className="text-indigo-600 text-[10px] font-black uppercase tracking-wider">
                              Request Workout Specialties Change
                            </Text>
                          </TouchableOpacity>
                        )}

                        {showSpecialtyForm && (
                          <View className="bg-zinc-50 border border-zinc-150 p-4 rounded-xl gap-3 mt-2">
                            <Text className="text-zinc-950 text-xs font-black uppercase">Select workout categories to request</Text>
                            <View className="flex-row flex-wrap gap-2">
                              {DB_CATEGORIES.map((cat, idx) => {
                                const isChecked = selectedSpecialties.includes(cat.key);
                                return (
                                  <TouchableOpacity
                                    key={idx}
                                    onPress={() => {
                                      if (isChecked) {
                                        setSelectedSpecialties(selectedSpecialties.filter(s => s !== cat.key));
                                      } else {
                                        setSelectedSpecialties([...selectedSpecialties, cat.key]);
                                      }
                                    }}
                                    className={`px-3 py-1.5 border rounded-lg flex-row items-center gap-1.5 ${
                                      isChecked ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-zinc-200'
                                    }`}
                                  >
                                    <Text className={`text-[10px] font-bold uppercase ${isChecked ? 'text-white' : 'text-zinc-600'}`}>{cat.display}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                            <View className="gap-1 mt-1">
                              <Text className="text-zinc-500 text-[8px] font-black uppercase">Why are you requesting this change?</Text>
                              <TextInput
                                value={specialtyMessage}
                                onChangeText={setSpecialtyMessage}
                                placeholder="Add certifications, ACE, fitness coach experience..."
                                className="border border-[#E5E7EB] bg-white p-3 rounded-xl text-xs text-zinc-900 font-semibold"
                              />
                            </View>
                            <View className="flex-row gap-2 mt-2">
                              <TouchableOpacity onPress={() => setShowSpecialtyForm(false)} className="flex-1 border border-zinc-255 py-2 rounded-xl items-center bg-white">
                                <Text className="text-zinc-500 text-[10px] font-black uppercase">Cancel</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={handleSpecialtySubmit} className="flex-1 bg-indigo-600 py-2 rounded-xl items-center">
                                <Text className="text-white text-[10px] font-black uppercase">Submit Request</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </AccordionCard>

                {/* 3. Operating Area Accordion */}
                <AccordionCard
                  title="Operating Area Base & Radius"
                  icon="map-pin"
                  expanded={expandedSection === 'operating'}
                  onToggle={() => setExpandedSection(expandedSection === 'operating' ? null : 'operating')}
                >
                  <View className="gap-3">
                    <View className="py-1 border-b border-zinc-50 pb-2">
                      <Text className="text-zinc-400 text-xs font-semibold">Operating Base Location</Text>
                      <Text className="text-zinc-950 text-xs font-black mt-1 leading-normal">
                        {coach.preferences?.operatingAddress || 'Operating Base Not Configured'}
                      </Text>
                      <Text className="text-zinc-450 text-[8px] font-semibold mt-1">
                        📍 Permanent check-in dispatch address
                      </Text>
                    </View>

                    <View className="flex-row justify-between py-1 border-b border-zinc-50 pb-2">
                      <Text className="text-zinc-400 text-xs font-semibold">Service Radius</Text>
                      <Text className="text-zinc-950 text-xs font-black">
                        {coach.preferences?.radiusKm ? `${coach.preferences.radiusKm} km` : '15 km'}
                      </Text>
                    </View>

                    <View className="flex-row justify-between py-1 border-b border-zinc-50 pb-2">
                      <Text className="text-zinc-400 text-xs font-semibold">Operating Verification status</Text>
                      <View className={`px-2 py-0.5 rounded-full ${
                        coach.preferences?.operatingLocationStatus === 'verified' 
                          ? 'bg-green-50 border border-green-150' 
                          : coach.preferences?.operatingLocationStatus === 'rejected'
                          ? 'bg-rose-50 border border-rose-150'
                          : 'bg-amber-50 border border-amber-150'
                      }`}>
                        <Text className={`text-[8px] font-black uppercase ${
                          coach.preferences?.operatingLocationStatus === 'verified'
                            ? 'text-green-600'
                            : coach.preferences?.operatingLocationStatus === 'rejected'
                            ? 'text-rose-600'
                            : 'text-amber-600'
                        }`}>
                          {coach.preferences?.operatingLocationStatus === 'verified' ? 'Verified' : coach.preferences?.operatingLocationStatus === 'rejected' ? 'Rejected' : 'Pending Review'}
                        </Text>
                      </View>
                    </View>

                    {coach.preferences?.addressChangeRequest && (
                      <View className="bg-amber-50 border border-amber-250 p-3 rounded-xl gap-1">
                        <Text className="text-amber-800 text-[9px] font-black uppercase tracking-wider">Pending Change Request</Text>
                        <Text className="text-zinc-900 text-xs font-black">
                          Change to: {coach.preferences.addressChangeRequest.requestedAddress} ({coach.preferences.addressChangeRequest.requestedRadius} km)
                        </Text>
                        <Text className="text-zinc-400 text-[8px] font-semibold mt-0.5">Submitted, waiting for verification approval.</Text>
                      </View>
                    )}

                    {!coach.preferences?.addressChangeRequest && !showAddressForm && (
                      <TouchableOpacity
                        onPress={() => {
                          setAddressInput(coach.preferences?.operatingAddress || '');
                          setRadiusInput((coach.preferences?.radiusKm as 10 | 15) || 15);
                          setShowAddressForm(true);
                        }}
                        className="bg-indigo-50 border border-indigo-200/50 p-3 rounded-xl flex-row justify-center items-center mt-2"
                      >
                        <Feather name="edit-2" size={12} color="#4F46E5" style={{ marginRight: 6 }} />
                        <Text className="text-indigo-600 text-[10px] font-black uppercase tracking-wider">
                          Request Address Change
                        </Text>
                      </TouchableOpacity>
                    )}

                    {showAddressForm && (
                      <View className="bg-zinc-50 border border-zinc-150 p-4 rounded-xl gap-3 mt-2">
                        <Text className="text-zinc-950 text-xs font-black uppercase">Configure Base address</Text>
                        <TouchableOpacity
                          onPress={handleUseCurrentLocation}
                          disabled={isSearchingLocation}
                          className="bg-indigo-50 border border-indigo-200/50 p-3 rounded-xl flex-row justify-center items-center gap-2"
                        >
                          <Feather name="navigation" size={12} color="#4F46E5" />
                          <Text className="text-indigo-600 text-[10px] font-black uppercase tracking-wider">Use Current Location</Text>
                        </TouchableOpacity>
                        
                        <View className="gap-1">
                          <Text className="text-zinc-500 text-[8px] font-black uppercase">Search address</Text>
                          <TextInput
                            value={addressInput}
                            onChangeText={setAddressInput}
                            placeholder="Enter address..."
                            className="border border-[#E5E7EB] bg-white p-3 rounded-xl text-xs text-zinc-900 font-semibold"
                          />
                        </View>

                        {searchSuggestions.length > 0 && (
                          <View className="bg-white border border-zinc-205 rounded-xl max-h-40 overflow-hidden py-1">
                            {searchSuggestions.map((item, idx) => (
                              <TouchableOpacity
                                key={idx}
                                onPress={() => handleSelectSuggestion(item)}
                                className="p-3 border-b border-zinc-100 flex-row items-center gap-2"
                              >
                                <Feather name="map-pin" size={10} color="#6B7280" />
                                <Text className="text-zinc-700 text-[10px] font-bold flex-1" numberOfLines={2}>{item.description}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}

                        {selectedLocation && (
                          <View className="bg-indigo-50/40 border border-indigo-100 p-4 rounded-2xl gap-3">
                            <View className="flex-row items-center gap-2">
                              <Feather name="check-circle" size={12} color="#4F46E5" />
                              <Text className="text-indigo-600 text-[8px] font-black uppercase">Location Selected</Text>
                            </View>
                            <Text className="text-zinc-900 text-[10px] font-bold leading-relaxed">{selectedLocation.address}</Text>
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={() => setIsLocationConfirmed(!isLocationConfirmed)}
                              className="flex-row items-center gap-2.5 border-t border-indigo-100/50 pt-2.5"
                            >
                              <View className={`w-4 h-4 rounded border items-center justify-center ${
                                isLocationConfirmed ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-zinc-300'
                              }`}>
                                {isLocationConfirmed && <Feather name="check" size={10} color="white" />}
                              </View>
                              <Text className="text-zinc-900 text-[9px] font-bold">This is my operating base.</Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        <View className="gap-1">
                          <Text className="text-zinc-500 text-[8px] font-black uppercase">Service Radius Limit</Text>
                          <View className="flex-row gap-2 mt-1">
                            {[10, 15].map((r) => (
                              <TouchableOpacity
                                key={r}
                                onPress={() => setRadiusInput(r as 10 | 15)}
                                className={`flex-1 py-2 border rounded-xl items-center ${
                                  radiusInput === r ? 'bg-zinc-950 border-zinc-950' : 'bg-white border-zinc-200'
                                }`}
                              >
                                <Text className={`text-xs font-black uppercase ${radiusInput === r ? 'text-white' : 'text-zinc-500'}`}>{r} km</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>

                        <View className="flex-row gap-2 mt-1">
                          <TouchableOpacity
                            onPress={() => {
                              setShowAddressForm(false);
                              setSearchSuggestions([]);
                              setSelectedLocation(null);
                              setIsLocationConfirmed(false);
                            }}
                            className="flex-1 border border-zinc-250 py-2.5 rounded-xl items-center bg-white"
                          >
                            <Text className="text-zinc-500 text-[10px] font-black uppercase">Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={handleSubmitAddressRequest}
                            disabled={!selectedLocation || !isLocationConfirmed}
                            className={`flex-1 py-2.5 rounded-xl items-center ${
                              selectedLocation && isLocationConfirmed ? 'bg-indigo-600' : 'bg-zinc-300'
                            }`}
                          >
                            <Text className="text-white text-[10px] font-black uppercase">Submit Request</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                </AccordionCard>

                {/* 4. Availability settings Accordion */}
                <AccordionCard
                  title="Availability Rules & Limits"
                  icon="calendar"
                  expanded={expandedSection === 'availability'}
                  onToggle={() => setExpandedSection(expandedSection === 'availability' ? null : 'availability')}
                >
                  <View className="gap-4">
                    <View className="gap-1.5">
                      <Text className="text-zinc-400 text-xs font-semibold">Availability Mode</Text>
                      <View className="flex-row gap-2 mt-1">
                        {['weekly_fixed', 'monthly_flexible'].map((mode) => (
                          <TouchableOpacity
                            key={mode}
                            onPress={() => setAvailMode(mode as any)}
                            className={`flex-1 py-2 border rounded-xl items-center ${
                              availMode === mode ? 'bg-zinc-950 border-zinc-950' : 'bg-white border-zinc-200'
                            }`}
                          >
                            <Text className={`text-[9px] font-black uppercase ${
                              availMode === mode ? 'text-white' : 'text-zinc-500'
                            }`}>
                              {mode === 'weekly_fixed' ? 'Fixed Weekly' : 'Flexible Monthly'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <View className="gap-1.5">
                      <Text className="text-zinc-400 text-xs font-semibold">Max Daily Sessions Policy</Text>
                      <View className="flex-row items-center gap-4 mt-1 bg-zinc-50 border border-zinc-200/60 p-2 rounded-xl justify-between">
                        <TouchableOpacity 
                          onPress={() => setMaxSessions(Math.max(1, maxSessions - 1))}
                          className="w-8 h-8 rounded-full bg-white border border-zinc-200 items-center justify-center"
                        >
                          <Feather name="minus" size={14} color="#101828" />
                        </TouchableOpacity>
                        <Text className="text-zinc-955 text-sm font-black">{maxSessions} sessions max/day</Text>
                        <TouchableOpacity 
                          onPress={() => setMaxSessions(Math.min(10, maxSessions + 1))}
                          className="w-8 h-8 rounded-full bg-white border border-zinc-200 items-center justify-center"
                        >
                          <Feather name="plus" size={14} color="#101828" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View className="gap-1.5">
                      <Text className="text-zinc-400 text-xs font-semibold">Default Available Days</Text>
                      <View className="flex-row flex-wrap gap-2 mt-1">
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                          const isChecked = weeklyDays[day];
                          return (
                            <TouchableOpacity
                              key={day}
                              onPress={() => setWeeklyDays({ ...weeklyDays, [day]: !isChecked })}
                              className={`px-3 py-1.5 border rounded-lg ${
                                isChecked ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-zinc-200'
                              }`}
                            >
                              <Text className={`text-[9px] font-black uppercase ${isChecked ? 'text-indigo-700' : 'text-zinc-550'}`}>{day.slice(0, 3)}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={handleSaveAvailabilitySettings}
                      className="bg-zinc-950 py-3 rounded-xl items-center justify-center mt-2"
                    >
                      <Text className="text-white text-xs font-bold uppercase tracking-wider">Save Availability Preferences</Text>
                    </TouchableOpacity>
                  </View>
                </AccordionCard>

                {/* 5. Payments & Earnings Accordion */}
                <AccordionCard
                  title="Payments, Banking & Ledger"
                  icon="credit-card"
                  expanded={expandedSection === 'banking'}
                  onToggle={() => setExpandedSection(expandedSection === 'banking' ? null : 'banking')}
                >
                  <View className="gap-4">
                    {/* Financial stats card */}
                    <View className="bg-zinc-955 p-5 rounded-[24px] gap-4">
                      <Text className="text-zinc-400 text-[9px] font-black uppercase tracking-widest pl-1">Financial summary</Text>
                      <View className="flex-row flex-wrap justify-between gap-y-3">
                        <View className="w-[48%] bg-zinc-900 border border-zinc-800 p-3 rounded-2xl">
                          <Text className="text-zinc-500 text-[8px] font-bold uppercase">Total Earnings</Text>
                          <Text className="text-emerald-500 text-sm font-black mt-0.5">₹{(totalEarnings || 0).toLocaleString('en-IN')}</Text>
                        </View>
                        <View className="w-[48%] bg-zinc-900 border border-zinc-800 p-3 rounded-2xl">
                          <Text className="text-zinc-500 text-[8px] font-bold uppercase">Paid Out</Text>
                          <Text className="text-white text-sm font-black mt-0.5">₹{((totalEarnings || 0) * 0.85).toLocaleString('en-IN')}</Text>
                        </View>
                        <View className="w-[48%] bg-zinc-900 border border-zinc-800 p-3 rounded-2xl">
                          <Text className="text-zinc-500 text-[8px] font-bold uppercase">Pending Payout</Text>
                          <Text className="text-amber-500 text-sm font-black mt-0.5">₹{((totalEarnings || 0) * 0.15).toLocaleString('en-IN')}</Text>
                        </View>
                        <View className="w-[48%] bg-zinc-900 border border-zinc-800 p-3 rounded-2xl">
                          <Text className="text-zinc-500 text-[8px] font-bold uppercase">Next Payout</Text>
                          <Text className="text-white text-[10px] font-black mt-0.5">Fri, 21 Aug</Text>
                        </View>
                      </View>
                    </View>

                    {/* Bank info view */}
                    <View className="border-t border-zinc-100 pt-3">
                      <View className="flex-row justify-between items-center mb-3">
                        <Text className="text-zinc-900 text-xs font-black uppercase">Bank Account details</Text>
                        <TouchableOpacity onPress={() => setIsEditingTrainer(!isEditingTrainer)}>
                          <Text className="text-indigo-600 text-[10px] font-black uppercase tracking-wider">{isEditingTrainer ? 'Close' : 'Update Details'}</Text>
                        </TouchableOpacity>
                      </View>
                      
                      {isEditingTrainer ? (
                        <View className="gap-3 bg-zinc-55 p-4 border border-zinc-150 rounded-2xl">
                          <View className="gap-1">
                            <Text className="text-zinc-500 text-[8px] font-black uppercase">Account Name</Text>
                            <TextInput value={bankAccName} onChangeText={setBankAccName} className="border border-[#E5E7EB] bg-white p-3 rounded-xl text-xs text-zinc-900 font-semibold" />
                          </View>
                          <View className="gap-1">
                            <Text className="text-zinc-500 text-[8px] font-black uppercase">Bank Name</Text>
                            <TextInput value={bankNameStr} onChangeText={setBankNameStr} className="border border-[#E5E7EB] bg-white p-3 rounded-xl text-xs text-zinc-900 font-semibold" />
                          </View>
                          <View className="gap-1">
                            <Text className="text-zinc-500 text-[8px] font-black uppercase">Account Number</Text>
                            <TextInput value={bankAccNumber} onChangeText={setBankAccNumber} keyboardType="number-pad" className="border border-[#E5E7EB] bg-white p-3 rounded-xl text-xs text-zinc-900 font-semibold" />
                          </View>
                          <View className="gap-1">
                            <Text className="text-zinc-500 text-[8px] font-black uppercase">IFSC Code</Text>
                            <TextInput value={bankIfscStr} onChangeText={setBankIfscStr} className="border border-[#E5E7EB] bg-white p-3 rounded-xl text-xs text-zinc-900 font-semibold" />
                          </View>
                          <View className="gap-1">
                            <Text className="text-zinc-500 text-[8px] font-black uppercase">UPI ID</Text>
                            <TextInput value={bankUpiIdStr} onChangeText={setBankUpiIdStr} className="border border-[#E5E7EB] bg-white p-3 rounded-xl text-xs text-zinc-900 font-semibold" />
                          </View>
                          <TouchableOpacity onPress={handleSaveTrainer} className="bg-indigo-600 py-3 rounded-xl items-center mt-1">
                            <Text className="text-white text-xs font-bold uppercase">Save Account details</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View className="gap-2">
                          <View className="flex-row justify-between py-1 border-b border-zinc-50">
                            <Text className="text-zinc-400 text-xs font-semibold">Account Holder</Text>
                            <Text className="text-zinc-950 text-xs font-black">{bankAccName || 'Not Set'}</Text>
                          </View>
                          <View className="flex-row justify-between py-1 border-b border-zinc-50">
                            <Text className="text-zinc-400 text-xs font-semibold">Bank Name</Text>
                            <Text className="text-zinc-950 text-xs font-black">{bankNameStr || 'Not Set'}</Text>
                          </View>
                          <View className="flex-row justify-between py-1 border-b border-zinc-50">
                            <Text className="text-zinc-400 text-xs font-semibold">Account Number</Text>
                            <Text className="text-zinc-950 text-xs font-black">{bankAccNumber ? `•••• ${bankAccNumber.slice(-4)}` : 'Not Set'}</Text>
                          </View>
                          <View className="flex-row justify-between py-1 border-b border-zinc-50">
                            <Text className="text-zinc-400 text-xs font-semibold">UPI ID</Text>
                            <Text className="text-zinc-950 text-xs font-black">{bankUpiIdStr || 'Not Set'}</Text>
                          </View>
                        </View>
                      )}
                    </View>

                    {/* Historical ledger list */}
                    <View className="border-t border-zinc-100 pt-3">
                      <Text className="text-zinc-900 text-xs font-black uppercase mb-3">Earnings History Ledger</Text>
                      {earningsList.length > 0 ? (
                        <View className="gap-2 bg-zinc-50 p-4 border border-zinc-150 rounded-2xl">
                          {earningsList.slice(0, 6).map((earn) => (
                            <View key={earn.id} className="flex-row justify-between items-center py-2 border-b border-zinc-200/50 last:border-b-0">
                              <View className="flex-1 pr-3">
                                <Text className="text-zinc-850 text-xs font-semibold leading-snug">
                                  {earn.type === 'session' && `Visit Fee: ${earn.clientName}`}
                                  {earn.type === 'no_show_compensation' && `Cancellation Fee: ${earn.clientName}`}
                                  {earn.type === 'penalty' && `Cancellation Penalty`}
                                </Text>
                                <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">{earn.date}</Text>
                              </View>
                              <Text className={`text-xs font-black ${earn.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {earn.amount >= 0 ? '+' : ''}₹{earn.amount.toLocaleString('en-IN')}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text className="text-zinc-400 text-[10px] text-center py-4 bg-zinc-50 border border-zinc-150 rounded-2xl">No earnings transactions logged.</Text>
                      )}
                    </View>
                  </View>
                </AccordionCard>

                {/* 6. Client support & Disputes Accordion */}
                <AccordionCard
                  title="Client Issues & Disputes"
                  icon="alert-circle"
                  expanded={expandedSection === 'support'}
                  onToggle={() => setExpandedSection(expandedSection === 'support' ? null : 'support')}
                >
                  <View className="gap-4">
                    <View className="flex-row justify-between items-center mb-1">
                      <Text className="text-zinc-900 text-xs font-black uppercase">Report support tickets</Text>
                      {!showDisputeForm && (
                        <TouchableOpacity onPress={() => setShowDisputeForm(true)} className="bg-indigo-50 border border-indigo-150 px-2.5 py-1 rounded-lg">
                          <Text className="text-indigo-600 text-[9px] font-black uppercase">Raise Ticket</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {showDisputeForm && (
                      <View className="bg-zinc-50 border border-zinc-150 p-4 rounded-xl gap-3 mt-1">
                        <Text className="text-zinc-950 text-xs font-black uppercase">Submit new issue ticket</Text>
                        <View className="gap-1">
                          <Text className="text-zinc-500 text-[8px] font-black uppercase">Category</Text>
                          <View className="flex-row flex-wrap gap-2 mt-1">
                            {['payment', 'safety', 'behavior', 'cancellation_dispute'].map((cat) => (
                              <TouchableOpacity
                                key={cat}
                                onPress={() => setDisputeCategory(cat as any)}
                                className={`px-2.5 py-1.5 border rounded-lg ${
                                  disputeCategory === cat ? 'bg-indigo-650 border-indigo-650' : 'bg-white border-zinc-200'
                                }`}
                              >
                                <Text className={`text-[8px] font-black uppercase ${disputeCategory === cat ? 'text-white' : 'text-zinc-650'}`}>
                                  {cat.replace('_', ' ')}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                        <View className="gap-1">
                          <Text className="text-zinc-500 text-[8px] font-black uppercase">Booking ID (Optional)</Text>
                          <TextInput value={disputeBookingId} onChangeText={setDisputeBookingId} placeholder="e.g. bk-728200" className="border border-[#E5E7EB] bg-white p-3 rounded-xl text-xs text-zinc-900 font-semibold" />
                        </View>
                        <View className="gap-1">
                          <Text className="text-zinc-500 text-[8px] font-black uppercase">Describe the issue</Text>
                          <TextInput value={disputeDescription} onChangeText={setDisputeDescription} placeholder="Please detail the cancellation timing, client safety concern, or dispute..." multiline numberOfLines={3} className="border border-[#E5E7EB] bg-white p-3 rounded-xl text-xs text-zinc-900 font-semibold" />
                        </View>
                        <View className="flex-row gap-2 mt-2">
                          <TouchableOpacity onPress={() => setShowDisputeForm(false)} className="flex-1 border border-zinc-255 py-2.5 rounded-xl items-center bg-white">
                            <Text className="text-zinc-500 text-[10px] font-black uppercase">Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={handleDisputeSubmit} className="flex-1 bg-indigo-600 py-2.5 rounded-xl items-center">
                            <Text className="text-white text-[10px] font-black uppercase">Submit Ticket</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {/* Dispute history */}
                    <View className="border-t border-zinc-100 pt-3">
                      <Text className="text-zinc-900 text-xs font-black uppercase mb-3">Your Disputes history</Text>
                      {disputesList.length > 0 ? (
                        <View className="gap-3.5 bg-zinc-50 p-4 border border-zinc-150 rounded-2xl">
                          {disputesList.map((d) => (
                            <View key={d.id} className="py-2 border-b border-zinc-200/50 last:border-b-0 gap-1">
                              <View className="flex-row justify-between items-center">
                                <Text className="text-zinc-950 text-xs font-black uppercase">Case: {d.category.replace('_', ' ')}</Text>
                                <View className={`px-2 py-0.5 rounded-full ${
                                  d.status === 'resolved' ? 'bg-green-50 border border-green-150' : 'bg-amber-50 border border-amber-150'
                                }`}>
                                  <Text className={`text-[7px] font-black uppercase ${d.status === 'resolved' ? 'text-green-600' : 'text-amber-600'}`}>
                                    {d.status}
                                  </Text>
                                </View>
                              </View>
                              {d.bookingId ? <Text className="text-zinc-400 text-[8px] font-bold">Booking ID: {d.bookingId}</Text> : null}
                              <Text className="text-zinc-650 text-xs leading-normal mt-1">{d.description}</Text>
                              <Text className="text-zinc-450 text-[8px] font-semibold mt-1">Submitted: {d.date}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text className="text-zinc-400 text-[10px] text-center py-4 bg-zinc-50 border border-zinc-150 rounded-2xl">No open dispute cases logged.</Text>
                      )}
                    </View>
                  </View>
                </AccordionCard>

                {/* 7. Safety & sos guidelines Accordion */}
                <AccordionCard
                  title="Safety Rules & Guidelines"
                  icon="shield"
                  expanded={expandedSection === 'safety'}
                  onToggle={() => setExpandedSection(expandedSection === 'safety' ? null : 'safety')}
                >
                  <View className="gap-3.5">
                    <View className="bg-rose-50 border border-rose-200/50 p-4 rounded-2xl flex-row items-center gap-3">
                      <Feather name="shield" size={16} color="#E11D48" />
                      <View className="flex-1">
                        <Text className="text-[#E11D48] text-[9px] font-black uppercase tracking-wider">Masked Calling & SOS</Text>
                        <Text className="text-zinc-700 text-[10px] font-bold leading-relaxed mt-0.5">
                          Call routing uses masked trainer-client phones. Pressing SOS inside any active session alerts support.
                        </Text>
                      </View>
                    </View>
                    
                    <View className="gap-2.5">
                      {[
                        { title: 'OTP Check-in verification', desc: 'Verify client OTP check-ins immediately at the venue door before beginning work.' },
                        { title: 'Safe Travel logging', desc: 'Remember to tap "Start Travel" and "Reached Location" to sync GPS coordinates with the dispatch center.' },
                        { title: 'Cancellation Policy', desc: 'No-shows by clients within 15 minutes of session start will result in full compensation credits.' }
                      ].map((item, idx) => (
                        <View key={idx} className="flex-row gap-3 items-start border-b border-zinc-100 last:border-b-0 pb-2.5">
                          <Feather name="check-circle" size={12} color="#16C784" style={{ marginTop: 2 }} />
                          <View className="flex-1">
                            <Text className="text-zinc-950 text-xs font-black uppercase">{item.title}</Text>
                            <Text className="text-[#6B7280] text-[10px] leading-relaxed mt-0.5">{item.desc}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                </AccordionCard>

                {/* 8. Equipment Kit Request Accordion */}
                <AccordionCard
                  title="Equipment Brand Kit Request"
                  icon="box"
                  expanded={expandedSection === 'kit'}
                  onToggle={() => setExpandedSection(expandedSection === 'kit' ? null : 'kit')}
                >
                  <View className="gap-4">
                    <View className="flex-row justify-between items-center mb-1">
                      <Text className="text-zinc-900 text-xs font-black uppercase">Order VIRLA Partner Accessories</Text>
                      {!showKitForm && (
                        <TouchableOpacity onPress={() => setShowKitForm(true)} className="bg-indigo-50 border border-indigo-150 px-2.5 py-1 rounded-lg">
                          <Text className="text-indigo-600 text-[9px] font-black uppercase">Order Kit</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {showKitForm && (
                      <View className="bg-zinc-50 border border-zinc-150 p-4 rounded-xl gap-3.5 mt-1">
                        <Text className="text-zinc-950 text-xs font-black uppercase">Select branding items</Text>
                        
                        <View className="gap-1.5">
                          {['T-shirt', 'Towel', 'Duffel Bag', 'Water Bottle'].map((item) => {
                            const isChecked = kitItems[item];
                            return (
                              <TouchableOpacity
                                key={item}
                                onPress={() => setKitItems({ ...kitItems, [item]: !isChecked })}
                                className="flex-row items-center gap-2.5 py-1"
                              >
                                <View className={`w-4 h-4 rounded border justify-center items-center ${
                                  isChecked ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-zinc-300'
                                }`}>
                                  {isChecked && <Feather name="check" size={10} color="white" />}
                                </View>
                                <Text className="text-zinc-750 text-xs font-bold">{item}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        <View className="gap-1">
                          <Text className="text-zinc-500 text-[8px] font-black uppercase">T-Shirt size (if ordering)</Text>
                          <View className="flex-row gap-2 mt-1">
                            {(['S', 'M', 'L', 'XL', 'XXL'] as const).map((sz) => (
                              <TouchableOpacity
                                key={sz}
                                onPress={() => setKitSize(sz)}
                                className={`flex-1 py-1.5 border rounded-lg items-center ${
                                  kitSize === sz ? 'bg-zinc-950 border-zinc-950' : 'bg-white border-zinc-200'
                                }`}
                              >
                                <Text className={`text-[10px] font-bold ${kitSize === sz ? 'text-white' : 'text-zinc-500'}`}>{sz}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>

                        <View className="flex-row gap-2 mt-2">
                          <TouchableOpacity onPress={() => setShowKitForm(false)} className="flex-1 border border-zinc-250 py-2 rounded-xl items-center bg-white">
                            <Text className="text-zinc-500 text-[10px] font-black uppercase">Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={handleKitSubmit} className="flex-1 bg-indigo-600 py-2 rounded-xl items-center">
                            <Text className="text-white text-[10px] font-black uppercase">Submit Request</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {/* Kit requests history list */}
                    <View className="border-t border-zinc-100 pt-3">
                      <Text className="text-zinc-900 text-xs font-black uppercase mb-3">Partner Kits History</Text>
                      {kitRequestsList.length > 0 ? (
                        <View className="gap-3.5 bg-zinc-50 p-4 border border-zinc-150 rounded-2xl">
                          {kitRequestsList.map((item) => (
                            <View key={item.id} className="py-2 border-b border-zinc-200/50 last:border-b-0 gap-1">
                              <View className="flex-row justify-between items-center">
                                <Text className="text-zinc-955 text-xs font-black uppercase">Order ID: {item.id.toUpperCase()}</Text>
                                <View className="bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded-full">
                                  <Text className="text-indigo-700 text-[7px] font-black uppercase">
                                    {item.status}
                                  </Text>
                                </View>
                              </View>
                              <Text className="text-zinc-700 text-xs font-semibold">Items: {item.items.join(', ')} (Size: {item.size})</Text>
                              <Text className="text-zinc-450 text-[8px] font-semibold mt-1">Requested: {item.date}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text className="text-zinc-400 text-[10px] text-center py-4 bg-zinc-50 border border-zinc-150 rounded-2xl">No partner brand kit requests logged.</Text>
                      )}
                    </View>
                  </View>
                </AccordionCard>

              </View>
            </>
          )}

          {/* Sign Out button */}
          <TouchableOpacity
            onPress={handleLogout}
            activeOpacity={0.8}
            className="bg-red-50 border border-red-200/50 p-4 rounded-xl flex-row justify-center items-center mt-6 mb-24"
          >
            <Feather name="log-out" size={15} color="#EF4444" style={{ marginRight: 8 }} />
            <Text className="text-red-600 text-xs font-black uppercase tracking-widest">Sign Out</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaViewWrapper>
  );
}

// Collapsible helper Card Component
interface AccordionCardProps {
  title: string;
  icon: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function AccordionCard({ title, icon, expanded, onToggle, children }: AccordionCardProps) {
  return (
    <View 
      className="bg-white border border-[#E5E7EB] rounded-[28px] overflow-hidden"
      style={{
        shadowColor: '#101828',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.02,
        shadowRadius: 8,
        elevation: 1,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onToggle}
        className="p-5 flex-row justify-between items-center w-full bg-white"
      >
        <View className="flex-row items-center gap-3.5">
          <View className="w-8 h-8 rounded-xl bg-indigo-50 justify-center items-center">
            <Feather name={icon as any} size={15} color="#4F46E5" />
          </View>
          <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider">{title}</Text>
        </View>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#6B7280" />
      </TouchableOpacity>
      
      {expanded && (
        <View className="px-5 pb-5 border-t border-zinc-100 pt-4 bg-[#FAFAFC]">
          {children}
        </View>
      )}
    </View>
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
