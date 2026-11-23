import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Platform,
  Alert,
  Keyboard,
  Dimensions,
} from 'react-native';
import Reanimated from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { Feather, Ionicons } from '@expo/vector-icons';
import { AvatarImage } from '../AvatarImage';
import { Loading } from '../Loading';
import { NativeSheet } from '../NativeSheet';
import { InlineDatePicker } from '../InlineDatePicker';
import { NativeFitnessDropdown } from '../NativeFitnessDropdown';
import { Database } from '../../database/Database';
import { softShadow } from '../../utils/shadows';
import { uploadAvatarToStorage } from '../../utils/uploadAvatar';
import { cleanEmail, isValidPhone, isValidEmail } from '../../utils/inputSafety';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const DEFAULT_AVATARS = [
  { id: 'avatar_male', label: 'Men', gender: 'male', uri: '' },
  { id: 'avatar_female', label: 'Women', gender: 'female', uri: '' },
];

export const getDefaultAvatarForGender = (gender?: string) => {
  const g = (gender || '').toLowerCase();
  if (g === 'female' || g === 'women') {
    return DEFAULT_AVATARS[1].uri;
  }
  return DEFAULT_AVATARS[0].uri;
};

export interface InitialProfileSnapshot {
  name: string;
  mobile: string;
  email: string;
  gender: string;
  dob: string;
  height: string;
  weight: string;
  fitnessLevel: string;
  targetGoal: string;
  preferredLanguage: string;
  city: string;
  avatar: string;
  userId?: string;
}

export interface ClientEditProfileSheetProps {
  visible: boolean;
  insetsTop: number;
  insetsBottom: number;
  initialProfile: InitialProfileSnapshot;
  onClose: () => void;
  onSaveSuccess: () => void;
  onUpdateCoreProfile: (payload: any) => Promise<void>;
}

export const ClientEditProfileSheet = React.memo(function ClientEditProfileSheet({
  visible,
  insetsTop,
  insetsBottom,
  initialProfile,
  onClose,
  onSaveSuccess,
  onUpdateCoreProfile,
}: ClientEditProfileSheetProps) {
  const [editName, setEditName] = useState(initialProfile.name);
  const [editMobile, setEditMobile] = useState(initialProfile.mobile);
  const [editEmail, setEditEmail] = useState(initialProfile.email);
  const [editGender, setEditGender] = useState(initialProfile.gender);
  const [editDob, setEditDob] = useState(initialProfile.dob);
  const [editHeight, setEditHeight] = useState(initialProfile.height);
  const [editWeight, setEditWeight] = useState(initialProfile.weight);
  const [editFitnessLevel, setEditFitnessLevel] = useState(initialProfile.fitnessLevel);
  const [editTargetGoal, setEditTargetGoal] = useState(initialProfile.targetGoal);
  const [editLanguage, setEditLanguage] = useState(initialProfile.preferredLanguage);
  const [editCity, setEditCity] = useState(initialProfile.city);
  const [editAvatar, setEditAvatar] = useState(initialProfile.avatar || DEFAULT_AVATARS[0].uri);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [editProfileError, setEditProfileError] = useState<string | null>(null);
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync draft fields from store snapshot ONLY when modal is closed / opening fresh
  useEffect(() => {
    if (!visible) {
      setEditName(initialProfile.name);
      setEditMobile(initialProfile.mobile);
      setEditEmail(initialProfile.email);
      setEditGender(initialProfile.gender);
      setEditDob(initialProfile.dob);
      setEditHeight(initialProfile.height);
      setEditWeight(initialProfile.weight);
      setEditFitnessLevel(initialProfile.fitnessLevel);
      setEditTargetGoal(initialProfile.targetGoal);
      setEditLanguage(initialProfile.preferredLanguage);
      setEditCity(initialProfile.city);
      setEditAvatar(initialProfile.avatar || DEFAULT_AVATARS[0].uri);
      setEditProfileError(null);
      setShowDatePicker(false);
    }
  }, [visible, initialProfile]);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    };
  }, []);

  const handleClose = useCallback(() => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    setEditProfileError(null);
    onClose();
  }, [onClose]);

  const handleAvatarPicked = async (localUri: string) => {
    const previous = editAvatar;
    setEditAvatar(localUri);
    setIsUploadingAvatar(true);
    try {
      const ownerId = initialProfile.userId || Database.getCurrentUserId();
      if (!ownerId) throw new Error('User not found');
      const publicUrl = await uploadAvatarToStorage(localUri, ownerId, 'users');
      setEditAvatar(publicUrl);
    } catch (e: any) {
      console.warn('[AvatarPicker] Upload failed:', e);
      setEditAvatar(previous);
      Alert.alert('Upload Failed', e?.message || 'Photo upload nahi ho payi. Network check karke dobara try karein.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const pickAvatarImage = async (source: 'camera' | 'library') => {
    if (isUploadingAvatar) return;
    try {
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Camera permission is needed to take a profile picture.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.5,
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
          await handleAvatarPicked(result.assets[0].uri);
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Gallery access is needed to select a profile picture.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.5,
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
          await handleAvatarPicked(result.assets[0].uri);
        }
      }
    } catch (e: any) {
      console.warn('[AvatarPicker] Error picking image:', e);
      Alert.alert('Picker Error', 'Unable to pick image. Please try again.');
    }
  };

  const handleSaveProfile = async () => {
    if (isSavingProfile || isUploadingAvatar) return;
    setEditProfileError(null);

    const normalizeMobile = (v: string) => v.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    const storedMobile = (initialProfile.mobile || '').trim();
    const storedEmail = (initialProfile.email || '').trim();
    const storedName = (initialProfile.name || '').trim();
    const storedGender = (initialProfile.gender || '').trim();
    const storedDob = (initialProfile.dob || '').trim();
    const storedHeight = (initialProfile.height || '').trim();
    const storedWeight = (initialProfile.weight || '').trim();
    const storedFitnessLevel = (initialProfile.fitnessLevel || '').trim();
    const storedTargetGoal = (initialProfile.targetGoal || '').trim();
    const storedLanguage = (initialProfile.preferredLanguage || '').trim();
    const storedCity = (initialProfile.city || '').trim();
    const storedAvatar = (initialProfile.avatar || '').trim();

    const mobileChanged = normalizeMobile(editMobile) !== normalizeMobile(storedMobile);
    const emailChanged = editEmail.trim().toLowerCase() !== storedEmail.toLowerCase();
    const nameChanged = editName.trim() !== storedName;
    const genderChanged = editGender.trim() !== storedGender;
    const dobChanged = editDob.trim() !== storedDob;
    const heightChanged = editHeight.trim() !== storedHeight;
    const weightChanged = editWeight.trim() !== storedWeight;
    const fitnessLevelChanged = editFitnessLevel.trim() !== storedFitnessLevel;
    const targetGoalChanged = editTargetGoal.trim() !== storedTargetGoal;
    const languageChanged = editLanguage.trim() !== storedLanguage;
    const cityChanged = editCity.trim() !== storedCity;
    const avatarChanged = (editAvatar || '').trim() !== storedAvatar;

    const hasAnyChange =
      mobileChanged ||
      emailChanged ||
      nameChanged ||
      genderChanged ||
      dobChanged ||
      heightChanged ||
      weightChanged ||
      fitnessLevelChanged ||
      targetGoalChanged ||
      languageChanged ||
      cityChanged ||
      avatarChanged;

    if (!hasAnyChange) {
      setEditProfileError('No changes to save');
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = setTimeout(() => {
        handleClose();
      }, 3000);
      return;
    }

    if (typeof editAvatar === 'string' && editAvatar.startsWith('file://')) {
      Alert.alert('Upload Pending', 'Profile picture abhi upload ho rahi hai. Thodi der baad save karein.');
      return;
    }

    if (mobileChanged && editMobile.trim() && !isValidPhone(editMobile)) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (emailChanged && editEmail.trim() && !isValidEmail(editEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    try {
      setIsSavingProfile(true);
      await onUpdateCoreProfile({
        name: editName,
        mobile: mobileChanged ? editMobile.trim() : storedMobile,
        email: emailChanged ? editEmail.trim() : storedEmail,
        gender: editGender,
        dob: editDob,
        height: editHeight,
        weight: editWeight,
        fitnessLevel: editFitnessLevel,
        targetGoal: editTargetGoal,
        preferredLanguage: editLanguage,
        city: editCity,
        avatar: editAvatar,
      });
      handleClose();
      onSaveSuccess();
    } catch (err: any) {
      console.error('[Profile Update Error]', err);
      Alert.alert('Save Error', err.message || 'Failed to save profile changes. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <NativeSheet visible={visible} onClose={handleClose} backgroundColor="#FFFFFF" fullHeight={true}>
      <View
        style={{
          height: keyboardHeight > 0
            ? Math.max(SCREEN_HEIGHT - keyboardHeight - insetsTop - 16, 320)
            : Math.min(SCREEN_HEIGHT * 0.88, 760),
          paddingBottom: Platform.OS === 'ios' ? insetsBottom : 0,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          backgroundColor: '#FFFFFF',
          overflow: 'hidden',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ paddingTop: 12, paddingBottom: 6, alignItems: 'center' }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0' }} />
        </View>

        <View className="px-6 py-3 flex-row justify-between items-center border-b border-slate-100 flex-shrink-0">
          <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-lg font-bold text-[#0F172A] tracking-tight">
            Edit Personal Information
          </Text>
          <Pressable
            onPress={handleClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: '#F1F5F9',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="x" size={16} color="#64748B" />
          </Pressable>
        </View>

        <Reanimated.ScrollView
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}
          contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
        >
          <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' }}>
            <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[11px] font-bold text-slate-500 tracking-wider uppercase mb-3">
              Profile Picture
            </Text>
            <View className="flex-row items-center gap-3.5">
              <View style={{ width: 56, height: 56, borderRadius: 28, padding: 2, borderWidth: 2, borderColor: '#E11D48', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                <AvatarImage
                  uri={editAvatar || initialProfile.avatar}
                  gender={(editGender || initialProfile.gender) as string}
                  style={{ width: '100%', height: '100%', borderRadius: 999 }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                />
                {isUploadingAvatar && (
                  <View className="absolute inset-0 rounded-full bg-black/45 items-center justify-center">
                    <Loading size="small" color="#FFFFFF" />
                  </View>
                )}
              </View>

              <View className="flex-1 flex-row gap-2">
                <Pressable
                  onPress={() => pickAvatarImage('camera')}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(226, 232, 240, 0.9)',
                    ...softShadow({ color: '#0F172A', opacity: 0.04, radius: 4, offsetY: 1 }),
                  }}
                >
                  <Feather name="camera" size={14} color="#64748B" />
                  <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-xs font-semibold text-slate-700">Camera</Text>
                </Pressable>

                <Pressable
                  onPress={() => pickAvatarImage('library')}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(226, 232, 240, 0.9)',
                    ...softShadow({ color: '#0F172A', opacity: 0.04, radius: 4, offsetY: 1 }),
                  }}
                >
                  <Feather name="image" size={14} color="#64748B" />
                  <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-xs font-semibold text-slate-700">Gallery</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
              Full Name
            </Text>
            <TextInput
              maxLength={250}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your Full Name"
              placeholderTextColor="#94A3B8"
              style={{
                backgroundColor: '#F8FAFC',
                borderWidth: 1,
                borderColor: 'rgba(226, 232, 240, 0.9)',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 14,
                color: '#0F172A',
                fontFamily: 'Outfit_600SemiBold',
              }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
              Mobile Number
            </Text>
            <View className="flex-row items-center gap-2">
              <View
                style={{
                  width: 72,
                  height: 48,
                  backgroundColor: '#F1F5F9',
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-sm font-bold text-slate-700">+91</Text>
              </View>
              <View
                style={{
                  flex: 1,
                  height: 48,
                  backgroundColor: '#F8FAFC',
                  borderWidth: 1,
                  borderColor: 'rgba(226, 232, 240, 0.9)',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <TextInput
                  value={editMobile.replace(/^\+?91\s*/, '')}
                  onChangeText={(val) => {
                    const cleaned = val.replace(/^\+?91\s*/, '').replace(/[^0-9]/g, '');
                    setEditMobile(cleaned);
                  }}
                  keyboardType="phone-pad"
                  maxLength={10}
                  placeholder="9876543210"
                  placeholderTextColor="#94A3B8"
                  style={{ flex: 1, fontSize: 14, color: '#0F172A', fontFamily: 'Outfit_600SemiBold' }}
                />
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              </View>
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
              Email Address
            </Text>
            <TextInput
              maxLength={254}
              value={editEmail}
              onChangeText={(v) => setEditEmail(cleanEmail(v))}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="name@example.com"
              placeholderTextColor="#94A3B8"
              style={{
                backgroundColor: '#F8FAFC',
                borderWidth: 1,
                borderColor: 'rgba(226, 232, 240, 0.9)',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 14,
                color: '#0F172A',
                fontFamily: 'Outfit_500Medium',
              }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
              Gender
            </Text>
            <View className="flex-row gap-2">
              {['Male', 'Female', 'Other'].map((g) => {
                const isSelected = editGender.toLowerCase() === g.toLowerCase();
                return (
                  <Pressable
                    key={g}
                    onPress={() => {
                      setEditGender(g);
                      const isDefault = !editAvatar || DEFAULT_AVATARS.some((av) => av.uri === editAvatar);
                      if (isDefault) {
                        setEditAvatar(getDefaultAvatarForGender(g));
                      }
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 11,
                      paddingHorizontal: 8,
                      backgroundColor: '#FFFFFF',
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isSelected ? '#E11D48' : '#E2E8F0',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      ...softShadow({ color: isSelected ? '#E11D48' : '#0F172A', opacity: isSelected ? 0.08 : 0.02, radius: 4, offsetY: 1 }),
                    }}
                  >
                    <View
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        borderWidth: isSelected ? 2 : 1,
                        borderColor: isSelected ? '#E11D48' : '#CBD5E1',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isSelected && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#E11D48' }} />}
                    </View>
                    <Text
                      style={{
                        fontFamily: isSelected ? 'Outfit_700Bold' : 'Outfit_500Medium',
                        color: isSelected ? '#E11D48' : '#475569',
                        fontSize: 12,
                      }}
                    >
                      {g}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
              Date of Birth
            </Text>
            <Pressable
              onPress={() => setShowDatePicker((prev) => !prev)}
              style={{
                backgroundColor: '#F8FAFC',
                borderWidth: 1,
                borderColor: showDatePicker ? '#E11D48' : 'rgba(226, 232, 240, 0.9)',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 13,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text
                style={{
                  flex: 1,
                  fontSize: 14,
                  color: editDob ? '#0F172A' : '#94A3B8',
                  fontFamily: 'Outfit_600SemiBold',
                  letterSpacing: editDob ? 0.5 : 0,
                }}
              >
                {editDob || 'DD/MM/YYYY'}
              </Text>
              <Feather name="calendar" size={16} color={showDatePicker ? '#E11D48' : '#64748B'} />
            </Pressable>

            {showDatePicker && (
              <InlineDatePicker
                value={editDob}
                onChange={(dStr) => setEditDob(dStr)}
                onClose={() => setShowDatePicker(false)}
              />
            )}
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1" style={{ gap: 6 }}>
              <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
                Height (CM)
              </Text>
              <TextInput
                maxLength={250}
                value={editHeight}
                onChangeText={setEditHeight}
                placeholder="189"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                style={{
                  backgroundColor: '#F8FAFC',
                  borderWidth: 1,
                  borderColor: 'rgba(226, 232, 240, 0.9)',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  fontSize: 14,
                  color: '#0F172A',
                  fontFamily: 'Outfit_600SemiBold',
                }}
              />
            </View>

            <View className="flex-1" style={{ gap: 6 }}>
              <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
                Weight (KG)
              </Text>
              <TextInput
                maxLength={250}
                value={editWeight}
                onChangeText={setEditWeight}
                placeholder="85"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                style={{
                  backgroundColor: '#F8FAFC',
                  borderWidth: 1,
                  borderColor: 'rgba(226, 232, 240, 0.9)',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  fontSize: 14,
                  color: '#0F172A',
                  fontFamily: 'Outfit_600SemiBold',
                }}
              />
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
              Fitness Level
            </Text>
            <NativeFitnessDropdown value={editFitnessLevel} onSelect={(lvl) => setEditFitnessLevel(lvl)} />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
              Area
            </Text>
            <TextInput
              maxLength={250}
              value={editCity}
              onChangeText={setEditCity}
              placeholder="e.g. Koramangala, Indiranagar"
              placeholderTextColor="#94A3B8"
              style={{
                backgroundColor: '#F8FAFC',
                borderWidth: 1,
                borderColor: 'rgba(226, 232, 240, 0.9)',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 14,
                color: '#334155',
                fontFamily: 'Outfit_500Medium',
              }}
            />
          </View>
        </Reanimated.ScrollView>

        {Boolean(editProfileError) && (
          <View className="py-2.5 items-center justify-center">
            <Text className="text-rose-600 text-xs font-bold text-center tracking-wide uppercase">
              No changes to save
            </Text>
          </View>
        )}

        <View
          style={{
            paddingHorizontal: 24,
            paddingTop: 12,
            paddingBottom: 12,
            borderTopWidth: 1,
            borderTopColor: '#F1F5F9',
            backgroundColor: '#FFFFFF',
          }}
          className="flex-row items-center justify-between gap-3"
        >
          <Pressable
            onPress={handleClose}
            disabled={isSavingProfile}
            style={{
              flex: 1,
              paddingVertical: 13,
              paddingHorizontal: 16,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 12,
              backgroundColor: '#FFFFFF',
            }}
          >
            <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-700 text-xs font-bold uppercase tracking-wider">
              Cancel
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSaveProfile}
            disabled={isSavingProfile}
            style={{
              flex: 1.4,
              paddingVertical: 13,
              paddingHorizontal: 20,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 12,
              backgroundColor: isSavingProfile ? '#334155' : '#090D16',
              flexDirection: 'row',
              gap: 8,
              ...softShadow({ color: '#090D16', opacity: 0.2, radius: 8, offsetY: 3 }),
            }}
          >
            {isSavingProfile ? (
              <>
                <Loading size="small" color="#FFFFFF" />
                <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-white text-xs font-bold uppercase tracking-wider">
                  Saving...
                </Text>
              </>
            ) : (
              <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-white text-xs font-bold uppercase tracking-wider">
                Save Changes
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </NativeSheet>
  );
});

