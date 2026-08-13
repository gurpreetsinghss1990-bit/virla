import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useUserStore } from '../store/userStore';
import { useCoachStore } from '../store/coachStore';
import { Database } from '../database/Database';

const CATEGORIES = [
  { key: 'Strength', name: 'Strength Training', icon: '💪' },
  { key: 'Mind & Body', name: 'Yoga', icon: '🧘‍♀️' },
  { key: 'Cardio', name: 'Dance Fitness', icon: '💃' },
  { key: 'Conditioning', name: 'Stretching', icon: '🤸‍♂️' },
  { key: 'Boxing', name: 'Boxing', icon: '🥊' },
  { key: 'All Workouts', name: 'All Workouts', icon: '⭐' }
];

export default function TrainerWorkoutsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUserStore();
  const { coaches, workoutAssignments, syncFromDB } = useCoachStore();

  const coach = coaches.find(c => c.name === user.name) || coaches[0];
  const assignments = coach ? workoutAssignments.filter(a => a.trainerId === coach.id) : [];

  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  // Separate assignments by status
  const approved = assignments.filter(a => a.status === 'APPROVED');
  const pending = assignments.filter(a => a.status === 'PENDING');
  const rejected = assignments.filter(a => a.status === 'REJECTED');
  const removalRequested = assignments.filter(a => a.status === 'REMOVAL_REQUESTED');

  const activeCategories = assignments
    .filter(a => a.status !== 'REMOVED')
    .map(a => a.workoutCategory);

  // Available options the coach can request (not currently assigned/requested)
  const availableToRequest = CATEGORIES.filter(cat => !activeCategories.includes(cat.key));

  const handleRequest = async (categoryKey: string, categoryName: string) => {
    if (!coach) return;
    Alert.alert(
      'Request Workout Assignment',
      `Would you like to request qualification approval for ${categoryName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request',
          onPress: async () => {
            setLoading(true);
            try {
              await Database.requestWorkoutAssignment(coach.id, categoryKey);
              syncFromDB();
              setModalVisible(false);
              Alert.alert('Request Submitted', 'Your request is pending administrator verification.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to submit request.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleRequestRemoval = (categoryKey: string, categoryName: string) => {
    if (!coach) return;
    Alert.alert(
      'Request Workout Removal',
      `Are you sure you want to request removal of your ${categoryName} authorization? Existing bookings will remain active.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit Request',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await Database.requestWorkoutRemoval(coach.id, categoryKey);
              syncFromDB();
              Alert.alert('Removal Requested', 'Your request has been sent to administrators for review.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to request removal.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const getCategoryDisplay = (key: string) => {
    const matched = CATEGORIES.find(c => c.key === key);
    return matched ? `${matched.icon} ${matched.name}` : key;
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
      {/* Header */}
      <View 
        style={{ paddingTop: insets.top + 16 }}
        className="px-6 pb-4 bg-white border-b border-zinc-100 flex-row items-center justify-between"
      >
        <TouchableOpacity 
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center bg-zinc-50 rounded-full"
        >
          <Ionicons name="arrow-back" size={20} color="#18181B" />
        </TouchableOpacity>
        <Text className="text-zinc-900 text-sm font-black tracking-tight">My Workouts</Text>
        <TouchableOpacity 
          onPress={() => syncFromDB()}
          className="w-10 h-10 items-center justify-center bg-zinc-50 rounded-full"
        >
          <Ionicons name="refresh" size={18} color="#18181B" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Intro */}
        <View className="mb-6">
          <Text className="text-zinc-400 text-[9px] font-extrabold uppercase tracking-wider">Qualifications Hub</Text>
          <Text className="text-zinc-950 text-2xl font-black tracking-tight mt-1">Authorized Categories</Text>
          <Text className="text-zinc-500 text-xs font-bold mt-1.5 leading-relaxed">
            These are the workouts you are currently approved to conduct on VIRLA. Additions and removals require administrator verification.
          </Text>
        </View>

        {/* Status Blocks */}
        {assignments.length === 0 && (
          <View className="bg-zinc-50 border border-zinc-100 rounded-3xl p-6 items-center my-6">
            <View className="w-12 h-12 bg-zinc-100 rounded-full items-center justify-center mb-4">
              <Feather name="shield-off" size={24} color="#71717A" />
            </View>
            <Text className="text-zinc-900 text-sm font-black">No Workouts Assigned</Text>
            <Text className="text-zinc-400 text-[10px] font-bold text-center mt-1 leading-normal max-w-[200px]">
              Your workout assignments will appear here once approved by VIRLA.
            </Text>
          </View>
        )}

        {/* APPROVED SECTIONS */}
        {approved.length > 0 && (
          <View className="mb-6">
            <Text className="text-zinc-400 text-[9px] font-black uppercase tracking-wider mb-2">Approved ({approved.length})</Text>
            {approved.map(a => (
              <View 
                key={a.id}
                className="bg-white border border-zinc-100 rounded-2xl p-4 flex-row items-center justify-between mb-2 shadow-sm"
              >
                <View className="flex-row items-center flex-1">
                  <View className="w-8 h-8 bg-emerald-50 rounded-full items-center justify-center mr-3">
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-zinc-900 text-xs font-black">{getCategoryDisplay(a.workoutCategory)}</Text>
                    <Text className="text-zinc-400 text-[9px] font-black uppercase mt-0.5">🔒 VIRLA Controlled</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => handleRequestRemoval(a.workoutCategory, CATEGORIES.find(c => c.key === a.workoutCategory)?.name || a.workoutCategory)}
                  className="px-3 py-1.5 bg-rose-50 rounded-lg"
                >
                  <Text className="text-rose-600 text-[9px] font-extrabold uppercase">Request Removal</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* PENDING SECTIONS */}
        {pending.length > 0 && (
          <View className="mb-6">
            <Text className="text-zinc-400 text-[9px] font-black uppercase tracking-wider mb-2">Pending Approval ({pending.length})</Text>
            {pending.map(a => (
              <View 
                key={a.id}
                className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 flex-row items-center justify-between mb-2"
              >
                <View className="flex-row items-center flex-1">
                  <View className="w-8 h-8 bg-amber-50 rounded-full items-center justify-center mr-3">
                    <Ionicons name="time" size={18} color="#D97706" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-zinc-900 text-xs font-black">{getCategoryDisplay(a.workoutCategory)}</Text>
                    <Text className="text-amber-600 text-[9px] font-bold uppercase mt-0.5">Awaiting VIRLA Verification</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* REMOVAL REQUESTED SECTIONS */}
        {removalRequested.length > 0 && (
          <View className="mb-6">
            <Text className="text-zinc-400 text-[9px] font-black uppercase tracking-wider mb-2">Removal Pending ({removalRequested.length})</Text>
            {removalRequested.map(a => (
              <View 
                key={a.id}
                className="bg-rose-50/30 border border-rose-100 rounded-2xl p-4 flex-row items-center justify-between mb-2"
              >
                <View className="flex-row items-center flex-1">
                  <View className="w-8 h-8 bg-rose-50 rounded-full items-center justify-center mr-3">
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-zinc-900 text-xs font-black">{getCategoryDisplay(a.workoutCategory)}</Text>
                    <Text className="text-rose-600 text-[9px] font-bold uppercase mt-0.5">Removal Requested - Pending</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* REJECTED SECTIONS */}
        {rejected.length > 0 && (
          <View className="mb-6">
            <Text className="text-zinc-400 text-[9px] font-black uppercase tracking-wider mb-2">Declined Requests ({rejected.length})</Text>
            {rejected.map(a => (
              <View 
                key={a.id}
                className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4 mb-2"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className="w-8 h-8 bg-zinc-100 rounded-full items-center justify-center mr-3">
                      <Ionicons name="close" size={18} color="#71717A" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-zinc-900 text-xs font-black">{getCategoryDisplay(a.workoutCategory)}</Text>
                      <Text className="text-zinc-500 text-[9px] font-bold uppercase mt-0.5">Declined</Text>
                    </View>
                  </View>
                </View>
                {a.rejectionReason && (
                  <View className="mt-3 pt-3 border-t border-zinc-100/80 bg-white/50 p-3 rounded-xl">
                    <Text className="text-zinc-400 text-[8px] font-black uppercase">Feedback Reason</Text>
                    <Text className="text-zinc-600 text-xs font-bold mt-1 leading-normal">"{a.rejectionReason}"</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Request Trigger */}
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          className="mt-6 py-4 bg-zinc-950 rounded-2xl items-center justify-center"
        >
          <Text className="text-white text-xs font-black uppercase tracking-wider">Request Workout Assignment</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Picker Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-white rounded-t-[40px] px-6 pt-8 pb-10 max-h-[80%]">
            <View className="flex-row items-center justify-between mb-6">
              <View>
                <Text className="text-zinc-900 text-lg font-black">Request Qualifications</Text>
                <Text className="text-zinc-400 text-[10px] font-bold uppercase mt-0.5">Select workout category to teach</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setModalVisible(false)}
                className="w-10 h-10 items-center justify-center bg-zinc-50 rounded-full"
              >
                <Ionicons name="close" size={20} color="#18181B" />
              </TouchableOpacity>
            </View>

            <ScrollView className="space-y-2 mb-6">
              {availableToRequest.length === 0 ? (
                <View className="py-8 items-center justify-center">
                  <Text className="text-zinc-400 text-xs font-bold text-center">You have requested or hold active approval for all available workouts.</Text>
                </View>
              ) : (
                availableToRequest.map(cat => (
                  <TouchableOpacity
                    key={cat.key}
                    onPress={() => handleRequest(cat.key, cat.name)}
                    className="flex-row items-center p-4 border border-zinc-100 rounded-2xl active:bg-zinc-50"
                  >
                    <Text className="text-xl mr-3">{cat.icon}</Text>
                    <View className="flex-1">
                      <Text className="text-zinc-900 text-xs font-black">{cat.name}</Text>
                      {cat.key === 'All Workouts' && (
                        <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">Authorizes all available categories</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#A1A1AA" />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
