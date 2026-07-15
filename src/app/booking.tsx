import React, { useState, useEffect } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWorkoutStore } from '../store/workoutStore';
import { useBookingStore } from '../store/bookingStore';
import { useMembershipStore } from '../store/membershipStore';
import { useUserStore } from '../store/userStore';
import { 
  LocationCard, 
  MemberCard, 
  DatePicker, 
  TimeSlotCard, 
  BookingSummaryCard, 
  SuccessAnimation 
} from '../components';
import { Heading, Subtitle } from '../presentation/components';
import { Ionicons } from '@expo/vector-icons';


export default function BookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const workoutId = params.workoutId as string;

  const { workouts, coaches } = useWorkoutStore();
  const { addBooking } = useBookingStore();
  const { membership, useCredit } = useMembershipStore();
  const { familyMembers } = useUserStore();

  const workout = workouts.find((w) => w.id === workoutId) || workouts[0];

  // Wizard Steps state (Steps 2 to 8)
  const [step, setStep] = useState(2);

  // Selections State
  const [selectedLocation, setSelectedLocation] = useState('');
  const [beneficiary, setBeneficiary] = useState(''); // 'myself' | 'family' | 'friend'
  const [selectedFamilyMember, setSelectedFamilyMember] = useState('');
  const [friendCode, setFriendCode] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  // Coach Assignment State
  const [assigningCoach, setAssigningCoach] = useState(false);
  const [assignedCoachIndex, setAssignedCoachIndex] = useState(0);

  // New Booking ID State
  const [newBookingId, setNewBookingId] = useState('');

  // Locations list (Step 2)
  const locations = [
    { key: 'home', icon: '🏠', title: 'Home' },
    { key: 'society_gym', icon: '🏢', title: 'Society Gym' },
    { key: 'my_gym', icon: '🏋️', title: 'My Gym' },
    { key: 'outdoor', icon: '🌳', title: 'Outdoor' },
  ];

  // Time Slots list (Step 5)
  const slots = [
    { slot: '06:00 AM - 07:00 AM', isAvailable: true },
    { slot: '07:00 AM - 08:00 AM', isAvailable: true },
    { slot: '08:00 AM - 09:00 AM', isAvailable: false },
    { slot: '09:00 AM - 10:00 AM', isAvailable: true },
    { slot: '10:00 AM - 11:00 AM', isAvailable: true },
    { slot: '04:00 PM - 05:00 PM', isAvailable: true },
    { slot: '05:00 PM - 06:00 PM', isAvailable: false },
    { slot: '07:00 PM - 08:00 PM', isAvailable: true },
    { slot: '09:00 PM - 10:00 PM', isAvailable: true },
  ];

  // Trigger Coach Matchmaker Loading Animation on Step 6
  useEffect(() => {
    if (step === 6) {
      setAssigningCoach(true);
      const timer = setTimeout(() => {
        setAssigningCoach(false);
      }, 2000); // 2s Apple-style loading matcher
      return () => clearTimeout(timer);
    }
  }, [step]);

  const handleNext = () => {
    // Validations per step
    if (step === 2 && !selectedLocation) {
      Alert.alert('Selection Required', 'Please select a location for your session.');
      return;
    }
    if (step === 3) {
      if (!beneficiary) {
        Alert.alert('Selection Required', 'Please choose who this session is for.');
        return;
      }
      if (beneficiary === 'family' && !selectedFamilyMember) {
        Alert.alert('Selection Required', 'Please select a family member.');
        return;
      }
      if (beneficiary === 'friend' && !friendCode) {
        Alert.alert('Invite Code Required', 'Please enter your friend invite code.');
        return;
      }
    }
    if (step === 4 && !selectedDate) {
      Alert.alert('Selection Required', 'Please select a booking date.');
      return;
    }
    if (step === 5 && !selectedTime) {
      Alert.alert('Selection Required', 'Please select a time slot.');
      return;
    }

    setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 2) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  // Assigns a different coach on click
  const handleChangeCoach = () => {
    setAssigningCoach(true);
    setTimeout(() => {
      setAssignedCoachIndex((prev) => (prev + 1) % coaches.length);
      setAssigningCoach(false);
    }, 1000);
  };

  // Processes booking completion
  const handleConfirmBooking = () => {
    if (membership.availableCredits <= 0) {
      Alert.alert('Quota Expired', 'You have no available membership credits. Purchase more credits in Membership settings.');
      return;
    }

    const success = useCredit();
    if (success) {
      const activeCoach = coaches[assignedCoachIndex];
      const newId = `b-wiz-${Date.now()}`;
      setNewBookingId(newId);

      addBooking({
        id: newId,
        trainerName: activeCoach.name,
        trainerPhoto: activeCoach.photo,
        workoutTitle: workout.title,
        date: selectedDate,
        time: selectedTime.split(' - ')[0], // Keep start time for tab cards
      });

      setStep(8); // confirmation success step
    }
  };

  // Dynamic titles for the layout header
  const getHeaderTitle = () => {
    switch (step) {
      case 2: return 'Select Location';
      case 3: return 'Who is joining?';
      case 4: return 'Choose Date';
      case 5: return 'Choose Time';
      case 6: return 'Coach Assignment';
      case 7: return 'Review Summary';
      case 8: return 'Confirmed';
      default: return 'Book Session';
    }
  };

  const activeCoach = coaches[assignedCoachIndex];

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Top Navigation Header */}
      {step < 8 && (
        <View className="h-14 flex-row items-center px-6 border-b border-zinc-100">
          <TouchableOpacity onPress={handleBack} className="w-8 h-8 items-center justify-center">
            <Ionicons name="arrow-back" size={20} color="#111111" />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-primary text-base font-black tracking-tight mr-8">
            {getHeaderTitle()}
          </Text>
        </View>
      )}

      {/* Main Body Layout */}
      <View className="flex-1">
        {step < 8 ? (
          <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6">
            
            {/* Step 2: Location Selection */}
            {step === 2 && (
              <View>
                <Text className="text-zinc-500 text-sm font-medium mb-6">
                  Where would you like your {workout.title} session?
                </Text>
                {locations.map((loc) => (
                  <LocationCard
                    key={loc.key}
                    icon={loc.icon}
                    title={loc.title}
                    isSelected={selectedLocation === loc.title}
                    onPress={() => setSelectedLocation(loc.title)}
                  />
                ))}
              </View>
            )}

            {/* Step 3: Beneficiary */}
            {step === 3 && (
              <View>
                <Text className="text-zinc-500 text-sm font-medium mb-6">
                  Who is attending this session?
                </Text>
                
                {/* Myself Card */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    setBeneficiary('myself');
                    setSelectedFamilyMember('');
                  }}
                  className={`w-full p-5 rounded-2xl border-2 mb-3 ${
                    beneficiary === 'myself' ? 'border-primary bg-zinc-50/50' : 'border-zinc-100'
                  }`}
                >
                  <Text className="text-primary text-base font-extrabold">Myself</Text>
                </TouchableOpacity>

                {/* Family Card */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setBeneficiary('family')}
                  className={`w-full p-5 rounded-2xl border-2 mb-4 ${
                    beneficiary === 'family' ? 'border-primary bg-zinc-50/50' : 'border-zinc-100'
                  }`}
                >
                  <Text className="text-primary text-base font-extrabold">Family Member</Text>
                </TouchableOpacity>

                {/* Linked family members checklist */}
                {beneficiary === 'family' && (
                  <View className="ml-4 mb-4">
                    <Text className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider mb-3">Linked Members</Text>
                    {familyMembers.map((member) => (
                      <MemberCard
                        key={member.id}
                        name={member.name}
                        relation={member.relation}
                        isSelected={selectedFamilyMember === member.name}
                        onPress={() => setSelectedFamilyMember(member.name)}
                      />
                    ))}
                  </View>
                )}

                {/* Friend Card */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    setBeneficiary('friend');
                    setSelectedFamilyMember('');
                  }}
                  className={`w-full p-5 rounded-2xl border-2 mb-4 ${
                    beneficiary === 'friend' ? 'border-primary bg-zinc-50/50' : 'border-zinc-100'
                  }`}
                >
                  <Text className="text-primary text-base font-extrabold">A Friend</Text>
                </TouchableOpacity>

                {/* Invite Code Input */}
                {beneficiary === 'friend' && (
                  <View className="ml-4 mb-4">
                    <Text className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider mb-2">Friend's Invite Code</Text>
                    <TextInput
                      value={friendCode}
                      onChangeText={setFriendCode}
                      placeholder="Enter invite code (e.g. VIR-591)"
                      placeholderTextColor="#A1A1AA"
                      className="border border-zinc-200 p-4 rounded-xl text-primary text-xs font-bold bg-zinc-50"
                    />
                  </View>
                )}
              </View>
            )}

            {/* Step 4: Date Picker */}
            {step === 4 && (
              <View className="gap-4">
                <Text className="text-zinc-500 text-sm font-medium mb-2 px-6">
                  Select your workout date
                </Text>
                <DatePicker 
                  selectedDate={selectedDate} 
                  onSelect={setSelectedDate} 
                />
                <Text className="text-[10px] text-zinc-400 font-semibold px-6 mt-4">
                  Note: Sessions on Saturdays and Sundays are unavailable in this mock calendar.
                </Text>
              </View>
            )}

            {/* Step 5: Time Selector */}
            {step === 5 && (
              <View>
                <Text className="text-zinc-500 text-sm font-medium mb-6">
                  Select a preferred hourly slot
                </Text>
                <View className="flex-row flex-wrap gap-4 justify-between">
                  {slots.map((s, i) => (
                    <TimeSlotCard
                      key={i}
                      slot={s.slot}
                      isAvailable={s.isAvailable}
                      isSelected={selectedTime === s.slot}
                      onPress={() => setSelectedTime(s.slot)}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Step 6: Coach Assignment Matchmaker */}
            {step === 6 && (
              <View className="flex-1 justify-center items-center py-10">
                {assigningCoach ? (
                  <View className="items-center">
                    <ActivityIndicator size="large" color="#111111" className="mb-4" />
                    <Text className="text-primary text-base font-extrabold tracking-tight">
                      Finding your best Wellness Coach...
                    </Text>
                    <Text className="text-zinc-400 text-xs text-center mt-2">
                      Matching you based on profile history and location
                    </Text>
                  </View>
                ) : (
                  <View className="w-full gap-6">
                    <Text className="text-zinc-500 text-sm font-medium mb-2 text-center">
                      We've matched you with an elite coach!
                    </Text>
                    
                    {/* Coach Profile Card */}
                    <View className="bg-zinc-50 border border-zinc-100 p-6 rounded-[24px] items-center relative overflow-hidden">
                      <Image
                        source={{ uri: activeCoach.photo }}
                        className="w-24 h-24 rounded-full border-4 border-white shadow-sm mb-4"
                      />
                      <Text className="text-primary text-lg font-black tracking-tight">{activeCoach.name}</Text>
                      <Text className="text-zinc-500 text-xs font-semibold mb-3">Certified Wellness Coach</Text>
                      
                      {/* Sub-details */}
                      <View className="flex-row items-center gap-3 mb-4">
                        <Text className="text-xs font-bold text-primary">⭐ {activeCoach.rating}</Text>
                        <Text className="text-zinc-300">|</Text>
                        <Text className="text-xs font-bold text-primary">{activeCoach.experience}</Text>
                      </View>

                      {/* Expanded specifications */}
                      <View className="w-full border-t border-zinc-200/50 pt-4 gap-2">
                        <View className="flex-row justify-between">
                          <Text className="text-zinc-400 text-[10px] font-bold uppercase">Languages</Text>
                          <Text className="text-primary text-xs font-bold">English, Hindi</Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-zinc-400 text-[10px] font-bold uppercase">Sessions Done</Text>
                          <Text className="text-primary text-xs font-bold">420+ sessions</Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-zinc-400 text-[10px] font-bold uppercase">Arrival ETA</Text>
                          <Text className="text-green-500 text-xs font-bold">Trainer arrives 10m early</Text>
                        </View>
                      </View>
                    </View>

                    {/* Change Coach trigger */}
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={handleChangeCoach}
                      className="border border-zinc-200 py-3.5 rounded-2xl items-center justify-center bg-white"
                    >
                      <Text className="text-primary text-xs font-bold">Change Coach</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Step 7: Summary & Receipt */}
            {step === 7 && (
              <View>
                <Text className="text-zinc-500 text-sm font-medium mb-6">
                  Please review and confirm your session receipt details.
                </Text>
                
                <BookingSummaryCard
                  workoutTitle={workout.title}
                  workoutIcon={workout.icon}
                  coachName={activeCoach.name}
                  coachPhoto={activeCoach.photo}
                  date={selectedDate}
                  time={selectedTime}
                  location={selectedLocation}
                  creditsBefore={membership.availableCredits}
                />
              </View>
            )}

          </ScrollView>
        ) : (
          /* Step 8: Success Splash confirmation */
          <View className="flex-1 justify-center items-center px-6 py-10 bg-white">
            <SuccessAnimation />
            
            <Heading className="mb-2">Your Session Is Confirmed!</Heading>
            <Subtitle className="mb-8">
              Wellness coach {activeCoach.name} is booked for your {workout.title} session.
            </Subtitle>

            {/* Receipt Summary Card */}
            <View className="w-full bg-zinc-50 border border-zinc-100 p-5 rounded-3xl mb-12 gap-3">
              <View className="flex-row justify-between items-center">
                <Text className="text-zinc-500 text-xs font-semibold">Coach</Text>
                <Text className="text-primary text-xs font-black">{activeCoach.name}</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-zinc-500 text-xs font-semibold">Date</Text>
                <Text className="text-primary text-xs font-black">{selectedDate}</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-zinc-500 text-xs font-semibold">Time</Text>
                <Text className="text-primary text-xs font-black">{selectedTime.split(' - ')[0]}</Text>
              </View>
              <View className="h-[1px] bg-zinc-200/50 my-1" />
              <View className="flex-row justify-between items-center">
                <Text className="text-zinc-500 text-xs font-semibold">Credits Remaining</Text>
                <Text className="text-green-500 text-xs font-black">
                  {membership.availableCredits} Credits
                </Text>
              </View>
            </View>

            {/* Success Navigation actions */}
            <View className="w-full gap-4">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  router.replace({
                    pathname: '/session-detail',
                    params: { id: newBookingId },
                  });
                }}
                className="w-full py-4 bg-zinc-900 rounded-2xl items-center justify-center shadow-sm"
              >
                <Text className="text-white text-base font-extrabold">
                  View Booking
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.replace('/(tabs)')}
                className="w-full py-4 bg-zinc-100 rounded-2xl items-center justify-center border border-zinc-200/50"
              >
                <Text className="text-primary text-base font-bold">
                  Go Home
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Persistent Proceed Action Bar */}
      {step < 8 && (!assigningCoach) && (
        <View className="p-6 bg-white border-t border-zinc-100">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={step === 7 ? handleConfirmBooking : handleNext}
            className="w-full py-4 bg-zinc-900 rounded-[20px] items-center justify-center shadow-sm"
          >
            <Text className="text-white text-base font-extrabold tracking-wide">
              {step === 7 ? 'Confirm Booking' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
