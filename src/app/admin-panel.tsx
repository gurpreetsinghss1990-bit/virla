import * as ImagePicker from 'expo-image-picker';
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform, Image, Modal, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Database, TrainerApplication, getCurrentServerTime, getISTDateInfo, SupportTicket } from '../database/Database';
import { getBookingISTDateRange, getDisplayWorkoutTitle, normalizeDate, formatToDDMMYYYY } from '../utils/date';
import { Booking, Coach } from '../types';
import { LuxuryCard } from '../components/LuxuryCard';
import { supabase } from '../database/supabaseClient';
import { assertUploadableFile } from '../utils/fileType';
import { useBookingStore } from '../store/bookingStore';
import { SupportChatModal } from '../components/SupportChatModal';
import { resolveAvatarSource } from '../components/AvatarImage';

const DEFAULT_FALLBACK_AVATAR = '';
const getSafeAvatarUri = (uri?: string | null) => {
  if (typeof uri === 'string' && uri.trim().length > 0) {
    return uri.trim();
  }
  return DEFAULT_FALLBACK_AVATAR;
};

export default function AdminPanelScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ tab?: string }>();
  const [applications, setApplications] = useState<TrainerApplication[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdminAuthorized, setIsAdminAuthorized] = useState<boolean | null>(null);
  
  const [activeTab, setActiveTab] = useState<'applications' | 'live' | 'locations' | 'acceptance' | 'disputes' | 'kits' | 'support'>('applications');
  const [disputeSection, setDisputeSection] = useState<'user' | 'trainer'>('user');
  const [disputes, setDisputes] = useState<any[]>([]);
  const [kitOrders, setKitOrders] = useState<any[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [isLoadingSupportTickets, setIsLoadingSupportTickets] = useState<boolean>(false);
  const [selectedSupportChatTicket, setSelectedSupportChatTicket] = useState<SupportTicket | null>(null);
  const [verificationDocs, setVerificationDocs] = useState<{[appId: string]: any}>({});
  const [hasLoadError, setHasLoadError] = useState<boolean>(false);
  const [isLoadingDisputesAndKits, setIsLoadingDisputesAndKits] = useState<boolean>(false);

  // Filters for trainer locations
  const [radiusFilter, setRadiusFilter] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending' | 'rejected'>('all');
  const [selectedAuditSession, setSelectedAuditSession] = useState<Booking | null>(null);

  // Direct Admin Location & Radius Override Modal state
  const [editingCoachLocation, setEditingCoachLocation] = useState<Coach | null>(null);
  const [overrideRadius, setOverrideRadius] = useState<number>(5);
  const [overrideAddress, setOverrideAddress] = useState<string>('');

  // Physical Interview Verification Form Modal state
  const [interviewFormApp, setInterviewFormApp] = useState<TrainerApplication | null>(null);
  const [interviewIdType, setInterviewIdType] = useState<'aadhaar' | 'pan'>('aadhaar');
  const [interviewIdDocUri, setInterviewIdDocUri] = useState<string>('');
  const [interviewProfilePicUri, setInterviewProfilePicUri] = useState<string>('');
  const [isSavingInterviewForm, setIsSavingInterviewForm] = useState<boolean>(false);
  const [interviewCompletedMap, setInterviewCompletedMap] = useState<{[appId: string]: boolean}>({});
  const [overrideStatus, setOverrideStatus] = useState<'verified' | 'pending' | 'rejected'>('verified');
  const [isSavingLocation, setIsSavingLocation] = useState<boolean>(false);
  
  // Section expand/collapse and cursor pagination states for Live Console
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    liveStream: false,
    todayBooked: false,
    upcomingBooked: false,
    liveOngoing: false,
    historyAudit: false,
  });

  const [sectionLimits, setSectionLimits] = useState<{ [key: string]: number }>({
    liveStream: 7,
    todayBooked: 7,
    upcomingBooked: 7,
    liveOngoing: 7,
    historyAudit: 7,
  });

  const toggleSection = (sectionKey: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const loadMoreForSection = (sectionKey: string) => {
    setSectionLimits((prev) => ({
      ...prev,
      [sectionKey]: (prev[sectionKey] || 7) + 7,
    }));
  };
  
  // Connect shared bookingStore
  const { bookings, updateTimelineStatus } = useBookingStore();

  const checkAdminAuth = async () => {
    const userId = Database.getCurrentUserId();
    if (!userId) {
      setIsAdminAuthorized(false);
      return;
    }
    try {
      const { data, error } = await supabase.from('users').select('role').eq('id', userId).single();
      if (data && data.role === 'admin') {
        setIsAdminAuthorized(true);
      } else {
        setIsAdminAuthorized(false);
      }
    } catch (err) {
      setIsAdminAuthorized(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      checkAdminAuth();
      useBookingStore.getState().syncFromDB();
      useBookingStore.getState().refreshBookings();
    });
  }, []);

  useEffect(() => {
    if (searchParams?.tab === 'live') {
      setActiveTab('live');
    }
  }, [searchParams?.tab]);

    const loadApplications = async () => {
      if (isAdminAuthorized !== true) return;
      setIsLoading(true);
      try {
        const data = await Database.fetchAllTrainerApplications();
        setApplications(data);
        setCoaches(Database.getCoaches());

        const docsMap: {[appId: string]: any} = {};
        await Promise.all(
          data.map(async (app) => {
            try {
              const docs = await Database.fetchTrainerVerificationDocs(app.id);
              if (docs.length > 0) {
                docsMap[app.id] = docs[0];
              }
            } catch (e) {
              console.error('[AdminPanel] Error fetching verification docs:', e);
            }
          })
        );
        setVerificationDocs(docsMap);

        await loadDisputesAndKits();
      } catch (err: any) {
        Alert.alert('Error', err.message);
      } finally {
        setIsLoading(false);
      }
    };

    const handleViewDocument = async (docUrlOrPath: string) => {
      try {
        if (!docUrlOrPath) {
          Alert.alert('No Document', 'Document file is missing or not provided.');
          return;
        }

        const { Linking } = require('react-native');

        // If it's already a full HTTP(S) URL (e.g. from Supabase public storage)
        if (docUrlOrPath.startsWith('http://') || docUrlOrPath.startsWith('https://')) {
          const supported = await Linking.canOpenURL(docUrlOrPath);
          if (supported) {
            await Linking.openURL(docUrlOrPath);
          } else {
            Alert.alert('Error', 'Unable to open file URL on device.');
          }
          return;
        }

        // If it's a storage path in trainer-documents or trainer-verification
        const bucket = docUrlOrPath.includes('trainer-docs') ? 'trainer-documents' : 'trainer-verification';
        const cleanPath = docUrlOrPath.replace(/^trainer-docs\//, '').replace(/^trainer-documents\//, '');

        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(docUrlOrPath, 120);

        if (error) {
          // Fallback to getPublicUrl
          const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(docUrlOrPath);
          if (pubData?.publicUrl) {
            await Linking.openURL(pubData.publicUrl);
            return;
          }
          throw error;
        }

        if (data?.signedUrl) {
          await Linking.openURL(data.signedUrl);
        } else {
          Alert.alert('Error', 'Could not generate signed URL for document.');
        }
      } catch (err: any) {
        Alert.alert('Failed to view document', err.message || String(err));
      }
    };

    const loadDisputesAndKits = async () => {
      setIsLoadingDisputesAndKits(true);
      setHasLoadError(false);
      try {
        const dispData = await Database.fetchAllDisputes();
        setDisputes(dispData);
        const kitData = await Database.fetchAllKitOrders();
        setKitOrders(kitData);
      } catch (err: any) {
        console.error('[Admin] loadDisputesAndKits error:', err.message);
        setHasLoadError(true);
      } finally {
        setIsLoadingDisputesAndKits(false);
      }
    };

    const loadSupportTickets = async () => {
      setIsLoadingSupportTickets(true);
      try {
        const tickets = await Database.fetchAllSupportTickets();
        setSupportTickets(tickets);
      } catch (err: any) {
        console.error('[Admin] loadSupportTickets error:', err.message);
      } finally {
        setIsLoadingSupportTickets(false);
      }
    };

    const refreshAllAdminData = async () => {
      setIsLoading(true);
      try {
        await Database.reload();
        await useBookingStore.getState().syncFromDB();
        await useBookingStore.getState().refreshBookings();
        await loadApplications();
        await loadDisputesAndKits();
        await loadSupportTickets();
      } catch (err: any) {
        console.error('[Admin] Refresh error:', err.message);
      } finally {
        setIsLoading(false);
      }
    };

    const handleApproveLocation = async (coachId: string) => {
      const coach = Database.schema.coaches.find(c => c.id === coachId);
      if (!coach || !coach.preferences?.addressChangeRequest) return;
      
      const request = coach.preferences.addressChangeRequest;
      const updatedPrefs = {
        ...coach.preferences,
        operatingAddress: request.requestedAddress,
        operatingLatitude: request.requestedLatitude,
        operatingLongitude: request.requestedLongitude,
        operatingPlaceId: request.requestedPlaceId,
        radiusKm: Math.min(request.requestedRadius || 5, 5),
        operatingLocationStatus: 'verified' as const,
        addressChangeRequest: null
      };
      
      try {
        await Database.updateTrainerPreferences(coachId, updatedPrefs);
        Alert.alert('Location Change Approved', `Operating base coordinates for Coach ${coach.name} successfully updated and verified.`);
        setCoaches(Database.getCoaches());
      } catch (err: any) {
        Alert.alert('Error', err.message);
      }
    };

    const handleRejectLocation = async (coachId: string) => {
      const coach = Database.schema.coaches.find(c => c.id === coachId);
      if (!coach || !coach.preferences?.addressChangeRequest) return;
      
      const updatedPrefs = {
        ...coach.preferences,
        operatingLocationStatus: coach.preferences.operatingAddress ? 'verified' as const : 'rejected' as const,
        addressChangeRequest: null
      };
      
      try {
        await Database.updateTrainerPreferences(coachId, updatedPrefs);
        Alert.alert('Location Change Rejected', `Operating base change request for Coach ${coach.name} has been rejected.`);
        setCoaches(Database.getCoaches());
      } catch (err: any) {
        Alert.alert('Error', err.message);
      }
    };

    const handleOpenEditLocation = (coach: Coach) => {
      setEditingCoachLocation(coach);
      setOverrideRadius(Math.min(coach.preferences?.radiusKm || 5, 5));
      setOverrideAddress(coach.preferences?.operatingAddress || '');
      setOverrideStatus(coach.preferences?.operatingLocationStatus || 'pending');
    };

    const handleSaveLocationOverride = async () => {
      if (!editingCoachLocation) return;
      setIsSavingLocation(true);
      try {
        const coach = Database.schema.coaches.find(c => c.id === editingCoachLocation.id) || editingCoachLocation;
        const currentPrefs = coach.preferences || { online: false, radiusKm: 5, maxDailySessions: 5, categories: [] };
        
        const updatedPrefs = {
          ...currentPrefs,
          operatingAddress: overrideAddress.trim() || currentPrefs.operatingAddress,
          radiusKm: Math.min(overrideRadius, 5),
          operatingLocationStatus: overrideStatus,
        };

        await Database.updateTrainerPreferences(editingCoachLocation.id, updatedPrefs);
        Alert.alert('Success', `Operating area and service radius updated for Coach ${coach.name}.`);
        setCoaches(Database.getCoaches());
        setEditingCoachLocation(null);
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to update location.');
      } finally {
        setIsSavingLocation(false);
      }
    };

    const handleQuickVerifyLocation = async (coachId: string) => {
      const coach = Database.schema.coaches.find(c => c.id === coachId);
      if (!coach) return;
      try {
        const currentPrefs = coach.preferences || { online: false, radiusKm: 5, maxDailySessions: 5, categories: [] };
        await Database.updateTrainerPreferences(coachId, {
          ...currentPrefs,
          radiusKm: Math.min(currentPrefs.radiusKm || 5, 5),
          operatingLocationStatus: 'verified' as const
        });
        Alert.alert('Status Updated', `Coach ${coach.name}'s location has been marked as VERIFIED.`);
        setCoaches(Database.getCoaches());
      } catch (err: any) {
        Alert.alert('Error', err.message);
      }
    };

  useEffect(() => {
    if (isAdminAuthorized === true) {
      Promise.resolve().then(() => {
        loadApplications();
        loadDisputesAndKits();
        loadSupportTickets();
      });
    }
  }, [isAdminAuthorized, activeTab]);

  const handleCaptureInterviewPhoto = async (target: 'id' | 'profile') => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to capture photos.');
        return;
      }
      const isProfilePic = target === 'profile';
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: isProfilePic,
        aspect: isProfilePic ? [1, 1] : undefined,
        quality: isProfilePic ? 0.7 : 0.8,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        if (target === 'id') {
          setInterviewIdDocUri(result.assets[0].uri);
        } else {
          setInterviewProfilePicUri(result.assets[0].uri);
        }
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Could not open camera.');
    }
  };

  const handlePickInterviewGallery = async (target: 'id' | 'profile') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Gallery permission is required to select photos.');
        return;
      }
      const isProfilePic = target === 'profile';
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: isProfilePic,
        aspect: isProfilePic ? [1, 1] : undefined,
        quality: isProfilePic ? 0.7 : 0.8,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        if (target === 'id') {
          setInterviewIdDocUri(result.assets[0].uri);
        } else {
          setInterviewProfilePicUri(result.assets[0].uri);
        }
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Could not pick image.');
    }
  };

  const handleSaveInterviewForm = async () => {
    if (!interviewFormApp) return;
    if (!interviewIdDocUri && !interviewProfilePicUri) {
      Alert.alert('Form Incomplete', 'Please upload or capture at least the ID Document (Aadhaar / PAN) or Trainer Profile Photo.');
      return;
    }

    setIsSavingInterviewForm(true);
    try {
      let uploadedIdUrl = '';
      let uploadedAvatarUrl = '';

      // Upload ID Document to Supabase if captured
      if (interviewIdDocUri) {
        try {
          const resp = await fetch(interviewIdDocUri);
          const arrayBuffer = await resp.arrayBuffer();
          const { ext, contentType } = assertUploadableFile(arrayBuffer, ['jpg', 'png', 'webp', 'heic', 'pdf']);
          const cleanFileName = `interview-${interviewIdType}-${interviewFormApp.id}-${Date.now()}.${ext}`;
          const filePath = `trainer-docs/${cleanFileName}`;
          
          await supabase.storage
            .from('trainer-documents')
            .upload(filePath, arrayBuffer, { upsert: true, contentType: `image/${ext}` });
          
          const { data: pubData } = supabase.storage.from('trainer-documents').getPublicUrl(filePath);
          uploadedIdUrl = pubData?.publicUrl || filePath;
        } catch (e: any) {
          console.warn('[Admin] Direct upload fallback for ID:', e);
          uploadedIdUrl = interviewIdDocUri;
        }
      }

      // Upload Profile Photo to Supabase if captured
      if (interviewProfilePicUri) {
        try {
          const resp = await fetch(interviewProfilePicUri);
          const arrayBuffer = await resp.arrayBuffer();
          const { ext, contentType } = assertUploadableFile(arrayBuffer, ['jpg', 'png', 'webp', 'heic']);
          const cleanFileName = `interview-avatar-${interviewFormApp.id}-${Date.now()}.${ext}`;
          const filePath = `trainer-docs/${cleanFileName}`;
          
          await supabase.storage
            .from('trainer-documents')
            .upload(filePath, arrayBuffer, { upsert: true, contentType: `image/${ext}` });
          
          const { data: pubData } = supabase.storage.from('trainer-documents').getPublicUrl(filePath);
          uploadedAvatarUrl = pubData?.publicUrl || filePath;
        } catch (e: any) {
          console.warn('[Admin] Direct upload fallback for Avatar:', e);
          uploadedAvatarUrl = interviewProfilePicUri;
        }
      }

      await Database.completeInterviewFormAndVerify(interviewFormApp.id, {
        idDocUrl: uploadedIdUrl || undefined,
        idType: interviewIdType,
        avatarUrl: uploadedAvatarUrl || undefined,
      });

      setInterviewCompletedMap(prev => ({ ...prev, [interviewFormApp.id]: true }));
      Alert.alert(
        'Interview Form Saved ✓',
        'Physical verification details have been recorded. You can now proceed to Approve this trainer.'
      );
      setInterviewFormApp(null);
      setInterviewIdDocUri('');
      setInterviewProfilePicUri('');
      await loadApplications();
    } catch (err: any) {
      Alert.alert('Save Error', err.message || 'Failed to save interview form details.');
    } finally {
      setIsSavingInterviewForm(false);
    }
  };

  const handlePhysicalInterviewApp = async (appId: string) => {
    try {
      await Database.schedulePhysicalInterviewTrainerApplication(appId);
      Alert.alert('Interview Scheduled', 'User is called for physical interview. The trainer application has been updated.');
      await loadApplications();
    } catch (err: any) {
      Alert.alert('Action Error', err.message);
    }
  };

  const handleApproveApp = async (appId: string) => {
    try {
      await Database.approveTrainerApplication(appId);
      Alert.alert('Approved Successfully', 'Trainer record has been created and user promoted to trainer role.');
      await loadApplications();
    } catch (err: any) {
      Alert.alert('Approval Error', err.message);
    }
  };

  const handleRejectApp = async (appId: string) => {
    try {
      await Database.rejectTrainerApplication(appId);
      Alert.alert('Application Rejected', 'Onboarding status has been updated to rejected.');
      await loadApplications();
    } catch (err: any) {
      Alert.alert('Rejection Error', err.message);
    }
  };

  const handleRequestInfoApp = async (appId: string) => {
    try {
      await Database.requestMoreInfoTrainerApplication(appId);
      Alert.alert('Information Requested', 'Onboarding status has been updated to info_requested.');
      await loadApplications();
    } catch (err: any) {
      Alert.alert('Request Error', err.message);
    }
  };

  const pendingAppsCount = applications.filter(a => a.status === 'pending' || a.status === 'info_requested').length;

  // Live session analytics metrics calculation
  const liveSessions = bookings.filter(b => {
    const ts = (b.timelineStatus || '').toLowerCase();
    return b.status === 'upcoming' && ts !== '' && ts !== 'booked' && ts !== 'session_closed';
  });
  
  // A session is considered delayed if it's assigned/accepted but hasn't advanced to travelling/arrived yet
  const delayedSessions = bookings.filter(b => {
    const ts = (b.timelineStatus || '').toLowerCase();
    return b.status === 'upcoming' && (ts === 'trainer_assigned' || ts === 'trainer_accepted');
  });
  
  const completedSessionsCount = bookings.filter(b => b.status === 'completed').length;
  const cancelledSessionsCount = bookings.filter(b => b.status === 'cancelled' || b.status === 'client_no_show' || b.status === 'trainer_no_show').length;
  const missedOrEndedSessions = bookings.filter(b => b.status !== 'upcoming');

  if (isAdminAuthorized === null) {
    return (
      <SafeAreaViewWrapper>
        <View className="flex-1 bg-[#FCF5F5] justify-center items-center">
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text className="text-zinc-400 text-xs font-black uppercase tracking-wider mt-4">Verifying Credentials...</Text>
        </View>
      </SafeAreaViewWrapper>
    );
  }

  if (isAdminAuthorized === false) {
    return (
      <SafeAreaViewWrapper>
        <View className="flex-1 bg-[#FCF5F5] justify-center items-center px-6">
          <Text className="text-4xl mb-4">🚫</Text>
          <Text className="text-zinc-900 text-sm font-black tracking-tight uppercase">Access Denied</Text>
          <Text className="text-zinc-500 text-xs font-semibold text-center mt-2 leading-relaxed">
            You do not have administrative permissions to view this control panel.
          </Text>
          <TouchableOpacity
            onPress={() => router.replace('/(tabs)/profile' as any)}
            className="mt-6 bg-[#101828] py-3.5 px-6 rounded-xl shadow-md"
          >
            <Text className="text-white text-xs font-black uppercase tracking-wider">Return to Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaViewWrapper>
    );
  }

  return (
    <SafeAreaViewWrapper>
      <View className="flex-1 bg-[#FCF5F5]">
        {/* Header */}
        <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white justify-between">
          <TouchableOpacity 
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/profile' as any);
              }
            }} 
            className="w-8 h-8 items-center justify-center"
          >
            <Ionicons name="arrow-back" size={20} color="#101828" />
          </TouchableOpacity>
          <Text className="text-[#101828] text-xs font-black uppercase tracking-wider">
            Admin Control Panel
          </Text>
          <TouchableOpacity onPress={refreshAllAdminData} className="w-8 h-8 items-center justify-center">
            <Feather name="refresh-cw" size={16} color="#101828" />
          </TouchableOpacity>
        </View>

        {/* Navigation Tabs Header */}
        <View className="bg-white border-b border-zinc-150 p-1">
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 6, gap: 8 }}
          >
            <TouchableOpacity
              onPress={() => setActiveTab('applications')}
              className={`px-4 py-2 rounded-xl items-center justify-center ${activeTab === 'applications' ? 'bg-zinc-950' : 'bg-zinc-50 border border-zinc-200/50'}`}
            >
              <Text className={`text-[9px] font-black uppercase tracking-wider ${activeTab === 'applications' ? 'text-white' : 'text-zinc-500'}`}>Onboarding</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => router.push('/admin-workout-approvals')}
              className="px-4 py-2 rounded-xl items-center justify-center bg-zinc-50 border border-zinc-200/50"
            >
              <Text className="text-[9px] font-black uppercase tracking-wider text-zinc-500 font-extrabold">Workouts</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => setActiveTab('locations')}
              className={`px-4 py-2 rounded-xl items-center justify-center ${activeTab === 'locations' ? 'bg-zinc-950' : 'bg-zinc-50 border border-zinc-200/50'}`}
            >
              <Text className={`text-[9px] font-black uppercase tracking-wider ${activeTab === 'locations' ? 'text-white' : 'text-zinc-500'}`}>Locations</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => setActiveTab('live')}
              className={`px-4 py-2 rounded-xl items-center justify-center ${activeTab === 'live' ? 'bg-zinc-950' : 'bg-zinc-50 border border-zinc-200/50'}`}
            >
              <Text className={`text-[9px] font-black uppercase tracking-wider ${activeTab === 'live' ? 'text-white' : 'text-zinc-500'}`}>Live Console</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => setActiveTab('acceptance')}
              className={`px-4 py-2 rounded-xl items-center justify-center ${activeTab === 'acceptance' ? 'bg-zinc-950' : 'bg-zinc-50 border border-zinc-200/50'}`}
            >
              <Text className={`text-[9px] font-black uppercase tracking-wider ${activeTab === 'acceptance' ? 'text-white' : 'text-zinc-500'}`}>Acceptance</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => setActiveTab('disputes')}
              className={`px-4 py-2 rounded-xl items-center justify-center ${activeTab === 'disputes' ? 'bg-zinc-950' : 'bg-zinc-50 border border-zinc-200/50'}`}
            >
              <Text className={`text-[9px] font-black uppercase tracking-wider ${activeTab === 'disputes' ? 'text-white' : 'text-zinc-500'}`}>Disputes</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => setActiveTab('kits')}
              className={`px-4 py-2 rounded-xl items-center justify-center ${activeTab === 'kits' ? 'bg-zinc-950' : 'bg-zinc-50 border border-zinc-200/50'}`}
            >
              <Text className={`text-[9px] font-black uppercase tracking-wider ${activeTab === 'kits' ? 'text-white' : 'text-zinc-500'}`}>Kits</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('support')}
              className={`px-4 py-2 rounded-xl items-center justify-center flex-row gap-1.5 ${activeTab === 'support' ? 'bg-rose-600' : 'bg-rose-50 border border-rose-200/60'}`}
            >
              <Feather name="headphones" size={11} color={activeTab === 'support' ? '#FFFFFF' : '#E11D48'} />
              <Text className={`text-[9px] font-black uppercase tracking-wider ${activeTab === 'support' ? 'text-white' : 'text-rose-600'}`}>
                Client Support
              </Text>
              {supportTickets.filter(t => t.status === 'OPEN').length > 0 && (
                <View className={`px-1.5 py-0.2 rounded-full ${activeTab === 'support' ? 'bg-white' : 'bg-rose-600'}`}>
                  <Text className={`text-[8px] font-black ${activeTab === 'support' ? 'text-rose-600' : 'text-white'}`}>
                    {supportTickets.filter(t => t.status === 'OPEN').length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 60 }}>
          
          {activeTab === 'applications' && (
            <View className="gap-6">
              <View>
                <Text className="text-zinc-900 text-xl font-black tracking-tight uppercase">Trainer Applications</Text>
                <Text className="text-[#6B7280] text-xs font-semibold mt-1 leading-relaxed">
                  Verify credentials and approve registrations.
                </Text>
              </View>

              {isLoading ? (
                <View className="py-20 justify-center items-center">
                  <ActivityIndicator size="small" color="#4F46E5" />
                </View>
              ) : (
                <>
                  <View className="flex-row justify-between gap-y-4">
                    <View className="w-[47%] bg-white border border-[#E5E7EB] p-4.5 rounded-[24px] shadow-xs gap-1.5">
                      <Text className="text-zinc-400 text-[8px] font-black uppercase">Pending Approval</Text>
                      <Text className="text-zinc-900 text-sm font-black">{pendingAppsCount} Applications</Text>
                    </View>
                    <View className="w-[47%] bg-white border border-[#E5E7EB] p-4.5 rounded-[24px] shadow-xs gap-1.5">
                      <Text className="text-zinc-400 text-[8px] font-black uppercase">Total Records</Text>
                      <Text className="text-zinc-900 text-sm font-black">{applications.length} Profiles</Text>
                    </View>
                  </View>

                  <View className="gap-4">
                    {applications.length === 0 ? (
                      <View className="bg-white border border-[#E5E7EB] p-8 rounded-[28px] items-center justify-center py-10 shadow-xs">
                        <Feather name="folder" size={24} color="#9CA3AF" />
                        <Text className="text-zinc-500 text-xs font-black uppercase mt-2">No application files found</Text>
                      </View>
                    ) : (
                      applications.map((app) => (
                        <LuxuryCard key={app.id} className="p-5 gap-4" interactive={false}>
                          <View className="flex-row justify-between items-start">
                            <View className="flex-row items-center gap-3 flex-1 pr-3">
                              <Image source={{ uri: getSafeAvatarUri(app.avatar) }} className="w-10 h-10 rounded-full border border-zinc-200" />
                              <View className="flex-1">
                                <Text className="text-zinc-950 text-xs font-black leading-tight">{app.fullName}</Text>
                                <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">{app.phone} • {app.email}</Text>
                              </View>
                            </View>
                            
                            <View className={`px-2 py-0.5 rounded-full ${
                              app.status === 'approved' 
                                ? 'bg-green-50 border border-green-150' 
                                : app.status === 'rejected' 
                                ? 'bg-rose-50 border border-rose-150' 
                                : 'bg-amber-50 border border-amber-150'
                            }`}>
                              <Text className={`text-[7px] font-black uppercase ${
                                app.status === 'approved' ? 'text-green-600' : app.status === 'rejected' ? 'text-rose-600' : 'text-amber-600'
                              }`}>
                                {app.status}
                              </Text>
                            </View>
                          </View>

                          <View className="h-[1px] bg-zinc-50" />

                          {/* Personal & Fitness Details Overview */}
                          <View className="gap-1.5 pl-1">
                            <View className="flex-row flex-wrap gap-x-4 gap-y-1">
                              <Text className="text-zinc-800 text-xs font-semibold">
                                DOB: <Text className="font-medium text-zinc-600">{app.dob || 'N/A'}</Text>
                              </Text>
                              <Text className="text-zinc-800 text-xs font-semibold">
                                Gender: <Text className="font-medium text-zinc-600 uppercase">{app.gender || 'N/A'}</Text>
                              </Text>
                              <Text className="text-zinc-800 text-xs font-semibold">
                                City: <Text className="font-medium text-zinc-600">{app.city || 'Mumbai'}</Text>
                              </Text>
                            </View>

                            {!!app.address && (
                              <Text className="text-zinc-800 text-xs font-semibold">
                                Address: <Text className="font-medium text-zinc-600">{app.address}{app.pinCode ? ` (${app.pinCode})` : ''}</Text>
                              </Text>
                            )}

                            <Text className="text-zinc-800 text-xs font-semibold">
                              Specialty: <Text className="font-medium text-zinc-600">{app.primaryWorkout}</Text>
                            </Text>

                            {!!app.secondarySkills && (
                              <Text className="text-zinc-800 text-xs font-semibold">
                                Secondary Skills: <Text className="font-medium text-zinc-600">{app.secondarySkills}</Text>
                              </Text>
                            )}

                            {!!app.fitnessQualifications && (
                              <Text className="text-zinc-800 text-xs font-semibold">
                                Qualifications: <Text className="font-medium text-zinc-600">{app.fitnessQualifications}</Text>
                              </Text>
                            )}

                            <View className="flex-row flex-wrap gap-x-4 gap-y-1">
                              <Text className="text-zinc-800 text-xs font-semibold">
                                Experience: <Text className="font-medium text-zinc-600">{app.yearsOfExperience} years</Text>
                              </Text>
                              <Text className="text-zinc-800 text-xs font-semibold">
                                Languages: <Text className="font-medium text-zinc-600">{app.languages}</Text>
                              </Text>
                              <Text className="text-zinc-800 text-xs font-semibold">
                                Radius: <Text className="font-medium text-zinc-600">{app.preferredWorkingRadius} km</Text>
                              </Text>
                            </View>

                            {!!app.aboutMe && (
                              <Text className="text-zinc-500 text-[11px] italic mt-0.5 leading-relaxed bg-zinc-50 p-2 rounded-lg border border-zinc-100">
                                "{app.aboutMe}"
                              </Text>
                            )}
                          </View>

                          <View className="h-[1px] bg-zinc-100" />

                          <View className="gap-2.5">
                            <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-wider">Verification Documents</Text>
                            
                            {/* Selfie and Certificates Links */}
                            <View className="flex-row gap-2.5">
                              {/* Selfie View */}
                              <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => handleViewDocument(app.documentSelfie || app.avatar)}
                                className="flex-1 bg-zinc-50 p-3 rounded-xl border border-zinc-200/80 items-center justify-center flex-row gap-2"
                              >
                                <Feather name="image" size={14} color="#E11D48" />
                                <View>
                                  <Text className="text-zinc-500 text-[8px] font-bold uppercase">Profile Selfie</Text>
                                  <Text className="text-zinc-900 text-[10px] font-black">View Photo ↗</Text>
                                </View>
                              </TouchableOpacity>

                              {/* Certificates View */}
                              {(() => {
                                let certUrl = '';
                                try {
                                  const parsed = JSON.parse(app.documentCertifications || '[]');
                                  if (Array.isArray(parsed) && parsed.length > 0) {
                                    certUrl = parsed[0];
                                  } else if (typeof parsed === 'string') {
                                    certUrl = parsed;
                                  } else if (parsed?.certifications?.[0]) {
                                    certUrl = parsed.certifications[0];
                                  }
                                } catch (e) {
                                  certUrl = app.documentCertifications || '';
                                }

                                const hasCert = !!certUrl && certUrl.trim() !== '' && certUrl !== '[]' && certUrl !== '[""]';

                                return (
                                  <TouchableOpacity
                                    activeOpacity={hasCert ? 0.8 : 1}
                                    disabled={!hasCert}
                                    onPress={() => hasCert && handleViewDocument(certUrl)}
                                    className={`flex-1 p-3 rounded-xl border items-center justify-center flex-row gap-2 ${
                                      hasCert 
                                        ? 'bg-emerald-50/60 border-emerald-200' 
                                        : 'bg-zinc-50 border-zinc-150 opacity-60'
                                    }`}
                                  >
                                    <Feather name="award" size={14} color={hasCert ? '#059669' : '#9CA3AF'} />
                                    <View>
                                      <Text className="text-zinc-500 text-[8px] font-bold uppercase">Certificate</Text>
                                      <Text className={`text-[10px] font-black ${hasCert ? 'text-emerald-700' : 'text-zinc-400'}`}>
                                        {hasCert ? 'View File ↗' : 'Not Uploaded'}
                                      </Text>
                                    </View>
                                  </TouchableOpacity>
                                );
                              })()}
                            </View>

                            {/* Full List of Uploaded Qualification Certificates */}
                            {(() => {
                              try {
                                const raw = app.documentCertifications || '[]';
                                const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;

                                // Check if we have certMap { [qualName]: url }
                                const certMap: { [key: string]: string } = parsed?.certMap || (
                                  typeof parsed === 'object' && !Array.isArray(parsed) && !parsed?.certifications ? parsed : {}
                                );

                                const mapEntries = Object.entries(certMap).filter(([_, url]) => !!url);

                                if (mapEntries.length > 0) {
                                  return (
                                    <View className="mt-1 gap-1.5 bg-zinc-50/70 p-2.5 rounded-xl border border-zinc-200/80">
                                      <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-wider">
                                        Uploaded Qualification Certificates ({mapEntries.length}):
                                      </Text>
                                      {mapEntries.map(([qualName, cUrl], idx) => (
                                        <TouchableOpacity
                                          key={idx}
                                          activeOpacity={0.7}
                                          onPress={() => handleViewDocument(cUrl)}
                                          className="flex-row items-center justify-between p-2.5 bg-white border border-zinc-200 rounded-lg shadow-2xs"
                                        >
                                          <View className="flex-row items-center gap-2 flex-1 pr-2">
                                            <Feather name="file-text" size={13} color="#059669" />
                                            <Text className="text-zinc-900 text-[10.5px] font-bold flex-1" numberOfLines={1}>
                                              {qualName}
                                            </Text>
                                          </View>
                                          <View className="flex-row items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                                            <Text className="text-emerald-700 text-[9px] font-black uppercase">View Doc ↗</Text>
                                          </View>
                                        </TouchableOpacity>
                                      ))}
                                    </View>
                                  );
                                }

                                // Fallback for list-based certs
                                const list: string[] = Array.isArray(parsed)
                                  ? parsed.filter(Boolean)
                                  : (parsed?.certifications || []).filter(Boolean);

                                if (list.length > 0) {
                                  return (
                                    <View className="mt-1 gap-1.5 bg-zinc-50/70 p-2.5 rounded-xl border border-zinc-200/80">
                                      <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-wider">
                                        Uploaded Certificates ({list.length}):
                                      </Text>
                                      {list.map((cUrl: string, idx: number) => (
                                        <TouchableOpacity
                                          key={idx}
                                          activeOpacity={0.7}
                                          onPress={() => handleViewDocument(cUrl)}
                                          className="flex-row items-center justify-between p-2.5 bg-white border border-zinc-200 rounded-lg shadow-2xs"
                                        >
                                          <View className="flex-row items-center gap-2 flex-1 pr-2">
                                            <Feather name="file-text" size={13} color="#059669" />
                                            <Text className="text-zinc-900 text-[10.5px] font-bold">
                                              Certificate #{idx + 1}
                                            </Text>
                                          </View>
                                          <View className="flex-row items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                                            <Text className="text-emerald-700 text-[9px] font-black uppercase">View Doc ↗</Text>
                                          </View>
                                        </TouchableOpacity>
                                      ))}
                                    </View>
                                  );
                                }
                              } catch (e) {}
                              return null;
                            })()}
                          </View>

                          {app.status !== 'approved' && (
                            <>
                              <View className="h-[1px] bg-zinc-100" />
                              
                              {/* Status banner when physical interview is scheduled */}
                              {app.status === 'interview_scheduled' && (
                                <View className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex-row items-center gap-2 mt-1">
                                  <Feather name="calendar" size={13} color="#D97706" />
                                  <Text className="text-amber-900 text-[10px] font-black uppercase tracking-wide">
                                    User is called for physical interview
                                  </Text>
                                </View>
                              )}

                              {/* Action Buttons Row */}
                              <View className="gap-2 mt-1">
                                <View className="flex-row gap-2">
                                  {/* 1. Physical Interview Button: Disables once clicked */}
                                  <TouchableOpacity
                                    disabled={app.status === 'interview_scheduled'}
                                    activeOpacity={0.8}
                                    onPress={() => handlePhysicalInterviewApp(app.id)}
                                    className={`flex-1 py-3 rounded-lg items-center justify-center ${
                                      app.status === 'interview_scheduled'
                                        ? 'bg-zinc-200 opacity-60'
                                        : 'bg-amber-600'
                                    }`}
                                  >
                                    <Text className={`text-[9px] font-black uppercase tracking-widest ${
                                      app.status === 'interview_scheduled' ? 'text-zinc-500' : 'text-white'
                                    }`}>
                                      {app.status === 'interview_scheduled' ? 'Interview Called ✓' : 'Physical Interview'}
                                    </Text>
                                  </TouchableOpacity>

                                  {/* 2. Fill Interview Form Button (Appears once Physical Interview is clicked) */}
                                  {app.status === 'interview_scheduled' && (
                                    <TouchableOpacity
                                      activeOpacity={0.8}
                                      onPress={() => {
                                        setInterviewFormApp(app);
                                        setInterviewIdDocUri(app.documentAadhaar || app.documentPan || '');
                                        setInterviewProfilePicUri(app.avatar || app.documentSelfie || '');
                                      }}
                                      className={`flex-1 py-3 rounded-lg items-center justify-center flex-row gap-1 ${
                                        (interviewCompletedMap[app.id] || (app.documentAadhaar || app.documentPan))
                                          ? 'bg-emerald-50 border border-emerald-300'
                                          : 'bg-indigo-600'
                                      }`}
                                    >
                                      <Feather 
                                        name="edit-3" 
                                        size={12} 
                                        color={(interviewCompletedMap[app.id] || (app.documentAadhaar || app.documentPan)) ? '#059669' : '#FFFFFF'} 
                                      />
                                      <Text className={`text-[9px] font-black uppercase tracking-widest ${
                                        (interviewCompletedMap[app.id] || (app.documentAadhaar || app.documentPan))
                                          ? 'text-emerald-800'
                                          : 'text-white'
                                      }`}>
                                        {(interviewCompletedMap[app.id] || (app.documentAadhaar || app.documentPan)) ? 'Edit Form' : 'Fill Interview Form'}
                                      </Text>
                                    </TouchableOpacity>
                                  )}
                                </View>

                                <View className="flex-row gap-2">
                                  {/* 3. Approve Button: Locked until interview form is completed / saved */}
                                  {(() => {
                                    const isFormCompleted = interviewCompletedMap[app.id] || (
                                      app.status === 'interview_scheduled' && (!!app.documentAadhaar || !!app.documentPan)
                                    );

                                    return (
                                      <TouchableOpacity
                                        disabled={!isFormCompleted}
                                        activeOpacity={0.8}
                                        onPress={() => handleApproveApp(app.id)}
                                        className={`flex-1 py-3 rounded-lg items-center justify-center ${
                                          isFormCompleted ? 'bg-emerald-600' : 'bg-zinc-200 opacity-60'
                                        }`}
                                      >
                                        <Text className={`text-[9px] font-black uppercase tracking-widest ${
                                          isFormCompleted ? 'text-white' : 'text-zinc-500'
                                        }`}>
                                          Approve
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })()}
                                  
                                  <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => handleRequestInfoApp(app.id)}
                                    className="flex-1 py-3 bg-blue-600 rounded-lg items-center justify-center"
                                  >
                                    <Text className="text-white text-[9px] font-black uppercase tracking-widest">Req Info</Text>
                                  </TouchableOpacity>

                                  <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => handleRejectApp(app.id)}
                                    className="flex-1 py-3 bg-rose-600 rounded-lg items-center justify-center"
                                  >
                                    <Text className="text-white text-[9px] font-black uppercase tracking-widest">Reject</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            </>
                          )}
                        </LuxuryCard>
                      ))
                    )}
                  </View>
                </>
              )}
            </View>
          )}

          {activeTab === 'locations' && (
            <View className="gap-6">
              {/* Header Title & Explanatory Guide */}
              <View className="gap-2">
                <Text className="text-zinc-950 text-xl font-black tracking-tight uppercase">Trainer Locations & Service Radius</Text>
                <Text className="text-zinc-500 text-xs font-semibold leading-relaxed">
                  Controls trainer dispatch eligibility, travel distance calculations, and client booking visibility.
                </Text>
              </View>

              {/* Educational How-It-Works Panel */}
              <View className="bg-indigo-50/60 border border-indigo-150 p-4.5 rounded-[24px] gap-2.5">
                <View className="flex-row items-center gap-2">
                  <View className="w-6 h-6 rounded-lg bg-indigo-600 items-center justify-center">
                    <Feather name="navigation" size={13} color="#FFFFFF" />
                  </View>
                  <Text className="text-indigo-950 text-xs font-black uppercase tracking-wider">
                    How Operating Area & Radius Function
                  </Text>
                </View>
                <View className="gap-2 pt-1">
                  <View className="flex-row items-start gap-2">
                    <Feather name="map-pin" size={13} color="#4F46E5" style={{ marginTop: 2 }} />
                    <Text className="text-zinc-700 text-xs font-medium leading-relaxed flex-1">
                      <Text className="font-bold text-zinc-900">Operating Base Address:</Text> The anchor GPS coordinates where the trainer starts their commute or travels from.
                    </Text>
                  </View>
                  <View className="flex-row items-start gap-2">
                    <Feather name="target" size={13} color="#4F46E5" style={{ marginTop: 2 }} />
                    <Text className="text-zinc-700 text-xs font-medium leading-relaxed flex-1">
                      <Text className="font-bold text-zinc-900">Service Area Radius (Max 5km):</Text> Maximum spherical/geofence distance from their base. Clients whose workout address is beyond this radius will not be matched with this trainer.
                    </Text>
                  </View>
                  <View className="flex-row items-start gap-2">
                    <Feather name="check-circle" size={13} color="#4F46E5" style={{ marginTop: 2 }} />
                    <Text className="text-zinc-700 text-xs font-medium leading-relaxed flex-1">
                      <Text className="font-bold text-zinc-900">Verification Status:</Text> Once marked <Text className="font-bold text-emerald-700">Verified</Text>, the trainer's enabled slots appear directly in the client booking calendar.
                    </Text>
                  </View>
                </View>
              </View>

              {/* Filters */}
              <View className="bg-white border border-[#E5E7EB] p-4.5 rounded-[24px] shadow-xs gap-3.5">
                <View className="flex-row justify-between items-center">
                  <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider">Filter Trainers</Text>
                  <Text className="text-zinc-400 text-[10px] font-bold">
                    Showing {coaches.filter((c) => {
                      const status = c.preferences?.operatingLocationStatus || 'pending';
                      const radius = String(Math.min(c.preferences?.radiusKm || 5, 5));
                      if (statusFilter !== 'all' && status !== statusFilter) return false;
                      if (radiusFilter !== 'all' && radius !== radiusFilter) return false;
                      return true;
                    }).length} of {coaches.length} Trainers
                  </Text>
                </View>
                
                <View className="flex-row gap-3">
                  {/* Status Filter */}
                  <View className="flex-1 gap-1.5">
                    <Text className="text-zinc-500 text-[9px] font-black uppercase tracking-wider">Status</Text>
                    <View className="flex-row bg-[#F1F3F5] p-1 rounded-xl">
                      {(['all', 'verified', 'pending', 'rejected'] as const).map((st) => (
                        <TouchableOpacity
                          key={st}
                          onPress={() => setStatusFilter(st)}
                          className={`flex-1 py-1.5 rounded-lg items-center ${statusFilter === st ? 'bg-white shadow-xs' : ''}`}
                        >
                          <Text className={`text-[8px] font-black uppercase ${statusFilter === st ? 'text-zinc-950' : 'text-zinc-500'}`}>
                            {st}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Radius Filter */}
                  <View className="w-44 gap-1.5">
                    <Text className="text-zinc-500 text-[9px] font-black uppercase tracking-wider">Radius Limit</Text>
                    <View className="flex-row bg-[#F1F3F5] p-1 rounded-xl">
                      {(['all', '3', '5'] as const).map((rd) => (
                        <TouchableOpacity
                          key={rd}
                          onPress={() => setRadiusFilter(rd as any)}
                          className={`flex-1 py-1.5 rounded-lg items-center ${radiusFilter === rd ? 'bg-white shadow-xs' : ''}`}
                        >
                          <Text className={`text-[8px] font-black uppercase ${radiusFilter === rd ? 'text-zinc-950' : 'text-zinc-500'}`}>
                            {rd === 'all' ? 'All' : `${rd}km`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              </View>

              {/* List of Trainers */}
              <View className="gap-4">
                {coaches
                  .filter((c) => {
                    const status = c.preferences?.operatingLocationStatus || 'pending';
                    const radius = String(Math.min(c.preferences?.radiusKm || 5, 5));
                    if (statusFilter !== 'all' && status !== statusFilter) return false;
                    if (radiusFilter !== 'all' && radius !== radiusFilter) return false;
                    return true;
                  })
                  .map((coach) => {
                    const hasRequest = !!coach.preferences?.addressChangeRequest;
                    const status = coach.preferences?.operatingLocationStatus || 'pending';
                    const radius = Math.min(coach.preferences?.radiusKm || 5, 5);
                    const address = coach.preferences?.operatingAddress;
                    const hasCoords = coach.preferences?.operatingLatitude !== undefined && coach.preferences?.operatingLongitude !== undefined;

                    return (
                      <LuxuryCard key={coach.id} className="p-5 gap-4" interactive={false}>
                        {/* Header Row: Trainer Info & Status Badge */}
                        <View className="flex-row justify-between items-start">
                          <View className="flex-row items-center gap-3 flex-1 pr-3">
                            <Image 
                              source={resolveAvatarSource(coach.photo, coach.gender)} 
                              className="w-11 h-11 rounded-full border border-zinc-200" 
                            />
                            <View className="flex-1">
                              <Text className="text-zinc-950 text-sm font-black tracking-tight leading-tight">{coach.name}</Text>
                              <Text className="text-zinc-400 text-[9px] font-bold uppercase mt-0.5">Trainer ID: {coach.id}</Text>
                            </View>
                          </View>

                          <View className={`px-2.5 py-1 rounded-full border ${
                            status === 'verified'
                              ? 'bg-emerald-50 border-emerald-200'
                              : status === 'rejected'
                              ? 'bg-rose-50 border-rose-200'
                              : 'bg-amber-50 border-amber-200'
                          }`}>
                            <Text className={`text-[8px] font-black uppercase tracking-wider ${
                              status === 'verified' ? 'text-emerald-700' : status === 'rejected' ? 'text-rose-700' : 'text-amber-700'
                            }`}>
                              {status === 'verified' ? '✓ Verified Base' : status === 'rejected' ? '✕ Rejected' : '⏳ Pending Base'}
                            </Text>
                          </View>
                        </View>

                        <View className="h-[1px] bg-zinc-100" />

                        {/* Location & Radius Details Box */}
                        <View className="bg-zinc-50 border border-zinc-150/80 p-3.5 rounded-2xl gap-3">
                          {/* Address */}
                          <View className="gap-1">
                            <View className="flex-row items-center gap-1.5">
                              <Feather name="map-pin" size={12} color="#6B7280" />
                              <Text className="text-zinc-500 text-[9px] font-black uppercase tracking-wider">Operating Base Address</Text>
                            </View>
                            <Text className="text-zinc-900 text-xs font-bold leading-relaxed">
                              {address || 'Not Set (Trainer must configure in profile)'}
                            </Text>
                          </View>

                          {/* Coordinates & Service Radius */}
                          <View className="flex-row justify-between pt-2 border-t border-zinc-200/60">
                            <View className="gap-0.5">
                              <Text className="text-zinc-400 text-[8px] font-black uppercase tracking-wider">GPS Coordinates</Text>
                              <Text className="text-zinc-700 text-[10px] font-semibold font-mono">
                                {hasCoords 
                                  ? `${coach.preferences?.operatingLatitude?.toFixed(5)}, ${coach.preferences?.operatingLongitude?.toFixed(5)}` 
                                  : 'Not Configured'}
                              </Text>
                            </View>

                            <View className="gap-0.5 items-end">
                              <Text className="text-zinc-400 text-[8px] font-black uppercase tracking-wider">Service Coverage Radius</Text>
                              <View className="flex-row items-center gap-1">
                                <Feather name="target" size={11} color="#4F46E5" />
                                <Text className="text-[#4F46E5] text-xs font-black">
                                  {radius} km
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>

                        {/* Pending Change Request Alert */}
                        {hasRequest && (
                          <View className="bg-amber-50 border border-amber-200 p-4 rounded-2xl gap-2.5">
                            <View className="flex-row items-center gap-1.5">
                              <Feather name="alert-triangle" size={13} color="#D97706" />
                              <Text className="text-amber-900 text-[10px] font-black uppercase tracking-wider">Requested Location Update</Text>
                            </View>
                            <Text className="text-zinc-900 text-xs font-bold leading-relaxed">
                              {coach.preferences?.addressChangeRequest?.requestedAddress}
                            </Text>
                            <View className="flex-row justify-between pt-1 border-t border-amber-200/60">
                              <Text className="text-amber-800 text-[9px] font-bold uppercase">
                                Requested Radius: {coach.preferences?.addressChangeRequest?.requestedRadius} km
                              </Text>
                              <Text className="text-zinc-500 text-[9px] font-semibold font-mono">
                                {coach.preferences?.addressChangeRequest?.requestedLatitude?.toFixed(4)}, {coach.preferences?.addressChangeRequest?.requestedLongitude?.toFixed(4)}
                              </Text>
                            </View>

                            <View className="flex-row gap-2 mt-1">
                              <TouchableOpacity
                                onPress={() => handleRejectLocation(coach.id)}
                                className="flex-1 border border-rose-200 bg-white py-2.5 rounded-xl items-center"
                              >
                                <Text className="text-rose-600 text-[9px] font-black uppercase tracking-wider">Reject Request</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => handleApproveLocation(coach.id)}
                                className="flex-1 bg-emerald-600 py-2.5 rounded-xl items-center shadow-xs"
                              >
                                <Text className="text-white text-[9px] font-black uppercase tracking-wider">Approve Base</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}

                        {/* Admin Action Buttons */}
                        <View className="flex-row gap-2 pt-1 border-t border-zinc-100">
                          {status !== 'verified' && (
                            <TouchableOpacity
                              onPress={() => handleQuickVerifyLocation(coach.id)}
                              className="flex-1 py-2.5 bg-emerald-600 rounded-xl items-center justify-center flex-row gap-1.5"
                            >
                              <Feather name="check" size={13} color="#FFFFFF" />
                              <Text className="text-white text-[9px] font-black uppercase tracking-wider">Mark Verified</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            onPress={() => handleOpenEditLocation(coach)}
                            className="flex-1 py-2.5 bg-zinc-900 rounded-xl items-center justify-center flex-row gap-1.5"
                          >
                            <Feather name="edit-2" size={13} color="#FFFFFF" />
                            <Text className="text-white text-[9px] font-black uppercase tracking-wider">Edit Base & Radius</Text>
                          </TouchableOpacity>
                        </View>
                      </LuxuryCard>
                    );
                  })}
              </View>
            </View>
          )}

          {activeTab === 'live' && (
            // Module 10: Live Session Console View
            <View className="gap-6">
              <View>
                <Text className="text-zinc-950 text-xl font-black tracking-tight uppercase">Live Session Console</Text>
                <Text className="text-[#6B7280] text-xs font-semibold mt-1 leading-relaxed">
                  Monitor real-time concierge sessions and manage delayed trainers.
                </Text>
              </View>

              {/* LIVE BOOKINGS STREAM: User, Session Name & Latest Real-time Update */}
              <View className="gap-3">
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => toggleSection('liveStream')}
                  className="bg-white border border-zinc-200 p-4 rounded-2xl flex-row items-center justify-between"
                >
                  <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                    <View className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <View>
                      <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider">
                        Live Booking Updates ({bookings.length})
                      </Text>
                      <Text className="text-zinc-400 text-[9px] font-semibold mt-0.5">
                        {expandedSections.liveStream ? 'Tap to collapse session list' : 'Tap to enlarge & view live bookings'}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <View className="bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded-full">
                      <Text className="text-emerald-700 text-[8px] font-black uppercase">Real-time</Text>
                    </View>
                    <Feather 
                      name={expandedSections.liveStream ? 'chevron-up' : 'chevron-down'} 
                      size={18} 
                      color="#4B5563" 
                    />
                  </View>
                </TouchableOpacity>

                {expandedSections.liveStream && (
                  <View className="gap-2.5">
                    {bookings.length === 0 ? (
                      <View className="bg-white border border-zinc-200 p-6 rounded-2xl items-center justify-center">
                        <Feather name="inbox" size={20} color="#9CA3AF" />
                        <Text className="text-zinc-400 text-[10px] font-bold uppercase mt-2">No bookings recorded yet</Text>
                      </View>
                    ) : (
                      <>
                        {bookings
                          .slice()
                          .reverse()
                          .slice(0, sectionLimits.liveStream || 7)
                          .map((b) => {
                            // Determine clean latest update text based on timeline status and trainer assignment
                            const ts = (b.timelineStatus || '').toLowerCase();
                            let latestUpdateText = 'Booking Created';
                            let statusBadgeColor = 'bg-zinc-100 text-zinc-700 border-zinc-200';

                            if (ts === 'trainer_assigned' || ts === 'booked') {
                              latestUpdateText = b.trainerName ? `Trainer Assigned: ${b.trainerName}` : 'Looking for Trainer';
                              statusBadgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
                            } else if (ts === 'trainer_accepted') {
                              latestUpdateText = `Accepted by ${b.trainerName || 'Trainer'}`;
                              statusBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                            } else if (ts === 'travelling') {
                              latestUpdateText = `${b.trainerName || 'Trainer'} is En Route`;
                              statusBadgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
                            } else if (ts === 'arrived') {
                              latestUpdateText = `${b.trainerName || 'Trainer'} Arrived at Location`;
                              statusBadgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
                            } else if (ts === 'workout_started') {
                              latestUpdateText = 'Workout In Progress';
                              statusBadgeColor = 'bg-purple-50 text-purple-700 border-purple-200';
                            } else if (ts === 'workout_completed' || ts === 'session_closed' || b.status === 'completed') {
                              latestUpdateText = 'Session Completed';
                              statusBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                            } else if (b.status === 'cancelled') {
                              latestUpdateText = 'Booking Cancelled';
                              statusBadgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
                            } else if (b.status === 'client_no_show' || b.status === 'trainer_no_show') {
                              latestUpdateText = b.status === 'client_no_show' ? 'Client No-Show' : 'Trainer No-Show';
                              statusBadgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
                            }

                            return (
                              <View key={`live-stream-${b.id}`} className="bg-white border border-zinc-200 p-4 rounded-2xl gap-2.5">
                                <View className="flex-row items-center justify-between">
                                  <View className="flex-1 pr-2">
                                    <Text className="text-zinc-950 text-sm font-black tracking-tight" numberOfLines={1}>
                                      {b.clientName || 'Client'}
                                    </Text>
                                    <Text className="text-[#E11D48] text-xs font-bold mt-0.5" numberOfLines={1}>
                                      {b.workoutTitle || 'Session'}
                                    </Text>
                                  </View>
                                  <View className={`px-2.5 py-1 rounded-full border ${statusBadgeColor.split(' ')[0]} ${statusBadgeColor.split(' ')[2]}`}>
                                    <Text className={`text-[8.5px] font-black uppercase tracking-wider ${statusBadgeColor.split(' ')[1]}`}>
                                      {b.time || 'Scheduled'}
                                    </Text>
                                  </View>
                                </View>

                                <View className="h-[1px] bg-zinc-100" />

                                <View className="flex-row items-center justify-between">
                                  <View className="flex-1 flex-row items-center gap-1.5 pr-2">
                                    <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">Latest Update:</Text>
                                    <Text className="text-zinc-900 text-xs font-extrabold flex-1" numberOfLines={1}>
                                      {latestUpdateText}
                                    </Text>
                                  </View>
                                  <Text className="text-zinc-400 text-[9px] font-medium">
                                    {b.date ? formatToDDMMYYYY(b.date) : ''}
                                  </Text>
                                </View>
                              </View>
                            );
                          })}

                        {bookings.length > (sectionLimits.liveStream || 7) && (
                          <TouchableOpacity
                            onPress={() => loadMoreForSection('liveStream')}
                            className="bg-zinc-100 border border-zinc-200 py-2.5 rounded-xl items-center justify-center mt-1 flex-row gap-2"
                          >
                            <Feather name="plus-circle" size={14} color="#374151" />
                            <Text className="text-zinc-800 text-[10px] font-black uppercase tracking-wider">
                              Load Next 7 Bookings (Showing {Math.min(sectionLimits.liveStream || 7, bookings.length)} of {bookings.length})
                            </Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </View>
                )}
              </View>

              {/* Sessions Analytics counters */}
              <View className="flex-row flex-wrap justify-between gap-y-4">
                <View className="w-[48%] bg-white border border-zinc-200 p-4 rounded-2xl">
                  <Text className="text-zinc-400 text-[8px] font-black uppercase tracking-wider">Live Tracking Active</Text>
                  <Text className="text-zinc-950 text-base font-black mt-1">{liveSessions.length} sessions</Text>
                </View>
                <View className="w-[48%] bg-white border border-zinc-200 p-4 rounded-2xl">
                  <Text className="text-amber-600 text-[8px] font-black uppercase tracking-wider">Delayed Coaches</Text>
                  <Text className="text-amber-700 text-base font-black mt-1">{delayedSessions.length} delayed</Text>
                </View>
                <View className="w-[48%] bg-white border border-zinc-200 p-4 rounded-2xl">
                  <Text className="text-zinc-400 text-[8px] font-black uppercase tracking-wider">Completed Sessions</Text>
                  <Text className="text-zinc-950 text-base font-black mt-1">{completedSessionsCount}</Text>
                </View>
                <View className="w-[48%] bg-white border border-zinc-200 p-4 rounded-2xl">
                  <Text className="text-zinc-400 text-[8px] font-black uppercase tracking-wider">Cancelled / No-shows</Text>
                  <Text className="text-zinc-950 text-base font-black mt-1">{cancelledSessionsCount}</Text>
                </View>
              </View>

              {/* Delayed coaches warning banner */}
              {delayedSessions.length > 0 && (
                <View className="bg-amber-50 border border-amber-100 p-4 rounded-2xl gap-1">
                  <Text className="text-amber-800 text-[9px] font-black uppercase tracking-wider">⚠️ Delay Warning</Text>
                  <Text className="text-amber-700 text-[10px] font-semibold">
                    {delayedSessions.length} wellness coach is assigned/accepted but has not initiated travel yet. Monitor check-in logs.
                  </Text>
                </View>
              )}

              {/* SOS Alerts dashboard */}
              <View className="bg-red-50 border border-red-100 p-4.5 rounded-2xl gap-2">
                <Text className="text-red-700 text-[9px] font-black uppercase tracking-wider">🚨 Safety SOS Alerts Console</Text>
                <View className="h-[1px] bg-red-100/50 my-1" />
                {liveSessions.length === 0 ? (
                  <View className="bg-white p-3 rounded-xl border border-red-100/60 items-center justify-center">
                    <Text className="text-zinc-500 text-[10px] font-bold">All Emergency Alert Channels Active & Normal</Text>
                    <Text className="text-zinc-400 text-[8px] font-medium mt-0.5">No emergency SOS triggers dispatched.</Text>
                  </View>
                ) : (
                  <View className="gap-2">
                    {liveSessions.map((ls) => (
                      <View key={ls.id} className="flex-row justify-between items-center bg-white p-2.5 rounded-xl border border-red-100">
                        <View className="gap-0.5 flex-1 pr-2">
                          <Text className="text-zinc-950 text-xs font-black">Coach {ls.trainerName} ↔ {ls.clientName || 'Client'}</Text>
                          <Text className="text-zinc-400 text-[8px] font-bold uppercase">Status: Live Monitoring ({ls.timelineStatus || 'In Progress'})</Text>
                        </View>
                        <TouchableOpacity 
                          onPress={() => Alert.alert('Safety Check', `Emergency channels for booking ${ls.id} are operational.`)} 
                          className="bg-zinc-800 px-3 py-1.5 rounded-lg"
                        >
                          <Text className="text-white text-[7px] font-black uppercase">Check SOS</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* TODAY'S BOOKED SESSIONS */}
              {(() => {
                const serverNow = getCurrentServerTime();
                const todayIstStr = getISTDateInfo(serverNow).dateString;

                const isUnaccepted = (timelineStatus?: string) => {
                  const ts = (timelineStatus || '').toLowerCase();
                  return ts === 'booked' || ts === 'trainer_assigned';
                };

                const todayBooked = bookings.filter(b => {
                  if (b.status !== 'upcoming') return false;
                  if (isUnaccepted(b.timelineStatus)) return false;
                  const range = getBookingISTDateRange(b);
                  return getISTDateInfo(range.start).dateString === todayIstStr;
                });

                const upcomingBooked = bookings.filter(b => {
                  if (b.status !== 'upcoming') return false;
                  if (isUnaccepted(b.timelineStatus)) return false;
                  const range = getBookingISTDateRange(b);
                  return getISTDateInfo(range.start).dateString > todayIstStr;
                });

                return (
                  <>
                    {/* TODAY'S BOOKED */}
                    <View className="gap-3">
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => toggleSection('todayBooked')}
                        className="bg-white border border-zinc-200 p-4 rounded-2xl flex-row items-center justify-between"
                      >
                        <View className="flex-1 pr-2">
                          <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider">
                            {"TODAY'S BOOKED SESSIONS (" + todayBooked.length + ")"}
                          </Text>
                          <Text className="text-zinc-400 text-[9px] font-semibold mt-0.5">
                            {expandedSections.todayBooked ? 'Tap to collapse' : 'Tap to enlarge & view today’s sessions'}
                          </Text>
                        </View>
                        <Feather 
                          name={expandedSections.todayBooked ? 'chevron-up' : 'chevron-down'} 
                          size={18} 
                          color="#4B5563" 
                        />
                      </TouchableOpacity>

                      {expandedSections.todayBooked && (
                        <View className="gap-3">
                          {todayBooked.length === 0 ? (
                            <View className="bg-white border border-zinc-200 p-8 rounded-[24px] items-center justify-center">
                              <Feather name="calendar" size={20} color="#9CA3AF" />
                              <Text className="text-zinc-400 text-[10px] font-black uppercase mt-2">No bookings scheduled for today.</Text>
                            </View>
                          ) : (
                            <>
                              {todayBooked.slice(0, sectionLimits.todayBooked || 7).map((b) => (
                                <LuxuryCard key={b.id} className="p-5" interactive={false}>
                                  <View className="flex-row justify-between items-start mb-3">
                                    <View className="gap-0.5">
                                      <Text className="text-[#101828] text-base font-extrabold">{b.workoutTitle}</Text>
                                      <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">Booking ID: {b.id}</Text>
                                    </View>
                                    <View className="bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-xl">
                                      <Text className="text-emerald-600 text-[8px] font-bold uppercase tracking-wider">{b.timelineStatus}</Text>
                                    </View>
                                  </View>
                                  <View className="h-[1px] bg-zinc-100 my-2" />
                                  <View className="gap-1.5 mb-3.5">
                                    <Text className="text-zinc-650 text-xs font-medium">Client Name: <Text className="font-bold text-zinc-900">{b.clientName || 'Client'}</Text></Text>
                                    <Text className="text-zinc-650 text-xs font-medium">Trainer Name: <Text className="font-bold text-zinc-900">{b.trainerName}</Text></Text>
                                    <Text className="text-zinc-650 text-xs font-medium">Workout Type: <Text className="font-bold text-zinc-900">{b.workoutTitle}</Text></Text>
                                    <Text className="text-zinc-650 text-xs font-medium">Booking Status: <Text className="font-bold text-zinc-900">Confirmed / Booked</Text></Text>
                                    <Text className="text-zinc-650 text-xs font-medium">Time: <Text className="font-bold text-zinc-900">{formatToDDMMYYYY(b.date)} @ {b.time}</Text></Text>
                                    <Text className="text-zinc-650 text-xs font-medium">Acceptance Type: <Text className="font-bold text-zinc-900">{b.acceptanceMethod === 'auto' ? 'AUTO-ACCEPTED' : (b.acceptanceMethod === 'manual' ? 'MANUALLY ACCEPTED' : 'PENDING')}</Text></Text>
                                    {(b.autoAcceptedAt || b.trainerAcceptedAt) && (
                                      <Text className="text-zinc-650 text-xs font-medium">Accepted At: <Text className="font-bold text-zinc-900">{new Date(Number(b.autoAcceptedAt || b.trainerAcceptedAt)).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</Text></Text>
                                    )}
                                  </View>
                                  <TouchableOpacity
                                    onPress={() => setSelectedAuditSession(b)}
                                    className="bg-zinc-800 py-3 rounded-xl items-center justify-center"
                                  >
                                    <Text className="text-white text-xs font-black uppercase tracking-wider">View Audit Timeline</Text>
                                  </TouchableOpacity>
                                </LuxuryCard>
                              ))}

                              {todayBooked.length > (sectionLimits.todayBooked || 7) && (
                                <TouchableOpacity
                                  onPress={() => loadMoreForSection('todayBooked')}
                                  className="bg-zinc-100 border border-zinc-200 py-2.5 rounded-xl items-center justify-center mt-1 flex-row gap-2"
                                >
                                  <Feather name="plus-circle" size={14} color="#374151" />
                                  <Text className="text-zinc-800 text-[10px] font-black uppercase tracking-wider">
                                    Load Next 7 Sessions (Showing {Math.min(sectionLimits.todayBooked || 7, todayBooked.length)} of {todayBooked.length})
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </>
                          )}
                        </View>
                      )}
                    </View>

                    {/* UPCOMING BOOKED SESSIONS */}
                    <View className="gap-3 mt-1">
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => toggleSection('upcomingBooked')}
                        className="bg-white border border-zinc-200 p-4 rounded-2xl flex-row items-center justify-between"
                      >
                        <View className="flex-1 pr-2">
                          <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider">
                            {"UPCOMING BOOKED SESSIONS (" + upcomingBooked.length + ")"}
                          </Text>
                          <Text className="text-zinc-400 text-[9px] font-semibold mt-0.5">
                            {expandedSections.upcomingBooked ? 'Tap to collapse' : 'Tap to enlarge & view upcoming sessions'}
                          </Text>
                        </View>
                        <Feather 
                          name={expandedSections.upcomingBooked ? 'chevron-up' : 'chevron-down'} 
                          size={18} 
                          color="#4B5563" 
                        />
                      </TouchableOpacity>

                      {expandedSections.upcomingBooked && (
                        <View className="gap-3">
                          {upcomingBooked.length === 0 ? (
                            <View className="bg-white border border-zinc-200 p-8 rounded-[24px] items-center justify-center">
                              <Feather name="clock" size={20} color="#9CA3AF" />
                              <Text className="text-zinc-400 text-[10px] font-black uppercase mt-2">No upcoming bookings scheduled.</Text>
                            </View>
                          ) : (
                            <>
                              {upcomingBooked.slice(0, sectionLimits.upcomingBooked || 7).map((b) => (
                                <LuxuryCard key={b.id} className="p-5" interactive={false}>
                                  <View className="flex-row justify-between items-start mb-3">
                                    <View className="gap-0.5">
                                      <Text className="text-[#101828] text-base font-extrabold">{b.workoutTitle}</Text>
                                      <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">Booking ID: {b.id}</Text>
                                    </View>
                                    <View className="bg-indigo-50 border border-indigo-150 px-3 py-1 rounded-xl">
                                      <Text className="text-indigo-600 text-[8px] font-bold uppercase tracking-wider">{b.timelineStatus}</Text>
                                    </View>
                                  </View>
                                  <View className="h-[1px] bg-zinc-100 my-2" />
                                  <View className="gap-1.5 mb-3.5">
                                    <Text className="text-zinc-650 text-xs font-medium">Client Name: <Text className="font-bold text-zinc-900">{b.clientName || 'Client'}</Text></Text>
                                    <Text className="text-zinc-650 text-xs font-medium">Trainer Name: <Text className="font-bold text-zinc-900">{b.trainerName}</Text></Text>
                                    <Text className="text-zinc-650 text-xs font-medium">Workout Type: <Text className="font-bold text-zinc-900">{b.workoutTitle}</Text></Text>
                                    <Text className="text-zinc-650 text-xs font-medium">Booking Status: <Text className="font-bold text-zinc-900">Confirmed / Booked</Text></Text>
                                    <Text className="text-zinc-650 text-xs font-medium">Time: <Text className="font-bold text-zinc-900">{formatToDDMMYYYY(b.date)} @ {b.time}</Text></Text>
                                    <Text className="text-zinc-650 text-xs font-medium">Acceptance Type: <Text className="font-bold text-zinc-900">{b.acceptanceMethod === 'auto' ? 'AUTO-ACCEPTED' : (b.acceptanceMethod === 'manual' ? 'MANUALLY ACCEPTED' : 'PENDING')}</Text></Text>
                                    {(b.autoAcceptedAt || b.trainerAcceptedAt) && (
                                      <Text className="text-zinc-650 text-xs font-medium">Accepted At: <Text className="font-bold text-zinc-900">{new Date(Number(b.autoAcceptedAt || b.trainerAcceptedAt)).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</Text></Text>
                                    )}
                                  </View>
                                  <TouchableOpacity
                                    onPress={() => setSelectedAuditSession(b)}
                                    className="bg-indigo-600 py-3 rounded-xl items-center justify-center"
                                  >
                                    <Text className="text-white text-xs font-black uppercase tracking-wider">View Audit Timeline</Text>
                                  </TouchableOpacity>
                                </LuxuryCard>
                              ))}

                              {upcomingBooked.length > (sectionLimits.upcomingBooked || 7) && (
                                <TouchableOpacity
                                  onPress={() => loadMoreForSection('upcomingBooked')}
                                  className="bg-zinc-100 border border-zinc-200 py-2.5 rounded-xl items-center justify-center mt-1 flex-row gap-2"
                                >
                                  <Feather name="plus-circle" size={14} color="#374151" />
                                  <Text className="text-zinc-800 text-[10px] font-black uppercase tracking-wider">
                                    Load Next 7 Sessions (Showing {Math.min(sectionLimits.upcomingBooked || 7, upcomingBooked.length)} of {upcomingBooked.length})
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </>
                          )}
                        </View>
                      )}
                    </View>
                  </>
                );
              })()}

              {/* Live Session List */}
              <View className="gap-3">
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => toggleSection('liveOngoing')}
                  className="bg-white border border-zinc-200 p-4 rounded-2xl flex-row items-center justify-between"
                >
                  <View className="flex-1 pr-2">
                    <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider">
                      {"Live Ongoing Sessions (" + liveSessions.length + ")"}
                    </Text>
                    <Text className="text-zinc-400 text-[9px] font-semibold mt-0.5">
                      {expandedSections.liveOngoing ? 'Tap to collapse' : 'Tap to enlarge & view live tracking'}
                    </Text>
                  </View>
                  <Feather 
                    name={expandedSections.liveOngoing ? 'chevron-up' : 'chevron-down'} 
                    size={18} 
                    color="#4B5563" 
                  />
                </TouchableOpacity>

                {expandedSections.liveOngoing && (
                  <View className="gap-3">
                    {liveSessions.length === 0 ? (
                      <View className="bg-white border border-zinc-200 p-8 rounded-[24px] items-center justify-center">
                        <Feather name="activity" size={20} color="#9CA3AF" />
                        <Text className="text-zinc-400 text-[10px] font-black uppercase mt-2">No active live tracking sessions</Text>
                      </View>
                    ) : (
                      <>
                        {liveSessions.slice(0, sectionLimits.liveOngoing || 7).map((b) => (
                          <LuxuryCard key={b.id} className="p-4 gap-3.5" interactive={false}>
                            <View className="flex-row items-center gap-3">
                              <Image source={{ uri: getSafeAvatarUri(b.trainerPhoto) }} className="w-10 h-10 rounded-full" />
                              <View className="flex-1">
                                <Text className="text-zinc-950 text-xs font-black">Coach {b.trainerName} ↔ {b.clientName || 'Client'}</Text>
                                <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">{b.workoutTitle} • {formatToDDMMYYYY(b.date)} ({b.time})</Text>
                              </View>
                              <View className="bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded-full">
                                <Text className="text-[#4F46E5] text-[7px] font-black uppercase">{b.timelineStatus}</Text>
                              </View>
                            </View>

                            <View className="h-[1px] bg-zinc-50" />
                            <View className="gap-1 pl-1">
                              <Text className="text-zinc-450 text-[8px] font-black uppercase">Target Address</Text>
                              <Text className="text-zinc-850 text-[10px] font-medium leading-relaxed" numberOfLines={1}>{b.address || 'Client Scheduled Address'}</Text>
                            </View>

                            <View className="flex-row gap-2 mt-1">
                              <TouchableOpacity
                                onPress={() => router.push({ pathname: '/session-detail' as any, params: { id: b.id } })}
                                className="flex-1 bg-zinc-950 py-2 rounded-lg items-center justify-center"
                              >
                                <Text className="text-white text-[8px] font-black uppercase">Inspect Session</Text>
                              </TouchableOpacity>
                              
                              <TouchableOpacity
                                onPress={async () => {
                                  try {
                                    await updateTimelineStatus(b.id, 'trainer_arrived');
                                    Alert.alert('Session Advanced', 'Trainer marked as arrived.');
                                  } catch (err: any) {
                                    Alert.alert('Error', err.message || 'Could not advance status.');
                                  }
                                }}
                                className="flex-1 bg-zinc-100 border border-zinc-200 py-2 rounded-lg items-center justify-center"
                              >
                                <Text className="text-zinc-950 text-[8px] font-black uppercase">Force Arrived</Text>
                              </TouchableOpacity>
                            </View>
                          </LuxuryCard>
                        ))}

                        {liveSessions.length > (sectionLimits.liveOngoing || 7) && (
                          <TouchableOpacity
                            onPress={() => loadMoreForSection('liveOngoing')}
                            className="bg-zinc-100 border border-zinc-200 py-2.5 rounded-xl items-center justify-center mt-1 flex-row gap-2"
                          >
                            <Feather name="plus-circle" size={14} color="#374151" />
                            <Text className="text-zinc-800 text-[10px] font-black uppercase tracking-wider">
                              Load Next 7 Sessions (Showing {Math.min(sectionLimits.liveOngoing || 7, liveSessions.length)} of {liveSessions.length})
                            </Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </View>
                )}
              </View>

              {/* Sessions History & Audit */}
              <View className="gap-3 mt-1">
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => toggleSection('historyAudit')}
                  className="bg-white border border-zinc-200 p-4 rounded-2xl flex-row items-center justify-between"
                >
                  <View className="flex-1 pr-2">
                    <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider">
                      {"Past & Missed Sessions Audit (" + missedOrEndedSessions.length + ")"}
                    </Text>
                    <Text className="text-zinc-400 text-[9px] font-semibold mt-0.5">
                      {expandedSections.historyAudit ? 'Tap to collapse' : 'Tap to enlarge & view past sessions'}
                    </Text>
                  </View>
                  <Feather 
                    name={expandedSections.historyAudit ? 'chevron-up' : 'chevron-down'} 
                    size={18} 
                    color="#4B5563" 
                  />
                </TouchableOpacity>

                {expandedSections.historyAudit && (
                  <View className="gap-3">
                    {missedOrEndedSessions.length === 0 ? (
                      <View className="bg-white border border-zinc-200 p-8 rounded-[24px] items-center justify-center">
                        <Feather name="list" size={20} color="#9CA3AF" />
                        <Text className="text-zinc-400 text-[10px] font-black uppercase mt-2">No historical sessions to display</Text>
                      </View>
                    ) : (
                      <>
                        {missedOrEndedSessions.slice(0, sectionLimits.historyAudit || 7).map((b) => (
                          <LuxuryCard key={b.id} className="p-4 gap-3.5" interactive={false}>
                            <View className="flex-row items-center gap-3">
                              <Image source={{ uri: getSafeAvatarUri(b.trainerPhoto) }} className="w-10 h-10 rounded-full" />
                              <View className="flex-1">
                                <Text className="text-zinc-950 text-xs font-black">Coach {b.trainerName} ↔ {b.clientName || 'Client'}</Text>
                                <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">{b.workoutTitle} • {formatToDDMMYYYY(b.date)} ({b.time})</Text>
                              </View>
                              <View className={`border px-2 py-0.5 rounded-full ${
                                b.status === 'completed' 
                                  ? 'bg-zinc-50 border-zinc-200' 
                                  : b.status === 'cancelled' 
                                    ? 'bg-red-50 border-red-150' 
                                    : 'bg-amber-50 border-amber-150'
                              }`}>
                                <Text className={`text-[7px] font-black uppercase ${
                                  b.status === 'completed' 
                                    ? 'text-zinc-500' 
                                    : b.status === 'cancelled' 
                                      ? 'text-red-500' 
                                      : 'text-amber-600'
                                }`}>{b.status}</Text>
                              </View>
                            </View>

                            <View className="flex-row gap-2 mt-1">
                              <TouchableOpacity
                                onPress={() => setSelectedAuditSession(b)}
                                className="flex-1 bg-zinc-900 py-2 rounded-lg items-center justify-center"
                              >
                                <Text className="text-white text-[8px] font-black uppercase">View Audit Details</Text>
                              </TouchableOpacity>
                            </View>
                          </LuxuryCard>
                        ))}

                        {missedOrEndedSessions.length > (sectionLimits.historyAudit || 7) && (
                          <TouchableOpacity
                            onPress={() => loadMoreForSection('historyAudit')}
                            className="bg-zinc-100 border border-zinc-200 py-2.5 rounded-xl items-center justify-center mt-1 flex-row gap-2"
                          >
                            <Feather name="plus-circle" size={14} color="#374151" />
                            <Text className="text-zinc-800 text-[10px] font-black uppercase tracking-wider">
                              Load Next 7 Sessions (Showing {Math.min(sectionLimits.historyAudit || 7, missedOrEndedSessions.length)} of {missedOrEndedSessions.length})
                            </Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </View>
                )}
              </View>

            </View>
          )}

          {activeTab === 'acceptance' && (() => {
            const pending = bookings.filter(b => {
              const ts = (b.timelineStatus || '').toLowerCase();
              return b.status === 'upcoming' && (ts === 'booked' || ts === 'trainer_assigned');
            });
            const autoAccepted = bookings.filter(b => {
              const method = (b.acceptanceMethod || '').toLowerCase();
              return b.status === 'upcoming' && (method === 'system_auto_accept' || method === 'auto');
            });
            const recent = bookings.filter(b => {
              const method = (b.acceptanceMethod || '').toLowerCase();
              const ts = (b.timelineStatus || '').toLowerCase();
              return b.status === 'upcoming' && (method === 'trainer_manual_accept' || method === 'manual' || ts === 'trainer_accepted');
            });

            return (
              <View className="gap-6">
                <View>
                  <Text className="text-zinc-950 text-xl font-black tracking-tight uppercase">Booking Acceptance Alerts</Text>
                  <Text className="text-[#6B7280] text-xs font-semibold mt-1 leading-relaxed">
                    Monitor trainer manual and system automatic acceptance status.
                  </Text>
                </View>

                {/* Section 1: ACTIVE TRAINING REQUESTS */}
                <View className="gap-4">
                  <Text className="text-zinc-800 text-[11px] font-black uppercase tracking-wider pl-1">ACTIVE TRAINING REQUESTS ({pending.length})</Text>
                  {pending.length === 0 ? (
                    <View className="p-6 bg-zinc-50 border border-dashed border-zinc-200 rounded-[28px] items-center justify-center">
                      <Text className="text-zinc-400 text-xs font-bold">No active training requests.</Text>
                    </View>
                  ) : (
                    pending.map(b => (
                      <LuxuryCard key={b.id} className="p-5" interactive={false}>
                        <View className="flex-row justify-between items-start mb-3">
                          <View className="gap-0.5">
                            <Text className="text-[#101828] text-base font-extrabold">{b.workoutTitle}</Text>
                            <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">Booking ID: {b.id}</Text>
                          </View>
                          <View className="bg-amber-50 border border-amber-100 px-3 py-1 rounded-xl">
                            <Text className="text-amber-600 text-[8px] font-bold uppercase tracking-wider">Waiting for trainer to accept</Text>
                          </View>
                        </View>
                        <View className="h-[1px] bg-zinc-100 my-2" />
                        <View className="gap-1.5 mb-3.5">
                          <Text className="text-zinc-650 text-xs font-medium">Client: <Text className="font-bold text-zinc-900">{b.clientName || 'Client'}</Text></Text>
                          <Text className="text-zinc-650 text-xs font-medium">Assigned Trainer: <Text className="font-bold text-zinc-900">{b.trainerId === 'searching' || !b.trainerId ? 'Searching for Trainer...' : b.trainerName}</Text></Text>
                          <Text className="text-zinc-650 text-xs font-medium">Booked Time: <Text className="font-bold text-zinc-900">{formatToDDMMYYYY(b.date)} @ {b.time}</Text></Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => setSelectedAuditSession(b)}
                          className="bg-indigo-600 py-3 rounded-xl items-center justify-center"
                        >
                          <Text className="text-white text-xs font-black uppercase tracking-wider">View Audit Timeline</Text>
                        </TouchableOpacity>
                      </LuxuryCard>
                    ))
                  )}
                </View>

                {/* Section 1.5: Auto-Accepted - Trainer Acknowledgement Pending */}
                {(() => {
                  const pendingAcks = bookings.filter(b => 
                    b.status === 'upcoming' && 
                    (b.acceptanceMethod === 'SYSTEM_AUTO_ACCEPT' || b.acceptanceMethod === 'auto') && 
                    b.trainerAcknowledgement === 'pending'
                  );
                  if (pendingAcks.length === 0) return null;
                  return (
                    <View className="gap-4">
                      <Text className="text-amber-600 text-[11px] font-black uppercase tracking-wider pl-1">
                        ⚠️ AUTO-ACCEPTED — TRAINER ACKNOWLEDGEMENT PENDING ({pendingAcks.length})
                      </Text>
                      {pendingAcks.map(b => (
                        <LuxuryCard key={b.id} className="p-5 border-amber-300 bg-amber-50/10" interactive={false}>
                          <View className="flex-row justify-between items-start mb-3">
                            <View className="gap-0.5">
                              <Text className="text-[#101828] text-base font-extrabold">{b.workoutTitle}</Text>
                              <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">Booking ID: {b.id}</Text>
                            </View>
                            <View className="bg-amber-100 border border-amber-200 px-3 py-1 rounded-xl">
                              <Text className="text-amber-700 text-[8px] font-bold uppercase tracking-wider">ACK PENDING</Text>
                            </View>
                          </View>
                          <View className="h-[1px] bg-amber-100 my-2" />
                          <View className="gap-1.5 mb-3.5">
                            <Text className="text-zinc-650 text-xs font-medium">Client: <Text className="font-bold text-zinc-900">{b.clientName || 'Client'}</Text></Text>
                            <Text className="text-zinc-650 text-xs font-medium">Assigned Trainer: <Text className="font-bold text-zinc-900">{b.trainerName}</Text></Text>
                            <Text className="text-zinc-650 text-xs font-medium">Booked Time: <Text className="font-bold text-zinc-900">{formatToDDMMYYYY(b.date)} @ {b.time}</Text></Text>
                            <Text className="text-zinc-650 text-xs font-medium">Auto-Accepted At: <Text className="font-bold text-zinc-900">{b.autoAcceptedAt ? new Date(b.autoAcceptedAt).toLocaleString() : 'N/A'}</Text></Text>
                            <Text className="text-zinc-650 text-xs font-medium">Acceptance Method: <Text className="font-bold text-zinc-900">AUTO AFTER 30 MINUTES</Text></Text>
                            <Text className="text-zinc-650 text-xs font-medium">Trainer Acknowledgement: <Text className="font-bold text-amber-700">PENDING</Text></Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => setSelectedAuditSession(b)}
                            className="bg-amber-600 py-3 rounded-xl items-center justify-center"
                          >
                            <Text className="text-white text-xs font-black uppercase tracking-wider">View Audit & Call Trainer</Text>
                          </TouchableOpacity>
                        </LuxuryCard>
                      ))}
                    </View>
                  );
                })()}

                {/* Section 2: Auto-Accepted Alert Priority */}
                <View className="gap-4">
                  <Text className="text-zinc-800 text-[11px] font-black uppercase tracking-wider pl-1">Auto-Accepted Sessions ({autoAccepted.length})</Text>
                  {autoAccepted.length === 0 ? (
                    <View className="p-6 bg-zinc-50 border border-dashed border-zinc-200 rounded-[28px] items-center justify-center">
                      <Text className="text-zinc-400 text-xs font-bold">No bookings have been auto-accepted.</Text>
                    </View>
                  ) : (
                    autoAccepted.map(b => (
                      <LuxuryCard key={b.id} className="p-5 border-rose-250 bg-rose-50/20" interactive={false}>
                        <View className="flex-row justify-between items-start mb-3">
                          <View className="gap-0.5">
                            <Text className="text-rose-950 text-base font-extrabold">{b.workoutTitle}</Text>
                            <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">Booking ID: {b.id}</Text>
                          </View>
                          <View className="bg-rose-100 border border-rose-200 px-3 py-1 rounded-xl">
                            <Text className="text-rose-700 text-[8px] font-bold uppercase tracking-wider">AUTO-ACCEPTED ⚠️</Text>
                          </View>
                        </View>
                        <View className="h-[1px] bg-rose-100 my-2" />
                        <View className="gap-1.5 mb-3.5">
                          <Text className="text-rose-900/80 text-xs font-medium">Client: <Text className="font-bold text-rose-900">{b.clientName || 'Client'}</Text></Text>
                          <Text className="text-rose-900/80 text-xs font-medium">Assigned Trainer: <Text className="font-bold text-rose-900">{b.trainerName}</Text> (No response)</Text>
                          <Text className="text-rose-900/80 text-xs font-medium">Booked Time: <Text className="font-bold text-rose-900">{formatToDDMMYYYY(b.date)} @ {b.time}</Text></Text>
                          <Text className="text-rose-900/80 text-xs font-medium">Trainer Acknowledgement: <Text className="font-bold text-rose-900">{b.trainerAcknowledgement === 'pending' ? 'PENDING' : 'COMPLETED'}</Text></Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => setSelectedAuditSession(b)}
                          className="bg-rose-600 py-3 rounded-xl items-center justify-center"
                        >
                          <Text className="text-white text-xs font-black uppercase tracking-wider">View Auto-Accept Audit</Text>
                        </TouchableOpacity>
                      </LuxuryCard>
                    ))
                  )}
                </View>

                {/* Section 3: Recent Acceptance */}
                <View className="gap-4">
                  <Text className="text-zinc-800 text-[11px] font-black uppercase tracking-wider pl-1">Recent Manual Acceptances ({recent.length})</Text>
                  {recent.length === 0 ? (
                    <View className="p-6 bg-zinc-50 border border-dashed border-zinc-200 rounded-[28px] items-center justify-center">
                      <Text className="text-zinc-400 text-xs font-bold">No manual acceptances found.</Text>
                    </View>
                  ) : (
                    recent.map(b => (
                      <LuxuryCard key={b.id} className="p-5" interactive={false}>
                        <View className="flex-row justify-between items-start mb-3">
                          <View className="gap-0.5">
                            <Text className="text-zinc-900 text-base font-extrabold">{b.workoutTitle}</Text>
                            <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">Booking ID: {b.id}</Text>
                          </View>
                          <View className="bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-xl">
                            <Text className="text-emerald-600 text-[8px] font-bold uppercase tracking-wider">Manually Accepted</Text>
                          </View>
                        </View>
                        <View className="h-[1px] bg-zinc-100 my-2" />
                        <View className="gap-1.5 mb-3.5">
                          <Text className="text-zinc-650 text-xs font-medium">Client: <Text className="font-bold text-zinc-900">{b.clientName || 'Client'}</Text></Text>
                          <Text className="text-zinc-650 text-xs font-medium">Assigned Trainer: <Text className="font-bold text-zinc-900">{b.trainerName}</Text> (Accepted manually)</Text>
                          <Text className="text-zinc-650 text-xs font-medium">Booked Time: <Text className="font-bold text-zinc-900">{formatToDDMMYYYY(b.date)} @ {b.time}</Text></Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => setSelectedAuditSession(b)}
                          className="bg-zinc-800 py-3 rounded-xl items-center justify-center"
                        >
                          <Text className="text-white text-xs font-black uppercase tracking-wider">View Audit Timeline</Text>
                        </TouchableOpacity>
                      </LuxuryCard>
                    ))
                  )}
                </View>
              </View>
            );
          })()}

          {activeTab === 'disputes' && (() => {
            const userCategories = ['Credits / Wallet', 'Booking Issue', 'Coach Feedback', 'Other'];
            const trainerCategories = ['payment', 'safety', 'behavior', 'cancellation_dispute'];

            const isUserDispute = (d: any) => {
              if (userCategories.includes(d.category)) return true;
              if (trainerCategories.includes(d.category)) return false;
              // Fallback check
              const desc = (d.description || '').toLowerCase();
              return desc.startsWith('[credits / wallet]') || desc.startsWith('[booking issue]') || desc.startsWith('[coach feedback]') || desc.startsWith('[other]');
            };

            const userDisputes = disputes.filter(d => isUserDispute(d));
            const trainerDisputes = disputes.filter(d => !isUserDispute(d));
            const displayedDisputes = disputeSection === 'user' ? userDisputes : trainerDisputes;

            return (
              <View className="gap-6">
                <View className="flex-row justify-between items-center">
                  <Text className="text-zinc-900 text-xl font-black tracking-tight uppercase">Dispute Management</Text>
                  <TouchableOpacity 
                    onPress={loadDisputesAndKits} 
                    className="bg-indigo-50 border border-indigo-150 px-3 py-1.5 rounded-xl flex-row items-center gap-1.5"
                  >
                    <Feather name="refresh-cw" size={10} color="#4F46E5" />
                    <Text className="text-indigo-650 text-[10px] font-black uppercase">Sync</Text>
                  </TouchableOpacity>
                </View>

                {/* Section Toggle: User vs Trainer */}
                <View className="flex-row bg-zinc-100 p-1 rounded-2xl border border-zinc-200/60">
                  <TouchableOpacity
                    onPress={() => setDisputeSection('user')}
                    className={`flex-1 py-2.5 rounded-xl items-center justify-center flex-row gap-2 ${
                      disputeSection === 'user' ? 'bg-white shadow-sm' : 'bg-transparent'
                    }`}
                  >
                    <Feather name="user" size={12} color={disputeSection === 'user' ? '#4F46E5' : '#71717A'} />
                    <Text className={`text-[10px] font-black uppercase tracking-wider ${
                      disputeSection === 'user' ? 'text-zinc-950 font-black' : 'text-zinc-500 font-bold'
                    }`}>
                      User Tickets ({userDisputes.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setDisputeSection('trainer')}
                    className={`flex-1 py-2.5 rounded-xl items-center justify-center flex-row gap-2 ${
                      disputeSection === 'trainer' ? 'bg-white shadow-sm' : 'bg-transparent'
                    }`}
                  >
                    <Feather name="shield" size={12} color={disputeSection === 'trainer' ? '#4F46E5' : '#71717A'} />
                    <Text className={`text-[10px] font-black uppercase tracking-wider ${
                      disputeSection === 'trainer' ? 'text-zinc-950 font-black' : 'text-zinc-500 font-bold'
                    }`}>
                      Trainer Tickets ({trainerDisputes.length})
                    </Text>
                  </TouchableOpacity>
                </View>

                {isLoadingDisputesAndKits ? (
                  <Text className="text-zinc-500 text-xs text-center py-8 bg-zinc-50 border border-zinc-150 rounded-[28px] overflow-hidden">Loading disputes...</Text>
                ) : hasLoadError ? (
                  <Text className="text-red-500 text-xs text-center py-8 bg-red-50 border border-red-200 rounded-[28px] overflow-hidden">Unable to load disputes. Please try again.</Text>
                ) : displayedDisputes.length > 0 ? (
                  <View className="gap-4">
                    {displayedDisputes.map((d) => (
                      <LuxuryCard key={d.id} className="gap-3.5">
                        <View className="flex-row justify-between items-center border-b border-zinc-100 pb-2">
                          <View>
                            <Text className="text-zinc-955 text-xs font-black uppercase">{d.ticket_id || d.id}</Text>
                            <Text className="text-zinc-450 text-[8px] font-black uppercase mt-0.5">Category: {d.category.replace('_', ' ')}</Text>
                          </View>
                          <View className={`px-2.5 py-1 rounded-md ${
                            d.status === 'OPEN' ? 'bg-rose-50 border border-rose-100' :
                            d.status === 'IN REVIEW' ? 'bg-amber-50 border border-amber-100' :
                            'bg-emerald-50 border border-emerald-100'
                          }`}>
                            <Text className={`text-[8px] font-black uppercase ${
                              d.status === 'OPEN' ? 'text-rose-600' :
                              d.status === 'IN REVIEW' ? 'text-amber-600' :
                              'text-emerald-600'
                            }`}>{d.status}</Text>
                          </View>
                        </View>

                        <View className="gap-2 bg-zinc-50 border border-zinc-150/50 p-3 rounded-2xl">
                          {d.trainer_name ? (
                            <View className="flex-row justify-between">
                              <Text className="text-zinc-455 text-[9px] font-bold uppercase">
                                {disputeSection === 'user' ? 'Client / User' : 'Trainer'}
                              </Text>
                              <Text className="text-zinc-900 text-[10px] font-black">{d.trainer_name} {d.trainer_phone ? `(${d.trainer_phone})` : ''}</Text>
                            </View>
                          ) : null}
                          {d.client_name ? (
                            <View className="flex-row justify-between">
                              <Text className="text-zinc-450 text-[9px] font-bold uppercase">Client</Text>
                              <Text className="text-zinc-900 text-[10px] font-black">{d.client_name} {d.client_phone ? `(${d.client_phone})` : ''}</Text>
                            </View>
                          ) : null}
                          {d.booking_id ? (
                            <View className="flex-row justify-between">
                              <Text className="text-zinc-455 text-[9px] font-bold uppercase">Booking ID</Text>
                              <Text className="text-zinc-900 text-[10px] font-extrabold">{d.booking_id}</Text>
                            </View>
                          ) : null}
                          <View className="flex-row justify-between">
                            <Text className="text-zinc-450 text-[9px] font-bold uppercase">Date Created</Text>
                            <Text className="text-zinc-900 text-[10px] font-black">{new Date(d.created_at).toLocaleString()}</Text>
                          </View>
                        </View>

                        <View className="gap-1 mt-1">
                          <Text className="text-zinc-500 text-[8px] font-black uppercase">Ticket Details</Text>
                          <Text className="text-zinc-800 text-xs font-semibold leading-relaxed">{d.description}</Text>
                        </View>

                        {/* Status Update Actions */}
                        <View className="border-t border-zinc-100 pt-3 mt-1.5 gap-2">
                          <Text className="text-zinc-450 text-[8px] font-black uppercase">Update Status</Text>
                          <View className="flex-row gap-1.5 flex-wrap">
                            {['OPEN', 'IN REVIEW', 'RESOLVED', 'CLOSED'].map((st) => (
                              <TouchableOpacity
                                key={st}
                                onPress={async () => {
                                  try {
                                    await Database.updateDisputeStatus(d.id, st);
                                    Alert.alert('Status Updated', `Ticket status set to ${st}`);
                                    loadDisputesAndKits();
                                  } catch (err: any) {
                                    Alert.alert('Error', err.message);
                                  }
                                }}
                                className={`flex-1 py-2 border rounded-xl items-center ${
                                  d.status === st ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-zinc-200'
                                }`}
                              >
                                <Text className={`text-[8px] font-black ${d.status === st ? 'text-white' : 'text-zinc-650'}`}>{st}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      </LuxuryCard>
                    ))}
                  </View>
                ) : (
                  <Text className="text-zinc-450 text-xs text-center py-8 bg-white border border-[#E5E7EB] rounded-[28px] overflow-hidden">
                    {disputeSection === 'user' ? 'No user support tickets logged in system.' : 'No trainer dispute tickets logged in system.'}
                  </Text>
                )}
              </View>
            );
          })()}

          {activeTab === 'kits' && (
            <View className="gap-6">
              <View className="flex-row justify-between items-center">
                <Text className="text-zinc-900 text-xl font-black tracking-tight uppercase">Kit Order Requests</Text>
                <TouchableOpacity 
                  onPress={loadDisputesAndKits} 
                  className="bg-indigo-50 border border-indigo-150 px-3 py-1.5 rounded-xl flex-row items-center gap-1.5"
                >
                  <Feather name="refresh-cw" size={10} color="#4F46E5" />
                  <Text className="text-indigo-650 text-[10px] font-black uppercase">Sync</Text>
                </TouchableOpacity>
              </View>

              {isLoadingDisputesAndKits ? (
                <Text className="text-zinc-500 text-xs text-center py-8 bg-zinc-50 border border-zinc-150 rounded-[28px] overflow-hidden">Loading kit orders...</Text>
              ) : hasLoadError ? (
                <Text className="text-red-500 text-xs text-center py-8 bg-red-50 border border-red-200 rounded-[28px] overflow-hidden">Unable to load kit orders. Please try again.</Text>
              ) : kitOrders.length > 0 ? (
                <View className="gap-4">
                  {kitOrders.map((k) => (
                    <LuxuryCard key={k.id} className="p-5 gap-3.5">
                      <View className="flex-row justify-between items-start border-b border-zinc-100 pb-3 flex-wrap gap-2">
                        <View className="flex-1 min-w-[120px]">
                          <Text className="text-zinc-400 text-[8px] font-black uppercase tracking-wider">Order ID</Text>
                          <Text className="text-zinc-955 text-xs font-black uppercase mt-0.5" numberOfLines={2}>
                            {k.order_id || k.id}
                          </Text>
                          <Text className="text-zinc-450 text-[8px] font-black uppercase mt-1">Trainer: {k.trainer_name}</Text>
                        </View>
                        <View className={`px-2.5 py-1 rounded-md align-self-start ${
                          k.status === 'SUBMITTED' ? 'bg-rose-50 border border-rose-100' :
                          k.status === 'UNDER REVIEW' ? 'bg-amber-50 border border-amber-100' :
                          k.status === 'APPROVED' || k.status === 'DELIVERED' ? 'bg-emerald-50 border border-emerald-100' :
                          'bg-zinc-100 border border-zinc-200'
                        }`}>
                          <Text className={`text-[8px] font-black uppercase ${
                            k.status === 'SUBMITTED' ? 'text-rose-600' :
                            k.status === 'UNDER REVIEW' ? 'text-amber-600' :
                            k.status === 'APPROVED' || k.status === 'DELIVERED' ? 'text-emerald-600' :
                            'text-zinc-650'
                          }`}>{k.status}</Text>
                        </View>
                      </View>

                      <View className="gap-2 bg-zinc-50 border border-zinc-150/50 p-3.5 rounded-2xl">
                        <View className="flex-row justify-between py-1.5 border-b border-zinc-200/40 last:border-b-0 gap-4">
                          <Text className="text-zinc-455 text-[9px] font-bold uppercase min-w-[90px] flex-shrink-0">Trainer Phone</Text>
                          <Text className="text-zinc-900 text-[10px] font-black text-right flex-1 flex-wrap">{k.trainer_phone}</Text>
                        </View>
                        <View className="flex-row justify-between py-1.5 border-b border-zinc-200/40 last:border-b-0 gap-4">
                          <Text className="text-zinc-455 text-[9px] font-bold uppercase min-w-[90px] flex-shrink-0">Date Requested</Text>
                          <Text className="text-zinc-900 text-[10px] font-black text-right flex-1 flex-wrap">
                            {new Date(k.created_at).toLocaleString()}
                          </Text>
                        </View>
                      </View>

                      <View className="gap-1 bg-indigo-50/30 border border-indigo-100/50 p-3.5 rounded-2xl">
                        <Text className="text-indigo-800 text-[8px] font-black uppercase mb-1">Items Requested</Text>
                        <View className="gap-1">
                          {typeof k.items === 'object' && k.items !== null ? (
                            Object.keys(k.items).map((i: string) => (
                              <Text key={i} className="text-zinc-800 text-xs font-semibold leading-relaxed">
                                • {i} × {k.items[i]}
                              </Text>
                            ))
                          ) : Array.isArray(k.items) ? (
                            k.items.map((i: any, idx: number) => (
                              <Text key={idx} className="text-zinc-800 text-xs font-semibold leading-relaxed">
                                • {i}
                              </Text>
                            ))
                          ) : (
                            <Text className="text-zinc-800 text-xs font-semibold leading-relaxed">{JSON.stringify(k.items)}</Text>
                          )}
                          {k.tshirt_size && (
                            <View className="mt-1 bg-indigo-100/40 px-2 py-0.5 rounded-md align-self-start">
                              <Text className="text-indigo-700 text-[9px] font-black uppercase">Size: {k.tshirt_size}</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Status Update Actions */}
                      <View className="border-t border-zinc-100 pt-3 mt-1.5 gap-2">
                        <Text className="text-zinc-455 text-[8px] font-black uppercase">Update Order Status</Text>
                        <View className="flex-row flex-wrap gap-1.5">
                          {['SUBMITTED', 'UNDER REVIEW', 'APPROVED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((st) => (
                            <TouchableOpacity
                              key={st}
                              onPress={async () => {
                                try {
                                  await Database.updateKitOrderStatus(k.id, st);
                                  Alert.alert('Status Updated', `Order status set to ${st}`);
                                  loadDisputesAndKits();
                                } catch (err: any) {
                                  Alert.alert('Error', err.message);
                                }
                              }}
                              className={`px-3 py-1.5 border rounded-xl items-center justify-center ${
                                k.status === st ? 'bg-zinc-950 border-zinc-950' : 'bg-white border-zinc-200'
                              }`}
                            >
                              <Text className={`text-[9px] font-black ${k.status === st ? 'text-white' : 'text-zinc-650'}`}>{st}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </LuxuryCard>
                  ))}
                </View>
              ) : (
                <Text className="text-zinc-450 text-xs text-center py-8 bg-white border border-[#E5E7EB] rounded-[28px] overflow-hidden">No brand kit requests logged in system.</Text>
              )}
            </View>
          )}

          {/* Client Support Tickets Tab */}
          {activeTab === 'support' && (
            <View className="gap-6">
              <View className="flex-row justify-between items-center">
                <View>
                  <Text className="text-zinc-900 text-xl font-black tracking-tight uppercase">Client Concierge Support</Text>
                  <Text className="text-[#6B7280] text-xs font-semibold mt-1">
                    Live tickets & real-time chat with users.
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={loadSupportTickets} 
                  className="bg-rose-50 border border-rose-150 px-3 py-1.5 rounded-xl flex-row items-center gap-1.5"
                >
                  <Feather name="refresh-cw" size={10} color="#E11D48" />
                  <Text className="text-rose-650 text-[10px] font-black uppercase">Sync</Text>
                </TouchableOpacity>
              </View>

              {isLoadingSupportTickets ? (
                <Text className="text-zinc-500 text-xs text-center py-8 bg-zinc-50 border border-zinc-150 rounded-[28px] overflow-hidden">Loading support tickets...</Text>
              ) : supportTickets.length > 0 ? (
                <View className="gap-4">
                  {supportTickets.map((t) => (
                    <LuxuryCard key={t.id} className="p-5 gap-3.5 border border-zinc-200">
                      <View className="flex-row justify-between items-start border-b border-zinc-100 pb-3 flex-wrap gap-2">
                        <View className="flex-1 min-w-[120px]">
                          <Text className="text-zinc-400 text-[8px] font-black uppercase tracking-wider">Ticket ID</Text>
                          <Text className="text-zinc-950 text-xs font-black uppercase mt-0.5">
                            {t.ticket_id}
                          </Text>
                          <Text className="text-zinc-500 text-[9px] font-bold uppercase mt-1">
                            Client: {t.user_name || 'Client'} ({t.user_phone || 'No Phone'})
                          </Text>
                        </View>
                        <View className={`px-2.5 py-1 rounded-md align-self-start ${
                          t.status === 'OPEN' ? 'bg-rose-50 border border-rose-150' :
                          t.status === 'IN_PROGRESS' ? 'bg-amber-50 border border-amber-150' :
                          'bg-emerald-50 border border-emerald-150'
                        }`}>
                          <Text className={`text-[8px] font-black uppercase ${
                            t.status === 'OPEN' ? 'text-rose-600' :
                            t.status === 'IN_PROGRESS' ? 'text-amber-600' :
                            'text-emerald-600'
                          }`}>{t.status}</Text>
                        </View>
                      </View>

                      {/* Ticket Meta Details */}
                      <View className="gap-2 bg-zinc-50 border border-zinc-150/60 p-3.5 rounded-2xl">
                        <View className="flex-row justify-between">
                          <Text className="text-zinc-450 text-[9px] font-bold uppercase">Category</Text>
                          <Text className="text-zinc-900 text-[10px] font-black">{t.category}</Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-zinc-450 text-[9px] font-bold uppercase">Reason</Text>
                          <Text className="text-zinc-900 text-[10px] font-black">{t.reason}</Text>
                        </View>
                        {t.preferred_resolution ? (
                          <View className="flex-row justify-between">
                            <Text className="text-zinc-450 text-[9px] font-bold uppercase">Target Resolution</Text>
                            <Text className="text-rose-600 text-[10px] font-black">{t.preferred_resolution}</Text>
                          </View>
                        ) : null}
                        {t.booking_id ? (
                          <View className="flex-row justify-between">
                            <Text className="text-zinc-450 text-[9px] font-bold uppercase">Linked Booking ID</Text>
                            <Text className="text-indigo-600 text-[10px] font-black">{t.booking_id}</Text>
                          </View>
                        ) : null}
                        <View className="flex-row justify-between">
                          <Text className="text-zinc-450 text-[9px] font-bold uppercase">Created At</Text>
                          <Text className="text-zinc-900 text-[10px] font-semibold">{new Date(t.created_at).toLocaleString()}</Text>
                        </View>
                      </View>

                      {/* Description */}
                      <View className="gap-1">
                        <Text className="text-zinc-400 text-[8px] font-black uppercase">Client Note</Text>
                        <Text className="text-zinc-800 text-xs font-semibold leading-relaxed">
                          {t.description}
                        </Text>
                      </View>

                      {/* Action Row: Open Real-time Chat & Status Toggle */}
                      <View className="border-t border-zinc-100 pt-3 gap-3">
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => setSelectedSupportChatTicket(t)}
                          className="w-full bg-[#101828] py-3 rounded-xl items-center justify-center flex-row gap-2"
                        >
                          <Feather name="message-circle" size={15} color="#FFFFFF" />
                          <Text className="text-white text-xs font-black uppercase tracking-wider">
                            Open Realtime Support Chat
                          </Text>
                        </TouchableOpacity>

                        <View className="gap-1.5">
                          <Text className="text-zinc-450 text-[8px] font-black uppercase">Update Ticket Status</Text>
                          <View className="flex-row gap-1.5">
                            {(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const).map((st) => (
                              <TouchableOpacity
                                key={st}
                                onPress={async () => {
                                  try {
                                    await Database.updateSupportTicketStatus(t.id, st);
                                    Alert.alert('Status Updated', `Ticket status set to ${st}`);
                                    loadSupportTickets();
                                  } catch (err: any) {
                                    Alert.alert('Error', err.message);
                                  }
                                }}
                                className={`flex-1 py-2 border rounded-xl items-center ${
                                  t.status === st ? 'bg-zinc-950 border-zinc-950' : 'bg-white border-zinc-200'
                                }`}
                              >
                                <Text className={`text-[8px] font-black ${t.status === st ? 'text-white' : 'text-zinc-650'}`}>
                                  {st}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      </View>
                    </LuxuryCard>
                  ))}
                </View>
              ) : (
                <Text className="text-zinc-450 text-xs text-center py-8 bg-white border border-[#E5E7EB] rounded-[28px] overflow-hidden">
                  No client support tickets logged in system.
                </Text>
              )}
            </View>
          )}

        </ScrollView>
      </View>

      {/* Real-time Admin Support Chat Modal */}
      <SupportChatModal
        visible={selectedSupportChatTicket !== null}
        ticket={selectedSupportChatTicket}
        currentRole="admin"
        onClose={() => {
          setSelectedSupportChatTicket(null);
          loadSupportTickets();
        }}
      />

      {/* Detailed Audit Modal */}
      <Modal
        visible={selectedAuditSession !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedAuditSession(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(9, 9, 11, 0.7)', justifyContent: 'center', padding: 20 }}>
          <View className="bg-white rounded-[32px] border border-zinc-200 p-6 shadow-2xl max-h-[85%]">
            <View className="flex-row justify-between items-center border-b border-zinc-100 pb-4 mb-4">
              <Text className="text-[#101828] text-base font-black uppercase tracking-wider">Session Audit Log</Text>
              <TouchableOpacity 
                onPress={() => setSelectedAuditSession(null)}
                className="w-8 h-8 rounded-full bg-zinc-50 items-center justify-center"
              >
                <Feather name="x" size={16} color="#101828" />
              </TouchableOpacity>
            </View>

            {selectedAuditSession && (() => {
              const b = selectedAuditSession;
              const checkInStatus = b.gracePeriodStartedAt ? 'Arrived / Checked In' : 'Not Checked In';
              const checkInTime = b.gracePeriodStartedAt ? new Date(b.gracePeriodStartedAt).toLocaleString() : 'N/A';
              const startTime = b.workoutStartedAt ? new Date(b.workoutStartedAt).toLocaleString() : 'N/A';
              const otpStatus = b.workoutStartedAt || ['workout_started', 'workout_completed', 'session_closed'].includes(b.timelineStatus || '') ? 'Verified' : 'Not Verified (Pending / Expired)';
              
              let statusExplanation = 'Session completed or cancelled normally.';
              if (b.status === 'missed_session_not_started') {
                statusExplanation = 'The session was not completed because neither party completed the required session-start flow.';
              } else if (b.status === 'client_no_show') {
                statusExplanation = 'Client failed to arrive or verify check-in within the 15-minute grace period.';
              } else if (b.status === 'trainer_no_show') {
                statusExplanation = 'Trainer failed to arrive at the customer location.';
              }

              return (
                <ScrollView showsVerticalScrollIndicator={false} className="gap-4">
                  {/* Explanation Alert */}
                  <View className="bg-zinc-50 border border-zinc-200 p-4 rounded-2xl mb-2">
                    <Text className="text-[#101828] text-[10px] font-black uppercase tracking-wider">Audit Explanation</Text>
                    <Text className="text-zinc-500 text-xs font-semibold mt-1.5 leading-relaxed">{statusExplanation}</Text>
                  </View>

                  {/* Booking Acceptance Audit Timeline */}
                  {b.createdAt && (
                    <View className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl mb-2 gap-2">
                      <Text className="text-indigo-950 text-[10px] font-black uppercase tracking-wider">Acceptance Audit Timeline</Text>
                      
                      <View className="gap-2.5 mt-1.5 pl-1.5 border-l border-indigo-200">
                        {/* 1. Created Event */}
                        <View className="flex-row items-center gap-2">
                          <View className="w-1.5 h-1.5 rounded-full bg-indigo-500 -ml-[9.5px]" />
                          <Text className="text-zinc-500 text-[8px] font-bold">{new Date(b.createdAt).toLocaleTimeString()}</Text>
                          <Text className="text-zinc-800 text-[9px] font-semibold">Booking Created</Text>
                        </View>

                        {/* 2. Notification T+0 Event */}
                        <View className="flex-row items-center gap-2">
                          <View className="w-1.5 h-1.5 rounded-full bg-indigo-500 -ml-[9.5px]" />
                          <Text className="text-zinc-500 text-[8px] font-bold">{new Date(b.createdAt).toLocaleTimeString()}</Text>
                          <Text className="text-zinc-800 text-[9px] font-semibold">Trainer Alert Notification Sent (T+0)</Text>
                        </View>

                        {/* 3. Notification T+15m Event if reminder count >= 2 */}
                        {(b.acceptanceNotificationCount || 1) >= 2 && (
                          <View className="flex-row items-center gap-2">
                            <View className="w-1.5 h-1.5 rounded-full bg-amber-500 -ml-[9.5px]" />
                            <Text className="text-zinc-500 text-[8px] font-bold">
                              {new Date(b.lastAcceptanceNotificationAt || (b.createdAt + 15 * 60 * 1000)).toLocaleTimeString()}
                            </Text>
                            <Text className="text-zinc-800 text-[9px] font-semibold">Acceptance Reminder Notification Sent (T+15)</Text>
                          </View>
                        )}

                        {/* 4. Acceptance Event */}
                        {b.acceptanceMethod === 'SYSTEM_AUTO_ACCEPT' ? (
                          <View className="flex-row items-center gap-2">
                            <View className="w-1.5 h-1.5 rounded-full bg-rose-500 -ml-[9.5px]" />
                            <Text className="text-zinc-500 text-[8px] font-bold">
                              {b.autoAcceptedAt ? new Date(b.autoAcceptedAt).toLocaleTimeString() : (b.acceptanceDeadline ? new Date(b.acceptanceDeadline).toLocaleTimeString() : 'Auto-Accepted')}
                            </Text>
                            <Text className="text-rose-600 text-[9px] font-black uppercase">SYSTEM AUTO-ACCEPTED (NO RESP)</Text>
                          </View>
                        ) : b.acceptanceMethod === 'TRAINER_MANUAL_ACCEPT' ? (
                          <View className="flex-row items-center gap-2">
                            <View className="w-1.5 h-1.5 rounded-full bg-emerald-500 -ml-[9.5px]" />
                            <Text className="text-zinc-500 text-[8px] font-bold">
                              {b.trainerAcceptedAt ? new Date(b.trainerAcceptedAt).toLocaleTimeString() : 'Accepted'}
                            </Text>
                            <Text className="text-emerald-700 text-[9px] font-black uppercase">Trainer Manually Accepted</Text>
                          </View>
                        ) : (
                          <View className="flex-row items-center gap-2">
                            <View className="w-1.5 h-1.5 rounded-full bg-amber-500 -ml-[9.5px]" />
                            <Text className="text-zinc-400 text-[8px] font-bold">Pending</Text>
                            <Text className="text-amber-700 text-[9px] font-bold uppercase">Waiting for Trainer Confirmation</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Fields list */}
                  <View className="gap-3">
                    <View>
                      <Text className="text-zinc-400 text-[8px] font-black uppercase">Booking ID</Text>
                      <Text className="text-[#101828] text-xs font-semibold mt-0.5">{b.id}</Text>
                    </View>
                    
                    <View className="flex-row justify-between">
                      <View className="w-[48%]">
                        <Text className="text-zinc-400 text-[8px] font-black uppercase">Client Name</Text>
                        <Text className="text-[#101828] text-xs font-semibold mt-0.5">{b.clientName || 'Client'}</Text>
                      </View>
                      <View className="w-[48%]">
                        <Text className="text-zinc-400 text-[8px] font-black uppercase">Assigned Trainer</Text>
                        <Text className="text-[#101828] text-xs font-semibold mt-0.5">{b.trainerName} ({b.trainerId || 'N/A'})</Text>
                      </View>
                    </View>

                    <View className="flex-row justify-between">
                      <View className="w-[48%]">
                        <Text className="text-zinc-400 text-[8px] font-black uppercase">Workout Type</Text>
                        <Text className="text-[#101828] text-xs font-semibold mt-0.5">{b.workoutTitle}</Text>
                      </View>
                      <View className="w-[48%]">
                        <Text className="text-zinc-400 text-[8px] font-black uppercase">Booked Slot</Text>
                        <Text className="text-[#101828] text-xs font-semibold mt-0.5">{formatToDDMMYYYY(b.date)} • {b.time}</Text>
                      </View>
                    </View>

                    <View className="h-[1px] bg-zinc-100 my-1" />

                    <View className="flex-row justify-between">
                      <View className="w-[48%]">
                        <Text className="text-zinc-400 text-[8px] font-black uppercase">Trainer Check-In Status</Text>
                        <Text className="text-[#101828] text-xs font-semibold mt-0.5">{checkInStatus}</Text>
                      </View>
                      <View className="w-[48%]">
                        <Text className="text-zinc-400 text-[8px] font-black uppercase">Check-In Timestamp</Text>
                        <Text className="text-[#101828] text-xs font-semibold mt-0.5">{checkInTime}</Text>
                      </View>
                    </View>

                    <View className="flex-row justify-between">
                      <View className="w-[48%]">
                        <Text className="text-zinc-400 text-[8px] font-black uppercase">Session Start Time</Text>
                        <Text className="text-[#101828] text-xs font-semibold mt-0.5">{startTime}</Text>
                      </View>
                      <View className="w-[48%]">
                        <Text className="text-zinc-400 text-[8px] font-black uppercase">OTP Verification</Text>
                        <Text className="text-[#101828] text-xs font-semibold mt-0.5">{otpStatus}</Text>
                      </View>
                    </View>

                    <View className="h-[1px] bg-zinc-100 my-1" />

                    <View className="flex-row justify-between">
                      <View className="w-[48%]">
                        <Text className="text-zinc-400 text-[8px] font-black uppercase">Completion Status</Text>
                        <Text className="text-[#101828] text-xs font-semibold mt-0.5">{b.status === 'completed' ? 'Completed' : 'Not Completed'}</Text>
                      </View>
                      <View className="w-[48%]">
                        <Text className="text-zinc-400 text-[8px] font-black uppercase">Cancellation Status</Text>
                        <Text className="text-[#101828] text-xs font-semibold mt-0.5">{b.status === 'cancelled' ? 'Cancelled' : 'Not Cancelled'}</Text>
                      </View>
                    </View>

                    <View className="flex-row justify-between">
                      <View className="w-[48%]">
                        <Text className="text-zinc-400 text-[8px] font-black uppercase">Final Status Code</Text>
                        <Text className="text-rose-600 text-xs font-bold uppercase mt-0.5">{b.status}</Text>
                      </View>
                      <View className="w-[48%]">
                        <Text className="text-zinc-400 text-[8px] font-black uppercase">Timeline Status</Text>
                        <Text className="text-[#101828] text-xs font-semibold mt-0.5">{b.timelineStatus || 'N/A'}</Text>
                      </View>
                    </View>

                    <View className="h-[1px] bg-zinc-100 my-1" />

                    <View>
                      <Text className="text-zinc-400 text-[8px] font-black uppercase">Database Created Timestamp</Text>
                      <Text className="text-[#101828] text-xs font-semibold mt-0.5">{b.createdAt ? new Date(b.createdAt).toLocaleString() : 'N/A'}</Text>
                    </View>
                  </View>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Physical Interview Verification Form Modal */}
      <Modal
        visible={!!interviewFormApp}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setInterviewFormApp(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View className="bg-white rounded-[26px] p-6 w-full max-w-lg gap-4 shadow-2xl">
            {/* Header */}
            <View className="flex-row items-center justify-between border-b border-zinc-100 pb-3">
              <View className="gap-0.5">
                <Text className="text-zinc-400 text-[9px] font-black uppercase tracking-wider">Physical Verification</Text>
                <Text className="text-zinc-950 text-base font-black tracking-tight">
                  Interview Form: {interviewFormApp?.fullName}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setInterviewFormApp(null)}
                className="w-8 h-8 rounded-full bg-zinc-100 items-center justify-center"
              >
                <Feather name="x" size={16} color="#71717A" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="max-h-[460px]">
              <View className="gap-4">
                {/* 1. ID Document Selection (Aadhaar / PAN) */}
                <View className="gap-2">
                  <Text className="text-zinc-700 text-xs font-bold uppercase tracking-wide">
                    1. ID Document Upload (Aadhaar or PAN)
                  </Text>
                  
                  {/* Selector tabs */}
                  <View className="flex-row bg-zinc-100 p-1 rounded-xl">
                    {(['aadhaar', 'pan'] as const).map(t => (
                      <TouchableOpacity
                        key={t}
                        onPress={() => setInterviewIdType(t)}
                        className={`flex-1 py-2 items-center rounded-lg ${
                          interviewIdType === t ? 'bg-[#101828]' : 'bg-transparent'
                        }`}
                      >
                        <Text className={`text-[10px] font-black uppercase ${
                          interviewIdType === t ? 'text-white' : 'text-zinc-600'
                        }`}>
                          {t === 'aadhaar' ? 'Aadhaar Card' : 'PAN Card'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* ID Preview / Capture Box */}
                  <View className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl gap-2.5">
                    {interviewIdDocUri ? (
                      <View className="items-center gap-2">
                        <Image
                          source={{ uri: interviewIdDocUri }}
                          style={{ width: '100%', height: 140, borderRadius: 12, backgroundColor: '#E4E4E7' }}
                          resizeMode="cover"
                        />
                        <Text className="text-emerald-700 text-[10px] font-black uppercase">✓ Document Captured</Text>
                      </View>
                    ) : (
                      <View className="py-6 items-center justify-center gap-1 border-2 border-dashed border-zinc-200 rounded-xl">
                        <Feather name="file-text" size={24} color="#A1A1AA" />
                        <Text className="text-zinc-400 text-xs font-semibold">No ID document selected</Text>
                      </View>
                    )}

                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        onPress={() => handleCaptureInterviewPhoto('id')}
                        className="flex-1 py-2.5 bg-zinc-950 rounded-xl items-center justify-center flex-row gap-1.5"
                      >
                        <Feather name="camera" size={13} color="#FFFFFF" />
                        <Text className="text-white text-[10px] font-black uppercase">Take Photo</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handlePickInterviewGallery('id')}
                        className="flex-1 py-2.5 bg-white border border-zinc-200 rounded-xl items-center justify-center flex-row gap-1.5"
                      >
                        <Feather name="image" size={13} color="#18181B" />
                        <Text className="text-zinc-800 text-[10px] font-black uppercase">Pick Gallery</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* 2. Trainer Profile Picture Capture */}
                <View className="gap-2">
                  <Text className="text-zinc-700 text-xs font-bold uppercase tracking-wide">
                    2. Trainer Profile Photo (Live Admin Capture)
                  </Text>

                  <View className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl gap-2.5">
                    {interviewProfilePicUri ? (
                      <View className="items-center gap-2">
                        <Image
                          source={{ uri: interviewProfilePicUri }}
                          style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#E4E4E7' }}
                          resizeMode="cover"
                        />
                        <Text className="text-emerald-700 text-[10px] font-black uppercase">✓ Photo Captured</Text>
                      </View>
                    ) : (
                      <View className="py-6 items-center justify-center gap-1 border-2 border-dashed border-zinc-200 rounded-xl">
                        <Feather name="user" size={24} color="#A1A1AA" />
                        <Text className="text-zinc-400 text-xs font-semibold">Take Trainer's Live Photo</Text>
                      </View>
                    )}

                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        onPress={() => handleCaptureInterviewPhoto('profile')}
                        className="flex-1 py-2.5 bg-zinc-950 rounded-xl items-center justify-center flex-row gap-1.5"
                      >
                        <Feather name="camera" size={13} color="#FFFFFF" />
                        <Text className="text-white text-[10px] font-black uppercase">Take Photo</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handlePickInterviewGallery('profile')}
                        className="flex-1 py-2.5 bg-white border border-zinc-200 rounded-xl items-center justify-center flex-row gap-1.5"
                      >
                        <Feather name="image" size={13} color="#18181B" />
                        <Text className="text-zinc-800 text-[10px] font-black uppercase">Pick Gallery</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Save Button */}
            <TouchableOpacity
              disabled={isSavingInterviewForm}
              onPress={handleSaveInterviewForm}
              className={`w-full py-4 rounded-xl items-center justify-center ${
                isSavingInterviewForm ? 'bg-zinc-300' : 'bg-emerald-600'
              }`}
            >
              {isSavingInterviewForm ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-white text-xs font-black uppercase tracking-wider">
                  Save Interview Details & Enable Approval
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Direct Admin Location & Radius Override Modal */}
      <Modal
        visible={editingCoachLocation !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingCoachLocation(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(9, 9, 11, 0.7)', justifyContent: 'center', padding: 20 }}>
          <View className="bg-white rounded-[32px] border border-zinc-200 p-6 shadow-2xl max-h-[90%] gap-4">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center border-b border-zinc-100 pb-3">
              <View>
                <Text className="text-[#101828] text-base font-black uppercase tracking-wider">
                  Edit Operating Base & Radius
                </Text>
                <Text className="text-zinc-400 text-[10px] font-bold mt-0.5">
                  Coach {editingCoachLocation?.name} ({editingCoachLocation?.id})
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => setEditingCoachLocation(null)}
                className="w-8 h-8 rounded-full bg-zinc-50 items-center justify-center"
              >
                <Feather name="x" size={16} color="#101828" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="gap-4">
              {/* Functionality Brief */}
              <View className="bg-indigo-50/50 border border-indigo-150 p-3 rounded-2xl gap-1">
                <Text className="text-indigo-950 text-[10px] font-black uppercase tracking-wider">
                  Admin Authority Override
                </Text>
                <Text className="text-zinc-650 text-xs font-medium leading-relaxed">
                  Modifying this base address or radius directly alters this coach's dispatch coverage. Clients searching outside this radius will not be matched.
                </Text>
              </View>

              {/* Operating Base Address Input */}
              <View className="gap-1.5 mt-2">
                <Text className="text-zinc-700 text-xs font-black uppercase tracking-wider">
                  Operating Base Address
                </Text>
                <TextInput
                  value={overrideAddress}
                  onChangeText={setOverrideAddress}
                  placeholder="e.g. Andheri West, Mumbai, MH"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3.5 text-zinc-900 text-xs font-semibold leading-relaxed min-h-[70px]"
                />
              </View>

              {/* Service Radius Selector */}
              <View className="gap-1.5 mt-2">
                <View className="flex-row justify-between items-center">
                  <Text className="text-zinc-700 text-xs font-black uppercase tracking-wider">
                    Service Area Radius Limit
                  </Text>
                  <Text className="text-indigo-600 text-xs font-black">
                    {overrideRadius} km Coverage
                  </Text>
                </View>
                <View className="flex-row gap-2 mt-1">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setOverrideRadius(r)}
                      className={`flex-1 py-3 rounded-2xl border items-center justify-center flex-row gap-1.5 ${
                        overrideRadius === r 
                          ? 'bg-indigo-600 border-indigo-600 shadow-xs' 
                          : 'bg-zinc-50 border-zinc-200'
                      }`}
                    >
                      <Text className={`text-xs font-black ${overrideRadius === r ? 'text-white' : 'text-zinc-700'}`}>
                        {r} km
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Verification Status Selector */}
              <View className="gap-1.5 mt-2">
                <Text className="text-zinc-700 text-xs font-black uppercase tracking-wider">
                  Verification Status
                </Text>
                <View className="flex-row gap-2 mt-1">
                  {(['verified', 'pending', 'rejected'] as const).map((st) => (
                    <TouchableOpacity
                      key={st}
                      onPress={() => setOverrideStatus(st)}
                      className={`flex-1 py-2.5 rounded-xl border items-center justify-center ${
                        overrideStatus === st 
                          ? st === 'verified'
                            ? 'bg-emerald-600 border-emerald-600'
                            : st === 'rejected'
                            ? 'bg-rose-600 border-rose-600'
                            : 'bg-amber-600 border-amber-600'
                          : 'bg-zinc-50 border-zinc-200'
                      }`}
                    >
                      <Text className={`text-[9px] font-black uppercase ${
                        overrideStatus === st ? 'text-white' : 'text-zinc-700'
                      }`}>
                        {st}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-2.5 mt-4 pt-3 border-t border-zinc-100">
                <TouchableOpacity
                  onPress={() => setEditingCoachLocation(null)}
                  disabled={isSavingLocation}
                  className="flex-1 py-3.5 border border-zinc-200 rounded-2xl items-center justify-center bg-white"
                >
                  <Text className="text-zinc-600 text-xs font-black uppercase tracking-wider">Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSaveLocationOverride}
                  disabled={isSavingLocation}
                  className="flex-1 py-3.5 bg-zinc-950 rounded-2xl items-center justify-center flex-row gap-2 shadow-sm"
                >
                  {isSavingLocation ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="save" size={14} color="#FFFFFF" />
                      <Text className="text-white text-xs font-black uppercase tracking-wider">Save Changes</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaViewWrapper>
  );
}

function SafeAreaViewWrapper({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: '#FCF5F5', paddingTop: insets.top }}>
      {children}
    </View>
  );
}
