import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Booking } from '../types';

interface PostSessionHealthReportModalProps {
  visible: boolean;
  clientName: string;
  onClose: () => void;
  onSubmit: (report: NonNullable<Booking['questionnaire']>) => Promise<void>;
}

const HEALTH_STATUS_OPTIONS = [
  'Feeling well',
  'Low energy / fatigue',
  'Poor sleep',
  'Muscle soreness',
  'Pain or discomfort',
  'Feeling unwell',
];

const AFFECTED_AREAS_OPTIONS = [
  'Neck / Back',
  'Shoulder',
  'Elbow / Wrist',
  'Hip',
  'Knee',
  'Ankle / Foot',
  'Other',
];

const HEALTH_CHANGE_OPTIONS = [
  'No change',
  'New health concern',
  'Existing concern has improved',
  'Existing concern has worsened',
];

export function PostSessionHealthReportModal({
  visible,
  clientName,
  onClose,
  onSubmit,
}: PostSessionHealthReportModalProps) {
  // Q1. Current health (multi-select)
  const [selectedHealthStatus, setSelectedHealthStatus] = useState<string[]>(['Feeling well']);

  // Q2. Injury or physical limitation (yes/no)
  const [hasInjury, setHasInjury] = useState<boolean>(false);
  const [selectedAffectedAreas, setSelectedAffectedAreas] = useState<string[]>([]);
  const [injuryDetails, setInjuryDetails] = useState<string>('');

  // Q3. Exercises to avoid / modify (yes/no)
  const [hasModifications, setHasModifications] = useState<boolean>(false);
  const [exercisesAvoidDetails, setExercisesAvoidDetails] = useState<string>('');

  // Q4. Changes since previous session
  const [healthChangeStatus, setHealthChangeStatus] = useState<string>('No change');
  const [healthChangeDetails, setHealthChangeDetails] = useState<string>('');

  // Q5. Important info for next trainer (Mandatory)
  const [nextTrainerInfo, setNextTrainerInfo] = useState<string>('');

  // Q6. Confirmation checkbox
  const [confirmed, setConfirmed] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const toggleHealthStatus = (opt: string) => {
    setSelectedHealthStatus((prev) => {
      if (opt === 'Feeling well') {
        return ['Feeling well'];
      }
      const filtered = prev.filter((i) => i !== 'Feeling well');
      if (filtered.includes(opt)) {
        const next = filtered.filter((i) => i !== opt);
        return next.length === 0 ? ['Feeling well'] : next;
      }
      return [...filtered, opt];
    });
  };

  const toggleAffectedArea = (area: string) => {
    setSelectedAffectedAreas((prev) =>
      prev.includes(area) ? prev.filter((i) => i !== area) : [...prev, area]
    );
  };

  const handleSubmit = async () => {
    if (selectedHealthStatus.length === 0) {
      Alert.alert('Required Field', "Please answer Question 1: How is the client's current health?");
      return;
    }

    if (hasInjury && selectedAffectedAreas.length === 0 && !injuryDetails.trim()) {
      Alert.alert('Required Field', 'Please specify the affected area or details for the injury reported in Question 2.');
      return;
    }

    if (hasModifications && !exercisesAvoidDetails.trim()) {
      Alert.alert('Required Field', 'Please mention which movements to avoid/modify in Question 3.');
      return;
    }

    if (!nextTrainerInfo.trim()) {
      Alert.alert('Required Field', 'Question 5 is mandatory. Please write what the next trainer must know before training this client.');
      return;
    }

    if (!confirmed) {
      Alert.alert('Confirmation Required', 'Please check the confirmation box to verify that you have recorded the health details accurately.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        clientHealthStatus: selectedHealthStatus,
        hasInjuryOrLimitation: hasInjury,
        affectedAreas: hasInjury ? selectedAffectedAreas : [],
        injuryDetails: hasInjury ? injuryDetails.trim() : '',
        hasExerciseModifications: hasModifications,
        exercisesToAvoidDetails: hasModifications ? exercisesAvoidDetails.trim() : '',
        healthChangeStatus,
        healthChangeDetails: healthChangeDetails.trim(),
        nextTrainerInfo: nextTrainerInfo.trim(),
        trainerConfirmed: confirmed,
        isLimitationResolved: false,
        coachNotes: nextTrainerInfo.trim(),
      });
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not submit report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 bg-black/60 justify-end">
          <TouchableWithoutFeedback onPress={() => {}}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              className="bg-white rounded-t-[32px] max-h-[92%] overflow-hidden"
            >
              {/* Header */}
              <View className="px-6 pt-5 pb-4 border-b border-zinc-100 flex-row items-center justify-between bg-white">
                <View className="flex-1 pr-3">
                  <View className="flex-row items-center gap-2">
                    <View className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <Text className="text-[10px] font-black uppercase tracking-wider text-rose-600">
                      Mandatory Post-Session Update
                    </Text>
                  </View>
                  <Text className="text-zinc-950 text-base font-extrabold mt-1">
                    Client Health & Limitation Form
                  </Text>
                  <Text className="text-zinc-500 text-xs font-medium">
                    Client: <Text className="font-bold text-zinc-800">{clientName || 'Client'}</Text>
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  className="w-9 h-9 rounded-full bg-zinc-100 items-center justify-center active:opacity-70"
                >
                  <Ionicons name="close" size={20} color="#3F3F46" />
                </TouchableOpacity>
              </View>

              {/* Form Body */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 20, paddingBottom: 36, gap: 20 }}
              >
                {/* Notice banner */}
                <View className="bg-indigo-50/70 border border-indigo-150 p-3.5 rounded-2xl flex-row items-start gap-2.5">
                  <Feather name="shield" size={16} color="#4F46E5" style={{ marginTop: 2 }} />
                  <Text className="text-indigo-950 text-xs font-semibold flex-1 leading-relaxed">
                    This information is saved to the client&apos;s profile and carried forward as a health alert for the next trainer before their session.
                  </Text>
                </View>

                {/* 1. Current Health */}
                <View className="gap-2.5">
                  <Text className="text-zinc-950 text-sm font-extrabold">
                    1. How is the client&apos;s current health?
                  </Text>
                  <View className="gap-2">
                    {HEALTH_STATUS_OPTIONS.map((opt) => {
                      const isSelected = selectedHealthStatus.includes(opt);
                      return (
                        <TouchableOpacity
                          key={opt}
                          activeOpacity={0.7}
                          onPress={() => toggleHealthStatus(opt)}
                          className={`flex-row items-center gap-3 p-3 rounded-xl border ${
                            isSelected
                              ? 'bg-rose-50/40 border-[#E11D48]'
                              : 'bg-zinc-50 border-zinc-200'
                          }`}
                        >
                          <View
                            className={`w-5 h-5 rounded-md border items-center justify-center ${
                              isSelected
                                ? 'bg-[#E11D48] border-[#E11D48]'
                                : 'bg-white border-zinc-300'
                            }`}
                          >
                            {isSelected && <Feather name="check" size={13} color="white" />}
                          </View>
                          <Text
                            className={`text-xs ${
                              isSelected ? 'font-bold text-zinc-950' : 'font-medium text-zinc-700'
                            }`}
                          >
                            {opt}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* 2. Injury or Medical Condition */}
                <View className="gap-2.5">
                  <Text className="text-zinc-950 text-sm font-extrabold">
                    2. Does the client have any current injury, medical condition, or physical limitation?
                  </Text>
                  <View className="flex-row gap-3">
                    {[
                      { label: 'No', value: false },
                      { label: 'Yes', value: true },
                    ].map((btn) => {
                      const isSelected = hasInjury === btn.value;
                      return (
                        <TouchableOpacity
                          key={btn.label}
                          activeOpacity={0.7}
                          onPress={() => setHasInjury(btn.value)}
                          className={`flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl border ${
                            isSelected
                              ? 'bg-rose-50/50 border-[#E11D48]'
                              : 'bg-zinc-50 border-zinc-200'
                          }`}
                        >
                          <View
                            className={`w-4 h-4 rounded-full border items-center justify-center ${
                              isSelected
                                ? 'bg-[#E11D48] border-[#E11D48]'
                                : 'bg-white border-zinc-300'
                            }`}
                          >
                            {isSelected && <View className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </View>
                          <Text
                            className={`text-xs ${
                              isSelected ? 'font-bold text-zinc-950' : 'font-medium text-zinc-700'
                            }`}
                          >
                            {btn.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Sub-question if Yes */}
                  {hasInjury && (
                    <View className="mt-2 p-3.5 bg-rose-50/30 border border-rose-100 rounded-2xl gap-3">
                      <Text className="text-zinc-800 text-xs font-bold">
                        If yes, select the affected area:
                      </Text>
                      <View className="flex-row flex-wrap gap-2">
                        {AFFECTED_AREAS_OPTIONS.map((area) => {
                          const isSel = selectedAffectedAreas.includes(area);
                          return (
                            <TouchableOpacity
                              key={area}
                              activeOpacity={0.7}
                              onPress={() => toggleAffectedArea(area)}
                              className={`px-3 py-2 rounded-lg border ${
                                isSel
                                  ? 'bg-[#E11D48] border-[#E11D48]'
                                  : 'bg-white border-zinc-200'
                              }`}
                            >
                              <Text
                                className={`text-xs ${
                                  isSel ? 'font-bold text-white' : 'font-medium text-zinc-700'
                                }`}
                              >
                                {area}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <View className="gap-1 mt-1">
                        <Text className="text-zinc-700 text-[11px] font-bold">
                          Brief details: What has the client reported?
                        </Text>
                        <TextInput
                          value={injuryDetails}
                          onChangeText={setInjuryDetails}
                          placeholder="e.g. Mild lower back stiffness while bending, started 2 days ago"
                          placeholderTextColor="#A1A1AA"
                          className="border border-zinc-200 bg-white p-3 rounded-xl text-xs font-medium"
                          multiline
                          numberOfLines={2}
                        />
                      </View>
                    </View>
                  )}
                </View>

                {/* 3. Exercises to avoid / modify */}
                <View className="gap-2.5">
                  <Text className="text-zinc-950 text-sm font-extrabold">
                    3. Are there any exercises or movements the client should avoid or modify?
                  </Text>
                  <View className="flex-row gap-3">
                    {[
                      { label: 'No', value: false },
                      { label: 'Yes', value: true },
                    ].map((btn) => {
                      const isSelected = hasModifications === btn.value;
                      return (
                        <TouchableOpacity
                          key={btn.label}
                          activeOpacity={0.7}
                          onPress={() => setHasModifications(btn.value)}
                          className={`flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl border ${
                            isSelected
                              ? 'bg-rose-50/50 border-[#E11D48]'
                              : 'bg-zinc-50 border-zinc-200'
                          }`}
                        >
                          <View
                            className={`w-4 h-4 rounded-full border items-center justify-center ${
                              isSelected
                                ? 'bg-[#E11D48] border-[#E11D48]'
                                : 'bg-white border-zinc-300'
                            }`}
                          >
                            {isSelected && <View className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </View>
                          <Text
                            className={`text-xs ${
                              isSelected ? 'font-bold text-zinc-950' : 'font-medium text-zinc-700'
                            }`}
                          >
                            {btn.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {hasModifications && (
                    <View className="gap-1 mt-1">
                      <Text className="text-zinc-700 text-[11px] font-bold">
                        Which movements, and why?
                      </Text>
                      <TextInput
                        value={exercisesAvoidDetails}
                        onChangeText={setExercisesAvoidDetails}
                        placeholder="e.g. Avoid heavy overhead presses due to right shoulder fatigue"
                        placeholderTextColor="#A1A1AA"
                        className="border border-zinc-200 bg-zinc-50 p-3 rounded-xl text-xs font-medium"
                        multiline
                        numberOfLines={2}
                      />
                    </View>
                  )}
                </View>

                {/* 4. Changes since previous session */}
                <View className="gap-2.5">
                  <Text className="text-zinc-950 text-sm font-extrabold">
                    4. Has anything changed in the client&apos;s health since the previous session?
                  </Text>
                  <View className="gap-2">
                    {HEALTH_CHANGE_OPTIONS.map((opt) => {
                      const isSelected = healthChangeStatus === opt;
                      return (
                        <TouchableOpacity
                          key={opt}
                          activeOpacity={0.7}
                          onPress={() => setHealthChangeStatus(opt)}
                          className={`flex-row items-center gap-3 p-3 rounded-xl border ${
                            isSelected
                              ? 'bg-rose-50/40 border-[#E11D48]'
                              : 'bg-zinc-50 border-zinc-200'
                          }`}
                        >
                          <View
                            className={`w-4 h-4 rounded-full border items-center justify-center ${
                              isSelected
                                ? 'bg-[#E11D48] border-[#E11D48]'
                                : 'bg-white border-zinc-300'
                            }`}
                          >
                            {isSelected && <View className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </View>
                          <Text
                            className={`text-xs ${
                              isSelected ? 'font-bold text-zinc-950' : 'font-medium text-zinc-700'
                            }`}
                          >
                            {opt}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {healthChangeStatus !== 'No change' && (
                    <View className="gap-1 mt-1">
                      <Text className="text-zinc-700 text-[11px] font-bold">
                        Brief details:
                      </Text>
                      <TextInput
                        value={healthChangeDetails}
                        onChangeText={setHealthChangeDetails}
                        placeholder="Provide details about the improved, new or worsened concern..."
                        placeholderTextColor="#A1A1AA"
                        className="border border-zinc-200 bg-zinc-50 p-3 rounded-xl text-xs font-medium"
                        multiline
                        numberOfLines={2}
                      />
                    </View>
                  )}
                </View>

                {/* 5. Important Information for the Next Trainer (Mandatory) */}
                <View className="gap-2.5">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-zinc-950 text-sm font-extrabold">
                      5. Important information for the next trainer
                    </Text>
                    <View className="bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                      <Text className="text-rose-600 text-[9px] font-black uppercase">Mandatory</Text>
                    </View>
                  </View>
                  <Text className="text-zinc-500 text-xs font-medium -mt-1">
                    What must the next trainer know before training this client?
                  </Text>
                  <TextInput
                    value={nextTrainerInfo}
                    onChangeText={setNextTrainerInfo}
                    placeholder="e.g. Excellent core strength. Keep warm-up extended to 8 mins. Focus on mobility before weighted sets."
                    placeholderTextColor="#A1A1AA"
                    className="border border-zinc-200 bg-zinc-50 p-3.5 rounded-xl text-xs font-medium min-h-[70px]"
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {/* 6. Trainer Confirmation */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setConfirmed(!confirmed)}
                  className={`p-4 rounded-2xl border flex-row items-start gap-3 ${
                    confirmed
                      ? 'bg-emerald-50/50 border-emerald-300'
                      : 'bg-zinc-50 border-zinc-200'
                  }`}
                >
                  <View
                    className={`w-5 h-5 rounded-md border items-center justify-center mt-0.5 ${
                      confirmed
                        ? 'bg-emerald-600 border-emerald-600'
                        : 'bg-white border-zinc-300'
                    }`}
                  >
                    {confirmed && <Feather name="check" size={13} color="white" />}
                  </View>
                  <Text className="text-zinc-800 text-xs font-bold flex-1 leading-relaxed">
                    I have recorded the client&apos;s reported health concerns accurately and highlighted any relevant physical limitations for the next trainer.
                  </Text>
                </TouchableOpacity>

                {/* Submit Button */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={isSubmitting}
                  onPress={handleSubmit}
                  className="w-full bg-[#E11D48] py-4 rounded-2xl items-center justify-center shadow-md active:opacity-90"
                >
                  <Text className="text-white text-sm font-black uppercase tracking-wider">
                    {isSubmitting ? 'Saving Health Update...' : 'Submit Health Update'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
