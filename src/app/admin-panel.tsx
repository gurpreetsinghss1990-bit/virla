import React, { useState, useEffect } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Database, TrainerApplication } from '../database/Database';
import { LuxuryCard } from '../components/LuxuryCard';
import { supabase } from '../database/supabaseClient';


export default function AdminPanelScreen() {
  const router = useRouter();
  const [applications, setApplications] = useState<TrainerApplication[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdminAuthorized, setIsAdminAuthorized] = useState<boolean | null>(null);

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
    checkAdminAuth();
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
      loadApplications();
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

  if (isAdminAuthorized === null) {
    return (
      <SafeAreaViewWrapper>
        <SafeAreaView className="flex-1 bg-[#F7F8FC] justify-center items-center">
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text className="text-zinc-400 text-xs font-black uppercase tracking-wider mt-4">Verifying Credentials...</Text>
        </SafeAreaView>
      </SafeAreaViewWrapper>
    );
  }

  if (isAdminAuthorized === false) {
    return (
      <SafeAreaViewWrapper>
        <SafeAreaView className="flex-1 bg-[#F7F8FC] justify-center items-center px-6">
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
        </SafeAreaView>
      </SafeAreaViewWrapper>
    );
  }

  return (
    <SafeAreaViewWrapper>
      <SafeAreaView className="flex-1 bg-[#F7F8FC]">
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
          <Text className="text-[#101828] text-sm font-black uppercase tracking-wider">
            Admin Audit Control Panel
          </Text>
          <TouchableOpacity onPress={loadApplications} className="w-8 h-8 items-center justify-center">
            <Feather name="refresh-cw" size={16} color="#101828" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 60 }}>
          <View className="gap-6">
            <View>
              <Text className="text-zinc-900 text-2xl font-black tracking-tight leading-tight">Trainer Applications</Text>
              <Text className="text-[#6B7280] text-xs font-semibold mt-1 leading-relaxed">
                Verify documents, credentials, and approve trainer registration requests.
              </Text>
            </View>

            {isLoading ? (
              <View className="py-20 items-center justify-center">
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text className="text-zinc-400 text-xs font-black uppercase tracking-wider mt-4">Syncing applications...</Text>
              </View>
            ) : (
              <>
                <Text className="text-zinc-500 text-[10px] font-black uppercase tracking-wider">
                  Audits ({pendingAppsCount} Pending review)
                </Text>

                {applications.length === 0 ? (
                  <LuxuryCard className="p-8 items-center justify-center bg-zinc-50 border-zinc-150" interactive={false}>
                    <Text className="text-zinc-400 text-xs font-bold uppercase">No Trainer Applications Found</Text>
                  </LuxuryCard>
                ) : (
                  applications.map((app) => (
                    <LuxuryCard key={app.id} className="p-5 gap-4" interactive={false}>
                      {/* Status Badge */}
                      <View className="flex-row justify-between items-center">
                        <View className="flex-1">
                          <Text className="text-zinc-900 text-sm font-black tracking-tight">{app.fullName}</Text>
                          <Text className="text-zinc-500 text-[10px]">{app.phone} • {app.email}</Text>
                        </View>
                        <View className={`px-2.5 py-1.5 rounded-md ${
                          app.status === 'approved' ? 'bg-emerald-50 border border-emerald-150' : 
                          app.status === 'rejected' ? 'bg-rose-50 border border-rose-150' : 
                          app.status === 'info_requested' ? 'bg-blue-50 border border-blue-150' : 
                          'bg-amber-50 border border-amber-150'
                        }`}>
                          <Text className={`text-[8px] font-black uppercase tracking-wider ${
                            app.status === 'approved' ? 'text-emerald-600' :
                            app.status === 'rejected' ? 'text-rose-600' :
                            app.status === 'info_requested' ? 'text-blue-600' :
                            'text-amber-600'
                          }`}>
                            {app.status === 'info_requested' ? 'Info Requested' : app.status}
                          </Text>
                        </View>
                      </View>

                      <View className="h-[1px] bg-zinc-100" />

                      {/* Specialty & Details */}
                      <View className="gap-1.5">
                        <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-wider">Professional Info</Text>
                        <Text className="text-zinc-800 text-xs font-semibold">Specialty: <Text className="font-medium text-zinc-600">{app.primaryWorkout}</Text></Text>
                        <Text className="text-zinc-800 text-xs font-semibold">Experience: <Text className="font-medium text-zinc-600">{app.yearsOfExperience} years</Text></Text>
                        <Text className="text-zinc-800 text-xs font-semibold">Languages: <Text className="font-medium text-zinc-600">{app.languages}</Text></Text>
                      </View>

                      <View className="h-[1px] bg-zinc-100" />

                      {/* Documents */}
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

                      {/* Action Buttons if not approved */}
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
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaViewWrapper>
  );
}

function SafeAreaViewWrapper({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'ios') {
    return <View className="flex-1 bg-[#F7F8FC] pt-12">{children}</View>;
  }
  return <View className="flex-1 bg-[#F7F8FC]">{children}</View>;
}
