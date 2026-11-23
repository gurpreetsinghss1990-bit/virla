import AnimatedReanimated from 'react-native-reanimated';
import { Loading } from '../../components/Loading';
import {
  ClientProfileView,
  ClientEditProfileSheet,
  InitialProfileSnapshot,
  getDefaultAvatarForGender,
} from '../../components/ClientProfileView';
import { FitnessGoalsModal } from '../../components/FitnessGoalsModal';
import { NativeAlertDialog } from '../../components/NativeAlertDialog';
import { NativeSingleChoiceDialog } from '../../components/NativeSingleChoiceDialog';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, TextInput, Alert, Platform, KeyboardAvoidingView, BackHandler, Pressable, StyleSheet } from 'react-native';
import { InteractionManager } from '../../utils/interactionManager';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Svg, { Path, Defs, LinearGradient, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useUserStore } from '../../store/userStore';
import { useMembershipStore } from '../../store/membershipStore';
import { useCoachStore } from '../../store/coachStore';
import { useWalletStore } from '../../store/walletStore';
import { useUserProfileStore } from '../../store/userProfileStore';
import { Database, TrainerApplication } from '../../database/Database';
import { syncAllDomainStores } from '../../store/syncAllStores';
import { AutocompleteSuggestion, fetchGooglePlacesAutocomplete, fetchGooglePlaceDetails, isValidServiceCoord, reverseGeocodeCoords, trainerServiceRadiusKm } from '../../utils/distance';
import { SignOutConfirmationModal } from '../../components/SignOutConfirmationModal';
import * as Location from 'expo-location';
import { requestForegroundLocationWithDisclosure } from '../../utils/locationDisclosure';
import * as ImagePicker from 'expo-image-picker';
import { formatToDDMMYYYY } from '../../utils/date';
import { Image as ExpoImage } from 'expo-image';
import { resolveAvatarSource } from '../../components/AvatarImage';
import { uploadAvatarToStorage } from '../../utils/uploadAvatar';
import { digitsOnly, cleanEmail, cleanIfsc, cleanUpi, isValidPhone, isValidEmail, isValidIfsc, isValidUpi } from '../../utils/inputSafety';

const ALL_FITNESS_GOALS = [
  'Weight Loss',
  'Fat Loss',
  'Muscle Gain',
  'Body Recomposition',
  'Strength',
  'Flexibility',
  'Mobility',
  'Sports Training',
  'Senior Fitness',
  'Post Pregnancy',
  'Rehabilitation',
  'General Fitness',
  'Maintain Weight',
];

export { getDefaultAvatarForGender };

type TrainerSectionType = 'profile' | 'workout' | 'operating' | 'availability' | 'banking' | 'support' | 'safety' | 'kit' | 'wallet';

const CATEGORY_DISPLAY_MAP: Record<string, string> = {
  'Strength': 'Strength Training',
  'Mind & Body': 'Yoga',
  'Cardio': 'Dance Fitness',
  'Conditioning': 'Stretching',
  'Boxing': 'Boxing',
  'Aerial Yoga': 'Aerial Yoga',
  'Pilates': 'Pilates',
  'All Workouts': 'All Workouts'
};

const DB_CATEGORIES = [
  { key: 'Strength', display: 'Strength Training' },
  { key: 'Mind & Body', display: 'Yoga' },
  { key: 'Cardio', display: 'Dance Fitness' },
  { key: 'Conditioning', display: 'Stretching' },
  { key: 'Boxing', display: 'Boxing' },
  { key: 'Aerial Yoga', display: 'Aerial Yoga' },
  { key: 'Pilates', display: 'Pilates' }
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

  const roleChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRoleChange = useCallback((newRole: 'customer' | 'trainer' | 'admin') => {
    setActiveRole(newRole);
    InteractionManager.runAfterInteractions(() => {
      if (roleChangeTimerRef.current) clearTimeout(roleChangeTimerRef.current);
      roleChangeTimerRef.current = setTimeout(() => {
        setRole(newRole);
      }, 100);
    });
  }, [setRole]);
  const { membership } = useMembershipStore();
  const { totalEarnings, earningsList } = useCoachStore();
  const { ledger, creditBalance, creditLots, syncFromDB: syncWallet } = useWalletStore();
  const profile = useUserProfileStore();
  const [isSignOutModalVisible, setIsSignOutModalVisible] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [profileSavedAlertVisible, setProfileSavedAlertVisible] = useState(false);

  const handleLogout = useCallback(() => {
    setIsSignOutModalVisible(true);
  }, []);

  const confirmLogout = useCallback(() => {
    setLoggedIn(false);
    router.replace('/get-started' as any);
  }, [setLoggedIn, router]);

  const closeSignOutModal = useCallback(() => {
    setIsSignOutModalVisible(false);
  }, []);

  const [hasApplied, setHasApplied] = useState(false);
  const [userApplication, setUserApplication] = useState<TrainerApplication | null>(null);

  // Navigation Throttle to prevent duplicate screen pushes on double tap
  const isNavigatingRef = useRef(false);
  const navThrottleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigateThrottled = useCallback((path: string) => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    router.push(path as any);
    if (navThrottleTimerRef.current) clearTimeout(navThrottleTimerRef.current);
    navThrottleTimerRef.current = setTimeout(() => {
      isNavigatingRef.current = false;
    }, 1000);
  }, [router]);

  useEffect(() => {
    return () => {
      if (roleChangeTimerRef.current) clearTimeout(roleChangeTimerRef.current);
      if (navThrottleTimerRef.current) clearTimeout(navThrottleTimerRef.current);
    };
  }, []);

  const checkApplicationStatus = async () => {
    const userPhone = profile.mobile;
    if (userPhone) {
      try {
        const userApp = await Database.fetchTrainerApplicationByPhone(userPhone);
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
    const timer = setTimeout(() => {
      checkApplicationStatus();
    }, 0);
    return () => clearTimeout(timer);
  }, [profile.mobile]);

  // Client Profile Edit modal visibility (form state isolated inside ClientEditProfileSheet)
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const openEditProfileModal = useCallback(() => {
    setIsEditingProfile(true);
  }, []);

  const closeEditProfileModal = useCallback(() => {
    setIsEditingProfile(false);
  }, []);

  const [isPersonalInfoExpanded, setIsPersonalInfoExpanded] = useState(false);

  const togglePersonalInfoExpansion = useCallback((targetState?: boolean) => {
    setIsPersonalInfoExpanded(prev => (typeof targetState === 'boolean' ? targetState : !prev));
  }, []);

  const [isGoalsModalVisible, setIsGoalsModalVisible] = useState(false);
  const closeGoalsModal = useCallback(() => setIsGoalsModalVisible(false), []);
  const closeProfileSavedAlert = useCallback(() => setProfileSavedAlertVisible(false), []);

  const initialProfileSnapshot: InitialProfileSnapshot = useMemo(() => ({
    name: profile.name || '',
    mobile: profile.mobile || '',
    email: profile.email || '',
    gender: profile.gender || '',
    dob: profile.dob || '',
    height: profile.height || '',
    weight: profile.weight || '',
    fitnessLevel: profile.fitnessLevel || '',
    targetGoal: profile.targetGoal || '',
    preferredLanguage: profile.preferredLanguage || '',
    city: profile.city || '',
    avatar: profile.avatar || user?.avatar || '',
    userId: user?.id,
  }), [
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
    profile.city,
    profile.avatar,
    user?.avatar,
    user?.id,
  ]);

  const handleUpdateCoreProfile = useCallback(async (payload: any) => {
    await profile.updateCoreProfile(payload);
    useUserStore.getState().syncFromDB();
  }, [profile.updateCoreProfile]);

  const handleSaveProfileSuccess = useCallback(() => {
    setProfileSavedAlertVisible(true);
  }, []);

  const [isUploadingTrainerPhoto, setIsUploadingTrainerPhoto] = useState(false);
  const [showTrainerPhotoDialog, setShowTrainerPhotoDialog] = useState(false);

  const handlePickTrainerAvatar = () => {
    if (!coach?.id || isUploadingTrainerPhoto) return;
    setShowTrainerPhotoDialog(true);
  };

  const executeTrainerPhotoOption = async (option: string) => {
    setShowTrainerPhotoDialog(false);
    if (option === 'Take Photo') {
      try {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Camera access is needed to capture your profile photo.');
          return;
        }
        const res = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.5,
        });
        if (!res.canceled && res.assets?.[0]?.uri) {
          await saveTrainerPhoto(res.assets[0].uri);
        }
      } catch (e: any) {
        console.warn('[TrainerPhotoPicker] Camera Error:', e);
        Alert.alert('Picker Error', 'Unable to capture photo. Please try again.');
      }
    } else if (option === 'Choose from Gallery') {
      try {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Gallery access is needed to select your profile photo.');
          return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.5,
        });
        if (!res.canceled && res.assets?.[0]?.uri) {
          await saveTrainerPhoto(res.assets[0].uri);
        }
      } catch (e: any) {
        console.warn('[TrainerPhotoPicker] Gallery Error:', e);
        Alert.alert('Picker Error', 'Unable to pick photo. Please try again.');
      }
    }
  };

  const saveTrainerPhoto = async (photoUri: string) => {
    if (!coach?.id) return;
    try {
      setIsUploadingTrainerPhoto(true);
      const publicUrl = await uploadAvatarToStorage(photoUri, coach.id, 'trainers');
      await Database.updateCoach(coach.id, { photo: publicUrl });
      if (user?.id) {
        await profile.updateCoreProfile({ avatar: publicUrl });
      }
      useCoachStore.getState().syncFromDB();
      Alert.alert('Success', 'Trainer profile photo updated successfully.');
    } catch (err: any) {
      console.error('[SaveTrainerPhoto] Error:', err);
      Alert.alert('Error', err.message || 'Failed to update trainer profile photo.');
    } finally {
      setIsUploadingTrainerPhoto(false);
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
  // Intercept back press so it closes panels/modals first only when Profile is focused.
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (isSignOutModalVisible) {
          setIsSignOutModalVisible(false);
          return true;
        }
        if (isEditingProfile) {
          closeEditProfileModal();
          return true;
        }
        if (isEditingTrainer) {
          setIsEditingTrainer(false);
          return true;
        }
        // Modals closed: return false so Tabs layout BackHandler navigates to previous tab
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [isSignOutModalVisible, isEditingProfile, isEditingTrainer, closeEditProfileModal])
  );
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
  const [radiusInput, setRadiusInput] = useState<number>(5);
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
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);
  const [showAllDisputes, setShowAllDisputes] = useState(false);

  // Kit Request States
  const [showKitForm, setShowKitForm] = useState(false);
  const [selectedTshirtSize, setSelectedTshirtSize] = useState<'S' | 'M' | 'L' | 'XL' | 'XXL' | null>(null);
  const [kitQuantities, setKitQuantities] = useState<{ [item: string]: number }>({ 'T-shirt': 0, 'Towel': 0, 'Duffel Bag': 0, 'Water Bottle': 0 });
  const [kitRequestsList, setKitRequestsList] = useState<any[]>([]);
  const [isSubmittingKit, setIsSubmittingKit] = useState(false);
  const [showAllKits, setShowAllKits] = useState(false);

  const profileSyncInFlightRef = useRef(false);

  // Reload disputes and kit requests on user load
  const reloadDynamicLists = async () => {
    if (!coach) return;
    const [disputes, kits] = await Promise.all([
      Database.fetchClientDisputes(coach.id),
      Database.fetchKitRequests(coach.id),
    ]);
    setDisputesList(disputes);
    setKitRequestsList(kits);
  };

  useFocusEffect(
    useCallback(() => {
      // Run all sync operations asynchronously after tab transition so switching tabs is instant
      let focusTimer: ReturnType<typeof setTimeout> | null = null;
      const task = InteractionManager.runAfterInteractions(() => {
        focusTimer = setTimeout(() => {
          const storedUser = useUserStore.getState().user;
          const isLoggedIn = useUserStore.getState().isLoggedIn;
          if (isLoggedIn && storedUser && storedUser.id) {
            Database.setCurrentUserId(storedUser.id);
          }

          useUserStore.getState().syncFromDB();
          useMembershipStore.getState().syncFromDB();
          useWalletStore.getState().syncFromDB();
          const cachedCoach = Database.schema?.coaches?.find((c: any) => c.name === user.name || c.id === user.id);
          if (cachedCoach) {
            setTrainerName(cachedCoach.name || '');
            setTrainerGender(cachedCoach.gender || '');
            setTrainerBio(cachedCoach.shortBio || '');
          }

          if (!Database.getIsLoaded()) {
            if (profileSyncInFlightRef.current) return;
            profileSyncInFlightRef.current = true;
            Database.load().then(async () => {
              const currentUid = storedUser?.id || Database.getCurrentUserId();
              if (currentUid) {
                await Database.refreshUserData(currentUid);
              }
              syncAllDomainStores();
              useUserStore.getState().syncFromDB();
              useMembershipStore.getState().syncFromDB();
              await reloadDynamicLists();
              const latestCoach = Database.schema?.coaches?.find((c: any) => c.name === user.name || c.id === user.id);
              if (latestCoach) {
                setTrainerName(latestCoach.name || '');
                setTrainerGender(latestCoach.gender || '');
                setTrainerBio(latestCoach.shortBio || '');
              }
            }).catch((err) => {
              console.warn('[Profile Tab] Background database sync warning:', err);
            }).finally(() => {
              profileSyncInFlightRef.current = false;
            });
          }
        }, 0);
      });

      return () => {
        task.cancel();
        if (focusTimer) clearTimeout(focusTimer);
      };
    }, [user.name, user.id])
  );

  useEffect(() => {
    if (coach?.id) {
      reloadDynamicLists().catch((err) => {
        console.warn('[Profile] Initial dispute/kit load failed:', err);
      });
    }
  }, []);

  useEffect(() => {
    if (!showAddressForm) return;
    const timer = setTimeout(() => {
      setLocationSessionToken(Math.random().toString(36).substring(2, 15) + Date.now().toString());
    }, 0);
    return () => clearTimeout(timer);
  }, [showAddressForm]);

  // Places search autocomplete
  useEffect(() => {
    if (addressInput.trim().length < 3) {
      const clearTimer = setTimeout(() => {
        setSearchSuggestions([]);
      }, 0);
      return () => clearTimeout(clearTimer);
    }
    let active = true;
    const controller = new AbortController();
    const delayDebounceFn = setTimeout(async () => {
      setIsSearchingLocation(true);
      try {
        const suggestions = await fetchGooglePlacesAutocomplete(addressInput, locationSessionToken, controller.signal);
        if (active) {
          setSearchSuggestions(suggestions);
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') console.warn(err);
      } finally {
        if (active) {
          setIsSearchingLocation(false);
        }
      }
    }, 350);
    return () => {
      active = false;
      controller.abort();
      clearTimeout(delayDebounceFn);
    };
  }, [addressInput, locationSessionToken]);

  const handleUseCurrentLocation = async () => {
    setIsSearchingLocation(true);
    try {
      const { status } = await requestForegroundLocationWithDisclosure(
        'VIRLA uses your location while the app is in use to set your service area and address.'
      );
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
      const details = await fetchGooglePlaceDetails(item.placeId);
      if (!isValidServiceCoord(details.latitude, details.longitude)) {
        throw new Error('Is address ke sahi coordinates nahi mile. Dobara try karein.');
      }
      setSelectedLocation({
        address: details.address || item.description,
        lat: details.latitude,
        lng: details.longitude,
        placeId: item.placeId,
      });
    } catch (err) {
      console.warn('[Profile] Place details lookup failed:', err);
      Alert.alert('Location Fetch Failed', 'Is address ke coordinates nahi mil paye. Dobara try karein.');
      setSelectedLocation(null as any);
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
    if (trainerEmail.trim() && !isValidEmail(trainerEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (bankAccNumber.trim() && bankAccNumber.trim().length < 6) {
      Alert.alert('Invalid Account Number', 'Please enter a valid bank account number.');
      return;
    }
    if (bankIfscStr.trim() && !isValidIfsc(bankIfscStr)) {
      Alert.alert('Invalid IFSC', 'IFSC code 11 characters ka hota hai, jaise HDFC0000060.');
      return;
    }
    if (bankUpiIdStr.trim() && !isValidUpi(bankUpiIdStr)) {
      Alert.alert('Invalid UPI ID', 'UPI ID ka format galat hai, jaise naam@okhdfc.');
      return;
    }
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
    if (!coach || !disputeDescription || isSubmittingDispute) return;
    setIsSubmittingDispute(true);
    try {
      await Database.addClientDispute(coach.id, {
        category: disputeCategory,
        description: disputeDescription,
        bookingId: disputeBookingId
      });
    } catch (e: any) {
      setIsSubmittingDispute(false);
      Alert.alert('Ticket Not Submitted', e?.message || 'Failed to submit dispute ticket. Please try again.');
      return;
    }
    setIsSubmittingDispute(false);
    setDisputeDescription('');
    setDisputeBookingId('');
    setShowDisputeForm(false);
    Alert.alert('Ticket Submitted', 'Our support team will review this case and reply within 24 hours.');
    // Refresh is best-effort: the ticket already exists server-side, so a failed
    // reload must never be reported as a failed submission.
    try {
      await reloadDynamicLists();
    } catch (err) {
      console.warn('[Profile] Dispute list refresh failed:', err);
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

    if (isSubmittingKit) return;
    setIsSubmittingKit(true);
    try {
      await Database.addKitRequest(coach.id, {
        items: itemsList,
        size: kitQuantities['T-shirt'] > 0 ? selectedTshirtSize : null
      });
    } catch (e: any) {
      setIsSubmittingKit(false);
      Alert.alert('Request Not Submitted', e?.message || 'Failed to submit kit request. Please try again.');
      return;
    }
    setIsSubmittingKit(false);
    setShowKitForm(false);
    setKitQuantities({ 'T-shirt': 0, 'Towel': 0, 'Duffel Bag': 0, 'Water Bottle': 0 });
    setSelectedTshirtSize(null);
    Alert.alert('Kit Requested', 'Brand kit request submitted successfully.');
    try {
      await reloadDynamicLists();
    } catch (err) {
      console.warn('[Profile] Kit list refresh failed:', err);
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
        <View className="flex-1 relative bg-[#F8F9FC]">
          {/* Botanical background atmosphere matching Stitch code.html (.bg-leaf-pattern) */}
          {activeRole !== 'trainer' && (
            <>
              {/* Botanical Green Wash & Amber Ambient Aura */}
              <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 460, zIndex: 0, overflow: 'hidden' }}>
                <Svg width="100%" height={460}>
                  <Defs>
                    {/* Top Right Botanical Green Wash from code.html */}
                    <RadialGradient id="topRightMint" cx="90%" cy="8%" rx="65%" ry="65%">
                      <Stop offset="0%" stopColor="#A7F3D0" stopOpacity={0.9} />
                      <Stop offset="35%" stopColor="#D1FAE5" stopOpacity={0.6} />
                      <Stop offset="70%" stopColor="#E6F4EA" stopOpacity={0.25} />
                      <Stop offset="100%" stopColor="#F8F9FC" stopOpacity={0} />
                    </RadialGradient>
                  </Defs>
                  <Rect width="100%" height={460} fill="url(#topRightMint)" />
                </Svg>
              </View>

              {/* High-intensity Botanical Vine & Leaves Illustration from Stitch code.html */}
              <View pointerEvents="none" style={{ position: 'absolute', top: -5, right: -10, width: 270, height: 320, opacity: 0.92, zIndex: 0 }}>
                <Svg width="270" height="320" viewBox="0 0 200 250" fill="none">
                  <Defs>
                    <LinearGradient id="stitchLeafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <Stop offset="0%" stopColor="#10B981" stopOpacity={0.95} />
                      <Stop offset="100%" stopColor="#059669" stopOpacity="0.85" />
                    </LinearGradient>
                  </Defs>
                  <Path 
                    d="M180,-10 C160,30 140,50 110,65 C135,70 160,60 175,45 C150,80 120,95 85,100 C115,110 145,105 165,85 C135,120 100,135 60,140 C85,155 125,150 145,130 C110,165 75,175 35,178 C65,190 100,185 120,165 C85,200 45,210 5,215 C40,225 75,220 95,200 C60,230 20,240 -10,245" 
                    stroke="#059669" 
                    strokeDasharray="1.5,2.5" 
                    strokeWidth="2" 
                  />
                  <Path d="M135,35 C155,20 175,25 185,45 C170,55 150,50 135,35 Z" fill="url(#stitchLeafGrad)" opacity={0.9} />
                  <Path d="M105,75 C130,60 150,68 160,90 C140,98 120,92 105,75 Z" fill="url(#stitchLeafGrad)" opacity={0.88} />
                  <Path d="M80,115 C108,100 130,110 138,132 C118,140 98,132 80,115 Z" fill="url(#stitchLeafGrad)" opacity={0.9} />
                  <Path d="M50,152 C78,140 100,150 108,170 C88,178 68,170 50,152 Z" fill="url(#stitchLeafGrad)" opacity={0.85} />
                  <Path d="M20,190 C45,180 65,190 72,210 C52,216 35,208 20,190 Z" fill="url(#stitchLeafGrad)" opacity={0.88} />
                </Svg>
              </View>
            </>
          )}
          {activeRole !== 'trainer' ? (
            <ClientProfileView
              insetsTop={insets.top}
              isHeaderCollapsed={isHeaderCollapsed}
              setIsHeaderCollapsed={setIsHeaderCollapsed}
              handleLogout={handleLogout}
              openEditProfileModal={openEditProfileModal}
              profile={profile}
              user={user}
              isWildcardTestAccount={isWildcardTestAccount}
              handleRoleChange={handleRoleChange}
              creditBalance={creditBalance}
              membership={membership}
              creditLots={creditLots}
              navigateThrottled={navigateThrottled}
              togglePersonalInfoExpansion={togglePersonalInfoExpansion}
              isPersonalInfoExpanded={isPersonalInfoExpanded}
              setIsGoalsModalVisible={setIsGoalsModalVisible}
              allFitnessGoals={ALL_FITNESS_GOALS}
              hasApplied={hasApplied}
              userApplication={userApplication}
            />
          ) : (
            <AnimatedReanimated.ScrollView
              showsVerticalScrollIndicator={false}
              overScrollMode="never"
              scrollEventThrottle={16}
              decelerationRate={0.96}
              bounces={true}
              alwaysBounceVertical={true}
              onScroll={(e) => {
                const collapsed = e.nativeEvent.contentOffset.y > 60;
                if (collapsed !== isHeaderCollapsed) setIsHeaderCollapsed(collapsed);
              }}
              className="flex-1 bg-transparent"
              contentContainerStyle={{ paddingHorizontal: 24, paddingTop: insets.top + 62, paddingBottom: 140 }}
            >
              {/* Trainer Profile Header Summary Card */}
              <View className="items-center mb-6">
                <View className="relative">
                  <View className="w-24 h-24 rounded-full border-[3px] border-[#E11D48] mb-3 shadow-xl bg-zinc-900 overflow-hidden">
                    <ExpoImage
                      source={resolveAvatarSource(coach?.photo || coach?.avatar || user?.avatar, coach?.gender)}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={200}
                    />
                  </View>
                  {/* Bottom Right Edit Pencil Icon */}
                  <Pressable
                    onPress={handlePickTrainerAvatar}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    className="absolute bottom-2 right-0 bg-[#E11D48] w-8 h-8 rounded-full border-2 border-white shadow-md items-center justify-center"
                  >
                    {isUploadingTrainerPhoto ? (
                      <Loading size="small" color="#FFFFFF" />
                    ) : (
                      <Feather name="edit-2" size={13} color="#FFFFFF" />
                    )}
                  </Pressable>
                </View>
                <Text className="text-[#101828] text-2xl font-black tracking-tight">{coach?.name || user?.name || 'User'}</Text>
                <Text className="text-[#4B5563] text-xs font-bold mt-1 tracking-wide uppercase">
                  {coach?.level || 'Master Trainer'} • {coach?.specialty || 'Strength & Conditioning'}
                </Text>
                <View className="flex-row items-center gap-1.5 mt-2.5 border border-[#E11D48]/30 px-3.5 py-1.5 rounded-full bg-[#E11D48]/5">
                  <Feather name="award" size={12} color="#E11D48" />
                  <Text className="text-[#E11D48] text-[10px] font-black uppercase tracking-widest">
                    Trainer ID: VIRLA-PRO-{(coach?.id || 'PRO-DEMO').slice(-6).toUpperCase()}
                  </Text>
                </View>

                {/* Go to Client Mode Button */}
                {isWildcardTestAccount(user, profile?.mobile) && (
                  <Pressable
                    onPress={() => handleRoleChange('customer')}
                    className="mt-3.5 bg-zinc-900 border border-zinc-700 px-4 py-2 rounded-xl flex-row items-center gap-2"
                  >
                    <Feather name="repeat" size={12} color="#E11D48" />
                    <Text className="text-white text-xs font-black uppercase tracking-wider">
                      Go to Client Mode
                    </Text>
                  </Pressable>
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
                  <View className="flex-row justify-between items-center border-b border-zinc-100 pb-3 mb-3.5">
                    <View className="flex-row items-center gap-2">
                      <View className="w-2 h-2 rounded-full bg-[#E11D48]" />
                      <Text className="text-zinc-500 text-[11px] font-bold uppercase tracking-widest">Coach Information</Text>
                    </View>
                    <Pressable
                      onPress={() => { if (isEditingTrainer) { handleSaveTrainer(); } else { setIsEditingTrainer(true); } }}
                      className="px-3.5 py-1.5 bg-zinc-900 rounded-lg flex-row items-center gap-1.5"
                    >
                      <Feather name={isEditingTrainer ? "check" : "edit-2"} size={11} color="#FFFFFF" />
                      <Text className="text-white text-xs font-bold">{isEditingTrainer ? 'Save' : 'Edit'}</Text>
                    </Pressable>
                  </View>

                  {isEditingTrainer ? (
                    <View className="gap-4">
                      <View className="gap-1.5">
                        <Text className="text-zinc-600 text-[11px] font-bold uppercase tracking-wider">Full Name</Text>
                        <TextInput
                          maxLength={250}
                          value={trainerName}
                          onChangeText={setTrainerName}
                          placeholder="Your full legal name"
                          placeholderTextColor="#9CA3AF"
                          className="border border-zinc-200 bg-[#FAFAFA] px-3.5 py-3 rounded-xl text-xs text-zinc-900 font-semibold"
                        />
                      </View>
                      <View className="gap-1.5">
                        <Text className="text-zinc-600 text-[11px] font-bold uppercase tracking-wider">Email Address</Text>
                        <TextInput
                          maxLength={254}
                          value={trainerEmail}
                          onChangeText={(v) => setTrainerEmail(cleanEmail(v))}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          placeholder="coach@virla.in"
                          placeholderTextColor="#9CA3AF"
                          className="border border-zinc-200 bg-[#FAFAFA] px-3.5 py-3 rounded-xl text-xs text-zinc-900 font-semibold"
                        />
                      </View>
                      <View className="gap-1.5">
                        <Text className="text-zinc-600 text-[11px] font-bold uppercase tracking-wider">Gender</Text>
                        <View className="bg-zinc-100/70 px-3.5 py-3 rounded-xl flex-row justify-between items-center">
                          <View className="flex-row items-center gap-2">
                            <Feather name="user" size={13} color="#52525B" />
                            <Text className="text-xs text-zinc-800 font-black capitalize">{trainerGender || 'Male'}</Text>
                          </View>
                          <View className="flex-row items-center gap-1 bg-zinc-200/80 px-2 py-0.5 rounded-md">
                            <Feather name="lock" size={11} color="#52525B" />
                            <Text className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">Locked</Text>
                          </View>
                        </View>
                      </View>
                      <View className="gap-1.5">
                        <View className="flex-row justify-between items-center">
                          <Text className="text-zinc-600 text-[11px] font-bold uppercase tracking-wider">Coach Short Bio</Text>
                          <Text className="text-zinc-400 text-[10px] font-medium">Appears on booking card</Text>
                        </View>
                        <TextInput
                          maxLength={1200}
                          value={trainerBio}
                          onChangeText={setTrainerBio}
                          multiline
                          numberOfLines={3}
                          placeholder="Write a concise overview of your coaching philosophy and expertise..."
                          placeholderTextColor="#9CA3AF"
                          textAlignVertical="top"
                          className="border border-zinc-200 bg-[#FAFAFA] p-3.5 rounded-xl text-xs text-zinc-900 font-medium leading-relaxed min-h-[88px]"
                        />
                      </View>
                    </View>
                  ) : (
                    <View className="gap-1">
                      <View className="flex-row justify-between items-center py-3 border-b border-zinc-100">
                        <Text className="text-zinc-500 text-xs font-semibold">Verification Status</Text>
                        <View className="px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full flex-row items-center gap-1.5">
                          <View className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          <Text className="text-emerald-700 text-xs font-black uppercase tracking-wider">Active Pro Partner</Text>
                        </View>
                      </View>
                      <View className="flex-row justify-between items-center py-3 border-b border-zinc-100">
                        <Text className="text-zinc-500 text-xs font-semibold">Email Address</Text>
                        <Text className="text-zinc-900 text-xs font-bold">{trainerEmail || 'Not Set'}</Text>
                      </View>
                      <View className="flex-row justify-between items-center py-3 border-b border-zinc-100">
                        <Text className="text-zinc-500 text-xs font-semibold">Gender</Text>
                        <View className="flex-row items-center gap-2">
                          <Text className="text-zinc-900 text-xs font-black capitalize">{trainerGender || 'Male'}</Text>
                          <View className="flex-row items-center gap-1 bg-zinc-100 px-2 py-0.5 rounded-md">
                            <Feather name="lock" size={10} color="#71717A" />
                            <Text className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Locked</Text>
                          </View>
                        </View>
                      </View>
                      <View className="pt-3 pb-1">
                        <Text className="text-zinc-500 text-[11px] font-bold uppercase tracking-wider mb-2">Professional Bio</Text>
                        <View className="bg-zinc-50 rounded-xl p-3.5">
                          <Text className="text-zinc-800 text-xs font-normal leading-relaxed">
                            {trainerBio || 'Certified personal trainer dedicated to functional movement, strength training, and tailored client transformations.'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                </AccordionCard>

                {/* 2. Workout Specialties Accordion */}
                <AccordionCard
                  title="Workout Specialties"
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
                        <View className="py-2 border-b border-zinc-200/60">
                          <Text className="text-zinc-500 text-xs font-medium mb-1.5">Active Approved Workout Categories</Text>
                          {approvedCats.length > 0 ? (
                            <View className="flex-row flex-wrap gap-2 mt-1">
                              {approvedCats.map((spec) => (
                                <View key={spec.id} className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full flex-row items-center gap-1.5">
                                  <Feather name="check" size={11} color="#059669" />
                                  <Text className="text-emerald-800 text-xs font-semibold">{spec.name}</Text>
                                </View>
                              ))}
                            </View>
                          ) : (
                            <Text className="text-zinc-400 text-xs font-medium mt-1">No approved workout categories</Text>
                          )}
                        </View>

                        {pendingCats.length > 0 && (
                          <View className="py-2 border-b border-zinc-200/60">
                            <Text className="text-zinc-500 text-xs font-medium mb-1.5">Pending Approval Requests</Text>
                            <View className="flex-row flex-wrap gap-2 mt-1">
                              {pendingCats.map((spec) => (
                                <View key={spec.id} className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full flex-row items-center gap-1.5">
                                  <Feather name="clock" size={11} color="#D97706" />
                                  <Text className="text-amber-800 text-xs font-semibold">
                                    {spec.name} ({spec.isRemoval ? 'Removal' : 'Addition'})
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}

                        {rejectedCats.length > 0 && (
                          <View className="py-2 border-b border-zinc-200/60">
                            <Text className="text-zinc-500 text-xs font-medium mb-1.5">Declined Category Requests</Text>
                            <View className="flex-row flex-wrap gap-2 mt-1">
                              {rejectedCats.map((spec) => (
                                <View key={spec.id} className="bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-full flex-row items-center gap-1.5">
                                  <Feather name="x" size={11} color="#EF4444" />
                                  <Text className="text-rose-800 text-xs font-semibold">
                                    {spec.name} {spec.reason ? `(${spec.reason})` : ''}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}

                        <View className="py-2 border-b border-zinc-200/60">
                          <Text className="text-zinc-500 text-xs font-medium">Specialization Focus</Text>
                          <Text className="text-zinc-900 text-xs font-semibold mt-1">
                            {coach?.specialization || 'Strength & Conditioning'}
                          </Text>
                        </View>

                        {!showSpecialtyForm && (
                          <Pressable
                            onPress={() => {
                              setSelectedSpecialties(getApprovedSpecialtyKeys());
                              setShowSpecialtyForm(true);
                            }}
                            className="bg-white p-3 rounded-xl flex-row justify-center items-center mt-1"
                          >
                            <Feather name="edit-2" size={13} color="#18181B" style={{ marginRight: 6 }} />
                            <Text className="text-zinc-900 text-xs font-semibold">
                              Request Workout Specialties Change
                            </Text>
                          </Pressable>
                        )}

                        {showSpecialtyForm && (
                          <View className="bg-white p-4 rounded-2xl gap-3.5 mt-1">
                            <Text className="text-zinc-900 text-xs font-bold uppercase tracking-wide">Select workout categories to request</Text>
                            <View className="flex-row flex-wrap gap-2">
                              {DB_CATEGORIES.map((cat, idx) => {
                                const isChecked = selectedSpecialties.includes(cat.key);
                                return (
                                  <Pressable
                                    key={idx}
                                    onPress={() => {
                                      if (isChecked) {
                                        setSelectedSpecialties(selectedSpecialties.filter(s => s !== cat.key));
                                      } else {
                                        setSelectedSpecialties([...selectedSpecialties, cat.key]);
                                      }
                                    }}
                                    className={`px-3 py-1.5 border rounded-xl flex-row items-center gap-1.5 ${
                                      isChecked ? 'bg-zinc-900 border-zinc-900' : 'bg-zinc-50 border-zinc-200'
                                    }`}
                                  >
                                    <Text className={`text-xs font-semibold ${isChecked ? 'text-white' : 'text-zinc-700'}`}>{cat.display}</Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                            <View className="gap-1.5 mt-1">
                              <Text className="text-zinc-600 text-xs font-semibold">Reason for requesting change</Text>
                              <TextInput
                                maxLength={250}
                                value={specialtyMessage}
                                onChangeText={setSpecialtyMessage}
                                placeholder="Add certifications, ACE, fitness coach experience..."
                                placeholderTextColor="#9CA3AF"
                                className="border border-zinc-200 bg-zinc-50 p-3 rounded-xl text-xs text-zinc-900 font-medium"
                              />
                            </View>
                            <View className="flex-row gap-2 mt-1">
                              <Pressable
                                onPress={() => setShowSpecialtyForm(false)}
                                className="flex-1 py-2.5 rounded-xl items-center bg-white"
                              >
                                <Text className="text-zinc-600 text-xs font-semibold">Cancel</Text>
                              </Pressable>
                              <Pressable
                                onPress={handleSpecialtySubmit}
                                className="flex-1 bg-zinc-900 py-2.5 rounded-xl items-center"
                              >
                                <Text className="text-white text-xs font-semibold">Submit Request</Text>
                              </Pressable>
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </AccordionCard>

                {/* 3. Operating Area Accordion */}
                <AccordionCard
                  title="Operating Area & Radius"
                  icon="map-pin"
                  expanded={expandedSection === 'operating'}
                  onToggle={() => setExpandedSection(expandedSection === 'operating' ? null : 'operating')}
                >
                  <View className="gap-3">
                    <View className="py-2 border-b border-zinc-200/60">
                      <Text className="text-zinc-500 text-xs font-medium">Operating Base Location</Text>
                      <Text className="text-zinc-900 text-xs font-semibold mt-1 leading-normal">
                        {coach?.preferences?.operatingAddress || 'Operating Base Not Configured'}
                      </Text>
                      <Text className="text-zinc-400 text-[11px] font-normal mt-1">
                        📍 Permanent check-in dispatch address
                      </Text>
                    </View>

                    <View className="flex-row justify-between items-center py-2 border-b border-zinc-200/60">
                      <Text className="text-zinc-500 text-xs font-medium">Service Radius</Text>
                      <Text className="text-zinc-900 text-xs font-semibold">
                        {`${trainerServiceRadiusKm(coach?.preferences?.radiusKm)} km`}
                      </Text>
                    </View>

                    <View className="flex-row justify-between items-center py-2 border-b border-zinc-200/60">
                      <Text className="text-zinc-500 text-xs font-medium">Verification status</Text>
                      <View className={`px-2.5 py-0.5 rounded-full ${
                        coach?.preferences?.operatingLocationStatus === 'verified'
                          ? 'bg-emerald-50 border border-emerald-200'
                          : coach?.preferences?.operatingLocationStatus === 'rejected'
                          ? 'bg-rose-50 border border-rose-200'
                          : 'bg-amber-50 border border-amber-200'
                      }`}>
                        <Text className={`text-xs font-semibold ${
                          coach?.preferences?.operatingLocationStatus === 'verified'
                            ? 'text-emerald-700'
                            : coach?.preferences?.operatingLocationStatus === 'rejected'
                            ? 'text-rose-700'
                            : 'text-amber-700'
                        }`}>
                          {coach?.preferences?.operatingLocationStatus === 'verified' ? 'Verified' : coach?.preferences?.operatingLocationStatus === 'rejected' ? 'Rejected' : 'Pending Review'}
                        </Text>
                      </View>
                    </View>

                    {coach?.preferences?.addressChangeRequest && (
                      <View className="bg-amber-50/80 border border-amber-200 p-3.5 rounded-2xl gap-1">
                        <Text className="text-amber-800 text-[11px] font-bold uppercase tracking-wider">Pending Change Request</Text>
                        <Text className="text-zinc-900 text-xs font-semibold">
                          Change to: {coach?.preferences?.addressChangeRequest?.requestedAddress} ({coach?.preferences?.addressChangeRequest?.requestedRadius} km)
                        </Text>
                        <Text className="text-zinc-500 text-[11px] font-medium mt-0.5">Submitted, waiting for verification approval.</Text>
                      </View>
                    )}

                    {!coach?.preferences?.addressChangeRequest && !showAddressForm && (
                      <Pressable
                        onPress={() => {
                          setAddressInput(coach?.preferences?.operatingAddress || '');
                          setRadiusInput(trainerServiceRadiusKm(coach?.preferences?.radiusKm as number));
                          setShowAddressForm(true);
                        }}
                        className="bg-white p-3 rounded-xl flex-row justify-center items-center mt-1"
                      >
                        <Feather name="edit-2" size={13} color="#18181B" style={{ marginRight: 6 }} />
                        <Text className="text-zinc-900 text-xs font-semibold">
                          Request Address Change
                        </Text>
                      </Pressable>
                    )}

                    {showAddressForm && (
                      <View className="bg-white p-4 rounded-2xl gap-3.5 mt-1">
                        <Text className="text-zinc-900 text-xs font-bold uppercase tracking-wide">Configure Base address</Text>

                        <Pressable
                          onPress={handleUseCurrentLocation}
                          disabled={isSearchingLocation}
                          className="bg-zinc-100 p-3 rounded-xl flex-row justify-center items-center gap-2"
                        >
                          <Feather name="navigation" size={13} color="#18181B" />
                          <Text className="text-zinc-900 text-xs font-semibold">Use Current Location</Text>
                        </Pressable>

                        <View className="gap-1.5">
                          <Text className="text-zinc-600 text-xs font-semibold">Search address</Text>
                          <TextInput
                            maxLength={250}
                            value={addressInput}
                            onChangeText={setAddressInput}
                            placeholder="Enter address..."
                            placeholderTextColor="#9CA3AF"
                            className="border border-zinc-200 bg-zinc-50 p-3 rounded-xl text-xs text-zinc-900 font-medium"
                          />
                        </View>

                        {searchSuggestions.length > 0 && (
                          <View className="bg-white rounded-xl max-h-40 overflow-hidden py-1">
                            {searchSuggestions.map((item, idx) => (
                              <Pressable
                                key={idx}
                                onPress={() => handleSelectSuggestion(item)}
                                className="p-3 border-b border-zinc-100 flex-row items-center gap-2"
                              >
                                <Feather name="map-pin" size={12} color="#71717A" />
                                <Text className="text-zinc-800 text-xs font-medium flex-1" numberOfLines={2}>{item.description}</Text>
                              </Pressable>
                            ))}
                          </View>
                        )}

                        {selectedLocation && (
                          <View className="bg-emerald-50/60 border border-emerald-200 p-3.5 rounded-2xl gap-2.5">
                            <View className="flex-row items-center gap-2">
                              <Feather name="check-circle" size={13} color="#059669" />
                              <Text className="text-emerald-800 text-xs font-bold">Location Selected</Text>
                            </View>
                            <Text className="text-zinc-800 text-xs font-normal leading-relaxed">{selectedLocation.address}</Text>
                            <Pressable
                              onPress={() => setIsLocationConfirmed(!isLocationConfirmed)}
                              className="flex-row items-center gap-2 border-t border-emerald-200/60 pt-2"
                            >
                              <View className={`w-4 h-4 rounded border items-center justify-center ${
                                isLocationConfirmed ? 'bg-zinc-900 border-zinc-900' : 'bg-white border-zinc-300'
                              }`}>
                                {isLocationConfirmed && <Feather name="check" size={11} color="white" />}
                              </View>
                              <Text className="text-zinc-800 text-xs font-semibold">This is my operating base.</Text>
                            </Pressable>
                          </View>
                        )}

                        <View className="gap-1.5">
                          <Text className="text-zinc-600 text-xs font-semibold">Service Radius Limit (Max 5 km)</Text>
                          <View className="flex-row gap-2 mt-0.5">
                            {[1, 2, 3, 4, 5].map((r) => (
                              <Pressable
                                key={r}
                                onPress={() => setRadiusInput(r)}
                                className={`flex-1 py-2.5 border rounded-xl items-center ${
                                  radiusInput === r ? 'bg-zinc-900 border-zinc-900' : 'bg-zinc-50 border-zinc-200'
                                }`}
                              >
                                <Text className={`text-xs font-bold ${radiusInput === r ? 'text-white' : 'text-zinc-700'}`}>{r} km</Text>
                              </Pressable>
                            ))}
                          </View>
                        </View>

                        <View className="flex-row gap-2 mt-1">
                          <Pressable
                            onPress={() => {
                              setShowAddressForm(false);
                              setSearchSuggestions([]);
                              setSelectedLocation(null);
                              setIsLocationConfirmed(false);
                            }}
                            className="flex-1 py-2.5 rounded-xl items-center bg-white"
                          >
                            <Text className="text-zinc-600 text-xs font-semibold">Cancel</Text>
                          </Pressable>
                          <Pressable
                            onPress={handleSubmitAddressRequest}
                            disabled={!selectedLocation || !isLocationConfirmed}
                            className={`flex-1 py-2.5 rounded-xl items-center ${
                              selectedLocation && isLocationConfirmed ? 'bg-zinc-900' : 'bg-zinc-200'
                            }`}
                          >
                            <Text className={`text-xs font-semibold ${selectedLocation && isLocationConfirmed ? 'text-white' : 'text-zinc-400'}`}>
                              Submit Request
                            </Text>
                          </Pressable>
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
                  <View className="gap-3.5">
                    <View className="gap-1.5">
                      <Text className="text-zinc-500 text-xs font-medium">Availability Mode</Text>
                      <View className="flex-row gap-2 mt-0.5">
                        {['weekly_fixed', 'monthly_flexible'].map((mode) => (
                          <Pressable
                            key={mode}
                            onPress={() => setAvailMode(mode as any)}
                            className={`flex-1 py-2.5 border rounded-xl items-center ${
                              availMode === mode ? 'bg-zinc-900 border-zinc-900' : 'bg-white border-zinc-200'
                            }`}
                          >
                            <Text className={`text-xs font-bold ${
                              availMode === mode ? 'text-white' : 'text-zinc-600'
                            }`}>
                              {mode === 'weekly_fixed' ? 'Fixed Weekly' : 'Flexible Monthly'}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>

                    <View className="gap-1.5">
                      <Text className="text-zinc-500 text-xs font-medium">Max Daily Sessions Policy</Text>
                      <View className="flex-row items-center gap-4 mt-0.5 bg-white p-2.5 rounded-xl justify-between">
                        <Pressable
                          onPress={() => setMaxSessions(Math.max(1, maxSessions - 1))}
                          className="w-8 h-8 rounded-lg bg-zinc-100 items-center justify-center"
                        >
                          <Feather name="minus" size={14} color="#18181B" />
                        </Pressable>
                        <Text className="text-zinc-900 text-xs font-bold">{maxSessions} sessions max / day</Text>
                        <Pressable
                          onPress={() => setMaxSessions(Math.min(10, maxSessions + 1))}
                          className="w-8 h-8 rounded-lg bg-zinc-100 items-center justify-center"
                        >
                          <Feather name="plus" size={14} color="#18181B" />
                        </Pressable>
                      </View>
                    </View>

                    <View className="gap-1.5">
                      <Text className="text-zinc-500 text-xs font-medium">Default Available Days</Text>
                      <View className="flex-row flex-wrap gap-2 mt-0.5">
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                          const isChecked = weeklyDays[day];
                          return (
                            <Pressable
                              key={day}
                              onPress={() => setWeeklyDays({ ...weeklyDays, [day]: !isChecked })}
                              className={`px-3 py-1.5 border rounded-xl ${
                                isChecked ? 'bg-zinc-900 border-zinc-900' : 'bg-white border-zinc-200'
                              }`}
                            >
                              <Text className={`text-xs font-semibold ${isChecked ? 'text-white' : 'text-zinc-600'}`}>{day.slice(0, 3)}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>

                    <Pressable
                      onPress={handleSaveAvailabilitySettings}
                      className="bg-zinc-900 py-3 rounded-xl items-center justify-center mt-1"
                    >
                      <Text className="text-white text-xs font-semibold">Save Availability Preferences</Text>
                    </Pressable>
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
                    <View className="bg-zinc-900 p-4 rounded-2xl gap-3">
                      <Text className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Financial Summary</Text>
                      <View className="flex-row flex-wrap justify-between gap-y-2.5">
                        <View className="w-[48%] bg-zinc-800/80 border border-zinc-700/60 p-3 rounded-xl">
                          <Text className="text-zinc-400 text-[11px] font-medium uppercase">Total Earnings</Text>
                          <Text className="text-emerald-400 text-sm font-bold mt-0.5">₹{(totalEarnings || 0).toLocaleString('en-IN')}</Text>
                        </View>
                        <View className="w-[48%] bg-zinc-800/80 border border-zinc-700/60 p-3 rounded-xl">
                          <Text className="text-zinc-400 text-[11px] font-medium uppercase">Paid Out</Text>
                          <Text className="text-white text-sm font-bold mt-0.5">₹{((totalEarnings || 0) * 0.85).toLocaleString('en-IN')}</Text>
                        </View>
                        <View className="w-[48%] bg-zinc-800/80 border border-zinc-700/60 p-3 rounded-xl">
                          <Text className="text-zinc-400 text-[11px] font-medium uppercase">Pending Payout</Text>
                          <Text className="text-amber-400 text-sm font-bold mt-0.5">₹{((totalEarnings || 0) * 0.15).toLocaleString('en-IN')}</Text>
                        </View>
                        <View className="w-[48%] bg-zinc-800/80 border border-zinc-700/60 p-3 rounded-xl">
                          <Text className="text-zinc-400 text-[11px] font-medium uppercase">Next Payout</Text>
                          <Text className="text-white text-xs font-bold mt-0.5">Fri, 21 Aug</Text>
                        </View>
                      </View>
                    </View>

                    {/* Bank info view */}
                    <View className="border-t border-zinc-200/60 pt-3">
                      <View className="flex-row justify-between items-center mb-2.5">
                        <Text className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Bank Account details</Text>
                        <Pressable
                          onPress={() => setIsEditingTrainer(!isEditingTrainer)}
                          className="px-2.5 py-1 bg-zinc-100 rounded-lg"
                        >
                          <Text className="text-zinc-800 text-xs font-semibold">{isEditingTrainer ? 'Close' : 'Update Details'}</Text>
                        </Pressable>
                      </View>

                      {isEditingTrainer ? (
                        <View className="gap-3 bg-white p-4 rounded-2xl">
                          <View className="gap-1.5">
                            <Text className="text-zinc-600 text-xs font-semibold">Account Name</Text>
                            <TextInput
                              maxLength={250}
                              value={bankAccName}
                              onChangeText={setBankAccName}
                              className="border border-zinc-200 bg-zinc-50 p-3 rounded-xl text-xs text-zinc-900 font-medium"
                            />
                          </View>
                          <View className="gap-1.5">
                            <Text className="text-zinc-600 text-xs font-semibold">Bank Name</Text>
                            <TextInput
                              maxLength={250}
                              value={bankNameStr}
                              onChangeText={setBankNameStr}
                              className="border border-zinc-200 bg-zinc-50 p-3 rounded-xl text-xs text-zinc-900 font-medium"
                            />
                          </View>
                          <View className="gap-1.5">
                            <Text className="text-zinc-600 text-xs font-semibold">Account Number</Text>
                            <TextInput
                              maxLength={18}
                              value={bankAccNumber}
                              onChangeText={(v) => setBankAccNumber(digitsOnly(v, 18))}
                              keyboardType="number-pad"
                              className="border border-zinc-200 bg-zinc-50 p-3 rounded-xl text-xs text-zinc-900 font-medium"
                            />
                          </View>
                          <View className="gap-1.5">
                            <Text className="text-zinc-600 text-xs font-semibold">IFSC Code</Text>
                            <TextInput
                              maxLength={11}
                              autoCapitalize="characters"
                              value={bankIfscStr}
                              onChangeText={(v) => setBankIfscStr(cleanIfsc(v))}
                              className="border border-zinc-200 bg-zinc-50 p-3 rounded-xl text-xs text-zinc-900 font-medium"
                            />
                          </View>
                          <View className="gap-1.5">
                            <Text className="text-zinc-600 text-xs font-semibold">UPI ID</Text>
                            <TextInput
                              maxLength={60}
                              autoCapitalize="none"
                              autoCorrect={false}
                              value={bankUpiIdStr}
                              onChangeText={(v) => setBankUpiIdStr(cleanUpi(v))}
                              className="border border-zinc-200 bg-zinc-50 p-3 rounded-xl text-xs text-zinc-900 font-medium"
                            />
                          </View>
                          <Pressable
                            onPress={handleSaveTrainer}
                            className="bg-zinc-900 py-3 rounded-xl items-center mt-1"
                          >
                            <Text className="text-white text-xs font-semibold">Save Account details</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <View className="gap-1 bg-white p-3.5 rounded-2xl">
                          <View className="flex-row justify-between items-center py-2 border-b border-zinc-100">
                            <Text className="text-zinc-500 text-xs font-medium">Account Holder</Text>
                            <Text className="text-zinc-900 text-xs font-semibold">{bankAccName || 'Not Set'}</Text>
                          </View>
                          <View className="flex-row justify-between items-center py-2 border-b border-zinc-100">
                            <Text className="text-zinc-500 text-xs font-medium">Bank Name</Text>
                            <Text className="text-zinc-900 text-xs font-semibold">{bankNameStr || 'Not Set'}</Text>
                          </View>
                          <View className="flex-row justify-between items-center py-2 border-b border-zinc-100">
                            <Text className="text-zinc-500 text-xs font-medium">Account Number</Text>
                            <Text className="text-zinc-900 text-xs font-semibold">{bankAccNumber ? `•••• ${bankAccNumber.slice(-4)}` : 'Not Set'}</Text>
                          </View>
                          <View className="flex-row justify-between items-center py-2">
                            <Text className="text-zinc-500 text-xs font-medium">UPI ID</Text>
                            <Text className="text-zinc-900 text-xs font-semibold">{bankUpiIdStr || 'Not Set'}</Text>
                          </View>
                        </View>
                      )}
                    </View>

                    {/* Historical ledger list */}
                    <View className="border-t border-zinc-200/60 pt-3">
                      <Text className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-2.5">Earnings History Ledger</Text>
                      {earningsList.length > 0 ? (
                        <View className="gap-2 bg-white p-3.5 rounded-2xl">
                          {earningsList.slice(0, 6).map((earn) => (
                            <View key={earn.id} className="flex-row justify-between items-center py-2 border-b border-zinc-100 last:border-b-0">
                              <View className="flex-1 pr-3">
                                <Text className="text-zinc-900 text-xs font-medium leading-snug">
                                  {earn.type === 'session' && (
                                    earn.isFavourite || (earn.clientName && earn.clientName.includes('(Favourite Trainer)'))
                                      ? `Visit Fee: ${earn.clientName.replace(' (Favourite Trainer)', '')} (Favourite Trainer)`
                                      : `Visit Fee: ${earn.clientName}`
                                  )}
                                  {earn.type === 'no_show_compensation' && `Cancellation Fee: ${earn.clientName}`}
                                  {earn.type === 'penalty' && `Cancellation Penalty`}
                                </Text>
                                <Text className="text-zinc-400 text-[10px] font-medium mt-0.5">{formatToDDMMYYYY(earn.date)}</Text>
                              </View>
                              <Text className={`text-xs font-bold ${earn.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {earn.amount >= 0 ? '+' : ''}₹{earn.amount.toLocaleString('en-IN')}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text className="text-zinc-400 text-xs text-center py-4 bg-white rounded-2xl">No earnings transactions logged.</Text>
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
                  <View className="gap-3.5">
                    <View className="flex-row justify-between items-center mb-1">
                      <Text className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Report support tickets</Text>
                      {!showDisputeForm && (
                        <Pressable
                          onPress={() => setShowDisputeForm(true)}
                          className="bg-zinc-900 px-3 py-1.5 rounded-lg"
                        >
                          <Text className="text-white text-xs font-semibold">Raise Ticket</Text>
                        </Pressable>
                      )}
                    </View>

                    {showDisputeForm && (
                      <View className="bg-white p-4 rounded-2xl gap-3.5 mt-1">
                        <Text className="text-zinc-900 text-xs font-bold uppercase tracking-wide">Submit new issue ticket</Text>
                        <View className="gap-1.5">
                          <Text className="text-zinc-600 text-xs font-semibold">Category</Text>
                          <View className="flex-row flex-wrap gap-2 mt-0.5">
                            {['payment', 'safety', 'behavior', 'cancellation_dispute'].map((cat) => (
                              <Pressable
                                key={cat}
                                onPress={() => setDisputeCategory(cat as any)}
                                className={`px-3 py-1.5 border rounded-xl flex-row items-center gap-1.5 ${
                                  disputeCategory === cat ? 'bg-zinc-900 border-zinc-900' : 'bg-zinc-50 border-zinc-200'
                                }`}
                              >
                                {disputeCategory === cat && (
                                  <Feather name="check" size={12} color="white" />
                                )}
                                <Text className={`text-xs font-semibold capitalize ${disputeCategory === cat ? 'text-white' : 'text-zinc-700'}`}>
                                  {cat.replace('_', ' ')}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </View>
                        <View className="gap-1.5">
                          <Text className="text-zinc-600 text-xs font-semibold">Booking ID (Optional)</Text>
                          <TextInput
                            maxLength={250}
                            value={disputeBookingId}
                            onChangeText={setDisputeBookingId}
                            placeholder="e.g. bk-728200"
                            placeholderTextColor="#9CA3AF"
                            className="border border-zinc-200 bg-zinc-50 p-3 rounded-xl text-xs text-zinc-900 font-medium"
                          />
                        </View>
                        <View className="gap-1.5">
                          <Text className="text-zinc-600 text-xs font-semibold">Describe the issue</Text>
                          <TextInput
                            maxLength={1200}
                            value={disputeDescription}
                            onChangeText={setDisputeDescription}
                            placeholder="Please detail the cancellation timing, client safety concern, or dispute..."
                            placeholderTextColor="#9CA3AF"
                            multiline
                            numberOfLines={3}
                            className="border border-zinc-200 bg-zinc-50 p-3 rounded-xl text-xs text-zinc-900 font-medium"
                          />
                        </View>
                        <View className="flex-row gap-2 mt-1">
                          <Pressable
                            onPress={() => setShowDisputeForm(false)}
                            className="flex-1 py-2.5 rounded-xl items-center bg-white"
                          >
                            <Text className="text-zinc-600 text-xs font-semibold">Cancel</Text>
                          </Pressable>
                          <Pressable
                            onPress={handleDisputeSubmit}
                            disabled={isSubmittingDispute}
                            className={`flex-1 bg-zinc-900 py-2.5 rounded-xl items-center ${isSubmittingDispute ? 'opacity-60' : ''}`}
                          >
                            <Text className="text-white text-xs font-semibold">{isSubmittingDispute ? 'Submitting...' : 'Submit Ticket'}</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}

                    {/* Dispute history */}
                    <View className="border-t border-zinc-200/60 pt-3">
                      <Text className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-2.5">Your Disputes history</Text>
                      {disputesList.length > 0 ? (
                        <View className="gap-2.5 bg-white p-3.5 rounded-2xl">
                          {(showAllDisputes ? disputesList : disputesList.slice(0, DISPUTES_PAGE_SIZE)).map((d) => (
                            <DisputeHistoryRow key={d.id} dispute={d} />
                          ))}
                          {disputesList.length > DISPUTES_PAGE_SIZE && (
                            <Pressable
                              onPress={() => setShowAllDisputes(prev => !prev)}
                              className="py-2 items-center"
                            >
                              <Text className="text-zinc-500 text-[11px] font-semibold">
                                {showAllDisputes ? 'Show less' : `Show all ${disputesList.length} cases`}
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      ) : (
                        <Text className="text-zinc-400 text-xs text-center py-4 bg-white rounded-2xl">No open dispute cases logged.</Text>
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
                    <View className="bg-rose-50 border border-rose-200/70 p-3.5 rounded-2xl flex-row items-center gap-3">
                      <View className="w-8 h-8 rounded-xl bg-rose-500/10 items-center justify-center">
                        <Feather name="shield" size={15} color="#E11D48" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[#E11D48] text-xs font-bold uppercase tracking-wider">Masked Calling & SOS</Text>
                        <Text className="text-zinc-700 text-xs font-normal leading-relaxed mt-0.5">
                          Call routing uses masked trainer-client phones. Pressing SOS inside any active session alerts 24/7 support.
                        </Text>
                      </View>
                    </View>

                    <View className="gap-2 bg-white p-3.5 rounded-2xl">
                      {[
                        { title: 'OTP Check-in verification', desc: 'Verify client OTP check-ins immediately at the venue door before beginning workout.' },
                        { title: 'Safe Travel logging', desc: 'Remember to tap "Start Travel" and "Reached Location" to sync GPS coordinates with the dispatch center.' },
                        { title: 'Cancellation Policy', desc: 'No-shows by clients within 15 minutes of session start will result in full compensation credits.' }
                      ].map((item, idx) => (
                        <View key={idx} className="flex-row gap-3 items-start py-2 border-b border-zinc-100 last:border-b-0">
                          <Feather name="check-circle" size={14} color="#059669" style={{ marginTop: 2 }} />
                          <View className="flex-1">
                            <Text className="text-zinc-900 text-xs font-semibold">{item.title}</Text>
                            <Text className="text-zinc-500 text-xs leading-relaxed mt-0.5">{item.desc}</Text>
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
                  <View className="gap-3.5">
                    <View className="flex-row justify-between items-center mb-1">
                      <Text className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">VIRLA Partner Accessories</Text>
                      {!showKitForm && (
                        <Pressable
                          onPress={() => setShowKitForm(true)}
                          className="bg-zinc-900 px-3 py-1.5 rounded-lg"
                        >
                          <Text className="text-white text-xs font-semibold">Order Kit</Text>
                        </Pressable>
                      )}
                    </View>
                    {showKitForm && (
                      <View className="bg-white p-4 rounded-2xl gap-3.5 mt-1">
                        <Text className="text-zinc-900 text-xs font-bold uppercase tracking-wide">Select quantities</Text>

                        <View className="gap-3">
                          {['T-shirt', 'Towel', 'Duffel Bag', 'Water Bottle'].map((item) => (
                            <View key={item} className="flex-row items-center justify-between border-b border-zinc-100 pb-2.5">
                              <Text className="text-zinc-800 text-xs font-semibold">{item}</Text>
                              <View className="flex-row items-center gap-3">
                                <Pressable
                                  onPress={() => {
                                    const current = kitQuantities[item] || 0;
                                    if (current > 0) {
                                      setKitQuantities({ ...kitQuantities, [item]: current - 1 });
                                    }
                                  }}
                                  className="w-7 h-7 bg-zinc-100 rounded-lg justify-center items-center"
                                >
                                  <Feather name="minus" size={12} color="#18181B" />
                                </Pressable>
                                <Text className="text-zinc-900 text-xs font-bold w-6 text-center">{kitQuantities[item] || 0}</Text>
                                <Pressable
                                  onPress={() => {
                                    const current = kitQuantities[item] || 0;
                                    setKitQuantities({ ...kitQuantities, [item]: current + 1 });
                                  }}
                                  className="w-7 h-7 bg-zinc-100 rounded-lg justify-center items-center"
                                >
                                  <Feather name="plus" size={12} color="#18181B" />
                                </Pressable>
                              </View>
                            </View>
                          ))}

                          {kitQuantities['T-shirt'] > 0 && (
                            <View className="gap-2 mt-1 bg-rose-50/50 border border-rose-200/60 p-3.5 rounded-xl">
                              <Text className="text-[#E11D48] text-xs font-bold uppercase tracking-wider">Select T-Shirt Size (*one size per order)</Text>
                              <View className="flex-row gap-1.5 mt-1">
                                {(['S', 'M', 'L', 'XL', 'XXL'] as const).map((sz) => (
                                  <Pressable
                                    key={sz}
                                    onPress={() => setSelectedTshirtSize(sz)}
                                    className={`flex-1 py-2 border rounded-xl items-center ${
                                      selectedTshirtSize === sz ? 'bg-zinc-900 border-zinc-900' : 'bg-white border-zinc-200'
                                    }`}
                                  >
                                    <Text className={`text-xs font-bold ${selectedTshirtSize === sz ? 'text-white' : 'text-zinc-600'}`}>{sz}</Text>
                                  </Pressable>
                                ))}
                              </View>
                            </View>
                          )}
                        </View>

                        <View className="flex-row gap-2 mt-1">
                          <Pressable
                            onPress={() => setShowKitForm(false)}
                            className="flex-1 py-2.5 rounded-xl items-center bg-white"
                          >
                            <Text className="text-zinc-600 text-xs font-semibold">Cancel</Text>
                          </Pressable>
                          <Pressable
                            onPress={handleKitSubmit}
                            disabled={isSubmittingKit}
                            className={`flex-1 bg-zinc-900 py-2.5 rounded-xl items-center ${isSubmittingKit ? 'opacity-60' : ''}`}
                          >
                            <Text className="text-white text-xs font-semibold">{isSubmittingKit ? 'Submitting...' : 'Submit Request'}</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}

                    {/* Kit requests history list */}
                    <View className="border-t border-zinc-200/60 pt-3">
                      <Text className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-2.5">Partner Kits History</Text>
                      {kitRequestsList.length > 0 ? (
                        <View className="gap-3">
                          {(showAllKits ? kitRequestsList : kitRequestsList.slice(0, KITS_PAGE_SIZE)).map((item) => (
                            <KitRequestRow key={item.id} item={item} />
                          ))}
                          {kitRequestsList.length > KITS_PAGE_SIZE && (
                            <Pressable
                              onPress={() => setShowAllKits(prev => !prev)}
                              className="py-2 items-center"
                            >
                              <Text className="text-zinc-500 text-[11px] font-semibold">
                                {showAllKits ? 'Show less' : `Show all ${kitRequestsList.length} requests`}
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      ) : (
                        <Text className="text-zinc-400 text-xs text-center py-4 bg-white rounded-2xl">No partner brand kit requests logged.</Text>
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
                    <View className="flex-row justify-between items-center py-2 border-b border-zinc-200/60">
                      <Text className="text-zinc-500 text-xs font-medium">Available Balance</Text>
                      <Text className="text-zinc-900 text-base font-bold">{creditBalance} Credits</Text>
                    </View>

                    <View className="gap-2 mt-1">
                      <Text className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Credit Lot Breakdown</Text>
                      {creditLots && creditLots.filter(l => l.remaining_credits > 0).length > 0 ? (
                        creditLots.filter(l => l.remaining_credits > 0).map((l, index) => (
                          <View key={l.id || index} className="flex-row justify-between items-center bg-white p-3 rounded-xl">
                            <Text className="text-zinc-800 text-xs font-semibold">{l.remaining_credits} Credits</Text>
                            <Text className="text-zinc-500 text-xs font-medium">Expires {formatToDDMMYYYY(l.official_expiry_date)}</Text>
                          </View>
                        ))
                      ) : (
                        <Text className="text-zinc-400 text-xs italic">No active credit lots available.</Text>
                      )}
                    </View>

                    <Pressable
                      onPress={() => router.push('/wallet' as any)}
                      className="bg-zinc-900 py-3 rounded-xl items-center justify-center mt-2"
                    >
                      <Text className="text-white text-xs font-semibold">Open Wallet Options</Text>
                    </Pressable>
                  </View>
                </AccordionCard>

              </View>

          {/* Sign Out button */}
          <Pressable
            onPress={handleLogout}
            className="bg-rose-50 border border-rose-200/70 px-8 py-3.5 rounded-full flex-row justify-center items-center self-center mt-6 mb-24 gap-2"
          >
            <Feather name="log-out" size={15} color="#E11D48" style={{ transform: [{ rotate: '-90deg' }] }} />
            <Text className="text-rose-600 text-xs font-bold uppercase tracking-wider">Sign Out</Text>
          </Pressable>

            </AnimatedReanimated.ScrollView>
          )}

        {/* Semi-transparent white status bar strip for smooth frosted glass / translucent edge-to-edge feel */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: insets.top,
            backgroundColor: 'rgba(255, 255, 255, 0.55)',
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: 'rgba(0, 0, 0, 0.05)',
            zIndex: 35,
          }}
        />
      </View>
    </KeyboardAvoidingView>

      <SignOutConfirmationModal
        visible={isSignOutModalVisible}
        onClose={closeSignOutModal}
        onConfirm={confirmLogout}
      />

      {/* Memoized Client Edit Personal Information Sheet */}
      <ClientEditProfileSheet
        visible={isEditingProfile}
        insetsTop={insets.top}
        insetsBottom={insets.bottom}
        initialProfile={initialProfileSnapshot}
        onClose={closeEditProfileModal}
        onSaveSuccess={handleSaveProfileSuccess}
        onUpdateCoreProfile={handleUpdateCoreProfile}
      />

      {/* Fitness Goals Native Bottom Sheet Modal */}
      <FitnessGoalsModal
        visible={isGoalsModalVisible}
        onClose={closeGoalsModal}
      />

      {/* Native AlertDialog for Profile Saved */}
      <NativeAlertDialog
        visible={profileSavedAlertVisible}
        title="Profile Saved"
        message="Your personal details have been updated."
        confirmText="OK"
        onConfirm={closeProfileSavedAlert}
      />

      {/* Native Single Choice Dialog for Trainer Photo Source */}
      <NativeSingleChoiceDialog
        visible={showTrainerPhotoDialog}
        title="Upload Profile Photo"
        message="Choose an option to update your trainer profile picture:"
        options={['Take Photo', 'Choose from Gallery']}
        onSelect={executeTrainerPhotoOption}
        onDismiss={() => setShowTrainerPhotoDialog(false)}
      />


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
  rightTextColor?: string;
  badgeBgColor?: string;
  badgeBorderColor?: string;
}

const DISPUTES_PAGE_SIZE = 5;
const KITS_PAGE_SIZE = 4;

const DisputeHistoryRow = React.memo(function DisputeHistoryRow({ dispute }: { dispute: any }) {
  return (
    <View className="py-2.5 border-b border-zinc-100 last:border-b-0 gap-1.5">
      <View className="flex-row justify-between items-center">
        <Text className="text-zinc-900 text-xs font-semibold capitalize">Case: {dispute.category.replace('_', ' ')}</Text>
        <View className={`px-2 py-0.5 rounded-full ${
          dispute.status === 'resolved' ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'
        }`}>
          <Text className={`text-[10px] font-bold uppercase ${dispute.status === 'resolved' ? 'text-emerald-700' : 'text-amber-700'}`}>
            {dispute.status}
          </Text>
        </View>
      </View>
      {dispute.bookingId ? <Text className="text-zinc-400 text-[11px] font-medium">Booking ID: {dispute.bookingId}</Text> : null}
      <Text className="text-zinc-700 text-xs leading-relaxed mt-0.5">{dispute.description}</Text>
      <Text className="text-zinc-400 text-[10px] font-medium mt-0.5">Submitted: {formatToDDMMYYYY(dispute.date)}</Text>
    </View>
  );
});

const KitRequestRow = React.memo(function KitRequestRow({ item }: { item: any }) {
  return (
    <View className="bg-white p-3.5 rounded-2xl gap-2">
      <View className="flex-row justify-between items-center">
        <Text className="text-zinc-900 text-xs font-bold uppercase">Order ID: {item.order_id || item.id}</Text>
        <View className={`px-2 py-0.5 rounded-full ${
          item.status === 'SUBMITTED' ? 'bg-rose-50 border border-rose-200' :
          item.status === 'UNDER REVIEW' ? 'bg-amber-50 border border-amber-200' :
          item.status === 'APPROVED' || item.status === 'DELIVERED' ? 'bg-emerald-50 border border-emerald-200' :
          'bg-zinc-100 border border-zinc-200'
        }`}>
          <Text className={`text-[10px] font-bold uppercase ${
            item.status === 'SUBMITTED' ? 'text-rose-700' :
            item.status === 'UNDER REVIEW' ? 'text-amber-700' :
            item.status === 'APPROVED' || item.status === 'DELIVERED' ? 'text-emerald-700' :
            'text-zinc-600'
          }`}>
            {item.status}
          </Text>
        </View>
      </View>
      <View className="border-t border-zinc-100 pt-2 mt-0.5">
        <Text className="text-zinc-400 text-[10px] font-medium uppercase mb-1">Items & Quantities</Text>
        <Text className="text-zinc-800 text-xs font-medium leading-relaxed">
          {typeof item.items === 'object' && item.items !== null
            ? Object.keys(item.items).map(k => `${k} × ${item.items[k]}`).join(', ')
            : Array.isArray(item.items) ? item.items.join(', ') : JSON.stringify(item.items)}
          {item.tshirt_size ? ` (Size: ${item.tshirt_size})` : ''}
        </Text>
      </View>
      <View className="flex-row justify-between items-center mt-1">
        <Text className="text-zinc-400 text-[10px] font-medium uppercase">Requested Date</Text>
        <Text className="text-zinc-800 text-xs font-semibold">{formatToDDMMYYYY(item.created_at)}</Text>
      </View>
    </View>
  );
});

function AccordionCard({ title, icon, expanded, onToggle, children, rightText, rightTextColor, badgeBgColor, badgeBorderColor }: AccordionCardProps) {
  return (
    <View
      className="bg-white rounded-[24px] overflow-hidden"
    >
      <Pressable
        onPress={onToggle}
        className={`p-4 flex-row justify-between items-center w-full bg-white ${expanded ? 'border-b border-zinc-100' : ''}`}
      >
        <View className="flex-row items-center gap-3.5 flex-1 pr-2">
          <View className={`w-9 h-9 rounded-xl justify-center items-center ${badgeBgColor ? badgeBgColor : expanded ? 'bg-zinc-900' : 'bg-zinc-100'}`}>
            <Feather name={icon as any} size={15} color={rightTextColor ? '#E11D48' : expanded ? '#FFFFFF' : '#18181B'} />
          </View>
          <Text className="text-zinc-900 text-[13px] font-bold tracking-tight">{title}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          {rightText && (
            <View className={badgeBgColor ? `px-2 py-0.5 rounded-full border ${badgeBgColor} ${badgeBorderColor || 'border-rose-200'}` : undefined}>
              <Text style={rightTextColor ? { color: rightTextColor } : undefined} className={rightTextColor ? "text-[11px] font-bold uppercase tracking-wider" : "text-zinc-500 text-xs font-semibold"}>{rightText}</Text>
            </View>
          )}
          <View className="w-7 h-7 rounded-full bg-zinc-50 items-center justify-center">
            <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color="#52525B" />
          </View>
        </View>
      </Pressable>

      {expanded && (
        <View className="p-4 bg-zinc-50/70">
          {children}
        </View>
      )}
    </View>
  );
}

function SafeAreaViewWrapper({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#FFF8F8' }}>
      {children}
    </View>
  );
}
