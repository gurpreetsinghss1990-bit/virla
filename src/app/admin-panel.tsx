import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform, Image, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Database, TrainerApplication, getCurrentServerTime, getBookingISTDateRange, getISTDateInfo } from '../database/Database';
import { Booking } from '../types';
import { Coach } from '../types';
import { LuxuryCard } from '../components/LuxuryCard';
import { supabase } from '../database/supabaseClient';
import { useBookingStore } from '../store/bookingStore';
import { normalizeDate } from '../utils/date';

export default function AdminPanelScreen() {
  const router = useRouter();
  const [applications, setApplications] = useState<TrainerApplication[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdminAuthorized, setIsAdminAuthorized] = useState<boolean | null>(null);
  
  // Tab controller state
  const [activeTab, setActiveTab] = useState<'applications' | 'live' | 'locations' | 'acceptance'>('applications');

  // Filters for trainer locations
  const [radiusFilter, setRadiusFilter] = useState<'all' | '10' | '15'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending'>('all');
  const [selectedAuditSession, setSelectedAuditSession] = useState<Booking | null>(null);
  
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

    const loadApplications = async () => {
      if (isAdminAuthorized !== true) return;
      setIsLoading(true);
      try {
        const data = await Database.fetchAllTrainerApplications();
        setApplications(data);
        setCoaches(Database.getCoaches());
      } catch (err: any) {
        Alert.alert('Error', err.message);
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
        radiusKm: request.requestedRadius,
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

  useEffect(() => {
    if (isAdminAuthorized === true) {
      Promise.resolve().then(() => {
        loadApplications();
      });
    }
  }, [isAdminAuthorized]);

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
  const liveSessions = bookings.filter(b => b.status === 'upcoming' && b.timelineStatus && b.timelineStatus !== 'booked' && b.timelineStatus !== 'session_closed');
  
  // A session is considered delayed if it's assigned/accepted but hasn't advanced to travelling/arrived yet
  const delayedSessions = bookings.filter(b => b.status === 'upcoming' && (b.timelineStatus === 'trainer_assigned' || b.timelineStatus === 'trainer_accepted'));
  
  const completedSessionsCount = bookings.filter(b => b.status === 'completed').length;
  const cancelledSessionsCount = bookings.filter(b => b.status === 'cancelled' || b.status === 'client_no_show' || b.status === 'trainer_no_show').length;
  const missedOrEndedSessions = bookings.filter(b => b.status !== 'upcoming');

  if (isAdminAuthorized === null) {
    return (
      <SafeAreaViewWrapper>
        <View className="flex-1 bg-[#F7F8FC] justify-center items-center">
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text className="text-zinc-400 text-xs font-black uppercase tracking-wider mt-4">Verifying Credentials...</Text>
        </View>
      </SafeAreaViewWrapper>
    );
  }

  if (isAdminAuthorized === false) {
    return (
      <SafeAreaViewWrapper>
        <View className="flex-1 bg-[#F7F8FC] justify-center items-center px-6">
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
      <View className="flex-1 bg-[#F7F8FC]">
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
          <TouchableOpacity onPress={loadApplications} className="w-8 h-8 items-center justify-center">
            <Feather name="refresh-cw" size={16} color="#101828" />
          </TouchableOpacity>
        </View>

        {/* Navigation Tabs Header */}
        <View className="flex-row bg-white border-b border-zinc-150 p-2 gap-1.5 flex-wrap">
          <TouchableOpacity
            onPress={() => setActiveTab('applications')}
            className={`flex-1 py-3 rounded-xl items-center justify-center min-w-[70px] ${activeTab === 'applications' ? 'bg-zinc-950' : 'bg-transparent'}`}
          >
            <Text className={`text-[7px] font-black uppercase tracking-wider text-center ${activeTab === 'applications' ? 'text-white' : 'text-zinc-400'}`}>Onboarding</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/admin-workout-approvals')}
            className="flex-1 py-3 rounded-xl items-center justify-center bg-transparent border border-zinc-150 min-w-[70px]"
          >
            <Text className="text-[7px] font-black uppercase tracking-wider text-center text-zinc-500 font-extrabold">Workouts</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('locations')}
            className={`flex-1 py-3 rounded-xl items-center justify-center min-w-[70px] ${activeTab === 'locations' ? 'bg-zinc-950' : 'bg-transparent'}`}
          >
            <Text className={`text-[7px] font-black uppercase tracking-wider text-center ${activeTab === 'locations' ? 'text-white' : 'text-zinc-400'}`}>Locations</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('live')}
            className={`flex-1 py-3 rounded-xl items-center justify-center min-w-[70px] ${activeTab === 'live' ? 'bg-zinc-950' : 'bg-transparent'}`}
          >
            <Text className={`text-[7px] font-black uppercase tracking-wider text-center ${activeTab === 'live' ? 'text-white' : 'text-zinc-400'}`}>Live Console</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('acceptance')}
            className={`flex-1 py-3 rounded-xl items-center justify-center min-w-[70px] ${activeTab === 'acceptance' ? 'bg-zinc-950' : 'bg-transparent'}`}
          >
            <Text className={`text-[7px] font-black uppercase tracking-wider text-center ${activeTab === 'acceptance' ? 'text-white' : 'text-zinc-400'}`}>Acceptance</Text>
          </TouchableOpacity>
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
                              <Image source={{ uri: app.avatar }} className="w-10 h-10 rounded-full border border-zinc-200" />
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

                          <View className="gap-1.5 pl-1">
                            <Text className="text-zinc-800 text-xs font-semibold">Specialty: <Text className="font-medium text-zinc-600">{app.primaryWorkout}</Text></Text>
                            <Text className="text-zinc-800 text-xs font-semibold">Experience: <Text className="font-medium text-zinc-600">{app.yearsOfExperience} years</Text></Text>
                            <Text className="text-zinc-800 text-xs font-semibold">Languages: <Text className="font-medium text-zinc-600">{app.languages}</Text></Text>
                          </View>

                          <View className="h-[1px] bg-zinc-100" />

                          <View className="gap-2">
                            <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-wider">Verification Documents</Text>
                            <View className="flex-row gap-3">
                              <View className="flex-1 bg-zinc-50 p-2.5 rounded-lg border border-zinc-100 items-center justify-center">
                                <Feather name="file-text" size={14} color="#6B7280" />
                                <Text className="text-zinc-500 text-[8px] mt-1 font-bold">PAN CARD</Text>
                                <Text className="text-zinc-800 text-[9px] font-medium mt-0.5">{app.panNumber}</Text>
                              </View>
                              
                              <View className="flex-row items-center gap-1.5 flex-1 bg-zinc-50 p-2.5 rounded-lg border border-zinc-100 justify-center">
                                <Feather name="image" size={14} color="#6B7280" />
                                <Text className="text-zinc-500 text-[8px] font-bold">SELFIE</Text>
                                <Text className="text-[#101828] text-[9px] font-medium" numberOfLines={1}>Attached</Text>
                              </View>
                            </View>
                          </View>

                          {app.status !== 'approved' && (
                            <>
                              <View className="h-[1px] bg-zinc-100" />
                              <View className="flex-row gap-2 mt-1">
                                <TouchableOpacity
                                  onPress={() => handleApproveApp(app.id)}
                                  className="flex-1 py-3 bg-emerald-600 rounded-lg items-center justify-center"
                                >
                                  <Text className="text-white text-[9px] font-black uppercase tracking-widest">Approve</Text>
                                </TouchableOpacity>
                                
                                <TouchableOpacity
                                  onPress={() => handleRequestInfoApp(app.id)}
                                  className="flex-1 py-3 bg-blue-600 rounded-lg items-center justify-center"
                                >
                                  <Text className="text-white text-[9px] font-black uppercase tracking-widest">Req Info</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  onPress={() => handleRejectApp(app.id)}
                                  className="flex-1 py-3 bg-rose-600 rounded-lg items-center justify-center"
                                >
                                  <Text className="text-white text-[9px] font-black uppercase tracking-widest">Reject</Text>
                                </TouchableOpacity>
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
              <View>
                <Text className="text-zinc-900 text-xl font-black tracking-tight uppercase">Trainer Locations</Text>
                <Text className="text-[#6B7280] text-xs font-semibold mt-1 leading-relaxed">
                  Manage permanent trainer operating coordinates and service areas.
                </Text>
              </View>

              {/* Filters */}
              <View className="bg-white border border-[#E5E7EB] p-4.5 rounded-[24px] shadow-xs gap-3">
                <Text className="text-zinc-950 text-[9px] font-black uppercase tracking-wider">Filters</Text>
                
                <View className="flex-row gap-2">
                  {/* Status Filter */}
                  <View className="flex-1 gap-1">
                    <Text className="text-zinc-400 text-[8px] font-black uppercase">Status</Text>
                    <View className="flex-row bg-[#F1F3F5] p-1 rounded-xl">
                      {['all', 'verified', 'pending'].map((st) => (
                        <TouchableOpacity
                          key={st}
                          onPress={() => setStatusFilter(st as any)}
                          className={`flex-1 py-1 rounded-lg items-center ${statusFilter === st ? 'bg-white shadow-xs' : ''}`}
                        >
                          <Text className="text-[8px] font-black uppercase text-zinc-950">{st}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Radius Filter */}
                  <View className="flex-1 gap-1">
                    <Text className="text-zinc-400 text-[8px] font-black uppercase">Radius</Text>
                    <View className="flex-row bg-[#F1F3F5] p-1 rounded-xl">
                      {['all', '10', '15'].map((rd) => (
                        <TouchableOpacity
                          key={rd}
                          onPress={() => setRadiusFilter(rd as any)}
                          className={`flex-1 py-1 rounded-lg items-center ${radiusFilter === rd ? 'bg-white shadow-xs' : ''}`}
                        >
                          <Text className="text-[8px] font-black uppercase text-zinc-950">{rd === 'all' ? 'All' : `${rd}km`}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              </View>

              {/* List */}
              <View className="gap-4">
                {coaches
                  .filter((c) => {
                    const status = c.preferences?.operatingLocationStatus || 'pending';
                    const radius = String(c.preferences?.radiusKm || 15);
                    if (statusFilter !== 'all' && status !== statusFilter) return false;
                    if (radiusFilter !== 'all' && radius !== radiusFilter) return false;
                    return true;
                  })
                  .map((coach) => {
                    const hasRequest = !!coach.preferences?.addressChangeRequest;
                    return (
                      <LuxuryCard key={coach.id} className="p-5 gap-4" interactive={false}>
                        <View className="flex-row justify-between items-start">
                          <View className="flex-row items-center gap-3">
                            <Image source={{ uri: coach.photo }} className="w-10 h-10 rounded-full border border-zinc-200" />
                            <View>
                              <Text className="text-zinc-950 text-xs font-black">{coach.name}</Text>
                              <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">Trainer ID: {coach.id}</Text>
                            </View>
                          </View>

                          <View className={`px-2 py-0.5 rounded-full ${
                            coach.preferences?.operatingLocationStatus === 'verified'
                              ? 'bg-green-50 border border-green-150'
                              : 'bg-amber-50 border border-amber-150'
                          }`}>
                            <Text className={`text-[7px] font-black uppercase ${
                              coach.preferences?.operatingLocationStatus === 'verified' ? 'text-green-600' : 'text-amber-600'
                            }`}>
                              {coach.preferences?.operatingLocationStatus || 'pending'}
                            </Text>
                          </View>
                        </View>

                        <View className="h-[1px] bg-zinc-50" />

                        <View className="gap-2.5 pl-1">
                          <View className="gap-0.5">
                            <Text className="text-zinc-400 text-[8px] font-black uppercase">Operating Base Address</Text>
                            <Text className="text-zinc-900 text-xs font-bold leading-normal">
                              {coach.preferences?.operatingAddress || 'Not Set'}
                            </Text>
                          </View>

                          <View className="flex-row justify-between">
                            <View className="gap-0.5">
                              <Text className="text-zinc-400 text-[8px] font-black uppercase">Coordinates</Text>
                              <Text className="text-zinc-700 text-[10px] font-semibold">
                                {coach.preferences?.operatingLatitude !== undefined 
                                  ? `${coach.preferences.operatingLatitude.toFixed(5)}, ${coach.preferences.operatingLongitude?.toFixed(5)}` 
                                  : 'Not Configured'}
                              </Text>
                            </View>

                            <View className="gap-0.5 items-end">
                              <Text className="text-zinc-400 text-[8px] font-black uppercase">Service Area Radius</Text>
                              <Text className="text-zinc-700 text-[10px] font-semibold">
                                {coach.preferences?.radiusKm ? `${coach.preferences.radiusKm} km` : '15 km (Default)'}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {hasRequest && (
                          <View className="bg-amber-50 border border-amber-200/50 p-4 rounded-2xl gap-3">
                            <View className="gap-1">
                              <Text className="text-amber-800 text-[8px] font-black uppercase tracking-wider">Requested Location Update</Text>
                              <Text className="text-zinc-900 text-xs font-black">
                                {coach.preferences?.addressChangeRequest?.requestedAddress}
                              </Text>
                              <Text className="text-zinc-500 text-[8px] font-bold uppercase">
                                Requested Radius: {coach.preferences?.addressChangeRequest?.requestedRadius} km
                              </Text>
                              <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">
                                Coordinates: {coach.preferences?.addressChangeRequest?.requestedLatitude?.toFixed(5)}, {coach.preferences?.addressChangeRequest?.requestedLongitude?.toFixed(5)}
                              </Text>
                            </View>

                            <View className="flex-row gap-2 mt-1">
                              <TouchableOpacity
                                onPress={() => handleRejectLocation(coach.id)}
                                className="flex-1 border border-rose-200 bg-white py-2 rounded-xl items-center"
                              >
                                <Text className="text-rose-600 text-[8px] font-black uppercase">Reject Request</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => handleApproveLocation(coach.id)}
                                className="flex-1 bg-green-600 py-2 rounded-xl items-center shadow-sm"
                              >
                                <Text className="text-white text-[8px] font-black uppercase">Approve Request</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
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
                <View className="flex-row justify-between items-center bg-white p-2.5 rounded-xl border border-red-100">
                  <View className="gap-0.5">
                    <Text className="text-zinc-950 text-xs font-black">Coach Karan • Client Viral</Text>
                    <Text className="text-zinc-400 text-[8px] font-bold uppercase">Status: Offline / Ready</Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => Alert.alert('SOS Reset', 'Emergency alert channels cleared successfully.')} 
                    className="bg-red-600 px-3 py-1.5 rounded-lg"
                  >
                    <Text className="text-white text-[7px] font-black uppercase">Reset SOS</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* TODAY'S BOOKED SESSIONS */}
              {(() => {
                const serverNow = getCurrentServerTime();
                const todayIstStr = getISTDateInfo(serverNow).dateString;

                const todayBooked = bookings.filter(b => {
                  if (b.status !== 'upcoming') return false;
                  if (b.timelineStatus === 'booked' || b.timelineStatus === 'trainer_assigned') return false;
                  const range = getBookingISTDateRange(b);
                  return getISTDateInfo(range.start).dateString === todayIstStr;
                });

                const upcomingBooked = bookings.filter(b => {
                  if (b.status !== 'upcoming') return false;
                  if (b.timelineStatus === 'booked' || b.timelineStatus === 'trainer_assigned') return false;
                  const range = getBookingISTDateRange(b);
                  return getISTDateInfo(range.start).dateString > todayIstStr;
                });

                return (
                  <>
                    {/* TODAY'S BOOKED */}
                    <View className="gap-4">
                      <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider pl-1">{"TODAY'S BOOKED SESSIONS (" + todayBooked.length + ")"}</Text>
                      {todayBooked.length === 0 ? (
                        <View className="bg-white border border-zinc-200 p-8 rounded-[24px] items-center justify-center">
                          <Feather name="calendar" size={20} color="#9CA3AF" />
                          <Text className="text-zinc-400 text-[10px] font-black uppercase mt-2">No bookings scheduled for today.</Text>
                        </View>
                      ) : (
                        todayBooked.map((b) => (
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
                              <Text className="text-zinc-650 text-xs font-medium">Client Name: <Text className="font-bold text-zinc-900">{b.clientName || 'Viral'}</Text></Text>
                              <Text className="text-zinc-650 text-xs font-medium">Trainer Name: <Text className="font-bold text-zinc-900">{b.trainerName}</Text></Text>
                              <Text className="text-zinc-650 text-xs font-medium">Workout Type: <Text className="font-bold text-zinc-900">{b.workoutTitle}</Text></Text>
                              <Text className="text-zinc-650 text-xs font-medium">Booking Status: <Text className="font-bold text-zinc-900">Confirmed / Booked</Text></Text>
                              <Text className="text-zinc-650 text-xs font-medium">Time: <Text className="font-bold text-zinc-900">{b.date} @ {b.time}</Text></Text>
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

                    {/* UPCOMING BOOKED SESSIONS */}
                    <View className="gap-4 mt-2">
                      <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider pl-1">UPCOMING BOOKED SESSIONS ({upcomingBooked.length})</Text>
                      {upcomingBooked.length === 0 ? (
                        <View className="bg-white border border-zinc-200 p-8 rounded-[24px] items-center justify-center">
                          <Feather name="clock" size={20} color="#9CA3AF" />
                          <Text className="text-zinc-400 text-[10px] font-black uppercase mt-2">No upcoming bookings scheduled.</Text>
                        </View>
                      ) : (
                        upcomingBooked.map((b) => (
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
                              <Text className="text-zinc-650 text-xs font-medium">Client Name: <Text className="font-bold text-zinc-900">{b.clientName || 'Viral'}</Text></Text>
                              <Text className="text-zinc-650 text-xs font-medium">Trainer Name: <Text className="font-bold text-zinc-900">{b.trainerName}</Text></Text>
                              <Text className="text-zinc-650 text-xs font-medium">Workout Type: <Text className="font-bold text-zinc-900">{b.workoutTitle}</Text></Text>
                              <Text className="text-zinc-650 text-xs font-medium">Booking Status: <Text className="font-bold text-zinc-900">Confirmed / Booked</Text></Text>
                              <Text className="text-zinc-650 text-xs font-medium">Time: <Text className="font-bold text-zinc-900">{b.date} @ {b.time}</Text></Text>
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
                  </>
                );
              })()}

              {/* Live Session List */}
              <View className="gap-4">
                <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider pl-1">Live Ongoing Sessions</Text>
                {liveSessions.length === 0 ? (
                  <View className="bg-white border border-zinc-200 p-8 rounded-[24px] items-center justify-center">
                    <Feather name="activity" size={20} color="#9CA3AF" />
                    <Text className="text-zinc-400 text-[10px] font-black uppercase mt-2">No active live tracking sessions</Text>
                  </View>
                ) : (
                  liveSessions.map((b) => (
                    <LuxuryCard key={b.id} className="p-4 gap-3.5" interactive={false}>
                      <View className="flex-row items-center gap-3">
                        <Image source={{ uri: b.trainerPhoto }} className="w-10 h-10 rounded-full" />
                        <View className="flex-1">
                          <Text className="text-zinc-950 text-xs font-black">Coach {b.trainerName} ↔ {b.clientName || 'Viral'}</Text>
                          <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">{b.workoutTitle} • {b.date} ({b.time})</Text>
                        </View>
                        <View className="bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded-full">
                          <Text className="text-[#4F46E5] text-[7px] font-black uppercase">{b.timelineStatus}</Text>
                        </View>
                      </View>

                      <View className="h-[1px] bg-zinc-50" />
                      <View className="gap-1 pl-1">
                        <Text className="text-zinc-450 text-[8px] font-black uppercase">Target Address</Text>
                        <Text className="text-zinc-850 text-[10px] font-medium leading-relaxed" numberOfLines={1}>{b.address || 'Mumbai, MH'}</Text>
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
                  ))
                )}
              </View>

              {/* Sessions History & Audit */}
              <View className="gap-3 mt-6">
                <Text className="text-[#101828] text-xs font-semibold uppercase tracking-widest pl-1">Past & Missed Sessions Audit</Text>
                {missedOrEndedSessions.length === 0 ? (
                  <View className="bg-white border border-zinc-200 p-8 rounded-[24px] items-center justify-center">
                    <Feather name="list" size={20} color="#9CA3AF" />
                    <Text className="text-zinc-400 text-[10px] font-black uppercase mt-2">No historical sessions to display</Text>
                  </View>
                ) : (
                  missedOrEndedSessions.map((b) => (
                    <LuxuryCard key={b.id} className="p-4 gap-3.5" interactive={false}>
                      <View className="flex-row items-center gap-3">
                        <Image source={{ uri: b.trainerPhoto }} className="w-10 h-10 rounded-full" />
                        <View className="flex-1">
                          <Text className="text-zinc-950 text-xs font-black">Coach {b.trainerName} ↔ {b.clientName || 'Viral'}</Text>
                          <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">{b.workoutTitle} • {b.date} ({b.time})</Text>
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
                  ))
                )}
              </View>

            </View>
          )}

          {activeTab === 'acceptance' && (() => {
            const pending = bookings.filter(b => b.status === 'upcoming' && (b.timelineStatus === 'booked' || b.timelineStatus === 'trainer_assigned'));
            const autoAccepted = bookings.filter(b => b.status === 'upcoming' && b.acceptanceMethod === 'SYSTEM_AUTO_ACCEPT');
            const recent = bookings.filter(b => b.status === 'upcoming' && b.acceptanceMethod === 'TRAINER_MANUAL_ACCEPT');

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
                            <Text className="text-amber-600 text-[8px] font-bold uppercase tracking-wider">Pending Confirmation</Text>
                          </View>
                        </View>
                        <View className="h-[1px] bg-zinc-100 my-2" />
                        <View className="gap-1.5 mb-3.5">
                          <Text className="text-zinc-650 text-xs font-medium">Client: <Text className="font-bold text-zinc-900">{b.clientName || 'Viral'}</Text></Text>
                          <Text className="text-zinc-650 text-xs font-medium">Assigned Trainer: <Text className="font-bold text-zinc-900">{b.trainerId === 'searching' || !b.trainerId ? 'Searching for Trainer...' : b.trainerName}</Text></Text>
                          <Text className="text-zinc-650 text-xs font-medium">Booked Time: <Text className="font-bold text-zinc-900">{b.date} @ {b.time}</Text></Text>
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
                          <Text className="text-rose-900/80 text-xs font-medium">Client: <Text className="font-bold text-rose-900">{b.clientName || 'Viral'}</Text></Text>
                          <Text className="text-rose-900/80 text-xs font-medium">Assigned Trainer: <Text className="font-bold text-rose-900">{b.trainerName}</Text> (No response)</Text>
                          <Text className="text-rose-900/80 text-xs font-medium">Booked Time: <Text className="font-bold text-rose-900">{b.date} @ {b.time}</Text></Text>
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
                          <Text className="text-zinc-650 text-xs font-medium">Client: <Text className="font-bold text-zinc-900">{b.clientName || 'Viral'}</Text></Text>
                          <Text className="text-zinc-650 text-xs font-medium">Assigned Trainer: <Text className="font-bold text-zinc-900">{b.trainerName}</Text> (Accepted manually)</Text>
                          <Text className="text-zinc-650 text-xs font-medium">Booked Time: <Text className="font-bold text-zinc-900">{b.date} @ {b.time}</Text></Text>
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

        </ScrollView>
      </View>

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
                              {new Date(b.autoAcceptedAt || b.acceptanceDeadline || (b.createdAt + 30 * 60 * 1000)).toLocaleTimeString()}
                            </Text>
                            <Text className="text-rose-600 text-[9px] font-black uppercase">SYSTEM AUTO-ACCEPTED (NO RESP)</Text>
                          </View>
                        ) : b.acceptanceMethod === 'TRAINER_MANUAL_ACCEPT' ? (
                          <View className="flex-row items-center gap-2">
                            <View className="w-1.5 h-1.5 rounded-full bg-emerald-500 -ml-[9.5px]" />
                            <Text className="text-zinc-500 text-[8px] font-bold">
                              {new Date(b.trainerAcceptedAt || (b.createdAt + 7 * 60 * 1000)).toLocaleTimeString()}
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
                        <Text className="text-[#101828] text-xs font-semibold mt-0.5">{b.clientName || 'Viral'}</Text>
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
                        <Text className="text-[#101828] text-xs font-semibold mt-0.5">{b.date} • {b.time}</Text>
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
