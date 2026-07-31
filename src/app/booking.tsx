/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, TextInput, Alert, Image, Animated, Modal, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useBookingStore } from '../store/bookingStore';
import { useMembershipStore } from '../store/membershipStore';
import { useAddressStore } from '../store/addressStore';
import { useCoachStore } from '../store/coachStore';
import { useNotificationStore } from '../store/notificationStore';
import { EmptyState, ApplePayConfirmation, BookingSuccessAnimation } from '../components';
import { Ionicons, Feather } from '@expo/vector-icons';
import Svg, { Circle, Line } from 'react-native-svg';
import { AssignmentEngine } from '../services/AssignmentEngine';

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
    description: 'Resistance training structured to build lean muscle and agility',
    icon: 'dumbbell',
    gradientColors: ['#FF5A5F', '#FF385C'],
    emoji: '🏋️‍♂️',
    duration: 50,
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
    description: 'High-intensity dance cardio to burn maximum calories',
    icon: 'music',
    gradientColors: ['#EC4899', '#BE185D'],
    emoji: '💃',
    duration: 45,
  },
  {
    id: 'exp-reset',
    title: 'Reset Studio',
    description: 'Deep stretch, myofascial release, and guided breathwork recovery',
    icon: 'coffee',
    gradientColors: ['#64748B', '#475569'],
    emoji: '🧘‍♂️',
    duration: 50,
  },
  {
    id: 'exp-combat',
    title: 'Combat Core',
    description: 'Shadow boxing, kick drills, and core conditioning',
    icon: 'activity',
    gradientColors: ['#F59E0B', '#D97706'],
    emoji: '🥊',
    duration: 55,
  },
];

export default function BookingScreen() {
  const router = useRouter();
  const noteInputRef = React.useRef<TextInput>(null);
  const params = useLocalSearchParams();
  const initialWorkoutId = params.workoutId as string;
  const initialWorkoutType = params.workoutType as string;
  const initialWorkoutName = params.workoutName as string;

  const { addBooking } = useBookingStore();
  const { consumeCredit } = useMembershipStore();
  const { addresses, addAddress, selectedAddressId, setSelectedAddressId } = useAddressStore();
  const { coaches } = useCoachStore();
  const { addNotification } = useNotificationStore();

  // Booking Wizard Steps (1 to 6)
  const [step, setStep] = useState(1);

  const getInitialExperience = () => {
    const searchString = [initialWorkoutId, initialWorkoutType, initialWorkoutName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (searchString) {
      if (
        searchString.includes('yoga') || 
        searchString.includes('flow') || 
        searchString.includes('pilates') || 
        searchString.includes('mind & body') || 
        searchString.includes('w-2') || 
        searchString.includes('w-3')
      ) {
        return EXPERIENCES[1];
      } else if (
        searchString.includes('dance') || 
        searchString.includes('rhythm') || 
        searchString.includes('cardio') || 
        searchString.includes('w-4')
      ) {
        return EXPERIENCES[2];
      } else if (
        searchString.includes('stretch') || 
        searchString.includes('recovery') || 
        searchString.includes('reset') || 
        searchString.includes('mobility') || 
        searchString.includes('w-5')
      ) {
        return EXPERIENCES[3];
      } else if (
        searchString.includes('boxing') || 
        searchString.includes('combat') || 
        searchString.includes('kickboxing') || 
        searchString.includes('w-8')
      ) {
        return EXPERIENCES[4];
      }
    }
    return EXPERIENCES[0];
  };

  const [selectedExperience, setSelectedExperience] = useState<Experience>(() => getInitialExperience());
  const [trainerPref, setTrainerPref] = useState<'any' | 'female' | 'male' | 'favourite'>('any');
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>('');
  
  // Location selection (legacy tabs unused state cleaned)
  const [addrDefault, setAddrDefault] = useState(false);

  // Location SPRINT 4 states
  const [gpsPermission, setGpsPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [gpsSignalFailure, setGpsSignalFailure] = useState(false);
  const [networkFailure, setNetworkFailure] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [activeCoords, setActiveCoords] = useState({ lat: 19.0176, lng: 72.8164 });
  const [etaText, setEtaText] = useState('~12 mins travel');
  const [distanceText, setDistanceText] = useState('3.2 km');
  const [isLocationOutsideCoverage, setIsLocationOutsideCoverage] = useState(false);
  const [successBookingId, setSuccessBookingId] = useState('');

  // Redesigned Step 3 location modal/flow states
  const [isMapModalVisible, setIsMapModalVisible] = useState(false);
  const [isAddAddressModalVisible, setIsAddAddressModalVisible] = useState(false);
  const [addAddressStep, setAddAddressStep] = useState<1 | 2 | 3>(1);
  
  // New address form fields
  const [newHouseNo, setNewHouseNo] = useState('');
  const [newBuildingName, setNewBuildingName] = useState('');
  const [newFloor, setNewFloor] = useState('');
  const [newLandmark, setNewLandmark] = useState('');
  const [newAddressLabelType, setNewAddressLabelType] = useState<'Home' | 'Office' | 'Gym' | 'Custom'>('Home');
  const [newCustomLabel, setNewCustomLabel] = useState('');

  // Date selection
  const [dateSelectionType, setDateSelectionType] = useState<'today' | 'tomorrow' | 'weekend' | 'calendar'>('today');
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  });
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);

  const getDefaultTimePeriod = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  };
  const [timePeriod, setTimePeriod] = useState<'morning' | 'afternoon' | 'evening' | 'night'>(() => getDefaultTimePeriod());
  const [selectedTime, setSelectedTime] = useState('');

  // Matchmaker and reveal state
  const [matchStage, setMatchStage] = useState(0);
  const [matchDone, setMatchDone] = useState(false);
  const [matchedCoach, setMatchedCoach] = useState<any>(null);
  const [trainerNote, setTrainerNote] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  // Layout Animation
  const [slideAnim] = useState(() => new Animated.Value(0));
  const [radarAnim] = useState(() => new Animated.Value(0));

  // Synchronize database content on mount in case of direct deep link / refresh
  useEffect(() => {
    try {
      useCoachStore.getState().syncFromDB();
      useAddressStore.getState().syncFromDB();
    } catch (err) {
      console.warn('Direct store sync failed on mount:', err);
    }
  }, []);

  // Initial workout matching logic for Sprint 3 compatibility
  useEffect(() => {
    const searchString = [initialWorkoutId, initialWorkoutType, initialWorkoutName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (searchString) {
      let matchedExp = EXPERIENCES[0];
      if (
        searchString.includes('yoga') || 
        searchString.includes('flow') || 
        searchString.includes('pilates') || 
        searchString.includes('mind & body') || 
        searchString.includes('w-2') || 
        searchString.includes('w-3')
      ) {
        matchedExp = EXPERIENCES[1];
      } else if (
        searchString.includes('dance') || 
        searchString.includes('rhythm') || 
        searchString.includes('cardio') || 
        searchString.includes('w-4')
      ) {
        matchedExp = EXPERIENCES[2];
      } else if (
        searchString.includes('stretch') || 
        searchString.includes('recovery') || 
        searchString.includes('reset') || 
        searchString.includes('mobility') || 
        searchString.includes('w-5')
      ) {
        matchedExp = EXPERIENCES[3];
      } else if (
        searchString.includes('boxing') || 
        searchString.includes('combat') || 
        searchString.includes('kickboxing') || 
        searchString.includes('w-8')
      ) {
        matchedExp = EXPERIENCES[4];
      }
      setSelectedExperience(matchedExp);
    }
  }, [initialWorkoutId, initialWorkoutType, initialWorkoutName]);

  useEffect(() => {
    console.log('[DEBUG-BOOKING] useEffect location check ran. step:', step, 'selectedAddressId:', selectedAddressId, 'addressesCount:', addresses.length);
    if (step === 3 && selectedAddressId) {
      const addr = addresses.find(a => a.id === selectedAddressId);
      if (addr) {
        const lower = addr.addressLine.toLowerCase();
        if (lower.includes('pune') || lower.includes('delhi') || lower.includes('bangalore') || lower.includes('kolkata')) {
          setIsLocationOutsideCoverage(true);
          setEtaText('N/A (Out of bounds)');
          setDistanceText('> 100 km');
        } else if (lower.includes('juhu')) {
          setIsLocationOutsideCoverage(false);
          setEtaText('~18 mins travel');
          setDistanceText('6.5 km');
          setActiveCoords({ lat: 19.1076, lng: 72.8264 });
        } else if (lower.includes('bandra')) {
          setIsLocationOutsideCoverage(false);
          setEtaText('~12 mins travel');
          setDistanceText('3.2 km');
          setActiveCoords({ lat: 19.0596, lng: 72.8295 });
        } else if (lower.includes('worli')) {
          setIsLocationOutsideCoverage(false);
          setEtaText('~20 mins travel');
          setDistanceText('8.4 km');
          setActiveCoords({ lat: 18.9986, lng: 72.8174 });
        } else {
          setIsLocationOutsideCoverage(false);
          setEtaText('~15 mins travel');
          setDistanceText('5.0 km');
          setActiveCoords({ lat: 19.0176, lng: 72.8164 });
        }
      }
    }
  }, [selectedAddressId, step, addresses]);

  // Set selected date based on shortcuts
  useEffect(() => {
    console.log('[DEBUG-BOOKING] useEffect dateSelectionType ran. type:', dateSelectionType);
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
    console.log('[DEBUG-BOOKING] useEffect radar animation ran. step:', step);
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
  }, [step, radarAnim]);

  // Step transitions
  const triggerTransition = (nextStep: number) => {
    console.log('[DEBUG-BOOKING] triggerTransition start. target:', nextStep);
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
    
    console.log('[DEBUG-BOOKING] triggerTransition setting step state to:', nextStep);
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
    if (step === 3) {
      if (!selectedAddressId) {
        Alert.alert('Location Required', 'Please choose a training address.');
        return;
      }
      if (isLocationOutsideCoverage) {
        Alert.alert('Outside Coverage', 'The selected address lies outside the VIRLA active fitness coverage zone.');
        return;
      }
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
      // Synchronously finalize coach match when transitioning to step 6
      finalizeMatch();
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

  // Legacy add address handler removed in favor of Step 3 Redesign Add Address wizard modal

  const handleConfirmBooking = () => {
    if (isConfirming) return;
    setIsConfirming(true);

    const success = consumeCredit();
    if (!success) {
      Alert.alert('Credits Low', 'You do not have enough credits. Please renew your membership.');
      setIsConfirming(false);
      return;
    }

    const bookingId = `b-${Date.now()}`;
    const targetAddress = addresses.find(a => a.id === selectedAddressId)?.addressLine || 'Selected Location';

    const fallbackCoach = {
      id: 'c-1',
      name: 'Karan Sharma',
      photo: 'https://images.unsplash.com/photo-1548690312-e3b507d8c110?auto=format&fit=crop&w=400&q=80',
      level: 'Certified Elite',
      rating: 4.9,
      completedSessions: 320,
      specialty: 'Strength & HIIT',
      languages: 'English, Hindi',
      price: 1200
    };
    const activeCoach = matchedCoach || coaches[0] || fallbackCoach;

    // Simulate network delay to prevent duplicate submissions and test loading states
    setTimeout(() => {
      try {
        const tempBooking = {
          id: bookingId,
          trainerName: activeCoach.name,
          trainerPhoto: activeCoach.photo,
          workoutTitle: selectedExperience.title,
          date: selectedDate,
          time: selectedTime,
          price: activeCoach.price || 1200,
          address: targetAddress,
          goal: selectedExperience.title,
          timelineStatus: 'booked' as const,
          status: 'upcoming' as const,
          trainerLevel: activeCoach.level || 'Certified',
          trainerRating: activeCoach.rating,
          trainerCompletedSessions: activeCoach.completedSessions || 150,
          trainerSpeciality: activeCoach.specialty,
          trainerLanguages: activeCoach.languages,
          trainerDistance: '2.5 km',
          trainerArrivalTime: '15 mins',
          trainerNote: trainerNote.trim() || undefined,
          createdAt: Date.now(),
        };

        const ratedTrainers = AssignmentEngine.rankTrainers(tempBooking);
        let assignedCoach = activeCoach;
        let poolIds: string[] = [];
        let score = 0;
        let reason = 'Matched Fav / Specialty Fallback';

        if (ratedTrainers.length > 0) {
          const topRating = ratedTrainers[0];
          assignedCoach = topRating.coach;
          poolIds = ratedTrainers.map(rt => rt.coach.id);
          score = topRating.score;
          reason = `Highest scorer in pool (Rank 1 of ${ratedTrainers.length})`;
        } else {
          poolIds = [activeCoach.id];
          score = 80;
        }

        addBooking({
          ...tempBooking,
          trainerName: assignedCoach.name,
          trainerPhoto: assignedCoach.photo,
          price: assignedCoach.price || 1200,
          trainerLevel: assignedCoach.level || 'Certified',
          trainerRating: assignedCoach.rating,
          trainerCompletedSessions: assignedCoach.completedSessions || 150,
          trainerSpeciality: assignedCoach.specialty,
          trainerLanguages: assignedCoach.languages,
          trainerDistance: `${(1.5 + Math.random() * 2).toFixed(1)} km`,
          trainerArrivalTime: `${Math.round(10 + Math.random() * 10)} mins`,
          assignedTrainersPool: poolIds,
          currentTrainerIndex: 0,
        });

        // Log the assignment event
        const DatabaseModule = require('../database/Database');
        DatabaseModule.Database.logAssignmentEvent({
          bookingId: bookingId,
          trainerId: assignedCoach.id,
          score: score,
          reason: reason,
          action: 'assigned'
        });

        // S5 notification triggering
        addNotification({
          title: 'Trainer Assigned ⚡',
          body: `Coach ${assignedCoach.name} (${assignedCoach.level} Trainer) is assigned to your ${selectedExperience.title} session on ${selectedDate} at ${selectedTime}.`,
        });

        addNotification({
          title: 'Workout Tomorrow 📅',
          body: `Get ready! Your VIRLA ${selectedExperience.title} session is scheduled for tomorrow at ${selectedTime}.`,
        });

        setSuccessBookingId(bookingId);
        setStep(7);
      } catch (err) {
        Alert.alert('Error', 'Unable to complete your booking. Please try again.');
      } finally {
        setIsConfirming(false);
      }
    }, 1800);
  };

  // Helper arrays for Step 5 Slots
  interface SlotItem {
    time: string;
    tag: string;
    isPrime: boolean;
    isBooked?: boolean;
  }

  const morningSlots: SlotItem[] = [
    { time: '06:00 AM - 07:00 AM', tag: 'High Demand', isPrime: false },
    { time: '07:00 AM - 08:00 AM', tag: 'Almost Full', isPrime: true },
    { time: '08:00 AM - 09:00 AM', tag: 'Only 2 left', isPrime: true },
    { time: '10:00 AM - 11:00 AM', tag: '', isPrime: false },
  ];
  const afternoonSlots: SlotItem[] = [
    { time: '12:00 PM - 01:00 PM', tag: '', isPrime: false },
    { time: '01:00 PM - 02:00 PM', tag: 'Fully Booked', isPrime: false, isBooked: true },
    { time: '02:00 PM - 03:00 PM', tag: 'High Demand', isPrime: false },
    { time: '04:00 PM - 05:00 PM', tag: 'Almost Full', isPrime: false },
  ];
  const eveningSlots: SlotItem[] = [
    { time: '05:00 PM - 06:00 PM', tag: 'Only 2 left', isPrime: true },
    { time: '06:00 PM - 07:00 PM', tag: 'High Demand', isPrime: true },
    { time: '07:00 PM - 08:00 PM', tag: 'Almost Full', isPrime: false },
    { time: '08:00 PM - 09:00 PM', tag: 'Fully Booked', isPrime: false, isBooked: true },
  ];
  const nightSlots: SlotItem[] = [
    { time: '09:00 PM - 10:00 PM', tag: 'Only 1 left', isPrime: false },
    { time: '10:00 PM - 11:00 PM', tag: '', isPrime: false },
  ];

  const getSlotsForPeriod = () => {
    if (timePeriod === 'morning') return morningSlots;
    if (timePeriod === 'afternoon') return afternoonSlots;
    if (timePeriod === 'evening') return eveningSlots;
    return nightSlots;
  };

  const isTimeSlotPassed = (timeSlotStr: string, dateStr: string) => {
    const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (dateStr !== todayStr) {
      return false;
    }

    const startTimePart = timeSlotStr.split(' - ')[0]; // e.g. "06:00 AM"
    const [timeVal, modifier] = startTimePart.split(' '); // ["06:00", "AM"]
    let [hours, minutes] = timeVal.split(':').map(Number);

    if (modifier === 'PM' && hours < 12) {
      hours += 12;
    }
    if (modifier === 'AM' && hours === 12) {
      hours = 0;
    }

    const slotDateTime = new Date();
    slotDateTime.setHours(hours, minutes, 0, 0);

    const now = new Date();
    return slotDateTime.getTime() <= now.getTime();
  };

  const getFilteredSlotsForPeriod = () => {
    const rawSlots = getSlotsForPeriod();
    const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (selectedDate === todayStr) {
      return rawSlots.filter(slot => !isTimeSlotPassed(slot.time, selectedDate));
    }
    return rawSlots;
  };

  const renderBadge = (slotObj: any) => {
    if (slotObj.isBooked) {
      return (
        <View className="bg-zinc-100 border border-zinc-200 px-2.5 py-1 rounded-full flex-row items-center gap-1">
          <Text className="text-zinc-500 text-[9px] font-black uppercase tracking-wider">⛔ Fully Booked</Text>
        </View>
      );
    }
    if (slotObj.tag === 'High Demand') {
      return (
        <View className="bg-red-50 border border-red-100 px-2.5 py-1 rounded-full flex-row items-center gap-1">
          <Text className="text-red-500 text-[9px] font-black uppercase tracking-wider">🔥 High Demand</Text>
        </View>
      );
    }
    if (slotObj.tag === 'Almost Full' || slotObj.tag === 'Only 2 left' || slotObj.tag === 'Only 1 left') {
      return (
        <View className="bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full flex-row items-center gap-1">
          <Text className="text-amber-600 text-[9px] font-black uppercase tracking-wider">⚠ Only 2 Left</Text>
        </View>
      );
    }
    if (slotObj.isPrime) {
      return (
        <View className="bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full flex-row items-center gap-1">
          <Text className="text-indigo-600 text-[9px] font-black uppercase tracking-wider">⭐ Prime Time</Text>
        </View>
      );
    }
    return null;
  };

  const getWorkoutImage = (id: string) => {
    switch (id) {
      case 'exp-strength':
        return 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80';
      case 'exp-flow':
        return 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80';
      case 'exp-rhythm':
        return 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80';
      case 'exp-reset':
        return 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=800&q=80';
      case 'exp-combat':
        return 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=800&q=80';
      default:
        return 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80';
    }
  };

  const getFormattedDateLabel = () => {
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    if (selectedDate === todayStr) {
      return `Today, ${selectedDate}`;
    } else if (selectedDate === tomorrowStr) {
      return `Tomorrow, ${selectedDate}`;
    }
    return selectedDate;
  };

  const handleChipPress = (chip: string) => {
    if (chip === 'Other') {
      noteInputRef.current?.focus();
      return;
    }
    setTrainerNote((prev) => {
      const trimmed = prev.trim();
      if (prev.includes(chip)) {
        const regex = new RegExp(`\\s*${chip},?\\s*|\\s*,?\\s*${chip}`, 'g');
        let next = prev.replace(regex, '').trim();
        next = next.replace(/,\s*,/g, ',').replace(/^,|,$/g, '').trim();
        return next;
      } else {
        if (trimmed.length === 0) {
          return chip;
        }
        const suffix = `, ${chip}`;
        if (trimmed.length + suffix.length <= 250) {
          return `${trimmed}${suffix}`;
        }
        return prev;
      }
    });
  };

  console.log('[DEBUG-BOOKING] Render start. step:', step, 'trainerPref:', trainerPref, 'selectedAddressId:', selectedAddressId, 'addressesCount:', addresses.length);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F8FC' }}>
      {/* Header back button */}
      <View className={`border-b border-[#E5E7EB] bg-white ${step === 6 ? 'py-3 px-6 flex-row items-center justify-between' : 'h-14 flex-row items-center px-6'}`}>
        {step < 7 ? (
          <TouchableOpacity onPress={handleBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} className="w-8 h-8 items-center justify-center">
            <Ionicons name="arrow-back" size={20} color="#101828" />
          </TouchableOpacity>
        ) : (
          <View className="w-8" />
        )}
        {step === 6 ? (
          <View className="flex-1 items-center mr-8">
            <Text className="text-[#101828] text-base font-black tracking-tight">Review & Confirm Booking</Text>
            <Text className="text-[#6B7280] text-[9px] font-semibold mt-0.5">Please review your session details before confirming</Text>
          </View>
        ) : (
          <Text className="flex-1 text-center text-[#101828] text-sm font-black uppercase tracking-wider mr-8">
            {step <= 5 ? `Step ${step} of 5` : 'Success'}
          </Text>
        )}
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={{ flex: 1, backgroundColor: '#F7F8FC' }}>
          {step <= 7 ? (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
            <View className="gap-6">
              
              {/* STEP 1: EXPERIENCE SELECTOR */}
              {step === 1 && (console.log('[DEBUG-BOOKING] Rendering step 1 block'), true) && (
                <View className="gap-5">
                  <View>
                    <Text className="text-[#6B7280] text-[10px] font-black uppercase tracking-widest">Training Experience</Text>
                    <Text className="text-[#101828] text-2xl font-black tracking-tight mt-1">Choose Workout Experience</Text>
                  </View>

                  <View className="gap-4">
                    {EXPERIENCES.map((exp) => {
                      const isSelected = selectedExperience.id === exp.id;
                      return (
                        <TouchableOpacity
                          key={exp.id}
                          activeOpacity={0.9}
                          onPress={() => {
                            setSelectedExperience(exp);
                            setTimeout(() => triggerTransition(2), 250);
                          }}
                          className={`p-5 rounded-[28px] border flex-row items-center justify-between ${
                            isSelected 
                              ? 'bg-zinc-950 border-zinc-950' 
                              : 'bg-white border-[#E5E7EB]'
                          }`}
                          style={{
                            shadowColor: '#101828',
                            shadowOffset: { width: 0, height: isSelected ? 4 : 1 },
                            shadowOpacity: isSelected ? 0.08 : 0.02,
                            shadowRadius: isSelected ? 8 : 2,
                            elevation: isSelected ? 3 : 1,
                          }}
                        >
                          <View className="flex-row items-center gap-4 flex-1">
                            <View 
                              style={{ 
                                backgroundColor: exp.gradientColors[0],
                                shadowColor: '#101828',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.02,
                                shadowRadius: 2,
                                elevation: 1,
                              }} 
                              className="w-12 h-12 rounded-2xl items-center justify-center"
                            >
                              <Text className="text-xl">{exp.emoji}</Text>
                            </View>
                            <View className="flex-1">
                              <Text className={`text-sm font-black tracking-tight ${isSelected ? 'text-white' : 'text-[#101828]'}`}>
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
              {step === 2 && (console.log('[DEBUG-BOOKING] Rendering step 2 block'), true) && (
                <View className="gap-5">
                  <View>
                    <Text className="text-[#6B7280] text-[10px] font-black uppercase tracking-widest">Concierge Match</Text>
                    <Text className="text-[#101828] text-2xl font-black tracking-tight mt-1">Trainer Preference</Text>
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
                            console.log("Male/Female preference pressed: " + pref.id);
                          }}
                          className={`w-[47%] p-5 rounded-[24px] border items-center justify-center gap-2.5 ${
                            isSelected ? 'bg-zinc-950 border-zinc-950' : 'bg-white border-[#E5E7EB]'
                          }`}
                          style={{
                            shadowColor: '#101828',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.02,
                            shadowRadius: 2,
                            elevation: 1,
                          }}
                        >
                          <Feather name={pref.icon as any} size={20} color={isSelected ? '#F59E0B' : '#6B7280'} />
                          <View className="items-center">
                            <Text className={`text-xs font-black tracking-tight text-center ${isSelected ? 'text-white' : 'text-[#101828]'}`}>
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
                      <Text className="text-[#101828] text-xs font-black uppercase tracking-wider pl-1">Select Favorite Coach</Text>
                      {coaches.filter(c => c.isFavourite).length > 0 ? (
                        coaches.filter(c => c.isFavourite).map((coach) => {
                          const isSelected = selectedTrainerId === coach.id;
                          return (
                            <TouchableOpacity
                              key={coach.id}
                              activeOpacity={0.8}
                              onPress={() => {
                                setSelectedTrainerId(coach.id);
                                setTimeout(() => triggerTransition(3), 250);
                              }}
                              className={`p-4 rounded-2xl border flex-row items-center justify-between ${
                                isSelected ? 'bg-indigo-50/50 border-indigo-500' : 'bg-white border-[#E5E7EB]'
                              }`}
                            >
                              <View className="flex-row items-center gap-3">
                                <Image source={{ uri: coach.photo }} className="w-10 h-10 rounded-full" />
                                <View>
                                  <Text className="text-[#101828] text-xs font-black">{coach.name}</Text>
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
              {step === 3 && (console.log('[DEBUG-BOOKING] Rendering step 3 block'), true) && (
                <View className="gap-5">
                  <View>
                    <Text className="text-[#6B7280] text-[10px] font-black uppercase tracking-widest">Training Venue</Text>
                    <Text className="text-[#101828] text-2xl font-black tracking-tight mt-1">Select Training Location</Text>
                    <Text className="text-zinc-500 text-xs font-semibold mt-1">
                      Choose where your VIRLA Wellness Coach should visit.
                    </Text>
                  </View>

                  {/* Saved Locations List */}
                  <View className="gap-3.5">
                    {addresses.map((addr) => {
                      const isSelected = selectedAddressId === addr.id;
                      // Display dynamic mock ETA/distance for address cards context
                      let cardEta = '12–15 mins';
                      if (addr.building.toLowerCase().includes('worli')) cardEta = '18–22 mins';
                      if (addr.building.toLowerCase().includes('juhu')) cardEta = '15–18 mins';
                      if (addr.building.toLowerCase().includes('bandra')) cardEta = '10–12 mins';

                      return (
                        <TouchableOpacity
                          key={addr.id}
                          activeOpacity={0.9}
                          onPress={() => {
                            setSelectedAddressId(addr.id);
                            // Auto transition to step 4 on card tap after small delay
                            setTimeout(() => triggerTransition(4), 300);
                          }}
                          className={`p-5 rounded-[24px] border flex-row items-center justify-between transition-all ${
                            isSelected 
                              ? 'bg-white border-[#E11D48]' 
                              : 'bg-white border-[#E5E7EB]'
                          }`}
                          style={{
                            shadowColor: isSelected ? '#E11D48' : '#101828',
                            shadowOffset: { width: 0, height: isSelected ? 6 : 2 },
                            shadowOpacity: isSelected ? 0.08 : 0.03,
                            shadowRadius: isSelected ? 12 : 6,
                            elevation: isSelected ? 4 : 2,
                          }}
                        >
                          <View className="flex-row items-center gap-4 flex-1">
                            <View className={`w-11 h-11 rounded-2xl items-center justify-center ${isSelected ? 'bg-rose-50' : 'bg-zinc-50'}`}>
                              <Text className="text-xl">
                                {addr.label === 'Home' ? '🏠' : addr.label === 'Office' ? '🏢' : addr.label === 'Gym' ? '🏋️' : '📍'}
                              </Text>
                            </View>
                            <View className="flex-1 gap-1">
                              <View className="flex-row items-center gap-2">
                                <Text className="text-[#101828] text-sm font-black">{addr.label}</Text>
                                {addr.isDefault && (
                                  <View className="bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-full">
                                    <Text className="text-[#6B7280] text-[8px] font-black uppercase tracking-wider">Default</Text>
                                  </View>
                                )}
                                {isSelected && (
                                  <View className="bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">
                                    <Text className="text-[#E11D48] text-[8px] font-black uppercase tracking-wider">Selected</Text>
                                  </View>
                                )}
                              </View>
                              <Text className="text-[#6B7280] text-xs font-semibold leading-relaxed">
                                {addr.addressLine}
                              </Text>
                              <View className="flex-row items-center gap-4 mt-1">
                                <Text className="text-green-600 text-[10px] font-bold">✓ Covered</Text>
                                <Text className="text-zinc-400 text-[10px] font-medium">• Est. arrival: {cardEta}</Text>
                              </View>
                            </View>
                          </View>

                          <View className="ml-2">
                            {isSelected ? (
                              <View className="w-6 h-6 rounded-full bg-[#E11D48] items-center justify-center">
                                <Feather name="check" size={14} color="white" />
                              </View>
                            ) : (
                              <View className="w-6 h-6 rounded-full border border-zinc-200 bg-zinc-50" />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}

                    {addresses.length === 0 && (
                      <View className="p-8 rounded-[24px] border border-dashed border-[#CBD5E1] bg-white items-center justify-center gap-2">
                        <Text className="text-3xl">📍</Text>
                        <Text className="text-[#101828] text-sm font-bold">No Saved Addresses</Text>
                        <Text className="text-zinc-500 text-xs text-center">Add a training location to begin booking.</Text>
                      </View>
                    )}

                    {/* Add New Address Trigger */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        setAddAddressStep(1);
                        setNewHouseNo('');
                        setNewBuildingName('');
                        setNewFloor('');
                        setNewLandmark('');
                        setNewAddressLabelType('Home');
                        setNewCustomLabel('');
                        setSearchQuery('');
                        setIsAddAddressModalVisible(true);
                      }}
                      className="p-5 rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] flex-row items-center justify-center gap-2"
                    >
                      <Feather name="plus" size={16} color="#475569" />
                      <Text className="text-[#475569] text-xs font-black uppercase tracking-wider">Add New Address</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Compact Service Availability card */}
                  {selectedAddressId ? (
                    !isLocationOutsideCoverage ? (
                      <View className="bg-emerald-50 border border-emerald-100 p-5 rounded-[24px] flex-row items-center gap-4">
                        <View className="w-10 h-10 rounded-full bg-emerald-100 items-center justify-center">
                          <Feather name="check-circle" size={20} color="#059669" />
                        </View>
                        <View className="flex-1 gap-0.5">
                          <Text className="text-emerald-800 text-xs font-black uppercase tracking-wider">🟢 Service Available</Text>
                          <Text className="text-emerald-700 text-xs font-semibold">Your location is within the VIRLA service area.</Text>
                          
                          <View className="flex-row gap-6 mt-2">
                            <View>
                              <Text className="text-zinc-500 text-[8px] font-bold uppercase">Estimated Trainer Arrival</Text>
                              <Text className="text-zinc-900 text-xs font-extrabold">{etaText}</Text>
                            </View>
                            <View>
                              <Text className="text-zinc-500 text-[8px] font-bold uppercase">Coverage Status</Text>
                              <Text className="text-zinc-900 text-xs font-extrabold">Available</Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View className="bg-red-50 border border-red-150 p-5 rounded-[24px] gap-3">
                        <View className="flex-row items-center gap-3">
                          <View className="w-10 h-10 rounded-full bg-red-100 items-center justify-center">
                            <Feather name="alert-triangle" size={20} color="#DC2626" />
                          </View>
                          <View className="flex-1">
                            <Text className="text-red-800 text-xs font-black uppercase tracking-wider">⚠️ Outside Service Area</Text>
                            <Text className="text-red-700 text-xs font-semibold">Sorry, VIRLA is not yet available in this area.</Text>
                          </View>
                        </View>
                        <Text className="text-zinc-500 text-xs leading-relaxed pl-1">
                          Join our waitlist and we&apos;ll notify you when we launch here.
                        </Text>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => Alert.alert('Waitlist Joined', 'Thank you! We will notify you as soon as VIRLA launches in your area.')}
                          className="bg-red-600 h-11 rounded-xl items-center justify-center self-start px-6"
                        >
                          <Text className="text-white text-xs font-black uppercase tracking-wider">Notify Me</Text>
                        </TouchableOpacity>
                      </View>
                    )
                  ) : null}

                  {/* Optional View on Map link */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setIsMapModalVisible(true)}
                    className="flex-row items-center justify-center gap-1.5 py-1.5"
                  >
                    <Feather name="map-pin" size={14} color="#E11D48" />
                    <Text className="text-[#E11D48] text-xs font-black uppercase tracking-wider">View on Map</Text>
                  </TouchableOpacity>

                  {/* FULL-SCREEN VIEW ON MAP MODAL */}
                  <Modal
                    visible={isMapModalVisible}
                    animationType="slide"
                    onRequestClose={() => setIsMapModalVisible(false)}
                  >
                    <SafeAreaView className="flex-1 bg-[#F7F8FC]">
                      {/* Header */}
                      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white">
                        <TouchableOpacity onPress={() => setIsMapModalVisible(false)} className="w-8 h-8 items-center justify-center">
                          <Ionicons name="arrow-back" size={20} color="#101828" />
                        </TouchableOpacity>
                        <Text className="flex-1 text-center text-[#101828] text-sm font-black uppercase tracking-wider mr-8">
                          Confirm Location
                        </Text>
                      </View>

                      <View className="flex-1 relative">
                        {/* Simulated Map View */}
                        <View className="flex-1 bg-sky-100/50 relative overflow-hidden items-center justify-center">
                          <Svg width="100%" height="100%" className="absolute">
                            <Line x1="15%" y1="0%" x2="15%" y2="100%" stroke="#BAE6FD" strokeWidth={1} strokeDasharray="6 6" />
                            <Line x1="50%" y1="0%" x2="50%" y2="100%" stroke="#BAE6FD" strokeWidth={2} />
                            <Line x1="85%" y1="0%" x2="85%" y2="100%" stroke="#BAE6FD" strokeWidth={1} strokeDasharray="6 6" />
                            <Line x1="0%" y1="25%" x2="100%" y2="25%" stroke="#BAE6FD" strokeWidth={1} strokeDasharray="6 6" />
                            <Line x1="0%" y1="60%" x2="100%" y2="60%" stroke="#BAE6FD" strokeWidth={2} />
                            <Line x1="0%" y1="85%" x2="100%" y2="85%" stroke="#BAE6FD" strokeWidth={1} strokeDasharray="6 6" />

                            <Circle cx="180" cy="200" r="140" stroke="#3B82F6" strokeWidth={1} fill="#93C5FD" fillOpacity="0.05" strokeDasharray="4 4" />
                          </Svg>

                          <Text style={{ position: 'absolute', left: 30, top: 40, color: '#93C5FD', fontSize: 10, fontWeight: 'bold' }}>JUHU BEACH</Text>
                          <Text style={{ position: 'absolute', left: 30, top: 230, color: '#93C5FD', fontSize: 10, fontWeight: 'bold' }}>BANDRA ROAD</Text>
                          <Text style={{ position: 'absolute', left: 280, top: 170, color: '#93C5FD', fontSize: 10, fontWeight: 'bold' }}>WORLI NAKA</Text>

                          <View 
                            className={`w-12 h-12 rounded-full ${
                              isLocationOutsideCoverage ? 'bg-red-500' : 'bg-indigo-600'
                            } border-4 border-white items-center justify-center relative z-20`}
                            style={{
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 6 },
                              shadowOpacity: 0.35,
                              shadowRadius: 10,
                              elevation: 6,
                            }}
                          >
                            <Feather name={isLocationOutsideCoverage ? 'alert-triangle' : 'map-pin'} size={18} color="white" />
                          </View>
                          <Text className="text-[10px] font-bold text-zinc-500 bg-white/90 border border-zinc-200 px-3 py-1 rounded-full absolute bottom-24 z-20">
                            {isLocationOutsideCoverage ? '⛔ Outside Coverage Area' : '📍 Target Pin Position'}
                          </Text>
                        </View>

                        {/* Search overlay */}
                        <View className="absolute top-4 left-6 right-6 z-35">
                          <View 
                            className="flex-row items-center bg-white border border-[#E5E7EB] px-4 py-2 rounded-2xl"
                            style={{
                              shadowColor: '#101828',
                              shadowOffset: { width: 0, height: 4 },
                              shadowOpacity: 0.08,
                              shadowRadius: 12,
                              elevation: 4,
                            }}
                          >
                            <Feather name="search" size={16} color="#6B7280" />
                            <TextInput
                              placeholder="Search custom address..."
                              placeholderTextColor="#9CA3AF"
                              value={searchQuery}
                              onChangeText={(t) => {
                                setSearchQuery(t);
                                setShowSearchDropdown(true);
                              }}
                              className="flex-1 text-xs font-semibold text-zinc-900 ml-2.5 py-1.5"
                            />
                            {searchQuery.length > 0 && (
                              <TouchableOpacity onPress={() => { setSearchQuery(''); setShowSearchDropdown(false); }}>
                                <Feather name="x" size={14} color="#6B7280" />
                              </TouchableOpacity>
                            )}
                          </View>

                          {showSearchDropdown && searchQuery.length > 0 && (
                            <View 
                              className="absolute top-14 left-0 right-0 bg-white border border-zinc-200 rounded-xl z-50 max-h-48 overflow-hidden"
                              style={{
                                shadowColor: '#101828',
                                shadowOffset: { width: 0, height: 6 },
                                shadowOpacity: 0.1,
                                shadowRadius: 12,
                                elevation: 6,
                              }}
                            >
                              {[
                                { name: 'Bandra West, Mumbai', desc: 'Active VIRLA service zone', out: false, coords: { lat: 19.0596, lng: 72.8295 }, eta: '~12 mins', dist: '3.2 km' },
                                { name: 'Juhu Scheme, Mumbai', desc: 'Active VIRLA service zone', out: false, coords: { lat: 19.1076, lng: 72.8264 }, eta: '~18 mins', dist: '6.5 km' },
                                { name: 'Worli Naka, Mumbai', desc: 'Active VIRLA service zone', out: false, coords: { lat: 18.9986, lng: 72.8174 }, eta: '~20 mins', dist: '8.4 km' },
                                { name: 'Pune Central Station', desc: 'Outside active service zone', out: true, coords: { lat: 18.5204, lng: 73.8567 }, eta: 'N/A', dist: '150 km' },
                                { name: 'Connaught Place, Delhi', desc: 'Outside active service zone', out: true, coords: { lat: 28.6304, lng: 77.2177 }, eta: 'N/A', dist: '1400 km' }
                              ]
                                .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                .map((item, idx) => (
                                  <TouchableOpacity
                                    key={idx}
                                    onPress={() => {
                                      if (networkFailure) {
                                        Alert.alert('Network Error', 'Network Connection Timeout. Please check your internet connection.');
                                        return;
                                      }
                                      setSearchQuery(item.name);
                                      setShowSearchDropdown(false);
                                      setIsLocationOutsideCoverage(item.out);
                                      setEtaText(item.eta);
                                      setDistanceText(item.dist);
                                      setActiveCoords(item.coords);

                                      if (item.out) {
                                        Alert.alert('Outside Coverage Area', 'This address lies outside the active VIRLA service zone.');
                                      } else {
                                        addAddress({
                                          label: 'Custom' as any,
                                          building: item.name,
                                          street: '',
                                          landmark: '',
                                          city: 'Mumbai',
                                          pinCode: '',
                                          isDefault: false,
                                          lat: item.coords.lat,
                                          lng: item.coords.lng,
                                          apartment: '',
                                          floor: '',
                                          notes: ''
                                        });
                                      }
                                    }}
                                    className="p-3.5 border-b border-zinc-100 flex-row justify-between items-center bg-white"
                                  >
                                    <View className="flex-1 pr-2">
                                      <Text className="text-zinc-900 text-xs font-bold">{item.name}</Text>
                                      <Text className="text-zinc-400 text-[8px] font-semibold">{item.desc}</Text>
                                    </View>
                                    <Feather name="arrow-up-left" size={14} color="#9CA3AF" />
                                  </TouchableOpacity>
                                ))
                              }
                            </View>
                          )}
                        </View>

                        {/* GPS Action button */}
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => {
                            if (gpsSignalFailure) {
                              Alert.alert('GPS Signal Failure', 'Weak GPS Signal: Satellites not reachable. Try moving outside or confirm address.');
                              return;
                            }
                            setGpsPermission('granted');
                            setIsLocationOutsideCoverage(false);
                            setEtaText('~18 mins travel');
                            setDistanceText('6.5 km');
                            setActiveCoords({ lat: 19.1076, lng: 72.8264 });
                            addAddress({
                              label: 'Custom' as any,
                              building: 'Juhu Beach, Mumbai, Maharashtra 400049',
                              street: '',
                              landmark: '',
                              city: 'Mumbai',
                              pinCode: '400049',
                              isDefault: false,
                              lat: 19.1076,
                              lng: 72.8264,
                              apartment: '',
                              floor: '',
                              notes: ''
                            });
                            Alert.alert('GPS Located', 'Positioned at Juhu Scheme. Set as active selection.');
                          }}
                          className="absolute bottom-28 right-6 w-11 h-11 bg-white border border-[#E5E7EB] rounded-full items-center justify-center"
                          style={{
                            shadowColor: '#101828',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.08,
                            shadowRadius: 10,
                            elevation: 4,
                          }}
                        >
                          <Feather name="navigation" size={18} color="#3B82F6" />
                        </TouchableOpacity>

                        {/* Footer Confirmation */}
                        <View className="p-6 bg-white border-t border-[#E5E7EB] gap-3">
                          <View className="flex-row justify-between items-center px-1">
                            <Text className="text-zinc-500 text-[10px] font-black uppercase">Active Coordinates</Text>
                            <Text className="text-zinc-900 text-xs font-extrabold">{activeCoords.lat.toFixed(4)}° N, {activeCoords.lng.toFixed(4)}° E</Text>
                          </View>
                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setIsMapModalVisible(false)}
                            className="w-full h-14 bg-zinc-950 rounded-2xl items-center justify-center shadow-md"
                          >
                            <Text className="text-white text-xs font-black uppercase tracking-wider">Confirm location</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </SafeAreaView>
                  </Modal>

                  {/* FULL-SCREEN ADD NEW ADDRESS FLOW */}
                  <Modal
                    visible={isAddAddressModalVisible}
                    animationType="slide"
                    onRequestClose={() => setIsAddAddressModalVisible(false)}
                  >
                    <SafeAreaView className="flex-1 bg-[#F7F8FC]">
                      {/* Header */}
                      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white">
                        <TouchableOpacity 
                          onPress={() => {
                            if (addAddressStep > 1) {
                              setAddAddressStep((prev) => (prev - 1) as any);
                            } else {
                              setIsAddAddressModalVisible(false);
                            }
                          }} 
                          className="w-8 h-8 items-center justify-center"
                        >
                          <Ionicons name="arrow-back" size={20} color="#101828" />
                        </TouchableOpacity>
                        <Text className="flex-1 text-center text-[#101828] text-sm font-black uppercase tracking-wider mr-8">
                          Add New Address
                        </Text>
                      </View>

                      {/* Wizard Progress Line */}
                      <View className="bg-white border-b border-zinc-150 py-3 flex-row justify-around px-6">
                        {[
                          { num: 1, label: 'Search' },
                          { num: 2, label: 'Confirm' },
                          { num: 3, label: 'Details' }
                        ].map((s) => {
                          const isActive = addAddressStep === s.num;
                          const isPast = addAddressStep > s.num;
                          return (
                            <View key={s.num} className="flex-row items-center gap-1.5">
                              <View className={`w-5 h-5 rounded-full items-center justify-center ${
                                isActive ? 'bg-[#E11D48]' : isPast ? 'bg-zinc-800' : 'bg-zinc-200'
                              }`}>
                                {isPast ? (
                                  <Feather name="check" size={10} color="white" />
                                ) : (
                                  <Text className="text-white text-[10px] font-black">{s.num}</Text>
                                )}
                              </View>
                              <Text className={`text-[10px] font-black uppercase tracking-wider ${
                                isActive ? 'text-[#E11D48]' : 'text-zinc-500'
                              }`}>{s.label}</Text>
                            </View>
                          );
                        })}
                      </View>

                      <View className="flex-1 bg-[#F7F8FC]">
                        {/* STEP 1: SEARCH OR GPS */}
                        {addAddressStep === 1 && (
                          <View className="p-6 gap-6 flex-1">
                            <View>
                              <Text className="text-[#6B7280] text-[10px] font-black uppercase tracking-widest">Step 1 of 3</Text>
                              <Text className="text-[#101828] text-xl font-black tracking-tight mt-1">Locate Your Address</Text>
                            </View>

                            {/* GPS current location button */}
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={() => {
                                if (gpsSignalFailure) {
                                  Alert.alert('GPS Jammed', 'Simulated Weak GPS Signal. Try manual address search.');
                                  return;
                                }
                                setGpsPermission('granted');
                                setIsLocationOutsideCoverage(false);
                                setEtaText('~18 mins travel');
                                setDistanceText('6.5 km');
                                setActiveCoords({ lat: 19.1076, lng: 72.8264 });
                                setSearchQuery('Juhu Beach Road, Mumbai, Maharashtra 400049');
                                setNewBuildingName('Juhu Beach Road');
                                setAddAddressStep(2);
                              }}
                              className="w-full h-14 bg-indigo-50 border border-indigo-150 rounded-2xl items-center justify-center flex-row gap-2.5"
                            >
                              <Feather name="navigation" size={16} color="#4F46E5" />
                              <Text className="text-[#4F46E5] text-xs font-bold uppercase tracking-wider">🛰️ Use Current GPS Location</Text>
                            </TouchableOpacity>

                            <View className="flex-row items-center gap-3">
                              <View className="flex-1 h-[1px] bg-zinc-200" />
                              <Text className="text-zinc-400 text-[9px] font-black uppercase">OR SEARCH</Text>
                              <View className="flex-1 h-[1px] bg-zinc-200" />
                            </View>

                            {/* Search query bar */}
                            <View className="gap-2 relative z-30">
                              <View className="flex-row items-center bg-white border border-[#E5E7EB] px-4 py-1.5 rounded-2xl">
                                <Feather name="search" size={16} color="#6B7280" />
                                <TextInput
                                  placeholder="Type locality (e.g. Bandra, Worli, Pune...)"
                                  placeholderTextColor="#9CA3AF"
                                  value={searchQuery}
                                  onChangeText={(t) => {
                                    setSearchQuery(t);
                                    setShowSearchDropdown(true);
                                  }}
                                  className="flex-1 text-xs font-semibold text-zinc-900 ml-2.5 py-1.5"
                                />
                              </View>

                              {/* Dropdown list of presets */}
                              {showSearchDropdown && searchQuery.length > 0 && (
                                <View 
                                  className="absolute top-14 left-0 right-0 bg-white border border-zinc-200 rounded-xl z-50 max-h-56 overflow-hidden"
                                  style={{
                                    shadowColor: '#101828',
                                    shadowOffset: { width: 0, height: 6 },
                                    shadowOpacity: 0.1,
                                    shadowRadius: 12,
                                    elevation: 6,
                                  }}
                                >
                                  {[
                                    { name: 'Bandra West, Mumbai', desc: 'Active VIRLA service zone', out: false, coords: { lat: 19.0596, lng: 72.8295 }, eta: '~12 mins', dist: '3.2 km' },
                                    { name: 'Juhu Scheme, Mumbai', desc: 'Active VIRLA service zone', out: false, coords: { lat: 19.1076, lng: 72.8264 }, eta: '~18 mins', dist: '6.5 km' },
                                    { name: 'Worli Naka, Mumbai', desc: 'Active VIRLA service zone', out: false, coords: { lat: 18.9986, lng: 72.8174 }, eta: '~20 mins', dist: '8.4 km' },
                                    { name: 'Pune Central Station', desc: 'Outside active service zone', out: true, coords: { lat: 18.5204, lng: 73.8567 }, eta: 'N/A', dist: '150 km' },
                                    { name: 'Connaught Place, Delhi', desc: 'Outside active service zone', out: true, coords: { lat: 28.6304, lng: 77.2177 }, eta: 'N/A', dist: '1400 km' }
                                  ]
                                    .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                    .map((item, idx) => (
                                      <TouchableOpacity
                                        key={idx}
                                        onPress={() => {
                                          setSearchQuery(item.name);
                                          setNewBuildingName(item.name.split(',')[0]);
                                          setShowSearchDropdown(false);
                                          setIsLocationOutsideCoverage(item.out);
                                          setEtaText(item.eta);
                                          setDistanceText(item.dist);
                                          setActiveCoords(item.coords);
                                          setAddAddressStep(2);
                                        }}
                                        className="p-4 border-b border-zinc-100 flex-row justify-between items-center bg-white"
                                      >
                                        <View className="flex-1 pr-2">
                                          <Text className="text-zinc-900 text-xs font-bold">{item.name}</Text>
                                          <Text className="text-zinc-400 text-[8px] font-semibold">{item.desc}</Text>
                                        </View>
                                        <Feather name="arrow-up-left" size={14} color="#9CA3AF" />
                                      </TouchableOpacity>
                                    ))
                                  }
                                </View>
                              )}
                            </View>
                          </View>
                        )}

                        {/* STEP 2: PIN CONFIRMATION */}
                        {addAddressStep === 2 && (
                          <View className="flex-1 relative">
                            {/* SVG simulated map */}
                            <View className="flex-1 bg-sky-100/50 relative overflow-hidden items-center justify-center">
                              <Svg width="100%" height="100%" className="absolute">
                                <Line x1="15%" y1="0%" x2="15%" y2="100%" stroke="#BAE6FD" strokeWidth={1} strokeDasharray="6 6" />
                                <Line x1="50%" y1="0%" x2="50%" y2="100%" stroke="#BAE6FD" strokeWidth={2} />
                                <Line x1="0%" y1="30%" x2="100%" y2="30%" stroke="#BAE6FD" strokeWidth={2} />
                                <Line x1="0%" y1="75%" x2="100%" y2="75%" stroke="#BAE6FD" strokeWidth={1} strokeDasharray="6 6" />
                              </Svg>

                              <View 
                                className={`w-14 h-14 rounded-full ${
                                  isLocationOutsideCoverage ? 'bg-red-500' : 'bg-[#E11D48]'
                                } border-4 border-white items-center justify-center`}
                                style={{
                                  shadowColor: '#000',
                                  shadowOffset: { width: 0, height: 6 },
                                  shadowOpacity: 0.35,
                                  shadowRadius: 10,
                                  elevation: 6,
                                }}
                              >
                                <Feather name={isLocationOutsideCoverage ? 'alert-triangle' : 'map-pin'} size={20} color="white" />
                              </View>

                              <View className="absolute bottom-28 bg-white border border-zinc-200 px-4 py-2.5 rounded-2xl items-center justify-center max-w-[85%]">
                                <Text className="text-zinc-900 text-xs font-black uppercase">Confirm Pin Location</Text>
                                <Text className="text-[#6B7280] text-[10px] font-semibold text-center mt-1 leading-relaxed">{searchQuery}</Text>
                              </View>
                            </View>

                            <View className="p-6 bg-white border-t border-[#E5E7EB]">
                              <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => setAddAddressStep(3)}
                                className="w-full h-14 bg-zinc-950 rounded-2xl items-center justify-center shadow-md"
                              >
                                <Text className="text-white text-xs font-black uppercase tracking-wider">Confirm Location Pin</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}

                        {/* STEP 3: DETAILS FORM */}
                        {addAddressStep === 3 && (
                          <ScrollView 
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
                            className="flex-1"
                          >
                            <View className="gap-6">
                              <View>
                                <Text className="text-[#6B7280] text-[10px] font-black uppercase tracking-widest">Step 3 of 3</Text>
                                <Text className="text-[#101828] text-xl font-black tracking-tight mt-1">Enter Address Details</Text>
                              </View>

                              <View className="bg-white border border-[#E5E7EB] p-5 rounded-[24px] gap-4">
                                <View className="flex-row items-center gap-2">
                                  <Feather name="map-pin" size={14} color="#6B7280" />
                                  <Text className="text-zinc-900 text-xs font-bold uppercase">{newBuildingName || 'Selected Locality'}</Text>
                                </View>

                                <View className="gap-3.5">
                                  <TextInput
                                    value={newHouseNo}
                                    onChangeText={setNewHouseNo}
                                    placeholder="Flat / House No (e.g. Flat 501)"
                                    placeholderTextColor="#9CA3AF"
                                    className="border border-[#E5E7EB] p-3.5 rounded-xl text-xs font-semibold bg-zinc-50"
                                  />
                                  <TextInput
                                    value={newBuildingName}
                                    onChangeText={setNewBuildingName}
                                    placeholder="Building / Society Name (e.g. Oberoi Springs)"
                                    placeholderTextColor="#9CA3AF"
                                    className="border border-[#E5E7EB] p-3.5 rounded-xl text-xs font-semibold bg-zinc-50"
                                  />
                                  <TextInput
                                    value={newFloor}
                                    onChangeText={setNewFloor}
                                    placeholder="Floor / Wing (e.g. 5th Floor, A Wing)"
                                    placeholderTextColor="#9CA3AF"
                                    className="border border-[#E5E7EB] p-3.5 rounded-xl text-xs font-semibold bg-zinc-50"
                                  />
                                  <TextInput
                                    value={newLandmark}
                                    onChangeText={setNewLandmark}
                                    placeholder="Landmark (e.g. Next to Citi Mall)"
                                    placeholderTextColor="#9CA3AF"
                                    className="border border-[#E5E7EB] p-3.5 rounded-xl text-xs font-semibold bg-zinc-50"
                                  />
                                </View>
                              </View>

                              {/* Label selection */}
                              <View className="gap-2.5">
                                <Text className="text-[#101828] text-xs font-black uppercase tracking-wider pl-1">Save As</Text>
                                <View className="flex-row justify-between">
                                  {[
                                    { id: 'Home', emoji: '🏠' },
                                    { id: 'Office', emoji: '🏢' },
                                    { id: 'Gym', emoji: '🏋️' },
                                    { id: 'Custom', emoji: '📍' }
                                  ].map((item) => {
                                    const isSel = newAddressLabelType === item.id;
                                    return (
                                      <TouchableOpacity
                                        key={item.id}
                                        activeOpacity={0.8}
                                        onPress={() => setNewAddressLabelType(item.id as any)}
                                        className={`w-[22%] py-3.5 rounded-xl border items-center justify-center flex-row gap-1 ${
                                          isSel ? 'bg-zinc-950 border-zinc-950' : 'bg-white border-[#E5E7EB]'
                                        }`}
                                      >
                                        <Text className="text-xs">{item.emoji}</Text>
                                        <Text className={`text-[9px] font-black uppercase ${isSel ? 'text-white' : 'text-zinc-800'}`}>{item.id}</Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>

                                {newAddressLabelType === 'Custom' && (
                                  <TextInput
                                    value={newCustomLabel}
                                    onChangeText={setNewCustomLabel}
                                    placeholder="Custom label (e.g. Parents, Guest)"
                                    placeholderTextColor="#9CA3AF"
                                    className="border border-[#E5E7EB] p-3.5 rounded-xl text-xs font-semibold bg-zinc-50 mt-2"
                                  />
                                )}
                              </View>

                              {/* Save Address Button */}
                              <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => {
                                  if (!newHouseNo.trim() || !newBuildingName.trim()) {
                                    Alert.alert('Missing Info', 'Please enter Flat/House No and Building Name.');
                                    return;
                                  }

                                  if (isLocationOutsideCoverage) {
                                    Alert.alert('Outside Area', 'Sorry, VIRLA currently only serves Mumbai. Address cannot be verified for coverage.');
                                    return;
                                  }

                                  const finalLabel = newAddressLabelType === 'Custom'
                                    ? (newCustomLabel.trim() || 'Custom') as any
                                    : newAddressLabelType;

                                  const fullBuilding = `${newHouseNo.trim()}, ${newBuildingName.trim()}`;
                                  const fullStreet = [newFloor.trim() ? `${newFloor.trim()}` : '', newLandmark.trim()].filter(Boolean).join(', ');

                                  addAddress({
                                    label: finalLabel,
                                    building: fullBuilding,
                                    street: fullStreet,
                                    landmark: newLandmark.trim(),
                                    city: 'Mumbai',
                                    pinCode: '',
                                    isDefault: false,
                                    lat: activeCoords.lat,
                                    lng: activeCoords.lng,
                                    apartment: '',
                                    floor: newFloor.trim(),
                                    notes: ''
                                  });

                                  // Retrieve newly created ID to select it
                                  setTimeout(() => {
                                    const updatedList = useAddressStore.getState().addresses;
                                    const matched = updatedList.find(a => a.building === fullBuilding);
                                    if (matched) {
                                      setSelectedAddressId(matched.id);
                                    }
                                  }, 150);

                                  setIsAddAddressModalVisible(false);
                                  Alert.alert('Address Saved', 'New training venue has been saved and selected.');
                                }}
                                className="w-full h-14 bg-[#E11D48] rounded-2xl items-center justify-center mt-2"
                              >
                                <Text className="text-white text-xs font-black uppercase tracking-wider">Save Training Location</Text>
                              </TouchableOpacity>
                            </View>
                          </ScrollView>
                        )}
                      </View>
                    </SafeAreaView>
                  </Modal>
                </View>
              )}

              {/* STEP 4: DATE SELECTOR */}
              {step === 4 && (
                <View className="gap-5">
                  <View>
                    <Text className="text-[#6B7280] text-[10px] font-black uppercase tracking-widest">Schedule Day</Text>
                    <Text className="text-[#101828] text-2xl font-black tracking-tight mt-1">Select Date</Text>
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
                          onPress={() => {
                            setDateSelectionType(capsule.id as any);
                            if (capsule.id !== 'calendar') {
                              setTimeout(() => triggerTransition(5), 250);
                            }
                          }}
                          className={`flex-1 p-3.5 rounded-2xl border items-center justify-center gap-1 ${
                            isSelected ? 'bg-zinc-950 border-zinc-950' : 'bg-white border-[#E5E7EB]'
                          }`}
                          style={{
                            shadowColor: '#101828',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.02,
                            shadowRadius: 2,
                            elevation: 1,
                          }}
                        >
                          <Text className={`text-[10px] font-black uppercase tracking-wider ${isSelected ? 'text-white' : 'text-[#101828]'}`}>
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
                    <View 
                      className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] gap-4"
                      style={{
                        shadowColor: '#101828',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.04,
                        shadowRadius: 6,
                        elevation: 2,
                      }}
                    >
                      <Text className="text-[#101828] text-xs font-black uppercase tracking-wider text-center">Select Available Date</Text>
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
                              onPress={() => {
                                setSelectedDate(dateString);
                                setTimeout(() => triggerTransition(5), 250);
                              }}
                              className={`w-[22%] py-3 rounded-xl border items-center justify-center ${
                                isPicked ? 'bg-[#101828] border-[#101828]' : 'bg-white border-[#E5E7EB]'
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
                      <Text className="text-[#101828] text-xs font-black uppercase tracking-wider">Selected Date</Text>
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
                    <Text className="text-[#101828] text-2xl font-black tracking-tight mt-1">Select Time Slot</Text>
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
                            isActive ? 'bg-[#101828]' : ''
                          }`}
                          style={isActive ? {
                            shadowColor: '#101828',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.08,
                            shadowRadius: 4,
                            elevation: 2,
                          } : undefined}
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
                    {getFilteredSlotsForPeriod().map((slotObj, idx) => {
                      const isPicked = selectedTime === slotObj.time;
                      const isDisabled = !!slotObj.isBooked;

                      return (
                        <TouchableOpacity
                          key={idx}
                          disabled={isDisabled}
                          activeOpacity={isDisabled ? 1 : 0.8}
                          onPress={() => {
                            setSelectedTime(slotObj.time);
                            setTimeout(() => handleNext(), 250);
                          }}
                          style={{
                            height: 76,
                            shadowColor: '#101828',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: isPicked ? 0.15 : 0.04,
                            shadowRadius: 6,
                            elevation: 2,
                          }}
                          className={`px-5 rounded-[20px] border flex-row justify-between items-center ${
                            isDisabled
                              ? 'bg-zinc-100 border-zinc-200 opacity-60'
                              : isPicked
                              ? 'bg-[#E11D48] border-[#E11D48]'
                              : 'bg-white border-[#E5E7EB]'
                          }`}
                        >
                          <View className="flex-row items-center gap-3.5">
                            <Feather 
                              name="clock" 
                              size={15} 
                              color={isDisabled ? '#9CA3AF' : isPicked ? 'white' : '#101828'} 
                            />
                            <View className="gap-0.5">
                              <Text 
                                className={`text-xs font-black tracking-tight ${
                                  isDisabled ? 'text-zinc-400 line-through' : isPicked ? 'text-white' : 'text-zinc-900'
                                }`}
                              >
                                {slotObj.time}
                              </Text>
                              <Text className={`text-[8px] font-bold ${isPicked ? 'text-rose-200' : 'text-[#6B7280]'}`}>
                                {isDisabled ? 'UNAVAILABLE' : 'AVAILABLE SLOT'}
                              </Text>
                            </View>
                          </View>
                          
                          {/* Right badge or checkmark indicator */}
                          <View className="flex-row items-center gap-2">
                            {renderBadge(slotObj)}
                            {isPicked ? (
                              <View className="w-5 h-5 rounded-full bg-white items-center justify-center">
                                <Feather name="check" size={12} color="#E11D48" />
                              </View>
                            ) : isDisabled ? (
                              <Text className="text-zinc-400 text-[9px] font-black uppercase tracking-wider">FULL</Text>
                            ) : (
                              <View className="w-5 h-5 rounded-full border border-zinc-200 bg-zinc-50" />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* STEP 6: REVIEW & CONFIRM BOOKING SCREEN (NEW) */}
              {step === 6 && (
                <View className="gap-6 pb-6">
                  {/* Section 1 — Booking Summary Card */}
                  <View 
                    className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4"
                    style={{
                      shadowColor: '#101828',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.02,
                      shadowRadius: 6,
                      elevation: 1,
                    }}
                  >
                    {/* Card Header: Calendar Icon, Title, Edit Button */}
                    <View className="flex-row justify-between items-center">
                      <View className="flex-row items-center gap-2.5">
                        <View className="w-7 h-7 rounded-full bg-rose-50 items-center justify-center">
                          <Feather name="calendar" size={13} color="#E11D48" />
                        </View>
                        <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider">Booking Summary</Text>
                      </View>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => triggerTransition(1)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        className="bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-1.5 flex-row items-center gap-1"
                      >
                        <Feather name="edit-2" size={10} color="#E11D48" />
                        <Text className="text-[#E11D48] text-[10px] font-black uppercase">Edit</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Workout Info: Thumbnail, Title, Solo Badge */}
                    <View className="flex-row gap-4 items-center mt-1">
                      <Image 
                        source={{ uri: getWorkoutImage(selectedExperience.id) }} 
                        className="w-20 h-20 rounded-[20px] bg-zinc-50 border border-zinc-100" 
                      />
                      <View className="flex-1 gap-1.5">
                        <Text className="text-[#101828] text-base font-black tracking-tight">{selectedExperience.title}</Text>
                        <View className="flex-row">
                          <View className="bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full flex-row items-center gap-1.5">
                            <Feather name="user" size={8} color="#E11D48" />
                            <Text className="text-[#E11D48] text-[8px] font-black uppercase">Solo Session</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Summary Row Items */}
                    <View className="mt-2">
                      {/* Date Row */}
                      <View className="border-t border-dashed border-[#E5E7EB] py-3.5 flex-row justify-between items-center">
                        <View className="flex-row items-center gap-2">
                          <Feather name="calendar" size={13} color="#6B7280" />
                          <Text className="text-[#6B7280] text-xs font-semibold">Date</Text>
                        </View>
                        <Text className="text-[#101828] text-xs font-extrabold">{getFormattedDateLabel()}</Text>
                      </View>

                      {/* Time Row */}
                      <View className="border-t border-dashed border-[#E5E7EB] py-3.5 flex-row justify-between items-center">
                        <View className="flex-row items-center gap-2">
                          <Feather name="clock" size={13} color="#6B7280" />
                          <Text className="text-[#6B7280] text-xs font-semibold">Time</Text>
                        </View>
                        <Text className="text-[#101828] text-xs font-extrabold">
                          {selectedTime} <Text className="text-[#6B7280] font-medium">({selectedExperience.duration} min workout)</Text>
                        </Text>
                      </View>

                      {/* Trainer Preference Row */}
                      <View className="border-t border-dashed border-[#E5E7EB] py-3.5 flex-row justify-between items-center">
                        <View className="flex-row items-center gap-2">
                          <Feather name="user" size={13} color="#6B7280" />
                          <Text className="text-[#6B7280] text-xs font-semibold">Trainer Preference</Text>
                        </View>
                        <Text className="text-[#101828] text-xs font-extrabold">
                          {trainerPref === 'any' ? 'No Preference' : trainerPref === 'female' ? 'Female Trainer' : trainerPref === 'male' ? 'Male Trainer' : 'Favorite Trainer'}
                        </Text>
                      </View>

                      {/* Location Row */}
                      <View className="border-t border-dashed border-[#E5E7EB] py-3.5 flex-row justify-between items-start">
                        <View className="flex-row items-center gap-2 mt-0.5">
                          <Feather name="map-pin" size={13} color="#6B7280" />
                          <Text className="text-[#6B7280] text-xs font-semibold">Location</Text>
                        </View>
                        <Text className="text-[#101828] text-xs font-extrabold max-w-[60%] text-right leading-relaxed">
                          {addresses.find(a => a.id === selectedAddressId)?.addressLine || 'Selected Location'}
                        </Text>
                      </View>

                      {/* Credits Row */}
                      <View className="border-t border-dashed border-[#E5E7EB] pt-3.5 flex-row justify-between items-center">
                        <View className="flex-row items-center gap-2">
                          <Feather name="credit-card" size={13} color="#6B7280" />
                          <Text className="text-[#6B7280] text-xs font-semibold">Credits</Text>
                        </View>
                        <Text className="text-[#101828] text-xs font-extrabold">1 Credit will be used</Text>
                      </View>
                    </View>
                  </View>

                  {/* Section 2 — Note to Your Trainer (Optional) */}
                  <View className="gap-3 mt-1">
                    {/* Header: Clipboard Icon, Title, Subtitle */}
                    <View className="flex-row gap-3 items-center">
                      <View className="w-9 h-9 rounded-full bg-rose-50 items-center justify-center">
                        <Feather name="edit-3" size={15} color="#E11D48" />
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center gap-1">
                          <Text className="text-[#101828] text-xs font-black uppercase tracking-wider">Note to Your Trainer</Text>
                          <Text className="text-[#6B7280] text-[10px] font-semibold">(Optional)</Text>
                        </View>
                        <Text className="text-[#6B7280] text-[9px] font-medium leading-none mt-1">Share anything that will help your trainer prepare better.</Text>
                      </View>
                    </View>

                    {/* Chips horizontal scroll */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 mt-1 py-1" contentContainerStyle={{ gap: 8 }}>
                      {[
                        { label: 'I have yoga mat', icon: 'award' },
                        { label: 'I have injury', icon: 'activity' },
                        { label: 'Security gate access', icon: 'shield' },
                        { label: 'Bring resistance bands', icon: 'gift' },
                        { label: 'Other', icon: 'chevron-down' }
                      ].map((chip) => {
                        const isSelected = trainerNote.includes(chip.label);
                        return (
                          <TouchableOpacity
                            key={chip.label}
                            activeOpacity={0.8}
                            onPress={() => handleChipPress(chip.label)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            className={`px-3 py-1.5 rounded-full border flex-row items-center gap-1.5 ${
                              isSelected ? 'bg-rose-100/70 border-rose-300' : 'bg-rose-50/50 border-rose-100/60'
                            }`}
                          >
                            <Feather name={chip.icon as any} size={10} color="#E11D48" />
                            <Text className="text-[#E11D48] text-[9px] font-extrabold">{chip.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    {/* Multiline text box */}
                    <View className="relative bg-white border border-[#E5E7EB] rounded-2xl p-4 mt-0.5">
                      <TextInput
                        ref={noteInputRef}
                        multiline
                        numberOfLines={4}
                        value={trainerNote}
                        onChangeText={(text) => {
                          if (text.length <= 250) {
                            setTrainerNote(text);
                          }
                        }}
                        placeholder="Anything else your trainer should know..."
                        placeholderTextColor="#9CA3AF"
                        className="text-[#101828] text-xs font-semibold h-20 text-start"
                        style={{ minHeight: 80, padding: 0, textAlignVertical: 'top' }}
                        maxLength={250}
                      />
                      <Text className="text-right text-[#9CA3AF] text-[9px] font-bold mt-1">
                        {trainerNote.length}/250
                      </Text>
                    </View>
                  </View>

                  {/* Section 3 — Session Policies */}
                  <View 
                    className="bg-amber-50/20 border border-amber-100/50 p-4.5 rounded-[28px] flex-row items-center justify-between mt-2"
                  >
                    <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                      <View className="w-9 h-9 rounded-full bg-amber-100/40 items-center justify-center">
                        <Feather name="shield" size={15} color="#D97706" />
                      </View>
                      <View className="flex-1 gap-0.5">
                        <Text className="text-[#101828] text-xs font-black uppercase tracking-wider">Session Policies</Text>
                        <Text className="text-[#6B7280] text-[9px] font-medium leading-normal">
                          Important information about timing, cancellation, privacy, safety & more.
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => router.push('/legal-center')}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      className="border border-rose-200 px-3.5 py-1.5 rounded-full flex-row items-center gap-0.5 bg-white shadow-sm"
                    >
                      <Text className="text-[#E11D48] text-[9px] font-black uppercase tracking-wide">View Details</Text>
                      <Feather name="chevron-right" size={10} color="#E11D48" />
                    </TouchableOpacity>
                  </View>

                  {/* Policy reminders grid icons */}
                  <View className="flex-row justify-between py-4 border-t border-b border-zinc-200/50 mt-2 bg-white rounded-2xl px-2">
                    <View className="flex-1 items-center px-1">
                      <Feather name="clock" size={14} color="#4F46E5" />
                      <Text className="text-zinc-950 text-[9px] font-black mt-1.5 text-center leading-none">15 Min Grace</Text>
                      <Text className="text-zinc-400 text-[7px] font-bold text-center mt-1 leading-relaxed">Grace period for preparation</Text>
                    </View>
                    
                    <View className="w-[1px] bg-zinc-100" />

                    <View className="flex-1 items-center px-1">
                      <Feather name="activity" size={14} color="#4B5563" />
                      <Text className="text-zinc-950 text-[9px] font-black mt-1.5 text-center leading-none">60 Min Workout</Text>
                      <Text className="text-zinc-400 text-[7px] font-bold text-center mt-1 leading-relaxed">Workout starts after OTP</Text>
                    </View>

                    <View className="w-[1px] bg-zinc-100" />

                    <View className="flex-1 items-center px-1">
                      <Feather name="shield" size={14} color="#E11D48" />
                      <Text className="text-zinc-950 text-[9px] font-black mt-1.5 text-center leading-none">Fair & Transparent</Text>
                      <Text className="text-zinc-400 text-[7px] font-bold text-center mt-1 leading-relaxed">Same rules for everyone</Text>
                    </View>

                    <View className="w-[1px] bg-zinc-100" />

                    <View className="flex-1 items-center px-1">
                      <Feather name="lock" size={14} color="#8B5CF6" />
                      <Text className="text-zinc-950 text-[9px] font-black mt-1.5 text-center leading-none">Secure & Private</Text>
                      <Text className="text-zinc-400 text-[7px] font-bold text-center mt-1 leading-relaxed">Your safety and privacy ensured</Text>
                    </View>
                  </View>

                  {/* Policy Reminder Banner */}
                  <View className="bg-indigo-50/50 border border-indigo-100/40 p-3.5 rounded-2xl flex-row items-center gap-2.5 mt-2">
                    <Feather name="info" size={13} color="#4F46E5" />
                    <Text className="text-zinc-600 text-[10px] font-medium flex-1">
                      By confirming this booking, you agree to the{' '}
                      <Text 
                        onPress={() => router.push('/legal-center')} 
                        className="text-indigo-600 font-extrabold underline"
                      >
                        VIRLA Session Policies
                      </Text>
                      .
                    </Text>
                  </View>

                  {/* Confirm Booking Primary Action */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleConfirmBooking}
                    disabled={isConfirming}
                    className="w-full py-4.5 bg-[#E11D48] rounded-[20px] items-center justify-center flex-row gap-2 mt-4"
                    style={{
                      shadowColor: '#E11D48',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.15,
                      shadowRadius: 8,
                      elevation: 3,
                    }}
                  >
                    {isConfirming ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <>
                        <Text className="text-white text-base font-extrabold">Confirm Booking</Text>
                        <Feather name="chevron-right" size={16} color="white" />
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Secure booking guarantee lock label */}
                  <View className="flex-row items-center justify-center gap-1.5 mt-1">
                    <Feather name="lock" size={11} color="#9CA3AF" />
                    <Text className="text-[#9CA3AF] text-[9px] font-bold">Your booking is 100% secure</Text>
                  </View>
                </View>
              )}

              {/* STEP 7: SUCCESS EXPERIENCE */}
              {step === 7 && (
                <BookingSuccessAnimation
                  workoutTitle={selectedExperience.title}
                  workoutDuration={selectedExperience.duration}
                  selectedDate={selectedDate}
                  selectedTime={selectedTime}
                  locationAddress={addresses.find(a => a.id === selectedAddressId)?.addressLine || 'Selected Location'}
                  successBookingId={successBookingId}
                  onViewSession={(id) => {
                    router.replace({
                      pathname: '/session-detail',
                      params: { id },
                    });
                  }}
                  onBackToHome={() => {
                    router.replace('/(tabs)');
                  }}
                />
              )}

            </View>
          </ScrollView>
        ) : null}
      </View>
    </KeyboardAvoidingView>

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
            className="flex-1 py-4 bg-zinc-950 rounded-2xl items-center justify-center"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <Text className="text-white text-xs font-black uppercase tracking-wider">Continue</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
