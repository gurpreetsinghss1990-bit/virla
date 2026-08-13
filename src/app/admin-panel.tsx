import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Database, TrainerApplication } from '../database/Database';
import { LuxuryCard } from '../components/LuxuryCard';
import { supabase } from '../database/supabaseClient';
import { useBookingStore } from '../store/bookingStore';

export default function AdminPanelScreen() {
  const router = useRouter();
  const [applications, setApplications] = useState<TrainerApplication[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdminAuthorized, setIsAdminAuthorized] = useState<boolean | null>(null);
  
  // Tab controller state
  const [activeTab, setActiveTab] = useState<'applications' | 'live'>('applications');
  
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
    });
  }, []);

  const loadApplications = async () => {
    if (isAdminAuthorized !== true) return;
    setIsLoading(true);
    try {
      const data = await Database.fetchAllTrainerApplications();
      setApplications(data);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsLoading(false);
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

        {/* Tab Selector */}
        <View className="flex-row bg-white border-b border-zinc-150 p-2 gap-1.5">
          <TouchableOpacity
            onPress={() => setActiveTab('applications')}
            className={`flex-1 py-3 rounded-xl items-center justify-center ${activeTab === 'applications' ? 'bg-zinc-950' : 'bg-transparent'}`}
          >
            <Text className={`text-[8px] font-black uppercase tracking-wider text-center ${activeTab === 'applications' ? 'text-white' : 'text-zinc-400'}`}>Onboarding</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/admin-workout-approvals')}
            className="flex-1 py-3 rounded-xl items-center justify-center bg-transparent border border-zinc-150"
          >
            <Text className="text-[8px] font-black uppercase tracking-wider text-center text-zinc-500">Workout Approvals</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('live')}
            className={`flex-1 py-3 rounded-xl items-center justify-center ${activeTab === 'live' ? 'bg-zinc-950' : 'bg-transparent'}`}
          >
            <Text className={`text-[8px] font-black uppercase tracking-wider text-center ${activeTab === 'live' ? 'text-white' : 'text-zinc-400'}`}>Live Console</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 60 }}>
          
          {activeTab === 'applications' ? (
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
          ) : (
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
                          onPress={() => {
                            updateTimelineStatus(b.id, 'trainer_arrived');
                            Alert.alert('Session Advanced', 'Trainer marked as arrived.');
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

            </View>
          )}

        </ScrollView>
      </View>
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
