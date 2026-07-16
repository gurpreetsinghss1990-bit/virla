import React, { useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserProfileStore } from '../store/userProfileStore';
import { Ionicons, Feather } from '@expo/vector-icons';

export default function HealthProfileScreen() {
  const router = useRouter();
  const { healthProfile, updateHealthProfile } = useUserProfileStore();

  const [form, setForm] = useState(healthProfile);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    updateHealthProfile(form);
    setIsEditing(false);
    Alert.alert('Health Profile Updated', 'Your medical logs and restrictions have been securely saved.');
  };

  const fields: { key: keyof typeof healthProfile; label: string; placeholder: string; icon: string }[] = [
    { key: 'medicalConditions', label: 'Medical Conditions', placeholder: 'e.g. Hypertension, Asthma', icon: 'activity' },
    { key: 'pastInjuries', label: 'Past Injuries', placeholder: 'e.g. Rotator cuff tear, Ankle sprain', icon: 'alert-triangle' },
    { key: 'jointPain', label: 'Joint Pain', placeholder: 'e.g. Tightness in right knee', icon: 'minimize-2' },
    { key: 'bloodPressure', label: 'Blood Pressure Status', placeholder: 'e.g. 120/80 mmHg (Normal)', icon: 'heart' },
    { key: 'diabetes', label: 'Diabetes Type (if any)', placeholder: 'e.g. None', icon: 'droplet' },
    { key: 'heartCondition', label: 'Heart Conditions', placeholder: 'e.g. None', icon: 'zap' },
    { key: 'asthma', label: 'Asthma / Breathing logs', placeholder: 'e.g. No', icon: 'wind' },
    { key: 'pregnancy', label: 'Pregnancy status', placeholder: 'e.g. Not Applicable', icon: 'smile' },
    { key: 'surgeries', label: 'Past Surgeries', placeholder: 'e.g. Appendectomy in 2021', icon: 'plus-circle' },
    { key: 'medication', label: 'Current Medications', placeholder: 'e.g. None', icon: 'clipboard' },
    { key: 'foodAllergies', label: 'Food Allergies', placeholder: 'e.g. Peanuts, Gluten', icon: 'coffee' },
    { key: 'workoutRestrictions', label: 'Workout Restrictions', placeholder: 'e.g. Avoid heavy loading squats', icon: 'slash' },
    { key: 'doctorNotes', label: 'Doctor Recommendations', placeholder: 'e.g. Keep heart rate below 150 bpm', icon: 'file-text' },
    { key: 'emergencyMedicalNotes', label: 'Emergency Medical Instructions', placeholder: 'e.g. Carry inhaler in gym bag', icon: 'shield' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FB]">
      {/* Header */}
      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white justify-between">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text className="text-[#111827] text-sm font-black uppercase tracking-wider">
          Health & Medical profile
        </Text>
        <TouchableOpacity onPress={() => { if (isEditing) { handleSave(); } else { setIsEditing(true); } }}>
          <Text className="text-indigo-600 text-xs font-black uppercase">
            {isEditing ? 'Save' : 'Edit'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 60 }}>
          <View className="gap-5">
            
            <View>
              <Text className="text-zinc-900 text-2xl font-black tracking-tight leading-tight">Medical Declarations</Text>
              <Text className="text-zinc-500 text-xs font-semibold mt-1 leading-relaxed">
                VIRLA matching engines evaluate these medical indicators to assign custom safety certified trainers.
              </Text>
            </View>

            <View className="gap-4">
              {fields.map((field) => (
                <View key={field.key} className="bg-white border border-[#E5E7EB] p-4.5 rounded-[24px] shadow-xs gap-2">
                  <View className="flex-row items-center gap-2">
                    <Feather name={field.icon as any} size={13} color="#4F46E5" />
                    <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider">{field.label}</Text>
                  </View>

                  {isEditing ? (
                    <TextInput
                      value={form[field.key]}
                      onChangeText={(val) => setForm(prev => ({ ...prev, [field.key]: val }))}
                      placeholder={field.placeholder}
                      placeholderTextColor="#9CA3AF"
                      className="border border-[#E5E7EB] bg-[#F8F9FB] p-3 rounded-xl text-zinc-900 text-xs font-semibold"
                    />
                  ) : (
                    <Text className="text-zinc-650 text-xs font-semibold leading-relaxed pl-5">
                      {form[field.key] || 'Not Declared'}
                    </Text>
                  )}
                </View>
              ))}
            </View>

            {isEditing && (
              <TouchableOpacity
                onPress={handleSave}
                className="w-full bg-[#111827] py-4 rounded-2xl items-center justify-center mt-3 shadow-xs"
              >
                <Text className="text-white text-xs font-black uppercase">Save Medical Information</Text>
              </TouchableOpacity>
            )}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
