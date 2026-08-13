import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Database } from '../database/Database';
import { useCoachStore } from '../store/coachStore';
import { supabase } from '../database/supabaseClient';

const CATEGORY_DISPLAY_MAP: Record<string, string> = {
  'Strength': 'Strength Training',
  'Mind & Body': 'Yoga',
  'Cardio': 'Dance Fitness',
  'Conditioning': 'Stretching',
  'Boxing': 'Boxing',
  'All Workouts': 'All Workouts'
};

export default function AdminWorkoutApprovalsScreen() {
  const insets = useSafeAreaInsets();
  const { coaches, workoutAssignments, syncFromDB } = useCoachStore();

  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'CHANGE_REQUESTS'>('PENDING');
  const [isAdminAuthorized, setIsAdminAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [adminUserId, setAdminUserId] = useState<string>('');

  // Rejection modal state
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState('');

  const checkAdminAuth = async () => {
    const userId = Database.getCurrentUserId();
    if (!userId) {
      setIsAdminAuthorized(false);
      return;
    }
    setAdminUserId(userId);
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

  const handleApprove = (assignmentId: string, category: string, trainerName: string) => {
    const displayCategory = CATEGORY_DISPLAY_MAP[category] || category;
    Alert.alert(
      'Confirm Workout Approval',
      `Approve ${displayCategory} for ${trainerName}?\n\nAfter approval, this trainer will become eligible to receive future ${displayCategory} bookings.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setLoading(true);
            try {
              await Database.adminApproveAssignment(assignmentId, adminUserId);
              syncFromDB();
              Alert.alert('Approved Successfully', 'Workout assignment status updated.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to approve.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleRejectPrompt = (assignmentId: string) => {
    setSelectedAssignmentId(assignmentId);
    setRejectionReason('');
    setRejectModalVisible(true);
  };

  const submitRejection = async () => {
    if (!rejectionReason.trim()) {
      Alert.alert('Validation Error', 'Please supply a rejection reason.');
      return;
    }
    setLoading(true);
    try {
      await Database.adminRejectAssignment(selectedAssignmentId, adminUserId, rejectionReason.trim());
      syncFromDB();
      setRejectModalVisible(false);
      Alert.alert('Rejected Successfully', 'Request has been declined.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to decline request.');
    } finally {
      setLoading(false);
    }
  };

  const getTrainerName = (trainerId: string) => {
    const coachObj = coaches.find(c => c.id === trainerId);
    return coachObj ? coachObj.name : `Trainer (${trainerId})`;
  };

  const getTrainerApprovedList = (trainerId: string, excludeCat: string) => {
    const list = workoutAssignments
      .filter(a => a.trainerId === trainerId && a.status === 'APPROVED' && a.workoutCategory !== excludeCat)
      .map(a => CATEGORY_DISPLAY_MAP[a.workoutCategory] || a.workoutCategory);
    return list.length > 0 ? list.join(', ') : 'None';
  };

  // Filter list by selected tab
  const listData = (workoutAssignments || []).filter(a => {
    if (activeTab === 'CHANGE_REQUESTS') return a.status === 'REMOVAL_REQUESTED';
    return a.status === activeTab;
  });

  if (isAdminAuthorized === false) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Ionicons name="lock-closed" size={48} color="#EF4444" />
        <Text className="text-zinc-900 text-lg font-black mt-4 uppercase">Access Denied</Text>
        <Text className="text-zinc-500 text-xs font-semibold text-center mt-2 leading-relaxed max-w-[260px]">
          Administrative authorization is required to access this control page.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)/profile' as any)}
          className="mt-6 bg-zinc-950 py-3.5 px-6 rounded-xl shadow-md"
        >
          <Text className="text-white text-xs font-black uppercase tracking-wider">Return Profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F9FC' }}>
      {/* Header */}
      <View 
        style={{ paddingTop: insets.top + 16 }}
        className="px-6 pb-4 bg-white border-b border-zinc-150 flex-row items-center justify-between"
      >
        <TouchableOpacity 
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center bg-zinc-50 rounded-full"
        >
          <Ionicons name="arrow-back" size={20} color="#18181B" />
        </TouchableOpacity>
        <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider">Workout Approvals</Text>
        <TouchableOpacity 
          onPress={() => syncFromDB()}
          className="w-10 h-10 items-center justify-center bg-zinc-50 rounded-full"
        >
          <Feather name="refresh-cw" size={16} color="#18181B" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View className="flex-row bg-white border-b border-zinc-100 p-2 gap-1">
        {(['PENDING', 'APPROVED', 'REJECTED', 'CHANGE_REQUESTS'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            className={`flex-1 py-3 rounded-lg items-center justify-center ${activeTab === tab ? 'bg-zinc-950' : 'bg-transparent'}`}
          >
            <Text 
              className={`text-[8px] font-black uppercase tracking-normal text-center ${activeTab === tab ? 'text-white' : 'text-zinc-400'}`}
            >
              {tab === 'CHANGE_REQUESTS' ? 'Change Req' : tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List Container */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color="#18181B" />
        </View>
      ) : (
        <ScrollView className="flex-1 p-6" contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
          {listData.length === 0 ? (
            <View className="bg-white border border-zinc-100 rounded-[28px] p-10 items-center justify-center py-20 shadow-xs">
              <Feather name="folder" size={24} color="#9CA3AF" />
              <Text className="text-zinc-400 text-xs font-black uppercase mt-2">No Requests Found</Text>
            </View>
          ) : (
            listData.map(a => {
              const trainerName = getTrainerName(a.trainerId);
              const displayCategory = CATEGORY_DISPLAY_MAP[a.workoutCategory] || a.workoutCategory;
              return (
                <View 
                  key={a.id}
                  className="bg-white border border-zinc-150/80 p-5 rounded-[28px] mb-4 shadow-sm"
                >
                  {/* Card Details */}
                  <View className="mb-4">
                    <Text className="text-zinc-400 text-[8px] font-black uppercase">Trainer Profile</Text>
                    <Text className="text-zinc-950 text-sm font-black mt-0.5">{trainerName}</Text>
                    <Text className="text-zinc-400 text-[8px] font-bold mt-0.5">ID: {a.trainerId}</Text>
                  </View>

                  <View className="mb-4 bg-zinc-50/50 p-3.5 rounded-2xl border border-zinc-100">
                    <Text className="text-zinc-400 text-[8px] font-black uppercase">Requested Workout</Text>
                    <Text className="text-zinc-900 text-xs font-black mt-1">{displayCategory}</Text>
                    
                    <Text className="text-zinc-400 text-[8px] font-black uppercase mt-3">Other Approved Specializations</Text>
                    <Text className="text-zinc-600 text-xs font-bold mt-1">{getTrainerApprovedList(a.trainerId, a.workoutCategory)}</Text>
                  </View>

                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-zinc-400 text-[8px] font-bold">Requested: {new Date(a.requestedAt).toLocaleDateString()}</Text>
                    <Text className="text-zinc-400 text-[8px] font-bold">Status: {a.status}</Text>
                  </View>

                  {/* Context Rejection reason view */}
                  {a.status === 'REJECTED' && a.rejectionReason && (
                    <View className="bg-rose-50/20 border border-rose-100/50 p-3 rounded-xl mb-4">
                      <Text className="text-rose-600 text-[8px] font-black uppercase">Declined Reason</Text>
                      <Text className="text-rose-700 text-xs font-bold mt-1">"{a.rejectionReason}"</Text>
                    </View>
                  )}

                  {/* Actions for pending and change requests */}
                  {(a.status === 'PENDING' || a.status === 'REMOVAL_REQUESTED') && (
                    <View className="flex-row gap-3 mt-3">
                      <TouchableOpacity
                        onPress={() => handleRejectPrompt(a.id)}
                        className="flex-1 py-3 bg-zinc-50 border border-zinc-200 rounded-xl items-center"
                      >
                        <Text className="text-zinc-700 text-xs font-black uppercase">Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleApprove(a.id, a.workoutCategory, trainerName)}
                        className="flex-1 py-3 bg-zinc-950 rounded-xl items-center"
                      >
                        <Text className="text-white text-xs font-black uppercase">Approve</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Reject Modal */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
      >
        <View className="flex-1 bg-black/60 items-center justify-center p-6">
          <View className="bg-white rounded-[32px] w-full max-w-sm p-6 shadow-xl">
            <Text className="text-zinc-950 text-lg font-black">Decline Request</Text>
            <Text className="text-zinc-400 text-[10px] font-bold uppercase mt-0.5">Please provide feedback/rejection reason</Text>

            <TextInput
              value={rejectionReason}
              onChangeText={setRejectionReason}
              placeholder="e.g. Certification document required."
              placeholderTextColor="#A1A1AA"
              multiline
              numberOfLines={4}
              className="w-full mt-4 border border-zinc-150 rounded-2xl p-4 text-zinc-800 text-xs font-semibold bg-zinc-50/50"
              style={{ height: 100, textAlignVertical: 'top' }}
            />

            <View className="flex-row gap-3 mt-6">
              <TouchableOpacity
                onPress={() => setRejectModalVisible(false)}
                className="flex-1 py-3.5 bg-zinc-50 border border-zinc-250 rounded-xl items-center"
              >
                <Text className="text-zinc-600 text-xs font-black uppercase">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitRejection}
                className="flex-1 py-3.5 bg-rose-600 rounded-xl items-center"
              >
                <Text className="text-white text-xs font-black uppercase">Confirm Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
