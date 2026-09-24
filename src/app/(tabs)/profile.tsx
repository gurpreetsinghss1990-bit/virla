import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, TextInput, Alert, Animated, Platform, KeyboardAvoidingView, InteractionManager, BackHandler, Modal, LayoutAnimation, UIManager } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Svg, { Path, Defs, LinearGradient, Stop, Polygon, Polyline } from 'react-native-svg';
import { useUserStore } from '../../store/userStore';
import { useMembershipStore } from '../../store/membershipStore';
import { useCoachStore } from '../../store/coachStore';
import { useWalletStore } from '../../store/walletStore';
import { useUserProfileStore } from '../../store/userProfileStore';
import { Database, TrainerApplication } from '../../database/Database';
import { AutocompleteSuggestion, fetchGooglePlacesAutocomplete, reverseGeocodeCoords } from '../../utils/distance';
import { LuxuryCard } from '../../components/LuxuryCard';
import { SignOutConfirmationModal } from '../../components/SignOutConfirmationModal';
import * as Location from 'expo-location';
import { formatToDDMMYYYY } from '../../utils/date';

type TrainerSectionType = 'profile' | 'workout' | 'operating' | 'availability' | 'banking' | 'support' | 'safety' | 'kit' | 'wallet';

const CATEGORY_DISPLAY_MAP: Record<string, string> = {
  'Strength': 'Strength Training',
  'Mind & Body': 'Yoga',
  'Cardio': 'Dance Fitness',
  'Conditioning': 'Stretching',
  'Boxing': 'Boxing',
  'Aerial Yoga': 'Aerial Yoga',
  'All Workouts': 'All Workouts'
};

const DB_CATEGORIES = [
  { key: 'Strength', display: 'Strength Training' },
  { key: 'Mind & Body', display: 'Yoga' },
  { key: 'Cardio', display: 'Dance Fitness' },
  { key: 'Conditioning', display: 'Stretching' },
  { key: 'Boxing', display: 'Boxing' },
  { key: 'Aerial Yoga', display: 'Aerial Yoga' }
];

const isWildcardTestAccount = (u: any, profileMobile?: string) => {
  if (!u) return false;
  if (u.isWildcardUser) return true;
  const phone = u.phone || profileMobile || '';
  const id = u.id || '';
  const email = u.email || '';
  return (
    phone.includes('1234567891') ||
    id.startsWith('u-testclient') ||
    (id.includes('test') && !id.includes('admin')) ||
    (email.includes('test') && !email.includes('admin'))
  );
};

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // Stores
  const { user, role, setRole, setLoggedIn } = useUserStore();
  const [activeRole, setActiveRole] = useState<'customer' | 'trainer' | 'admin'>(role || 'customer');

  useEffect(() => {
    if (role) {
      setActiveRole(role as 'customer' | 'trainer' | 'admin');
    }
  }, [role]);

  const handleRoleChange = useCallback((newRole: 'customer' | 'trainer' | 'admin') => {
    setActiveRole(newRole);
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        setRole(newRole);
      }, 100);
    });
  }, [setRole]);
  const { membership } = useMembershipStore();
  const { totalEarnings, earningsList } = useCoachStore();
  const { ledger, creditBalance, creditLots, syncFromDB: syncWallet } = useWalletStore();
  const profile = useUserProfileStore();
  const [isSignOutModalVisible, setIsSignOutModalVisible] = useState(false);

  const handleLogout = () => {
    setIsSignOutModalVisible(true);
  };

  const confirmLogout = () => {
    setLoggedIn(false);
    router.replace('/get-started' as any);
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

  // Subtle sparkle intro pulse (1-2 gentle twinkles on screen load and on tap)
  const sparkleAnim = useMemo(() => new Animated.Value(0), []);
  const triggerSparkleAnimation = useCallback(() => {
    sparkleAnim.stopAnimation();
    sparkleAnim.setValue(0);
    Animated.sequence([
      Animated.timing(sparkleAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(sparkleAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(sparkleAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(sparkleAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [sparkleAnim]);

  // Sponge/Layers cascading compression animation (layer1 hits layer2, layer2 hits layer3, then returns)
  const layer1Anim = useMemo(() => new Animated.Value(0), []);
  const layer2Anim = useMemo(() => new Animated.Value(0), []);
  const layer3Anim = useMemo(() => new Animated.Value(0), []);
  const [isLayersAnimating, setIsLayersAnimating] = useState(false);

  const triggerLayersAnimation = useCallback(() => {
    setIsLayersAnimating(true);
    layer1Anim.stopAnimation();
    layer2Anim.stopAnimation();
    layer3Anim.stopAnimation();
    layer1Anim.setValue(0);
    layer2Anim.setValue(0);
    layer3Anim.setValue(0);

    // Step 1: Top layer 1 drops down to hit layer 2
    Animated.timing(layer1Anim, {
      toValue: 3.5,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      // Step 2: Layer 2 receives impact, pushes down to hit layer 3
      Animated.parallel([
        Animated.timing(layer1Anim, {
          toValue: 5,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(layer2Anim, {
          toValue: 2.5,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Step 3: Layer 3 compresses slightly under bottom impact
        Animated.timing(layer3Anim, {
          toValue: 1.2,
          duration: 80,
          useNativeDriver: true,
        }).start(() => {
          // Step 4: Spring back up sequentially to stationary positions
          Animated.parallel([
            Animated.spring(layer1Anim, {
              toValue: 0,
              friction: 5,
              tension: 100,
              useNativeDriver: true,
            }),
            Animated.spring(layer2Anim, {
              toValue: 0,
              friction: 6,
              tension: 90,
              useNativeDriver: true,
            }),
            Animated.spring(layer3Anim, {
              toValue: 0,
              friction: 7,
              tension: 80,
              useNativeDriver: true,
            }),
          ]).start(() => {
            setIsLayersAnimating(false);
          });
        });
      });
    });
  }, [layer1Anim, layer2Anim, layer3Anim]);

  // View Wallet Underline swipe animation (left to right rapid stroke on press, then navigate)
  const walletUnderlineAnim = useMemo(() => new Animated.Value(0), []);
  const [walletLineWidth, setWalletLineWidth] = useState(85);
  const handleViewWalletPress = useCallback(() => {
    walletUnderlineAnim.setValue(0);
    Animated.timing(walletUnderlineAnim, {
      toValue: 1,
      duration: 140,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        router.push('/wallet' as any);
        setTimeout(() => {
          walletUnderlineAnim.setValue(0);
        }, 400);
      }
    });
  }, [walletUnderlineAnim, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      triggerSparkleAnimation();
    }, 350);
    return () => clearTimeout(timer);
  }, [triggerSparkleAnimation]);

  // Client Profile Edit local states
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isPersonalInfoExpanded, setIsPersonalInfoExpanded] = useState(false);

  const togglePersonalInfoExpansion = useCallback((targetState?: boolean) => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    LayoutAnimation.configureNext({
      duration: 260,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
    setIsPersonalInfoExpanded(prev => (typeof targetState === 'boolean' ? targetState : !prev));
  }, []);
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

  useEffect(() => {
    const timer = setTimeout(() => {
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
    }, 0);
    return () => clearTimeout(timer);
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

  const handleSaveProfile = async () => {
    try {
      await profile.updateCoreProfile({
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
    } catch (err: any) {
      console.error('[Profile Update Error]', err);
      Alert.alert('Save Error', err.message || 'Failed to save profile changes. Please try again.');
    }
  };

  // Trainer local states & parsing
  const isTestAccount = isWildcardTestAccount(user, profile?.mobile);
  const coach = Database.schema?.coaches?.find((c: any) => c.name === user?.name || c.id === user?.id) || 
    (isTestAccount ? (Database.schema?.coaches?.find((c: any) => c.id === 'demo.trainer' || c.id === 'u-testclient' || c.id === 'u-testadmin') || Database.schema?.coaches?.[0] || null) : null);
  let parsedBankDetails = { accountName: '', bankName: '', accountNumber: '', ifsc: '', upiId: '' };
  try {
    if (coach && coach.bankDetails) {
      parsedBankDetails = JSON.parse(coach.bankDetails);
    }
  } catch (e) {}

  const [isEditingTrainer, setIsEditingTrainer] = useState(false);

  // ── Hardware back button (Android) ──────────────────────────────────────
  // Intercept back press so it closes panels/modals instead of exiting the app.
  useEffect(() => {
    const onBackPress = () => {
      if (isSignOutModalVisible) {
        setIsSignOutModalVisible(false);
        return true;
      }
      if (isEditingProfile) {
        setIsEditingProfile(false);
        return true;
      }
      if (isEditingTrainer) {
        setIsEditingTrainer(false);
        return true;
      }
      // Root tab screen – prevent accidental app exit
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [isSignOutModalVisible, isEditingProfile, isEditingTrainer]);
  const [trainerBio, setTrainerBio] = useState(coach?.shortBio || '');
  const [trainerName, setTrainerName] = useState(coach?.name || user?.name || '');
  const [trainerEmail, setTrainerEmail] = useState(user?.email || '');
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
  const [selectedTshirtSize, setSelectedTshirtSize] = useState<'S' | 'M' | 'L' | 'XL' | 'XXL' | null>(null);
  const [kitQuantities, setKitQuantities] = useState<{ [item: string]: number }>({ 'T-shirt': 0, 'Towel': 0, 'Duffel Bag': 0, 'Water Bottle': 0 });
  const [kitRequestsList, setKitRequestsList] = useState<any[]>([]);

  // Reload disputes and kit requests on user load
  const reloadDynamicLists = async () => {
    if (coach) {
      const disputes = await Database.fetchClientDisputes(coach.id);
      setDisputesList(disputes);
      const kits = await Database.fetchKitRequests(coach.id);
      setKitRequestsList(kits);
    }
  };

  useFocusEffect(
    useCallback(() => {
      // Ensure session is restored if store is hydrated
      const storedUser = useUserStore.getState().user;
      const isLoggedIn = useUserStore.getState().isLoggedIn;
      if (isLoggedIn && storedUser && storedUser.id) {
        Database.setCurrentUserId(storedUser.id);
      }

      Database.load().then(() => {
        useUserStore.getState().syncFromDB();
        useUserProfileStore.getState().syncFromDB();
        useCoachStore.getState().syncFromDB();
        useWalletStore.getState().syncFromDB();
        useMembershipStore.getState().syncFromDB();
        reloadDynamicLists();
        const latestCoach = Database.schema.coaches.find((c: any) => c.name === user.name || c.id === user.id);
        if (latestCoach) {
          setTrainerName(latestCoach.name || '');
          setTrainerGender(latestCoach.gender || '');
          setTrainerBio(latestCoach.shortBio || '');
        }
      });
    }, [])
  );

  useEffect(() => {
    if (coach?.id) {
      reloadDynamicLists();
    }
  }, []);

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

  const handleDisputeSubmit = async () => {
    if (!coach || !disputeDescription) return;
    try {
      await Database.addClientDispute(coach.id, {
        category: disputeCategory,
        description: disputeDescription,
        bookingId: disputeBookingId
      });
      setDisputeDescription('');
      setDisputeBookingId('');
      setShowDisputeForm(false);
      await reloadDynamicLists();
      Alert.alert('Ticket Submitted', 'Our support team will review this case and reply within 24 hours.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit dispute ticket.');
    }
  };

  const handleKitSubmit = async () => {
    if (!coach) return;
    const itemsList: { [item: string]: number } = {};
    let totalQty = 0;
    
    Object.keys(kitQuantities).forEach(item => {
      const qty = kitQuantities[item];
      if (qty > 0) {
        itemsList[item] = qty;
        totalQty += qty;
      }
    });

    if (totalQty === 0) {
      Alert.alert('Item Selection', 'Please select a quantity greater than 0 for at least one item.');
      return;
    }

    if (kitQuantities['T-shirt'] > 0 && !selectedTshirtSize) {
      Alert.alert('Size Required', 'Please select a T-shirt size.');
      return;
    }

    try {
      await Database.addKitRequest(coach.id, {
        items: itemsList,
        size: kitQuantities['T-shirt'] > 0 ? selectedTshirtSize : null
      });
      setShowKitForm(false);
      setKitQuantities({ 'T-shirt': 0, 'Towel': 0, 'Duffel Bag': 0, 'Water Bottle': 0 });
      setSelectedTshirtSize(null);
      await reloadDynamicLists();
      Alert.alert('Kit Requested', 'Brand kit request submitted successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit kit request.');
    }
  };

  const renderPassQRCode = () => (
    <View className="bg-white p-1.5 rounded-xl">
      <View className="w-12 h-12 border border-zinc-200 justify-center items-center">
        <Ionicons name="qr-code-outline" size={28} color="#101828" />
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
          {/* =============================================================== */}
          {/* ======================= CLIENT PROFILE ======================== */}
          {/* =============================================================== */}
          {activeRole !== 'trainer' && (
            <>
              {/* Subtle botanical branch illustration on top right */}
              <View pointerEvents="none" style={{ position: 'absolute', top: -18, right: -24, width: 140, height: 160, opacity: 0.85, zIndex: 0 }}>
                <Svg width="140" height="160" viewBox="0 0 140 160" fill="none">
                  <Defs>
                    <LinearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <Stop offset="0%" stopColor="#C2D3C8" stopOpacity="0.85" />
                      <Stop offset="100%" stopColor="#94AA9D" stopOpacity="0.45" />
                    </LinearGradient>
                    <LinearGradient id="stemGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <Stop offset="0%" stopColor="#B0C2B6" stopOpacity="0.8" />
                      <Stop offset="100%" stopColor="#7E9688" stopOpacity="0.35" />
                    </LinearGradient>
                  </Defs>
                  <Path d="M 140 10 Q 85 65 30 135" stroke="url(#stemGrad)" strokeWidth="1.6" strokeLinecap="round" />
                  <Path d="M 125 32 Q 92 18 78 38 Q 106 48 125 32 Z" fill="url(#leafGrad)" />
                  <Path d="M 110 48 Q 72 42 58 66 Q 90 72 110 48 Z" fill="url(#leafGrad)" />
                  <Path d="M 90 68 Q 52 70 40 98 Q 72 98 90 68 Z" fill="url(#leafGrad)" />
                  <Path d="M 72 90 Q 38 100 30 128 Q 58 124 72 90 Z" fill="url(#leafGrad)" />
                  <Path d="M 48 114 Q 20 128 14 154 Q 38 144 48 114 Z" fill="url(#leafGrad)" />
                  <Path d="M 135 18 Q 112 4 98 20 Q 122 28 135 18 Z" fill="url(#leafGrad)" />
                </Svg>
              </View>

              {/* Top Bar Header */}
              <View className="flex-row items-center justify-between mb-5 z-10">
                <Text className="text-[#101828] text-3xl font-black tracking-tight">Profile</Text>
                {/* Settings button commented out
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => router.push('/settings' as any)}
                  className="w-10 h-10 rounded-full border border-zinc-200/90 bg-white/90 items-center justify-center shadow-xs"
                >
                  <Ionicons name="settings-outline" size={20} color="#101828" />
                </TouchableOpacity>
                */}
              </View>

              {/* User Hero Section */}
              <View className="flex-row items-center gap-4 mb-6 z-10">
                <View className="w-[78px] h-[78px] rounded-full p-[2.5px] border-2 border-[#F59E0B] bg-white shadow-sm">
                  <Image
                    source={{ uri: profile.avatar || user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80' }}
                    className="w-full h-full rounded-full"
                  />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 flex-wrap">
                    <Text className="text-[#101828] text-2xl font-black tracking-tight">
                      {profile.name || user?.name || 'Virral'}
                    </Text>
                    <View className="bg-[#FFFBEB] border border-[#FDE68A] px-2.5 py-0.5 rounded-full flex-row items-center gap-1">
                      <MaterialCommunityIcons name="crown" size={11} color="#D97706" />
                      <Text className="text-[#D97706] text-[9px] font-black uppercase tracking-wider">ELITE MEMBER</Text>
                    </View>
                  </View>
                  <Text className="text-[#64748B] text-xs font-semibold mt-1">
                    Stronger   •   Healthier   •   Happier
                  </Text>

                  {/* Go to Trainer Mode Button for Wildcard Accounts */}
                  {user?.role !== 'admin' && (user?.role === 'trainer' || isWildcardTestAccount(user, profile?.mobile)) && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => handleRoleChange('trainer')}
                      className="mt-2.5 bg-[#101828] border border-zinc-800 px-3 py-1.5 rounded-xl flex-row items-center gap-1.5 self-start shadow-sm"
                    >
                      <Feather name="repeat" size={11} color="#F5B942" />
                      <Text className="text-white text-[10px] font-black uppercase tracking-wider">
                        Go to Trainer Mode
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Luxury Virla Pass Card */}
              <View 
                className="bg-[#0B1528] rounded-[26px] p-5 shadow-xl relative overflow-hidden mb-5 border border-[#1E293B]"
              >
                {/* Subtle wave lines on dark card */}
                <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                  <Svg width="100%" height="100%" viewBox="0 0 320 160" fill="none">
                    <Path d="M 110 160 C 170 120 220 60 320 40" stroke="#38BDF8" strokeWidth="0.8" strokeOpacity="0.18" />
                    <Path d="M 130 160 C 180 125 230 70 320 55" stroke="#38BDF8" strokeWidth="0.8" strokeOpacity="0.14" />
                    <Path d="M 150 160 C 195 130 240 80 320 70" stroke="#38BDF8" strokeWidth="0.8" strokeOpacity="0.10" />
                    <Path d="M 170 160 C 210 135 250 90 320 85" stroke="#38BDF8" strokeWidth="0.8" strokeOpacity="0.08" />
                  </Svg>
                </View>

                <View className="flex-row justify-between items-start">
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={triggerSparkleAnimation}
                  >
                    <View className="flex-row items-center">
                      <Animated.View
                        style={{
                          transform: [
                            {
                              scale: sparkleAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [1, 1.35],
                              }),
                            },
                            {
                              rotate: sparkleAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0deg', '25deg'],
                              }),
                            },
                          ],
                        }}
                      >
                        <Ionicons name="sparkles" size={11} color="#2DD4BF" />
                      </Animated.View>
                      <Text className="text-[#2DD4BF] text-[9px] font-black uppercase tracking-widest ml-1">
                        VIRLA PASS
                      </Text>
                    </View>
                    <Text className="text-white text-2xl font-black mt-1 tracking-tight">
                      {(membership.tier || 'PREMIUM').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                  <View className="bg-white p-1.5 rounded-xl shadow-xs">
                    <Ionicons name="qr-code" size={32} color="#0B1528" />
                  </View>
                </View>

                <View className="flex-row justify-between items-end mt-5 pt-3 border-t border-zinc-800/60">
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={triggerLayersAnimation}
                    className="flex-row items-center py-1"
                  >
                    <View style={{ width: 22, height: 22, justifyContent: 'center', alignItems: 'center' }}>
                      {/* Layer 1 (Top diamond) */}
                      <Animated.View
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          transform: [{ translateY: layer1Anim }],
                        }}
                      >
                        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                          <Polygon
                            points="12 2 2 7 12 12 22 7 12 2"
                            stroke={isLayersAnimating ? '#2DD4BF' : '#CBD5E1'}
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </Svg>
                      </Animated.View>

                      {/* Layer 2 (Middle chevron) */}
                      <Animated.View
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          transform: [{ translateY: layer2Anim }],
                        }}
                      >
                        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                          <Polyline
                            points="2 12 12 17 22 12"
                            stroke={isLayersAnimating ? '#2DD4BF' : '#CBD5E1'}
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </Svg>
                      </Animated.View>

                      {/* Layer 3 (Bottom chevron) */}
                      <Animated.View
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          transform: [{ translateY: layer3Anim }],
                        }}
                      >
                        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                          <Polyline
                            points="2 17 12 22 22 17"
                            stroke={isLayersAnimating ? '#2DD4BF' : '#CBD5E1'}
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </Svg>
                      </Animated.View>
                    </View>

                    <Text className="text-white text-sm font-black ml-2">
                      {membership.availableCredits ?? 20} Credits
                    </Text>
                  </TouchableOpacity>

                  <View className="w-[1px] h-7 bg-zinc-700/60 mx-2" />

                  <View className="items-end">
                    <Text className="text-[#94A3B8] text-[9px] font-bold uppercase tracking-wider">
                      Valid till
                    </Text>
                    <Text className="text-white text-xs font-bold mt-0.5">
                      {membership.renewalDate || 'Sep 19, 2027'}
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={handleViewWalletPress}
                      className="mt-1.5 py-0.5 self-end"
                    >
                      <View className="flex-row items-center gap-1">
                        <Text className="text-[#2DD4BF] text-xs font-black">View Wallet</Text>
                        <Feather name="arrow-right" size={11} color="#2DD4BF" />
                      </View>
                      {/* Rapid Left-to-Right Green Underline */}
                      <View 
                        style={{ height: 2.5, marginTop: 3, overflow: 'hidden', width: '100%', borderRadius: 2 }}
                        onLayout={(e) => {
                          const w = e.nativeEvent.layout.width;
                          if (w > 0 && w !== walletLineWidth) {
                            setWalletLineWidth(w);
                          }
                        }}
                      >
                        <Animated.View
                          style={{
                            height: 2.5,
                            width: '100%',
                            backgroundColor: '#2DD4BF',
                            borderRadius: 2,
                            transform: [
                              {
                                translateX: walletUnderlineAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [-walletLineWidth, 0],
                                }),
                              },
                            ],
                          }}
                        />
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* 1. Personal Information Accordion Card */}
              <View className="bg-white border border-[#E5E7EB] rounded-[24px] p-5 shadow-xs mb-4">
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => togglePersonalInfoExpansion()}
                  className={`flex-row justify-between items-center ${isPersonalInfoExpanded ? 'mb-2 pb-2.5 border-b border-zinc-100' : ''}`}
                >
                  <View className="flex-row items-center gap-3 flex-1">
                    <View className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center">
                      <Feather name="user" size={17} color="#475569" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[#101828] text-sm font-black tracking-tight">Personal Information</Text>
                      <Text className="text-[#94A3B8] text-[11px] font-semibold mt-0.5">
                        {isPersonalInfoExpanded ? 'Tap to wrap / collapse' : `${profile.name || 'Virral'} • Tap to view all details`}
                      </Text>
                    </View>
                  </View>

                  <View className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center">
                    <Feather name={isPersonalInfoExpanded ? "chevron-up" : "chevron-down"} size={16} color="#475569" />
                  </View>
                </TouchableOpacity>

                {isPersonalInfoExpanded && (
                  <View className="gap-2.5 pt-2">
                    {/* Sub-header inside Dropdown with Edit button */}
                    <View className="flex-row justify-between items-center pb-2 border-b border-zinc-100">
                      <Text className="text-[#64748B] text-xs font-bold uppercase tracking-wider">Profile Details</Text>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setIsEditingProfile(true)}
                        className="flex-row items-center gap-1.5 bg-slate-100 border border-slate-200/80 px-3 py-1 rounded-full"
                      >
                        <Feather name="edit-2" size={11} color="#0F172A" />
                        <Text className="text-[#0F172A] text-xs font-bold">Edit</Text>
                      </TouchableOpacity>
                    </View>
                    {/* Full Name */}
                    <TouchableOpacity activeOpacity={0.6} onPress={() => setIsEditingProfile(true)} className="flex-row items-center justify-between py-1.5">
                      <View className="flex-row items-center gap-3">
                        <Feather name="user" size={16} color="#64748B" />
                        <Text className="text-[#64748B] text-xs font-semibold">Full Name</Text>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        <Text className="text-[#101828] text-xs font-black">{profile.name || 'Virral'}</Text>
                        <Feather name="chevron-right" size={14} color="#94A3B8" />
                      </View>
                    </TouchableOpacity>

                    {/* Mobile Number */}
                    <TouchableOpacity activeOpacity={0.6} onPress={() => setIsEditingProfile(true)} className="flex-row items-center justify-between py-1.5">
                      <View className="flex-row items-center gap-3">
                        <Feather name="phone" size={16} color="#64748B" />
                        <Text className="text-[#64748B] text-xs font-semibold">Mobile Number</Text>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        <Text className="text-[#101828] text-xs font-black">{profile.mobile || '919967720006'}</Text>
                        <Feather name="chevron-right" size={14} color="#94A3B8" />
                      </View>
                    </TouchableOpacity>

                    {/* Email address */}
                    <TouchableOpacity activeOpacity={0.6} onPress={() => setIsEditingProfile(true)} className="flex-row items-center justify-between py-1.5">
                      <View className="flex-row items-center gap-3">
                        <Feather name="mail" size={16} color="#64748B" />
                        <Text className="text-[#64748B] text-xs font-semibold">Email address</Text>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        <Text className="text-[#101828] text-xs font-black">{profile.email || 'Not provided'}</Text>
                        <Feather name="chevron-right" size={14} color="#94A3B8" />
                      </View>
                    </TouchableOpacity>

                    {/* Gender */}
                    <TouchableOpacity activeOpacity={0.6} onPress={() => setIsEditingProfile(true)} className="flex-row items-center justify-between py-1.5">
                      <View className="flex-row items-center gap-3">
                        <Ionicons name="male-female-outline" size={16} color="#64748B" />
                        <Text className="text-[#64748B] text-xs font-semibold">Gender</Text>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        <Text className="text-[#101828] text-xs font-black">{profile.gender || 'Male'}</Text>
                        <Feather name="chevron-right" size={14} color="#94A3B8" />
                      </View>
                    </TouchableOpacity>

                    {/* Date of Birth */}
                    <TouchableOpacity activeOpacity={0.6} onPress={() => setIsEditingProfile(true)} className="flex-row items-center justify-between py-1.5">
                      <View className="flex-row items-center gap-3">
                        <Feather name="calendar" size={16} color="#64748B" />
                        <Text className="text-[#64748B] text-xs font-semibold">Date of Birth</Text>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        <Text className="text-[#101828] text-xs font-black">{profile.dob || 'Not provided'}</Text>
                        <Feather name="chevron-right" size={14} color="#94A3B8" />
                      </View>
                    </TouchableOpacity>

                    {/* Height */}
                    <TouchableOpacity activeOpacity={0.6} onPress={() => setIsEditingProfile(true)} className="flex-row items-center justify-between py-1.5">
                      <View className="flex-row items-center gap-3">
                        <Ionicons name="resize-outline" size={16} color="#64748B" />
                        <Text className="text-[#64748B] text-xs font-semibold">Height</Text>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        <Text className="text-[#101828] text-xs font-black">
                          {profile.height ? (profile.height.includes('cm') ? profile.height : `${profile.height} cm`) : '189 cm'}
                        </Text>
                        <Feather name="chevron-right" size={14} color="#94A3B8" />
                      </View>
                    </TouchableOpacity>

                    {/* Weight */}
                    <TouchableOpacity activeOpacity={0.6} onPress={() => setIsEditingProfile(true)} className="flex-row items-center justify-between py-1.5">
                      <View className="flex-row items-center gap-3">
                        <Ionicons name="barbell-outline" size={16} color="#64748B" />
                        <Text className="text-[#64748B] text-xs font-semibold">Weight</Text>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        <Text className="text-[#101828] text-xs font-black">
                          {profile.weight ? (profile.weight.includes('kg') ? profile.weight : `${profile.weight} kg`) : '74 kg'}
                        </Text>
                        <Feather name="chevron-right" size={14} color="#94A3B8" />
                      </View>
                    </TouchableOpacity>

                    {/* Fitness Level */}
                    <TouchableOpacity activeOpacity={0.6} onPress={() => setIsEditingProfile(true)} className="flex-row items-center justify-between py-1.5">
                      <View className="flex-row items-center gap-3">
                        <Feather name="trending-up" size={16} color="#64748B" />
                        <Text className="text-[#64748B] text-xs font-semibold">Fitness Level</Text>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        <Text className="text-[#101828] text-xs font-black">{profile.fitnessLevel || 'Intermediate'}</Text>
                        <Feather name="chevron-right" size={14} color="#94A3B8" />
                      </View>
                    </TouchableOpacity>

                    {/* City */}
                    <TouchableOpacity activeOpacity={0.6} onPress={() => setIsEditingProfile(true)} className="flex-row items-center justify-between py-1.5">
                      <View className="flex-row items-center gap-3">
                        <Feather name="map-pin" size={16} color="#64748B" />
                        <Text className="text-[#64748B] text-xs font-semibold">City</Text>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        <Text className="text-[#101828] text-xs font-black">{profile.city || 'Bengaluru'}</Text>
                        <Feather name="chevron-right" size={14} color="#94A3B8" />
                      </View>
                    </TouchableOpacity>

                    {/* Member Since */}
                    <View className="flex-row items-center justify-between py-1.5">
                      <View className="flex-row items-center gap-3">
                        <Feather name="clock" size={16} color="#64748B" />
                        <Text className="text-[#64748B] text-xs font-semibold">Member Since</Text>
                      </View>
                      <Text className="text-[#101828] text-xs font-black pr-2">{profile.memberSince || 'Sep 2024'}</Text>
                    </View>

                    {/* Total Sessions Completed */}
                    <View className="flex-row items-center justify-between py-1.5">
                      <View className="flex-row items-center gap-3">
                        <Feather name="check-circle" size={16} color="#64748B" />
                        <Text className="text-[#64748B] text-xs font-semibold">Completed Sessions</Text>
                      </View>
                      <Text className="text-[#101828] text-xs font-black pr-2">{profile.totalSessions || 0} Sessions</Text>
                    </View>

                    {/* Total Calories Burned */}
                    <View className="flex-row items-center justify-between py-1.5">
                      <View className="flex-row items-center gap-3">
                        <Feather name="zap" size={16} color="#64748B" />
                        <Text className="text-[#64748B] text-xs font-semibold">Calories Burned</Text>
                      </View>
                      <Text className="text-[#101828] text-xs font-black pr-2">{(profile.totalCalories || 0).toLocaleString()} kcal</Text>
                    </View>

                    {/* Lifetime Spendings */}
                    <View className="flex-row items-center justify-between py-1.5">
                      <View className="flex-row items-center gap-3">
                        <Ionicons name="wallet-outline" size={16} color="#64748B" />
                        <Text className="text-[#64748B] text-xs font-semibold">Lifetime Spendings</Text>
                      </View>
                      <Text className="text-[#101828] text-xs font-black pr-2">{profile.lifetimeSpend || '₹0'}</Text>
                    </View>

                    {/* Bottom Collapse Toggle */}
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => togglePersonalInfoExpansion(false)}
                      className="flex-row items-center justify-center gap-2 py-2.5 mt-2 border-t border-zinc-100"
                    >
                      <Feather name="chevron-up" size={15} color="#4F46E5" />
                      <Text className="text-indigo-600 text-xs font-bold">Wrap / Collapse information</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* 2. Fitness Goals Card */}
              <View className="bg-white border border-[#E5E7EB] rounded-[24px] p-5 shadow-xs mb-4">
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-[#101828] text-sm font-black tracking-tight">Fitness Goals</Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => router.push('/fitness-goals' as any)}
                    className="flex-row items-center gap-1.5"
                  >
                    <Feather name="edit-2" size={12} color="#475569" />
                    <Text className="text-[#475569] text-xs font-bold">Edit</Text>
                  </TouchableOpacity>
                </View>

                {/* Goal Chips */}
                <View className="flex-row flex-wrap gap-2 mb-3.5">
                  {(Array.isArray(profile.selectedGoals) && profile.selectedGoals.length > 0
                    ? profile.selectedGoals
                    : ['Strength', 'Endurance', 'Weight Loss', 'Flexibility']
                  ).map((goal, idx) => (
                    <TouchableOpacity
                      key={`${goal}-${idx}`}
                      activeOpacity={0.8}
                      onPress={() => router.push('/fitness-goals' as any)}
                      className={
                        idx < 2
                          ? "bg-[#E6F4F1] border border-[#A7F3D0] px-3 py-1.5 rounded-full flex-row items-center gap-1"
                          : "bg-[#F1F5F9] border border-[#E2E8F0] px-3 py-1.5 rounded-full"
                      }
                    >
                      <Text className={idx < 2 ? "text-[#065F46] text-xs font-bold" : "text-[#475569] text-xs font-semibold"}>
                        {goal}
                      </Text>
                      {idx < 2 && <Feather name="arrow-up-right" size={12} color="#065F46" />}
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Motivational Banner */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => router.push('/fitness-goals' as any)}
                  className="bg-[#EDF7F2] border border-[#D1FAE5] rounded-2xl p-3.5 flex-row items-center justify-between"
                >
                  <View className="flex-row items-center gap-3 flex-1 pr-2">
                    <View className="w-8 h-8 rounded-full bg-[#D1FAE5] items-center justify-center">
                      <Feather name="target" size={16} color="#047857" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[#064E3B] text-xs font-black">Your fitness journey matters.</Text>
                      <Text className="text-[#047857] text-[11px] font-medium mt-0.5">
                        Let's set your goals for better results.
                      </Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={16} color="#047857" />
                </TouchableOpacity>
              </View>


              {/* Admin Control Panel direct entry button */}
              {(user?.role === 'admin' || isWildcardTestAccount(user, profile.mobile)) && (
                <View className="mb-4">
                  <LuxuryCard 
                    className="p-4 bg-indigo-950 border border-indigo-800 shadow-md rounded-[24px]"
                    onPress={() => router.push('/admin-panel' as any)}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-3">
                        <View className="w-9 h-9 rounded-xl bg-indigo-600 items-center justify-center">
                          <Feather name="shield" size={16} color="white" />
                        </View>
                        <View className="gap-0.5">
                          <Text className="text-indigo-300 text-[8px] font-black uppercase tracking-widest">Administrator Access</Text>
                          <Text className="text-white text-sm font-black tracking-tight">Open Admin Control Panel</Text>
                        </View>
                      </View>
                      <Feather name="chevron-right" size={16} color="#A5B4FC" />
                    </View>
                  </LuxuryCard>
                </View>
              )}

              {/* Become a Trainer Option */}
              {user?.role !== 'trainer' && !hasApplied && (
                <View className="mb-4">
                  <LuxuryCard 
                    className="p-5 bg-zinc-950 border border-zinc-800 shadow-md rounded-[24px]"
                    onPress={() => router.push('/trainer-application')}
                  >
                    <View className="gap-3">
                      <View className="flex-row items-center justify-between">
                        <View className="gap-0.5">
                          <Text className="text-[#E11D48] text-[8px] font-black uppercase tracking-widest">Join our team</Text>
                          <Text className="text-white text-sm font-black tracking-tight">Become a VIRLA Trainer</Text>
                        </View>
                        <View className="w-7 h-7 rounded-full bg-[#E11D48] items-center justify-center shadow-md">
                          <Feather name="arrow-right" size={12} color="white" />
                        </View>
                      </View>

                      <Text className="text-zinc-400 text-xs font-semibold leading-relaxed">
                        Train on your schedule. Grow your client base. Keep more of what you earn.
                      </Text>
                    </View>
                  </LuxuryCard>
                </View>
              )}

              {/* Trainer Application Tracker */}
              {user?.role !== 'trainer' && hasApplied && userApplication && (
                <View className="mb-4">
                  <LuxuryCard 
                    className={`p-4 border rounded-[24px] ${
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
                      </View>
                      <Feather name="chevron-right" size={18} color="#6B7280" />
                    </View>
                  </LuxuryCard>
                </View>
              )}
            </>
          )}

          {/* =============================================================== */}
          {/* ======================= TRAINER PROFILE ======================= */}
          {/* =============================================================== */}
          {activeRole === 'trainer' && (
            <>
              {/* Trainer Profile Header Summary Card */}
              <View className="items-center mb-6">
                <Image
                  source={{ uri: coach?.avatar || user?.avatar || 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=150&q=80' }}
                  className="w-20 h-20 rounded-full border-2 border-[#E11D48] mb-3 shadow-lg"
                />
                <Text className="text-[#101828] text-2xl font-black tracking-tight">{coach?.name || user?.name || 'User'}</Text>
                <Text className="text-[#6B7280] text-xs font-semibold mt-0.5">
                  {coach?.level || 'Associate'} • {coach?.specialty || 'General Training'}
                </Text>
                <Text className="text-[#E11D48] text-[9px] font-black uppercase tracking-widest mt-2 border border-[#E11D48]/35 px-3 py-1 rounded-full bg-[#E11D48]/5">
                  Trainer ID: VIRLA-PRO-{(coach?.id || 'PRO-DEMO').slice(-6).toUpperCase()}
                </Text>

                {/* Go to Client Mode Button */}
                {isWildcardTestAccount(user, profile?.mobile) && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => handleRoleChange('customer')}
                    className="mt-3 bg-zinc-900 border border-zinc-700 px-4 py-2 rounded-xl flex-row items-center gap-2 shadow-sm"
                  >
                    <Feather name="repeat" size={12} color="#E11D48" />
                    <Text className="text-white text-xs font-black uppercase tracking-wider">
                      Go to Client Mode
                    </Text>
                  </TouchableOpacity>
                )}
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
                    const assignments = coach?.id ? Database.getWorkoutAssignments(coach.id) : [];
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
                            {coach?.specialization || 'Strength & Conditioning'}
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
                        {coach?.preferences?.operatingAddress || 'Operating Base Not Configured'}
                      </Text>
                      <Text className="text-zinc-450 text-[8px] font-semibold mt-1">
                        📍 Permanent check-in dispatch address
                      </Text>
                    </View>

                    <View className="flex-row justify-between py-1 border-b border-zinc-50 pb-2">
                      <Text className="text-zinc-400 text-xs font-semibold">Service Radius</Text>
                      <Text className="text-zinc-950 text-xs font-black">
                        {coach?.preferences?.radiusKm ? `${coach.preferences.radiusKm} km` : '15 km'}
                      </Text>
                    </View>

                    <View className="flex-row justify-between py-1 border-b border-zinc-50 pb-2">
                      <Text className="text-zinc-400 text-xs font-semibold">Operating Verification status</Text>
                      <View className={`px-2 py-0.5 rounded-full ${
                        coach?.preferences?.operatingLocationStatus === 'verified' 
                          ? 'bg-green-50 border border-green-150' 
                          : coach?.preferences?.operatingLocationStatus === 'rejected'
                          ? 'bg-rose-50 border border-rose-150'
                          : 'bg-amber-50 border border-amber-150'
                      }`}>
                        <Text className={`text-[8px] font-black uppercase ${
                          coach?.preferences?.operatingLocationStatus === 'verified'
                            ? 'text-green-600'
                            : coach?.preferences?.operatingLocationStatus === 'rejected'
                            ? 'text-rose-600'
                            : 'text-amber-600'
                        }`}>
                          {coach?.preferences?.operatingLocationStatus === 'verified' ? 'Verified' : coach?.preferences?.operatingLocationStatus === 'rejected' ? 'Rejected' : 'Pending Review'}
                        </Text>
                      </View>
                    </View>

                    {coach?.preferences?.addressChangeRequest && (
                      <View className="bg-amber-50 border border-amber-250 p-3 rounded-xl gap-1">
                        <Text className="text-amber-800 text-[9px] font-black uppercase tracking-wider">Pending Change Request</Text>
                        <Text className="text-zinc-900 text-xs font-black">
                          Change to: {coach?.preferences?.addressChangeRequest?.requestedAddress} ({coach?.preferences?.addressChangeRequest?.requestedRadius} km)
                        </Text>
                        <Text className="text-zinc-400 text-[8px] font-semibold mt-0.5">Submitted, waiting for verification approval.</Text>
                      </View>
                    )}

                    {!coach?.preferences?.addressChangeRequest && !showAddressForm && (
                      <TouchableOpacity
                        onPress={() => {
                          setAddressInput(coach?.preferences?.operatingAddress || '');
                          setRadiusInput((coach?.preferences?.radiusKm as 10 | 15) || 15);
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
                                <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">{formatToDDMMYYYY(earn.date)}</Text>
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
                                className={`px-3 py-1.5 border rounded-lg flex-row items-center gap-1.5 ${
                                  disputeCategory === cat ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-zinc-200'
                                }`}
                              >
                                {disputeCategory === cat && (
                                  <Feather name="check" size={10} color="white" />
                                )}
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
                              <Text className="text-zinc-450 text-[8px] font-semibold mt-1">Submitted: {formatToDDMMYYYY(d.date)}</Text>
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
                        <Text className="text-zinc-955 text-xs font-black uppercase">Select quantities</Text>
                        
                        <View className="gap-3.5">
                          {['T-shirt', 'Towel', 'Duffel Bag', 'Water Bottle'].map((item) => (
                            <View key={item} className="flex-row items-center justify-between border-b border-zinc-100 pb-2">
                              <Text className="text-zinc-750 text-xs font-bold">{item}</Text>
                              <View className="flex-row items-center gap-3">
                                <TouchableOpacity 
                                  onPress={() => {
                                    const current = kitQuantities[item] || 0;
                                    if (current > 0) {
                                      setKitQuantities({ ...kitQuantities, [item]: current - 1 });
                                    }
                                  }}
                                  className="w-6 h-6 bg-zinc-100 border border-zinc-200 rounded-lg justify-center items-center"
                                >
                                  <Feather name="minus" size={10} color="#374151" />
                                </TouchableOpacity>
                                <Text className="text-zinc-950 text-xs font-black w-6 text-center">{kitQuantities[item] || 0}</Text>
                                <TouchableOpacity 
                                  onPress={() => {
                                    const current = kitQuantities[item] || 0;
                                    setKitQuantities({ ...kitQuantities, [item]: current + 1 });
                                  }}
                                  className="w-6 h-6 bg-zinc-100 border border-zinc-200 rounded-lg justify-center items-center"
                                >
                                  <Feather name="plus" size={10} color="#374151" />
                                </TouchableOpacity>
                              </View>
                            </View>
                          ))}

                          {kitQuantities['T-shirt'] > 0 && (
                            <View className="gap-2 mt-1 bg-rose-50/40 border border-rose-100/60 p-3 rounded-xl">
                              <Text className="text-[#E11D48] text-[8px] font-black uppercase tracking-wider">Select T-Shirt Size (*one size per order)</Text>
                              <View className="flex-row gap-1.5 mt-1">
                                {(['S', 'M', 'L', 'XL', 'XXL'] as const).map((sz) => (
                                  <TouchableOpacity
                                    key={sz}
                                    onPress={() => setSelectedTshirtSize(sz)}
                                    className={`flex-1 py-1.5 border rounded-lg items-center ${
                                      selectedTshirtSize === sz ? 'bg-zinc-950 border-zinc-950' : 'bg-white border-zinc-200'
                                    }`}
                                  >
                                    <Text className={`text-[9px] font-black ${selectedTshirtSize === sz ? 'text-white' : 'text-zinc-500'}`}>{sz}</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            </View>
                          )}
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
                        <View className="gap-3.5">
                          {kitRequestsList.map((item) => (
                            <View key={item.id} className="bg-zinc-50 border border-zinc-150 p-4 rounded-xl gap-2">
                              <View className="flex-row justify-between items-center">
                                <Text className="text-zinc-955 text-[10px] font-black uppercase">Order ID: {item.order_id || item.id}</Text>
                                <View className={`px-2 py-0.5 rounded-md ${
                                  item.status === 'SUBMITTED' ? 'bg-rose-50 border border-rose-100' :
                                  item.status === 'UNDER REVIEW' ? 'bg-amber-50 border border-amber-100' :
                                  item.status === 'APPROVED' || item.status === 'DELIVERED' ? 'bg-emerald-50 border border-emerald-100' :
                                  'bg-zinc-100 border border-zinc-200'
                                }`}>
                                  <Text className={`text-[8px] font-black uppercase ${
                                    item.status === 'SUBMITTED' ? 'text-rose-600' :
                                    item.status === 'UNDER REVIEW' ? 'text-amber-600' :
                                    item.status === 'APPROVED' || item.status === 'DELIVERED' ? 'text-emerald-600' :
                                    'text-zinc-650'
                                  }`}>
                                    {item.status}
                                  </Text>
                                </View>
                              </View>
                              <View className="border-t border-zinc-150 pt-2 mt-1">
                                <Text className="text-zinc-450 text-[8px] font-black uppercase mb-1">Items & Quantities</Text>
                                <Text className="text-zinc-800 text-xs font-semibold leading-relaxed">
                                  {typeof item.items === 'object' && item.items !== null
                                    ? Object.keys(item.items).map(k => `${k} × ${item.items[k]}`).join(', ')
                                    : Array.isArray(item.items) ? item.items.join(', ') : JSON.stringify(item.items)}
                                  {item.tshirt_size ? ` (Size: ${item.tshirt_size})` : ''}
                                </Text>
                              </View>
                              <View className="flex-row justify-between mt-1">
                                <Text className="text-zinc-450 text-[9px] font-bold uppercase">Requested Date</Text>
                                <Text className="text-zinc-800 text-[9px] font-extrabold">{formatToDDMMYYYY(item.created_at)}</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text className="text-zinc-400 text-[10px] text-center py-4 bg-zinc-50 border border-zinc-150 rounded-2xl">No partner brand kit requests logged.</Text>
                      )}
                    </View>
                  </View>
                </AccordionCard>

                {/* 9. Compact Expandable Credit Wallet Accordion */}
                <AccordionCard
                  title="Credit Wallet"
                  icon="credit-card"
                  rightText={`${creditBalance} Credits`}
                  expanded={expandedSection === 'wallet'}
                  onToggle={() => setExpandedSection(expandedSection === 'wallet' ? null : 'wallet')}
                >
                  <View className="gap-3.5">
                    <View className="flex-row justify-between items-center py-2 border-b border-zinc-100">
                      <Text className="text-zinc-550 text-xs font-bold">Available Balance</Text>
                      <Text className="text-zinc-950 text-base font-black">{creditBalance} Credits</Text>
                    </View>

                    <View className="gap-2.5 mt-2">
                      <Text className="text-zinc-950 text-[10px] font-black uppercase tracking-wider">Credit Lot Breakdown</Text>
                      {creditLots && creditLots.filter(l => l.remaining_credits > 0).length > 0 ? (
                        creditLots.filter(l => l.remaining_credits > 0).map((l, index) => (
                          <View key={l.id || index} className="flex-row justify-between items-center bg-zinc-50 border border-zinc-150 p-3 rounded-xl">
                            <Text className="text-zinc-700 text-xs font-bold">{l.remaining_credits} Credits</Text>
                            <Text className="text-zinc-500 text-[10px] font-semibold">Expires {formatToDDMMYYYY(l.official_expiry_date)}</Text>
                          </View>
                        ))
                      ) : (
                        <Text className="text-zinc-400 text-[10px] italic">No active credit lots available.</Text>
                      )}
                    </View>

                    <TouchableOpacity
                      onPress={() => router.push('/wallet' as any)}
                      className="bg-indigo-600 py-3 rounded-xl items-center justify-center mt-4 shadow-sm"
                    >
                      <Text className="text-white text-xs font-black uppercase tracking-wider">Open Wallet Options</Text>
                    </TouchableOpacity>
                  </View>
                </AccordionCard>

              </View>
            </>
          )}

          {/* Sign Out button */}
          <TouchableOpacity
            onPress={handleLogout}
            activeOpacity={0.8}
            className="bg-red-50 border border-red-200/50 px-8 py-3.5 rounded-xl flex-row justify-center items-center self-center mt-6 mb-24 gap-2"
          >
            <Feather name="log-out" size={15} color="#EF4444" style={{ transform: [{ rotate: '-90deg' }] }} />
            <Text className="text-red-600 text-xs font-black uppercase tracking-widest">Sign Out</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      <SignOutConfirmationModal
        visible={isSignOutModalVisible}
        onClose={() => setIsSignOutModalVisible(false)}
        onConfirm={confirmLogout}
      />

      {/* Edit Personal Information Modal */}
      <Modal
        visible={isEditingProfile}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditingProfile(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-end bg-black/60"
        >
          <View className="bg-white rounded-t-[32px] p-6 max-h-[88%] shadow-2xl">
            <View className="flex-row justify-between items-center pb-3.5 border-b border-zinc-100">
              <Text className="text-[#101828] text-base font-black">Edit Personal Information</Text>
              <TouchableOpacity 
                onPress={() => setIsEditingProfile(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 items-center justify-center"
              >
                <Feather name="x" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="mt-4">
              <View className="gap-3.5 pb-4">
                {[
                  { l: 'Full Name', val: editName, set: setEditName },
                  { l: 'Mobile Number', val: editMobile, set: setEditMobile, kt: 'phone-pad' as const },
                  { l: 'Email address', val: editEmail, set: setEditEmail, kt: 'email-address' as const },
                  { l: 'Gender', val: editGender, set: setEditGender },
                  { l: 'Date of Birth', val: editDob, set: setEditDob },
                  { l: 'Height (e.g. 189 cm)', val: editHeight, set: setEditHeight },
                  { l: 'Weight (e.g. 74 kg)', val: editWeight, set: setEditWeight },
                  { l: 'Fitness Level', val: editFitnessLevel, set: setEditFitnessLevel },
                  { l: 'City', val: editCity, set: setEditCity },
                ].map((f, idx) => (
                  <View key={idx} className="gap-1">
                    <Text className="text-zinc-500 text-[9px] font-black uppercase tracking-wider">{f.l}</Text>
                    <TextInput
                      value={f.val}
                      onChangeText={f.set}
                      keyboardType={f.kt}
                      className="border border-[#E5E7EB] bg-[#F8F9FA] p-3 rounded-xl text-xs text-zinc-900 font-semibold"
                    />
                  </View>
                ))}
              </View>
            </ScrollView>

            <View className="flex-row gap-3 pt-3 border-t border-zinc-100">
              <TouchableOpacity
                onPress={() => setIsEditingProfile(false)}
                className="flex-1 py-3.5 rounded-xl border border-zinc-200 items-center justify-center"
              >
                <Text className="text-zinc-600 text-xs font-black uppercase tracking-wider">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveProfile}
                className="flex-1 py-3.5 rounded-xl bg-[#101828] items-center justify-center shadow-sm"
              >
                <Text className="text-white text-xs font-black uppercase tracking-wider">Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>


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
  rightText?: string;
}

function AccordionCard({ title, icon, expanded, onToggle, children, rightText }: AccordionCardProps) {
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
        <View className="flex-row items-center gap-3.5 flex-1">
          <View className="w-8 h-8 rounded-xl bg-indigo-50 justify-center items-center">
            <Feather name={icon as any} size={15} color="#4F46E5" />
          </View>
          <Text className="text-zinc-955 text-xs font-black uppercase tracking-wider">{title}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          {rightText && (
            <Text className="text-zinc-450 text-xs font-black tracking-wide">{rightText}</Text>
          )}
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#6B7280" />
        </View>
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
