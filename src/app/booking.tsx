import React, { useState, useEffect, useRef } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, TextInput, Alert, Image, Animated, Dimensions, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWorkoutStore } from '../store/workoutStore';
import { useBookingStore } from '../store/bookingStore';
import { useMembershipStore } from '../store/membershipStore';
import { useAddressStore } from '../store/addressStore';
import { useCoachStore } from '../store/coachStore';
import { useNotificationStore } from '../store/notificationStore';
import { EmptyState, ApplePayConfirmation } from '../components';
import { Ionicons, Feather } from '@expo/vector-icons';
import Svg, { Circle, Line, Path, Rect, Defs, RadialGradient, Stop } from 'react-native-svg';

const { width } = Dimensions.get('window');

// 5 Premium experiences specified
interface Experience {
  id: string;
  title: string;
  description: string;
  icon: string;
  gradientColors: string[];
  emoji: string;
  duration: number;
}

const EXPERIENCES: Experience[] = [
  {
    id: 'exp-strength',
    title: 'Forge Strength',
    description: 'Built for strength & muscle training at home',
    icon: 'dumbbell',
    gradientColors: ['#EF4444', '#B91C1C'],
    emoji: '🏋️‍♂️',
    duration: 60,
  },
  {
    id: 'exp-flow',
    title: 'Flow Motion',
    description: 'Yoga & mobility to restore balance and posture',
    icon: 'compass',
    gradientColors: ['#10B981', '#047857'],
    emoji: '🧘‍♀️',
    duration: 60,
  },
  {
    id: 'exp-rhythm',
    title: 'Rhythm Burn',
    description: 'High-energy dance cardio conditioning beats',
    icon: 'music',
    gradientColors: ['#EC4899', '#BE185D'],
    emoji: '💃',
    duration: 45,
  },
  {
    id: 'exp-reset',
    title: 'Reset Studio',
    description: 'Active stretch, recovery, and decompression',
    icon: 'coffee',
    gradientColors: ['#3B82F6', '#1D4ED8'],
    emoji: '🛌',
    duration: 45,
  },
  {
    id: 'exp-combat',
    title: 'Combat Core',
    description: 'Boxing conditioning, core drills, speed agility',
    icon: 'activity',
    gradientColors: ['#F59E0B', '#D97706'],
    emoji: '🥊',
    duration: 60,
  },
];

export default function BookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const initialWorkoutId = params.workoutId as string;

  const { addBooking } = useBookingStore();
  const { membership, useCredit } = useMembershipStore();
  const { addresses, addAddress, selectedAddressId, setSelectedAddressId } = useAddressStore();
  const { coaches } = useCoachStore();
  const { addNotification } = useNotificationStore();

  // Booking Wizard Steps (1 to 6)
  const [step, setStep] = useState(1);
  const [selectedExperience, setSelectedExperience] = useState<Experience>(EXPERIENCES[0]);
  const [trainerPref, setTrainerPref] = useState<'any' | 'female' | 'male' | 'favourite'>('any');
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>('');
  
  // Location selection
  const [locationType, setLocationType] = useState<'current' | 'saved' | 'new'>('saved');
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addrLabel, setAddrLabel] = useState('');
  const [addrLine, setAddrLine] = useState('');
  const [addrDefault, setAddrDefault] = useState(false);

  // Date selection
  const [dateSelectionType, setDateSelectionType] = useState<'today' | 'tomorrow' | 'weekend' | 'calendar'>('today');
  const [selectedDate, setSelectedDate] = useState('');
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);

  // Time slots selection
  const [timePeriod, setTimePeriod] = useState<'morning' | 'afternoon' | 'evening' | 'night'>('morning');
  const [selectedTime, setSelectedTime] = useState('');

  // Matchmaker and reveal state
  const [matchStage, setMatchStage] = useState(0);
  const [matchDone, setMatchDone] = useState(false);
  const [matchedCoach, setMatchedCoach] = useState<any>(null);

  // Layout Animation
  const slideAnim = useRef(new Animated.Value(0)).current;
  const radarAnim = useRef(new Animated.Value(0)).current;

  // Initial workout matching logic for Sprint 3 compatibility
  useEffect(() => {
    if (initialWorkoutId) {
      const lower = initialWorkoutId.toLowerCase();
      let matchedExp = EXPERIENCES[0];
      if (lower.includes('yoga') || lower.includes('flow') || lower.includes('pilates')) {
        matchedExp = EXPERIENCES[1];
      } else if (lower.includes('dance') || lower.includes('rhythm')) {
        matchedExp = EXPERIENCES[2];
      } else if (lower.includes('stretch') || lower.includes('recovery') || lower.includes('reset')) {
        matchedExp = EXPERIENCES[3];
      } else if (lower.includes('boxing') || lower.includes('combat') || lower.includes('kickboxing')) {
        matchedExp = EXPERIENCES[4];
      }
      setSelectedExperience(matchedExp);
    }
  }, [initialWorkoutId]);

  // Set selected date based on shortcuts
  useEffect(() => {
    const today = new Date();
    if (dateSelectionType === 'today') {
      const formatted = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      setSelectedDate(formatted);
      setShowCalendarPicker(false);
    } else if (dateSelectionType === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const formatted = tomorrow.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      setSelectedDate(formatted);
      setShowCalendarPicker(false);
    } else if (dateSelectionType === 'weekend') {
      // Find next Saturday
      const saturday = new Date(today);
      saturday.setDate(today.getDate() + (6 - today.getDay() + 7) % 7);
      const formatted = saturday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      setSelectedDate(formatted);
      setShowCalendarPicker(false);
    } else if (dateSelectionType === 'calendar') {
      setShowCalendarPicker(true);
    }
  }, [dateSelectionType]);

  // Pulse animation for radar scanning map
  useEffect(() => {
    if (step === 3) {
      radarAnim.setValue(0);
      Animated.loop(
        Animated.timing(radarAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [step]);

  // Step transitions
  const triggerTransition = (nextStep: number) => {
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: -10,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 10,
        duration: 0,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      })
    ]).start();
    
    setStep(nextStep);
  };

  const handleNext = () => {
    if (step === 1 && !selectedExperience) {
      Alert.alert('Selection Required', 'Please select a training experience.');
      return;
    }
    if (step === 2 && trainerPref === 'favourite' && !selectedTrainerId) {
      const favouritesExist = coaches.some(c => c.isFavourite);
      if (favouritesExist) {
        Alert.alert('Selection Required', 'Please select one of your favorite coaches.');
        return;
      }
      // If none exist, they are stuck, let them change preference
      Alert.alert('Preference Required', 'Please choose another trainer preference.');
      return;
    }
    if (step === 3 && locationType === 'saved' && !selectedAddressId) {
      Alert.alert('Location Required', 'Please choose a saved address.');
      return;
    }
    if (step === 4 && !selectedDate) {
      Alert.alert('Date Required', 'Please select a date.');
      return;
    }
    if (step === 5) {
      if (!selectedTime) {
        Alert.alert('Time Required', 'Please select a time slot.');
        return;
      }
      // Begin matchmaker directly when advancing to step 6
      startMatchmaker();
    }
    triggerTransition(step + 1);
  };

  const handleBack = () => {
    if (step > 1) {
      triggerTransition(step - 1);
    } else {
      router.back();
    }
  };

  // Matchmaker simulation trigger
  const startMatchmaker = () => {
    setMatchStage(0);
    setMatchDone(false);
    
    const interval = setInterval(() => {
      setMatchStage((prev) => {
        if (prev >= 4) {
          clearInterval(interval);
          finalizeMatch();
          return 5;
        }
        return prev + 1;
      });
    }, 600);
  };

  const finalizeMatch = () => {
    // Select coach based on preference and workout specialty
    let pool = coaches;

    // Filter by gender if requested
    if (trainerPref === 'female') {
      pool = pool.filter(c => c.name.endsWith('Patel') || c.name.endsWith('Rao') || c.name.endsWith('Deshmukh') || c.name.endsWith('Sen') || c.name.endsWith('Hegde'));
    } else if (trainerPref === 'male') {
      pool = pool.filter(c => c.name.endsWith('Sharma') || c.name.endsWith('Mehta') || c.name.endsWith('Gill') || c.name.endsWith('Nair') || c.name.endsWith('Varma'));
    }

    // Filter by specialty if applicable
    let specFilter = 'Strength';
    if (selectedExperience.id === 'exp-flow') specFilter = 'Yoga';
    if (selectedExperience.id === 'exp-rhythm') specFilter = 'Dance';
    if (selectedExperience.id === 'exp-reset') specFilter = 'Mobility';
    if (selectedExperience.id === 'exp-combat') specFilter = 'Boxing';

    let specialtyPool = pool.filter(c => c.specialty.includes(specFilter) || c.workoutSpecialties?.some(s => s.includes(specFilter)));
    if (specialtyPool.length === 0) specialtyPool = pool;

    // Pick specific coach
    let finalCoach = specialtyPool[0];
    if (trainerPref === 'favourite' && selectedTrainerId) {
      const fav = coaches.find(c => c.id === selectedTrainerId);
      if (fav) finalCoach = fav;
    }

    // Fallback if somehow undefined
    if (!finalCoach) finalCoach = coaches[0];

    setMatchedCoach(finalCoach);
    setMatchDone(true);
  };

  const handleAddNewAddress = () => {
    if (!addrLabel.trim() || !addrLine.trim()) {
      Alert.alert('Incomplete Form', 'Please enter both label and address.');
      return;
    }
    addAddress({
      label: addrLabel.trim(),
      addressLine: addrLine.trim(),
      isDefault: addrDefault,
    });
    setShowAddressForm(false);
    setAddrLabel('');
    setAddrLine('');
    setAddrDefault(false);
  };

  const handleConfirmBooking = () => {
    const success = useCredit();
    if (!success) {
      Alert.alert('Credits Low', 'You do not have enough credits. Please renew your membership.');
      return;
    }

    const bookingId = `b-${Date.now()}`;
    const targetAddress = addresses.find(a => a.id === selectedAddressId)?.addressLine || 'Selected Location';

    addBooking({
      id: bookingId,
      trainerName: matchedCoach.name,
      trainerPhoto: matchedCoach.photo,
      workoutTitle: selectedExperience.title,
      date: selectedDate,
      time: selectedTime,
      price: matchedCoach.price || 1200,
      address: targetAddress,
      goal: selectedExperience.title,
      timelineStatus: 'booked',
      trainerLevel: matchedCoach.level || 'Certified',
      trainerRating: matchedCoach.rating,
      trainerCompletedSessions: matchedCoach.completedSessions || 150,
      trainerSpeciality: matchedCoach.specialty,
      trainerLanguages: matchedCoach.languages,
      trainerDistance: `${(1.5 + Math.random() * 2).toFixed(1)} km`,
      trainerArrivalTime: `${Math.round(10 + Math.random() * 10)} mins`,
    });

    // S5 notification triggering
    addNotification({
      title: 'Trainer Assigned ⚡',
      body: `Coach ${matchedCoach.name} (${matchedCoach.level} Trainer) is assigned to your ${selectedExperience.title} session on ${selectedDate} at ${selectedTime}.`,
    });

    addNotification({
      title: 'Workout Tomorrow 📅',
      body: `Get ready! Your VIRLA ${selectedExperience.title} session is scheduled for tomorrow at ${selectedTime}.`,
    });

    // Route to session detail for timeline simulation
    router.replace({
      pathname: '/session-detail',
      params: { id: bookingId },
    });
  };

  // Helper arrays for Step 5 Slots
  const morningSlots = [
    { time: '06:00 AM - 07:00 AM', tag: 'High Demand', isPrime: false },
    { time: '07:00 AM - 08:00 AM', tag: 'Almost Full', isPrime: true },
    { time: '08:00 AM - 09:00 AM', tag: 'Only 2 left', isPrime: true },
    { time: '10:00 AM - 11:00 AM', tag: '', isPrime: false },
  ];
  const afternoonSlots = [
    { time: '12:00 PM - 01:00 PM', tag: '', isPrime: false },
    { time: '02:00 PM - 03:00 PM', tag: 'High Demand', isPrime: false },
    { time: '04:00 PM - 05:00 PM', tag: 'Almost Full', isPrime: false },
  ];
  const eveningSlots = [
    { time: '05:00 PM - 06:00 PM', tag: 'Only 2 left', isPrime: true },
    { time: '06:00 PM - 07:00 PM', tag: 'High Demand', isPrime: true },
    { time: '07:00 PM - 08:00 PM', tag: 'Almost Full', isPrime: false },
  ];
  const nightSlots = [
    { time: '09:00 PM - 10:00 PM', tag: 'Only 1 left', isPrime: false },
    { time: '10:00 PM - 11:00 PM', tag: '', isPrime: false },
  ];

  const getSlotsForPeriod = () => {
    if (timePeriod === 'morning') return morningSlots;
    if (timePeriod === 'afternoon') return afternoonSlots;
    if (timePeriod === 'evening') return eveningSlots;
    return nightSlots;
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FB]">
      {/* Header back button */}
      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white">
        <TouchableOpacity onPress={handleBack} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-[#111827] text-sm font-black uppercase tracking-wider mr-8">
          {step <= 5 ? `Step ${step} of 5` : 'Trainer Match'}
        </Text>
      </View>

      <View className="flex-1">
        {step <= 6 ? (
          <ScrollView showsVerticalScrollIndicator={false} className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
            <Animated.View style={{ transform: [{ translateY: slideAnim }] }} className="gap-6">
              
              {/* STEP 1: EXPERIENCE SELECTOR */}
              {step === 1 && (
                <View className="gap-5">
                  <View>
                    <Text className="text-[#6B7280] text-[10px] font-black uppercase tracking-widest">Training Experience</Text>
                    <Text className="text-[#111827] text-2xl font-black tracking-tight mt-1">Choose Workout Experience</Text>
                  </View>

                  <View className="gap-4">
                    {EXPERIENCES.map((exp) => {
                      const isSelected = selectedExperience.id === exp.id;
                      return (
                        <TouchableOpacity
                          key={exp.id}
                          activeOpacity={0.9}
                          onPress={() => setSelectedExperience(exp)}
                          className={`p-5 rounded-[28px] border flex-row items-center justify-between shadow-xs ${
                            isSelected 
                              ? 'bg-zinc-950 border-zinc-950 shadow-md' 
                              : 'bg-white border-[#E5E7EB]'
                          }`}
                        >
                          <View className="flex-row items-center gap-4 flex-1">
                            <View 
                              style={{ backgroundColor: exp.gradientColors[0] }} 
                              className="w-12 h-12 rounded-2xl items-center justify-center shadow-xs"
                            >
                              <Text className="text-xl">{exp.emoji}</Text>
                            </View>
                            <View className="flex-1">
                              <Text className={`text-sm font-black tracking-tight ${isSelected ? 'text-white' : 'text-[#111827]'}`}>
                                {exp.title}
                              </Text>
                              <Text className={`text-[10px] font-bold mt-1 leading-relaxed ${isSelected ? 'text-zinc-400' : 'text-[#6B7280]'}`}>
                                {exp.description}
                              </Text>
                            </View>
                          </View>
                          {isSelected && (
                            <View className="w-5 h-5 rounded-full bg-indigo-500 items-center justify-center">
                              <Feather name="check" size={12} color="white" />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* STEP 2: TRAINER PREFERENCE */}
              {step === 2 && (
                <View className="gap-5">
                  <View>
                    <Text className="text-[#6B7280] text-[10px] font-black uppercase tracking-widest">Concierge Match</Text>
                    <Text className="text-[#111827] text-2xl font-black tracking-tight mt-1">Trainer Preference</Text>
                  </View>

                  <View className="flex-row flex-wrap justify-between gap-y-4">
                    {[
                      { id: 'any', label: 'No Preference', icon: 'shuffle', desc: 'Any expert match' },
                      { id: 'female', label: 'Female Trainer', icon: 'smile', desc: 'Match female coach' },
                      { id: 'male', label: 'Male Trainer', icon: 'user', desc: 'Match male coach' },
                      { id: 'favourite', label: 'Favourite Trainer', icon: 'heart', desc: 'Choose saved favorites' }
                    ].map((pref) => {
                      const isSelected = trainerPref === pref.id;
                      return (
                        <TouchableOpacity
                          key={pref.id}
                          activeOpacity={0.8}
                          onPress={() => {
                            setTrainerPref(pref.id as any);
                            if (pref.id === 'favourite') {
                              // Auto-select first favorite if exists
                              const favs = coaches.filter(c => c.isFavourite);
                              if (favs.length > 0) {
                                setSelectedTrainerId(favs[0].id);
                              }
                            }
                          }}
                          className={`w-[47%] p-5 rounded-[24px] border items-center justify-center gap-2.5 shadow-xs ${
                            isSelected ? 'bg-zinc-950 border-zinc-950' : 'bg-white border-[#E5E7EB]'
                          }`}
                        >
                          <Feather name={pref.icon as any} size={20} color={isSelected ? '#F59E0B' : '#6B7280'} />
                          <View className="items-center">
                            <Text className={`text-xs font-black tracking-tight text-center ${isSelected ? 'text-white' : 'text-[#111827]'}`}>
                              {pref.label}
                            </Text>
                            <Text className={`text-[8px] text-center font-bold mt-1 ${isSelected ? 'text-zinc-500' : 'text-[#9CA3AF]'}`}>
                              {pref.desc}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Favourites Section */}
                  {trainerPref === 'favourite' && (
                    <View className="mt-4 gap-3">
                      <Text className="text-[#111827] text-xs font-black uppercase tracking-wider pl-1">Select Favorite Coach</Text>
                      {coaches.filter(c => c.isFavourite).length > 0 ? (
                        coaches.filter(c => c.isFavourite).map((coach) => {
                          const isSelected = selectedTrainerId === coach.id;
                          return (
                            <TouchableOpacity
                              key={coach.id}
                              activeOpacity={0.8}
                              onPress={() => setSelectedTrainerId(coach.id)}
                              className={`p-4 rounded-2xl border flex-row items-center justify-between ${
                                isSelected ? 'bg-indigo-50/50 border-indigo-500' : 'bg-white border-[#E5E7EB]'
                              }`}
                            >
                              <View className="flex-row items-center gap-3">
                                <Image source={{ uri: coach.photo }} className="w-10 h-10 rounded-full" />
                                <View>
                                  <Text className="text-[#111827] text-xs font-black">{coach.name}</Text>
                                  <Text className="text-[#6B7280] text-[9px] font-bold mt-0.5">{coach.specialty} • ⭐ {coach.rating}</Text>
                                </View>
                              </View>
                              {isSelected ? (
                                <View className="w-4 h-4 rounded-full bg-[#4F46E5] items-center justify-center">
                                  <Feather name="check" size={10} color="white" />
                                </View>
                              ) : (
                                <View className="w-4 h-4 rounded-full border border-zinc-300" />
                              )}
                            </TouchableOpacity>
                          );
                        })
                      ) : (
                        <EmptyState type="no-favourite-trainer" />
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* STEP 3: LOCATION & MAP */}
              {step === 3 && (
                <View className="gap-5">
                  <View>
                    <Text className="text-[#6B7280] text-[10px] font-black uppercase tracking-widest">Training Venue</Text>
                    <Text className="text-[#111827] text-2xl font-black tracking-tight mt-1">Select Location</Text>
                  </View>

                  {/* Location Selector Tabs */}
                  <View className="flex-row bg-[#E5E7EB]/40 border border-[#E5E7EB]/80 p-1 rounded-2xl">
                    {[
                      { id: 'saved', label: 'Saved Address' },
                      { id: 'new', label: 'Add New' }
                    ].map((opt) => {
                      const isActive = locationType === opt.id;
                      return (
                        <TouchableOpacity
                          key={opt.id}
                          activeOpacity={0.8}
                          onPress={() => {
                            setLocationType(opt.id as any);
                            if (opt.id === 'new') setShowAddressForm(true);
                            else setShowAddressForm(false);
                          }}
                          className={`flex-1 py-3 rounded-xl items-center justify-center ${
                            isActive ? 'bg-[#111827] shadow-sm' : ''
                          }`}
                        >
                          <Text className={`text-[9px] font-black uppercase tracking-wider ${isActive ? 'text-white' : 'text-[#6B7280]'}`}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Saved Addresses list */}
                  {locationType === 'saved' && !showAddressForm && (
                    <View className="gap-3.5">
                      {addresses.map((addr) => {
                        const isSelected = selectedAddressId === addr.id;
                        return (
                          <TouchableOpacity
                            key={addr.id}
                            activeOpacity={0.8}
                            onPress={() => setSelectedAddressId(addr.id)}
                            className={`p-5 rounded-[24px] border flex-row items-start gap-3.5 shadow-xs ${
                              isSelected ? 'bg-white border-zinc-950 shadow-sm' : 'bg-white border-[#E5E7EB]'
                            }`}
                          >
                            <View className={`w-8 h-8 rounded-xl items-center justify-center ${isSelected ? 'bg-zinc-900' : 'bg-zinc-100'}`}>
                              <Feather name={addr.label === 'Home' ? 'home' : addr.label === 'Office' ? 'briefcase' : 'map-pin'} size={14} color={isSelected ? 'white' : '#6B7280'} />
                            </View>
                            <View className="flex-1 gap-1">
                              <View className="flex-row items-center gap-2">
                                <Text className="text-[#111827] text-xs font-black">{addr.label}</Text>
                                {addr.isDefault && (
                                  <View className="bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded-full">
                                    <Text className="text-[#6B7280] text-[7px] font-black uppercase tracking-wider">Default</Text>
                                  </View>
                                )}
                              </View>
                              <Text className="text-[#6B7280] text-[10px] font-semibold leading-relaxed">
                                {addr.addressLine}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  {/* Add New Address Form */}
                  {showAddressForm && (
                    <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] gap-4 shadow-sm">
                      <Text className="text-[#111827] text-xs font-black uppercase tracking-wider pl-1">New Address details</Text>
                      <View className="gap-3">
                        <TextInput
                          value={addrLabel}
                          onChangeText={setAddrLabel}
                          placeholder="Label (e.g. Home, Office, Gym)"
                          placeholderTextColor="#9CA3AF"
                          className="border border-[#E5E7EB] p-3 rounded-xl text-xs font-semibold bg-zinc-50"
                        />
                        <TextInput
                          value={addrLine}
                          onChangeText={setAddrLine}
                          placeholder="Complete Address Line"
                          placeholderTextColor="#9CA3AF"
                          multiline
                          className="border border-[#E5E7EB] p-3 rounded-xl text-xs font-semibold bg-zinc-50 h-20"
                        />
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => setAddrDefault(!addrDefault)}
                          className="flex-row items-center gap-2 py-1 pl-1"
                        >
                          <View className={`w-4 h-4 rounded border justify-center items-center ${addrDefault ? 'bg-[#111827] border-[#111827]' : 'border-zinc-300'}`}>
                            {addrDefault && <Feather name="check" size={10} color="white" />}
                          </View>
                          <Text className="text-[#6B7280] text-[10px] font-bold uppercase tracking-wider">Set as default address</Text>
                        </TouchableOpacity>

                        <View className="flex-row gap-3 mt-2">
                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => {
                              setShowAddressForm(false);
                              setLocationType('saved');
                            }}
                            className="flex-1 py-3 bg-zinc-100 rounded-xl items-center justify-center"
                          >
                            <Text className="text-zinc-600 text-xs font-black uppercase">Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={handleAddNewAddress}
                            className="flex-1 py-3 bg-zinc-950 rounded-xl items-center justify-center"
                          >
                            <Text className="text-white text-xs font-black uppercase">Save</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Apple Maps Style Card (Feature 3) */}
                  <View className="bg-white border border-[#E5E7EB] rounded-[30px] p-4.5 shadow-sm overflow-hidden gap-3.5 mt-2">
                    <View className="flex-row justify-between items-center px-1">
                      <View className="flex-row items-center gap-2">
                        <Feather name="navigation" size={14} color="#3B82F6" />
                        <Text className="text-[#111827] text-xs font-black uppercase tracking-wider">Coverage Radius</Text>
                      </View>
                      <View className="bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                        <Text className="text-blue-600 text-[8px] font-black uppercase">Active GPS</Text>
                      </View>
                    </View>

                    {/* SVG Map Graphic */}
                    <View className="h-44 bg-[#E0F2FE]/45 border border-[#BAE6FD]/40 rounded-2xl relative overflow-hidden items-center justify-center">
                      <Svg width="100%" height="100%" className="absolute">
                        {/* Map roads/grids */}
                        <Line x1="10%" y1="0%" x2="10%" y2="100%" stroke="#BAE6FD" strokeWidth={1} strokeDasharray="4 4" />
                        <Line x1="45%" y1="0%" x2="45%" y2="100%" stroke="#BAE6FD" strokeWidth={2} />
                        <Line x1="80%" y1="0%" x2="80%" y2="100%" stroke="#BAE6FD" strokeWidth={1} strokeDasharray="4 4" />
                        <Line x1="0%" y1="35%" x2="100%" y2="35%" stroke="#BAE6FD" strokeWidth={2} />
                        <Line x1="0%" y1="70%" x2="100%" y2="70%" stroke="#BAE6FD" strokeWidth={1} strokeDasharray="4 4" />
                        
                        {/* Area details */}
                        <Circle cx="120" cy="50" r="28" fill="#DDB1FC" opacity={0.3} />
                        <Circle cx="280" cy="120" r="35" fill="#3B82F6" opacity={0.1} />
                      </Svg>

                      {/* Radar Pulse Wave Animation */}
                      <Animated.View
                        style={{
                          position: 'absolute',
                          width: 80,
                          height: 80,
                          borderRadius: 40,
                          borderWidth: 1.5,
                          borderColor: '#3B82F6',
                          backgroundColor: 'rgba(59, 130, 246, 0.08)',
                          transform: [
                            {
                              scale: radarAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.6, 2.8],
                              }),
                            },
                          ],
                          opacity: radarAnim.interpolate({
                            inputRange: [0, 0.8, 1],
                            outputRange: [0.7, 0.4, 0],
                          }),
                        }}
                      />

                      {/* Location PIN */}
                      <View className="w-9 h-9 rounded-full bg-blue-600 border-2 border-white items-center justify-center shadow-lg relative z-20">
                        <Feather name="map-pin" size={14} color="white" />
                      </View>
                    </View>

                    <View className="flex-row justify-between items-center bg-zinc-50 border border-zinc-100 p-3.5 rounded-2xl">
                      <View className="gap-1 flex-1">
                        <Text className="text-[#6B7280] text-[8px] font-bold uppercase">Estimated travel time</Text>
                        <Text className="text-zinc-900 text-xs font-extrabold">🚀 ETA: ~12 mins travel</Text>
                      </View>
                      <View className="w-[1px] h-8 bg-[#E5E7EB] mx-3" />
                      <View className="gap-1 flex-1 items-end">
                        <Text className="text-[#6B7280] text-[8px] font-bold uppercase">Covers Areas</Text>
                        <Text className="text-zinc-900 text-[10px] font-extrabold text-right">Bandra, Juhu, Worli, Nariman</Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* STEP 4: DATE SELECTOR */}
              {step === 4 && (
                <View className="gap-5">
                  <View>
                    <Text className="text-[#6B7280] text-[10px] font-black uppercase tracking-widest">Schedule Day</Text>
                    <Text className="text-[#111827] text-2xl font-black tracking-tight mt-1">Select Date</Text>
                  </View>

                  {/* Horizontal Date Capsules (Feature 4) */}
                  <View className="flex-row justify-between gap-2.5">
                    {[
                      { id: 'today', label: 'Today', sub: 'Jul 16' },
                      { id: 'tomorrow', label: 'Tomorrow', sub: 'Jul 17' },
                      { id: 'weekend', label: 'Weekend', sub: 'Jul 18-19' },
                      { id: 'calendar', label: 'Calendar', sub: 'Open Grid' }
                    ].map((capsule) => {
                      const isSelected = dateSelectionType === capsule.id;
                      return (
                        <TouchableOpacity
                          key={capsule.id}
                          activeOpacity={0.8}
                          onPress={() => setDateSelectionType(capsule.id as any)}
                          className={`flex-1 p-3.5 rounded-2xl border items-center justify-center gap-1 shadow-xs ${
                            isSelected ? 'bg-zinc-950 border-zinc-950' : 'bg-white border-[#E5E7EB]'
                          }`}
                        >
                          <Text className={`text-[10px] font-black uppercase tracking-wider ${isSelected ? 'text-white' : 'text-[#111827]'}`}>
                            {capsule.label}
                          </Text>
                          <Text className={`text-[8px] font-bold ${isSelected ? 'text-zinc-400' : 'text-[#6B7280]'}`}>
                            {capsule.sub}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Date picker grid panel */}
                  {showCalendarPicker && (
                    <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] gap-4 shadow-sm">
                      <Text className="text-[#111827] text-xs font-black uppercase tracking-wider text-center">Select Available Date</Text>
                      <View className="flex-row flex-wrap justify-between gap-y-3">
                        {Array.from({ length: 12 }).map((_, i) => {
                          const dateObj = new Date();
                          dateObj.setDate(dateObj.getDate() + i + 2); // dates starting from 2 days from now
                          const dateString = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                          const displayDay = dateObj.toLocaleDateString('en-US', { day: '2-digit' });
                          const displayMonth = dateObj.toLocaleDateString('en-US', { month: 'short' });
                          const isPicked = selectedDate === dateString;

                          return (
                            <TouchableOpacity
                              key={i}
                              activeOpacity={0.8}
                              onPress={() => setSelectedDate(dateString)}
                              className={`w-[22%] py-3 rounded-xl border items-center justify-center ${
                                isPicked ? 'bg-[#111827] border-[#111827]' : 'bg-white border-[#E5E7EB]'
                              }`}
                            >
                              <Text className={`text-xs font-black ${isPicked ? 'text-white' : 'text-zinc-800'}`}>{displayDay}</Text>
                              <Text className={`text-[8px] font-bold uppercase mt-0.5 ${isPicked ? 'text-zinc-400' : 'text-[#6B7280]'}`}>{displayMonth}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* Summary date selected bar */}
                  <View className="bg-white border border-[#E5E7EB] px-5 py-4.5 rounded-[24px] flex-row justify-between items-center">
                    <View className="flex-row items-center gap-2.5">
                      <Feather name="calendar" size={16} color="#4F46E5" />
                      <Text className="text-[#111827] text-xs font-black uppercase tracking-wider">Selected Date</Text>
                    </View>
                    <Text className="text-[#4F46E5] text-xs font-extrabold">{selectedDate || 'Select a date'}</Text>
                  </View>
                </View>
              )}

              {/* STEP 5: TIME SELECTOR */}
              {step === 5 && (
                <View className="gap-5">
                  <View>
                    <Text className="text-[#6B7280] text-[10px] font-black uppercase tracking-widest">Training Schedule</Text>
                    <Text className="text-[#111827] text-2xl font-black tracking-tight mt-1">Select Time Slot</Text>
                  </View>

                  {/* Day periods capsules */}
                  <View className="flex-row bg-[#E5E7EB]/40 border border-[#E5E7EB]/80 p-1 rounded-2xl">
                    {[
                      { id: 'morning', label: 'Morning' },
                      { id: 'afternoon', label: 'Afternoon' },
                      { id: 'evening', label: 'Evening' },
                      { id: 'night', label: 'Night' }
                    ].map((period) => {
                      const isActive = timePeriod === period.id;
                      return (
                        <TouchableOpacity
                          key={period.id}
                          activeOpacity={0.8}
                          onPress={() => setTimePeriod(period.id as any)}
                          className={`flex-1 py-3 rounded-xl items-center justify-center ${
                            isActive ? 'bg-[#111827] shadow-sm' : ''
                          }`}
                        >
                          <Text className={`text-[9px] font-black uppercase tracking-wider ${isActive ? 'text-white' : 'text-[#6B7280]'}`}>
                            {period.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Slots listing for period */}
                  <View className="gap-3.5">
                    {getSlotsForPeriod().map((slotObj, idx) => {
                      const isPicked = selectedTime === slotObj.time;
                      return (
                        <TouchableOpacity
                          key={idx}
                          activeOpacity={0.8}
                          onPress={() => setSelectedTime(slotObj.time)}
                          className={`p-4.5 rounded-[24px] border flex-row justify-between items-center shadow-xs ${
                            isPicked ? 'bg-zinc-950 border-zinc-950 shadow-md' : 'bg-white border-[#E5E7EB]'
                          }`}
                        >
                          <View className="flex-row items-center gap-3.5">
                            <Feather name="clock" size={14} color={isPicked ? '#F59E0B' : '#6B7280'} />
                            <Text className={`text-xs font-black tracking-tight ${isPicked ? 'text-white' : 'text-zinc-900'}`}>
                              {slotObj.time}
                            </Text>
                            {slotObj.isPrime && (
                              <View className="bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex-row items-center gap-0.5">
                                <Text className="text-amber-500 text-[8px] font-black uppercase tracking-wider">★ Prime Time</Text>
                              </View>
                            )}
                          </View>
                          
                          {/* Remaining slot tag */}
                          {slotObj.tag ? (
                            <View className={`px-2 py-1 rounded-lg ${
                              slotObj.tag.includes('left') || slotObj.tag.includes('1')
                                ? 'bg-red-50' 
                                : slotObj.tag.includes('Full') 
                                ? 'bg-amber-50' 
                                : 'bg-indigo-50'
                            }`}>
                              <Text className={`text-[8px] font-black uppercase tracking-wider ${
                                slotObj.tag.includes('left') || slotObj.tag.includes('1')
                                  ? 'text-red-500'
                                  : slotObj.tag.includes('Full')
                                  ? 'text-amber-600'
                                  : 'text-indigo-600'
                              }`}>
                                {slotObj.tag}
                              </Text>
                            </View>
                          ) : (
                            <View className="w-5 h-5 rounded-full border border-zinc-200" />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* STEP 6: MATCHMAKER SIMULATOR & SUMMARY */}
              {step === 6 && (
                <View className="gap-6 pb-6">
                  {!matchDone ? (
                    /* MATCHMAKER SCREEN (Feature 6) */
                    <View className="bg-white border border-[#E5E7EB] p-8 rounded-[32px] items-center justify-center shadow-xs py-16 gap-6">
                      <View className="relative w-20 h-20 items-center justify-center">
                        <Svg width={80} height={80} viewBox="0 0 80 80" className="absolute">
                          <Circle cx={40} cy={40} r={35} stroke="#E5E7EB" strokeWidth={4} fill="none" />
                          <Circle cx={40} cy={40} r={35} stroke="#4F46E5" strokeWidth={4} fill="none" strokeDasharray="220" strokeDashoffset={220 - (220 * (matchStage + 1)) / 6} strokeLinecap="round" />
                        </Svg>
                        <Feather name="compass" size={28} color="#4F46E5" className="animate-spin" />
                      </View>

                      <View className="items-center gap-1.5">
                        <Text className="text-[#111827] text-lg font-black tracking-tight">Finding your perfect coach…</Text>
                        <Text className="text-[#6B7280] text-xs font-semibold uppercase tracking-wider mt-1 text-center max-w-[80%] leading-relaxed">
                          Checking matches for: {selectedExperience.title}
                        </Text>
                      </View>

                      {/* Status stages steps */}
                      <View className="w-full gap-3 mt-4 px-2">
                        {[
                          'User Books Session (Initiated)',
                          'Find Trainers Available For That Exact Time Slot',
                          'Filter Trainers Within Supported Distance Radius',
                          'Sort By: Availability, Distance, Average Rating, Completed Sessions',
                          'Automatically Assign Best Matching Trainer',
                          'Trainer Confirms Booking & Customer Receives Confirmation'
                        ].map((label, idx) => {
                          const isDone = matchStage > idx;
                          const isActive = matchStage === idx;
                          return (
                            <View key={idx} className="flex-row items-center gap-3">
                              {isDone ? (
                                <View className="w-4 h-4 rounded-full bg-green-500 items-center justify-center">
                                  <Feather name="check" size={10} color="white" />
                                </View>
                              ) : isActive ? (
                                <View className="w-4 h-4 rounded-full bg-indigo-500 items-center justify-center">
                                  <View className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                </View>
                              ) : (
                                <View className="w-4 h-4 rounded-full border border-zinc-200" />
                              )}
                              <Text className={`text-xs font-semibold ${isDone ? 'text-zinc-500 font-normal line-through' : isActive ? 'text-indigo-600 font-extrabold' : 'text-zinc-400'}`}>
                                {label}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  ) : (
                    /* REVEAL TRAINER BEAUTIFULLY & SESSION SUMMARY */
                    <View className="gap-6 animate-fade-in">
                      <View>
                        <Text className="text-[#6B7280] text-[10px] font-black uppercase tracking-widest">Match Confirmed</Text>
                        <Text className="text-[#111827] text-2xl font-black tracking-tight mt-1">Perfect Coach Found!</Text>
                      </View>

                      {/* Coach Detail Card */}
                      <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
                        <View className="flex-row gap-4 items-center">
                          <Image source={{ uri: matchedCoach.photo }} className="w-16 h-16 rounded-full border border-zinc-100" />
                          <View className="flex-1 gap-1">
                            <View className="flex-row items-center gap-2 flex-wrap">
                              <Text className="text-[#111827] text-base font-black tracking-tight">{matchedCoach.name}</Text>
                              
                              {/* Level premium badges */}
                              <View className={`px-2.5 py-0.5 rounded-full ${
                                matchedCoach.level === 'Elite' 
                                  ? 'bg-amber-500/10 border border-amber-500/20' 
                                  : matchedCoach.level === 'Certified' 
                                  ? 'bg-zinc-400/10 border border-zinc-400/20' 
                                  : 'bg-orange-700/10 border border-orange-700/20'
                              }`}>
                                <Text className={`text-[8px] font-black uppercase tracking-widest ${
                                  matchedCoach.level === 'Elite'
                                    ? 'text-amber-600'
                                    : matchedCoach.level === 'Certified'
                                    ? 'text-zinc-500'
                                    : 'text-orange-700'
                                }`}>
                                  {matchedCoach.level} Badge
                                </Text>
                              </View>
                            </View>
                            <Text className="text-[#6B7280] text-xs font-semibold leading-none">{matchedCoach.specialty}</Text>
                            <Text className="text-zinc-400 text-[10px] font-bold leading-none mt-1">⭐️ {matchedCoach.rating} ({matchedCoach.completedSessions || 150} sessions completed)</Text>
                          </View>
                        </View>

                        <View className="h-[1px] bg-zinc-100" />

                        <View className="flex-row justify-between items-center px-1">
                          <View className="gap-0.5">
                            <Text className="text-[#6B7280] text-[8px] font-bold uppercase">Languages</Text>
                            <Text className="text-zinc-800 text-[10px] font-extrabold">{(matchedCoach.languages || ['English']).join(', ')}</Text>
                          </View>
                          <View className="gap-0.5 items-end">
                            <Text className="text-[#6B7280] text-[8px] font-bold uppercase">Arrival distance</Text>
                            <Text className="text-zinc-800 text-[10px] font-extrabold">~2.5 km away</Text>
                          </View>
                        </View>
                      </View>

                      {/* Workout Session Details */}
                      <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
                        <Text className="text-[#111827] text-xs font-black uppercase tracking-wider border-b border-zinc-100 pb-3">Session Summary</Text>
                        
                        <View className="gap-3">
                          <View className="flex-row justify-between items-center">
                            <Text className="text-[#6B7280] text-xs font-semibold">Workout Experience</Text>
                            <Text className="text-[#111827] text-xs font-extrabold">{selectedExperience.title}</Text>
                          </View>
                          <View className="flex-row justify-between items-center">
                            <Text className="text-[#6B7280] text-xs font-semibold">Scheduled Date</Text>
                            <Text className="text-[#111827] text-xs font-extrabold">{selectedDate}</Text>
                          </View>
                          <View className="flex-row justify-between items-center">
                            <Text className="text-[#6B7280] text-xs font-semibold">Time Slot</Text>
                            <Text className="text-[#111827] text-xs font-extrabold">{selectedTime}</Text>
                          </View>
                          <View className="flex-row justify-between items-center">
                            <Text className="text-[#6B7280] text-xs font-semibold">Duration</Text>
                            <Text className="text-[#111827] text-xs font-extrabold">{selectedExperience.duration} Mins</Text>
                          </View>
                          <View className="flex-row justify-between items-start">
                            <Text className="text-[#6B7280] text-xs font-semibold mt-0.5">Location</Text>
                            <Text className="text-[#111827] text-xs font-extrabold max-w-[60%] text-right leading-relaxed">
                              {addresses.find(a => a.id === selectedAddressId)?.addressLine || 'Selected address'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Apple Pay confirmation Card */}
                      <ApplePayConfirmation onConfirm={handleConfirmBooking} priceText={`₹${matchedCoach.price || 1200}`} />
                    </View>
                  )}
                </View>
              )}

            </Animated.View>
          </ScrollView>
        ) : null}
      </View>

      {/* Footer wizard navigation buttons (Steps 1 to 5) */}
      {step <= 5 && (
        <View className="p-6 bg-white border-t border-[#E5E7EB] flex-row gap-3">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleBack}
            className="flex-1 py-4 bg-zinc-50 border border-[#E5E7EB] rounded-2xl items-center justify-center"
          >
            <Text className="text-zinc-600 text-xs font-black uppercase tracking-wider">Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleNext}
            className="flex-1 py-4 bg-zinc-950 rounded-2xl items-center justify-center shadow-sm"
          >
            <Text className="text-white text-xs font-black uppercase tracking-wider">Continue</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
