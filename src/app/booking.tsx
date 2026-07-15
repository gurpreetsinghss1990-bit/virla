import React, { useState, useEffect } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, TextInput, Alert, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWorkoutStore } from '../store/workoutStore';
import { useBookingStore } from '../store/bookingStore';
import { useMembershipStore } from '../store/membershipStore';
import { useUserStore } from '../store/userStore';
import { useAddressStore } from '../store/addressStore';
import { useCalendarStore } from '../store/calendarStore';
import { useTimeSlotStore } from '../store/timeSlotStore';
import { useCoachStore } from '../store/coachStore';
import { 
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
  const initialWorkoutId = params.workoutId as string;

  const { workouts } = useWorkoutStore();
  const { addBooking } = useBookingStore();
  const { membership, useCredit } = useMembershipStore();
  const { familyMembers } = useUserStore();
  
  // Zustand Stores for Step State Management (Feature 14)
  const { addresses, addAddress, selectedAddressId, setSelectedAddressId } = useAddressStore();
  const { coaches } = useCoachStore();
  const { selectedDate, setSelectedDate } = useCalendarStore();
  const { selectedTimeSlot, setSelectedTimeSlot, timeSlots } = useTimeSlotStore();

  // Redesigned Steps (Steps 1 to 7)
  const [step, setStep] = useState(initialWorkoutId ? 2 : 1);

  // Flow State
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(initialWorkoutId || '');
  const [selectedGoal, setSelectedGoal] = useState('');
  
  // Date Type Selector: 'today' | 'tomorrow' | 'other'
  const [dateType, setDateType] = useState<'today' | 'tomorrow' | 'other'>('today');

  // Address Form
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addrLabel, setAddrLabel] = useState('');
  const [addrLine, setAddrLine] = useState('');
  const [addrDefault, setAddrDefault] = useState(false);

  // Family Form
  const [beneficiary, setBeneficiary] = useState('myself');
  const [selectedFamilyMemberId, setSelectedFamilyMemberId] = useState('');
  const [showFamilyForm, setShowFamilyForm] = useState(false);
  const [fmName, setFmName] = useState('');
  const [fmAge, setFmAge] = useState('');
  const [fmGender, setFmGender] = useState('Female');
  const [fmRelation, setFmRelation] = useState('');
  const [fmNotes, setFmNotes] = useState('');

  // Preferred Coach ID (Returning Coach Feature)
  const [prefCoachId, setPrefCoachId] = useState('');
  const [coachValidationStatus, setCoachValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [validatedCoachName, setValidatedCoachName] = useState('');

  // Booking Results
  const [newBookingId, setNewBookingId] = useState('');
  const [useCreditsMode, setUseCreditsMode] = useState(true);

  // Auto-fill dates based on dateType
  useEffect(() => {
    const today = new Date();
    if (dateType === 'today') {
      const formatted = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      setSelectedDate(formatted);
    } else if (dateType === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const formatted = tomorrow.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      setSelectedDate(formatted);
    }
  }, [dateType]);

  // Validate Coach ID reactively
  useEffect(() => {
    if (!prefCoachId.trim()) {
      setCoachValidationStatus('idle');
      setValidatedCoachName('');
      return;
    }
    const matched = coaches.find(c => c.id.toLowerCase() === prefCoachId.trim().toLowerCase());
    if (matched) {
      setCoachValidationStatus('valid');
      setValidatedCoachName(matched.name);
    } else {
      setCoachValidationStatus('invalid');
      setValidatedCoachName('');
    }
  }, [prefCoachId]);

  // Set default address
  useEffect(() => {
    if (addresses.length > 0 && !selectedAddressId) {
      const defaultAddr = addresses.find(a => a.isDefault) || addresses[0];
      setSelectedAddressId(defaultAddr.id);
    }
  }, [addresses]);

  const handleWorkoutSelect = (id: string) => {
    setSelectedWorkoutId(id);
    setStep(2); // Auto proceed to Goal Selection
  };

  const handleNext = () => {
    if (step === 1 && !selectedWorkoutId) {
      Alert.alert('Selection Required', 'Please select a workout category.');
      return;
    }
    if (step === 2 && !selectedGoal) {
      Alert.alert('Selection Required', 'Please choose your primary workout goal.');
      return;
    }
    if (step === 3) {
      if (!selectedDate) {
        Alert.alert('Date Required', 'Please select a date.');
        return;
      }
      if (!selectedTimeSlot) {
        Alert.alert('Time Slot Required', 'Please select a preferred slot.');
        return;
      }
    }
    if (step === 4 && !selectedAddressId) {
      Alert.alert('Address Required', 'Please choose a location address.');
      return;
    }
    if (step === 5 && beneficiary === 'family' && !selectedFamilyMemberId && !showFamilyForm) {
      Alert.alert('Selection Required', 'Please select a family member or add one.');
      return;
    }

    setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  const handleAddFamilyMember = () => {
    if (!fmName.trim() || !fmAge.trim() || !fmRelation.trim()) {
      Alert.alert('Incomplete Form', 'Please enter Name, Age, and Relationship.');
      return;
    }
    const newMember = {
      id: `fm-${Date.now()}`,
      name: fmName.trim(),
      age: parseInt(fmAge.trim()) || 25,
      gender: fmGender,
      relation: fmRelation.trim(),
      notes: fmNotes.trim()
    };
    useUserStore.setState((state) => ({
      familyMembers: [...state.familyMembers, newMember]
    }));
    setSelectedFamilyMemberId(newMember.id);
    setShowFamilyForm(false);
    setFmName('');
    setFmAge('');
    setFmGender('Female');
    setFmRelation('');
    setFmNotes('');
    Alert.alert('Success', `${newMember.name} added and selected.`);
  };

  const handleAddNewAddress = () => {
    if (!addrLabel.trim() || !addrLine.trim()) {
      Alert.alert('Incomplete Form', 'Please enter a Label and Address.');
      return;
    }
    addAddress({
      label: addrLabel.trim(),
      addressLine: addrLine.trim(),
      isDefault: addrDefault
    });
    setShowAddressForm(false);
    setAddrLabel('');
    setAddrLine('');
    setAddrDefault(false);
    Alert.alert('Success', 'Address added and selected.');
  };

  const handleConfirmBooking = () => {
    if (useCreditsMode && membership.availableCredits <= 0) {
      Alert.alert('No Credits Available', 'Top up your credits or choose cash/card to confirm booking.');
      return;
    }
    if (prefCoachId.trim() && coachValidationStatus === 'invalid') {
      Alert.alert('Invalid Coach ID', 'Please enter a valid Coach ID or clear the field to let VIRLA assign the best coach.');
      return;
    }

    const bookingId = `b-wiz-${Date.now()}`;
    setNewBookingId(bookingId);

    const activeWorkout = workouts.find(w => w.id === selectedWorkoutId) || workouts[0];
    const activeAddress = addresses.find(a => a.id === selectedAddressId) || addresses[0];
    const activeFamily = familyMembers.find(f => f.id === selectedFamilyMemberId);
    const workoutPrice = activeWorkout?.sessionPrice || 1200;

    let assignedTrainerName = 'Assigning Coach...';
    let assignedTrainerPhoto = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';

    if (coachValidationStatus === 'valid' && validatedCoachName) {
      const match = coaches.find(c => c.name === validatedCoachName);
      assignedTrainerName = `Coach ${validatedCoachName} (Requested)`;
      if (match) {
        assignedTrainerPhoto = match.photo;
      }
    }

    if (useCreditsMode) {
      useCredit();
    }

    addBooking({
      id: bookingId,
      trainerName: assignedTrainerName,
      trainerPhoto: assignedTrainerPhoto,
      workoutTitle: activeWorkout.title,
      date: selectedDate,
      time: selectedTimeSlot.split(' - ')[0],
      price: workoutPrice,
      address: activeAddress.addressLine,
      goal: selectedGoal,
      preferredCoachId: prefCoachId.trim() || undefined,
      familyMember: activeFamily ? {
        name: activeFamily.name,
        age: activeFamily.age || 25,
        gender: activeFamily.gender || 'Female',
        relation: activeFamily.relation,
        notes: activeFamily.notes || ''
      } : undefined
    });

    setStep(7); // success step
  };

  const getHeaderTitle = () => {
    switch (step) {
      case 1: return 'Select Workout';
      case 2: return 'Select Goal';
      case 3: return 'Choose Date & Time';
      case 4: return 'Choose Location';
      case 5: return 'Family Member';
      case 6: return 'Booking Summary';
      case 7: return 'Booking Confirmed';
      default: return 'Book Session';
    }
  };

  const activeWorkout = workouts.find(w => w.id === selectedWorkoutId) || workouts[0];
  const workoutPrice = activeWorkout?.sessionPrice || 1200;
  const activeAddress = addresses.find(a => a.id === selectedAddressId) || addresses[0];

  const goals = [
    { label: 'Lose Weight', icon: '🏃‍♂️' },
    { label: 'Build Muscle', icon: '💪' },
    { label: 'Improve Flexibility', icon: '🧘' },
    { label: 'Recover from Injury', icon: '🩹' },
    { label: 'Stay Active', icon: '🏡' },
    { label: 'Improve Stamina', icon: '🫁' }
  ];

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Top Header */}
      {step < 7 && (
        <View className="h-14 flex-row items-center px-6 border-b border-zinc-100">
          <TouchableOpacity onPress={handleBack} className="w-8 h-8 items-center justify-center">
            <Ionicons name="arrow-back" size={20} color="#111111" />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-primary text-base font-black tracking-tight mr-8">
            {getHeaderTitle()}
          </Text>
        </View>
      )}

      <View className="flex-1">
        {step < 7 ? (
          <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6">
            
            {/* Step 1: Workout Selection */}
            {step === 1 && (
              <View className="gap-4 pb-8">
                <Text className="text-zinc-500 text-sm font-medium mb-1">
                  Select a certified home wellness program
                </Text>
                
                {workouts.map((w) => {
                  const isSelected = selectedWorkoutId === w.id;
                  return (
                    <TouchableOpacity
                      key={w.id}
                      activeOpacity={0.9}
                      onPress={() => handleWorkoutSelect(w.id)}
                      className={`bg-white border-2 rounded-3xl overflow-hidden shadow-xs flex-row p-4 gap-4 ${
                        isSelected ? 'border-accent bg-zinc-50/30' : 'border-zinc-100'
                      }`}
                    >
                      <Image
                        source={{ uri: w.heroImage || 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=150&q=80' }}
                        className="w-20 h-20 rounded-2xl"
                      />
                      <View className="flex-1 justify-between py-0.5">
                        <View>
                          <Text className="text-primary text-base font-extrabold tracking-tight">{w.title}</Text>
                          <Text className="text-zinc-500 text-xs font-semibold leading-relaxed mt-0.5" numberOfLines={2}>
                            {w.description}
                          </Text>
                        </View>
                        <View className="flex-row justify-between items-center mt-2.5">
                          <Text className="text-zinc-400 text-[10px] font-bold">⏱️ {w.duration} mins</Text>
                          <Text className="text-accent text-xs font-black">Starts ₹{w.sessionPrice || 900}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Step 2: Goal Selection */}
            {step === 2 && (
              <View className="gap-5">
                <Text className="text-zinc-500 text-sm font-medium">
                  What is your primary goal? This helps our AI matches assign the perfect coach.
                </Text>

                <View className="flex-row flex-wrap gap-4 justify-between">
                  {goals.map((g) => {
                    const isSelected = selectedGoal === g.label;
                    return (
                      <TouchableOpacity
                        key={g.label}
                        activeOpacity={0.8}
                        onPress={() => {
                          setSelectedGoal(g.label);
                          // Delay briefly for premium micro-interaction before proceeding
                          setTimeout(() => setStep(3), 200);
                        }}
                        className={`w-[47%] p-5 rounded-3xl border-2 items-center justify-center gap-3 ${
                          isSelected ? 'border-accent bg-zinc-50/50' : 'border-zinc-100 bg-white'
                        }`}
                      >
                        <Text className="text-3xl">{g.icon}</Text>
                        <Text className="text-primary text-xs font-extrabold text-center tracking-tight leading-tight">
                          {g.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Step 3: Choose Date & Time */}
            {step === 3 && (
              <View className="gap-5">
                <Text className="text-zinc-500 text-sm font-medium">
                  When should we schedule your session?
                </Text>

                {/* Today/Tomorrow/Other Capsules */}
                <View className="flex-row bg-zinc-50 border border-zinc-100 p-1.5 rounded-2xl">
                  {(['today', 'tomorrow', 'other'] as const).map((type) => {
                    const isActive = dateType === type;
                    return (
                      <TouchableOpacity
                        key={type}
                        activeOpacity={0.8}
                        onPress={() => setDateType(type)}
                        className={`flex-1 py-3 rounded-xl items-center justify-center ${
                          isActive ? 'bg-zinc-900 shadow-sm' : ''
                        }`}
                      >
                        <Text className={`text-xs font-extrabold uppercase tracking-wider ${isActive ? 'text-white' : 'text-zinc-400'}`}>
                          {type === 'other' ? 'Pick Date' : type}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Show DatePicker only if 'other' is chosen */}
                {dateType === 'other' && (
                  <View className="my-2">
                    <DatePicker 
                      selectedDate={selectedDate} 
                      onSelect={setSelectedDate} 
                    />
                  </View>
                )}

                {/* Date Confirmation Subheader */}
                <View className="bg-zinc-50 p-4 rounded-2xl flex-row justify-between items-center">
                  <Text className="text-zinc-500 text-xs font-semibold">Selected Workout Date</Text>
                  <Text className="text-primary text-xs font-black">📅 {selectedDate || 'Select Date'}</Text>
                </View>

                {/* Available Slots */}
                <View className="gap-3">
                  <Text className="text-zinc-400 text-[10px] font-extrabold uppercase tracking-wider">Select Available Time Slot</Text>
                  <View className="flex-row flex-wrap gap-4 justify-between">
                    {timeSlots.map((s, i) => (
                      <TimeSlotCard
                        key={i}
                        slot={s.slot}
                        isAvailable={s.isAvailable}
                        isSelected={selectedTimeSlot === s.slot}
                        onPress={() => setSelectedTimeSlot(s.slot)}
                      />
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Step 4: Choose Location */}
            {step === 4 && (
              <View className="gap-4">
                <View className="flex-row justify-between items-center">
                  <Text className="text-zinc-500 text-sm font-medium">
                    Where should our wellness coach visit?
                  </Text>
                  
                  {!showAddressForm && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setShowAddressForm(true)}
                      className="bg-zinc-900 px-3 py-1.5 rounded-full flex-row items-center gap-1 shadow-sm"
                    >
                      <Ionicons name="add" size={12} color="white" />
                      <Text className="text-white text-[9px] font-black uppercase tracking-wider">Add New</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {showAddressForm ? (
                  /* Inline Add Address Form */
                  <View className="bg-zinc-50 border border-zinc-100 p-5 rounded-2xl gap-4">
                    <Text className="text-primary text-xs font-black uppercase tracking-wider">Add Address Details</Text>
                    <TextInput
                      value={addrLabel}
                      onChangeText={setAddrLabel}
                      placeholder="Address Label (e.g. Home, Office, Gym)"
                      placeholderTextColor="#A1A1AA"
                      className="border border-zinc-200 p-3 rounded-xl text-primary text-xs font-bold bg-white"
                    />
                    <TextInput
                      value={addrLine}
                      onChangeText={setAddrLine}
                      placeholder="Street address, apartment, sector, city"
                      placeholderTextColor="#A1A1AA"
                      multiline
                      className="border border-zinc-200 p-3 rounded-xl text-primary text-xs font-bold bg-white h-16"
                    />
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setAddrDefault(!addrDefault)}
                      className="flex-row items-center gap-2"
                    >
                      <View className={`w-4 h-4 rounded border items-center justify-center ${addrDefault ? 'bg-orange-500 border-orange-500' : 'border-zinc-300'}`}>
                        {addrDefault && <Ionicons name="checkmark" size={10} color="white" />}
                      </View>
                      <Text className="text-zinc-500 text-xs font-semibold">Set as default address</Text>
                    </TouchableOpacity>
                    <View className="flex-row gap-3 mt-2">
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setShowAddressForm(false)}
                        className="flex-1 py-3 bg-zinc-200/50 rounded-xl items-center"
                      >
                        <Text className="text-primary text-xs font-bold">Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleAddNewAddress}
                        className="flex-1 py-3 bg-zinc-900 rounded-xl items-center"
                      >
                        <Text className="text-white text-xs font-black">Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  /* Addresses list */
                  <View className="gap-3">
                    {addresses.map((addr) => {
                      const isSelected = selectedAddressId === addr.id;
                      return (
                        <TouchableOpacity
                          key={addr.id}
                          activeOpacity={0.8}
                          onPress={() => setSelectedAddressId(addr.id)}
                          className={`p-4 rounded-2xl border-2 flex-row justify-between items-center ${
                            isSelected ? 'border-accent bg-zinc-50/50' : 'border-zinc-100'
                          }`}
                        >
                          <View className="flex-1 pr-4">
                            <View className="flex-row items-center gap-2 mb-1">
                              <Text className="text-primary text-sm font-black">{addr.label}</Text>
                              {addr.isDefault && (
                                <View className="bg-orange-500/10 px-2.5 py-0.5 rounded-full border border-orange-500/20">
                                  <Text className="text-orange-600 text-[8px] font-black uppercase tracking-wider">Default</Text>
                                </View>
                              )}
                            </View>
                            <Text className="text-zinc-500 text-xs font-semibold leading-relaxed" numberOfLines={2}>
                              {addr.addressLine}
                            </Text>
                          </View>
                          <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${isSelected ? 'border-accent' : 'border-zinc-200'}`}>
                            {isSelected && <View className="w-2.5 h-2.5 rounded-full bg-orange-500" />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Step 5: Family Member */}
            {step === 5 && (
              <View className="gap-4">
                <Text className="text-zinc-500 text-sm font-medium">
                  Select who this wellness workout session is for:
                </Text>
                
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      setBeneficiary('myself');
                      setSelectedFamilyMemberId('');
                      setShowFamilyForm(false);
                    }}
                    className={`flex-1 p-4 rounded-2xl border-2 items-center justify-center ${
                      beneficiary === 'myself' ? 'border-accent bg-zinc-50/50' : 'border-zinc-100'
                    }`}
                  >
                    <Text className="text-lg mb-1">🙋‍♂️</Text>
                    <Text className="text-primary text-xs font-black">Myself</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setBeneficiary('family')}
                    className={`flex-1 p-4 rounded-2xl border-2 items-center justify-center ${
                      beneficiary === 'family' ? 'border-accent bg-zinc-50/50' : 'border-zinc-100'
                    }`}
                  >
                    <Text className="text-lg mb-1">👨‍👩‍👧‍👦</Text>
                    <Text className="text-primary text-xs font-black">Family Member</Text>
                  </TouchableOpacity>
                </View>

                {beneficiary === 'family' && (
                  <View className="gap-3 mt-2">
                    <View className="flex-row justify-between items-center">
                      <Text className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider">Select Registered Family</Text>
                      {!showFamilyForm && (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => setShowFamilyForm(true)}
                          className="bg-zinc-900 px-3 py-1.5 rounded-full flex-row items-center gap-1 shadow-sm"
                        >
                          <Ionicons name="add" size={12} color="white" />
                          <Text className="text-white text-[9px] font-black uppercase tracking-wider">Add Family</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {showFamilyForm ? (
                      /* Inline Add Family Form */
                      <View className="bg-zinc-50 border border-zinc-100 p-5 rounded-2xl gap-4">
                        <Text className="text-primary text-xs font-black uppercase tracking-wider">New Family Member Profile</Text>
                        <TextInput
                          value={fmName}
                          onChangeText={setFmName}
                          placeholder="Full Name"
                          placeholderTextColor="#A1A1AA"
                          className="border border-zinc-200 p-3 rounded-xl text-primary text-xs font-bold bg-white"
                        />
                        <View className="flex-row gap-3">
                          <TextInput
                            value={fmAge}
                            onChangeText={setFmAge}
                            placeholder="Age"
                            keyboardType="numeric"
                            placeholderTextColor="#A1A1AA"
                            className="flex-1 border border-zinc-200 p-3 rounded-xl text-primary text-xs font-bold bg-white"
                          />
                          <TextInput
                            value={fmRelation}
                            onChangeText={setFmRelation}
                            placeholder="Relation"
                            placeholderTextColor="#A1A1AA"
                            className="flex-1 border border-zinc-200 p-3 rounded-xl text-primary text-xs font-bold bg-white"
                          />
                        </View>
                        
                        <View className="gap-1">
                          <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">Gender</Text>
                          <View className="flex-row gap-2 mt-1">
                            {['Female', 'Male', 'Other'].map((g) => (
                              <TouchableOpacity
                                key={g}
                                activeOpacity={0.8}
                                onPress={() => setFmGender(g)}
                                className={`flex-1 py-2.5 rounded-xl border items-center ${
                                  fmGender === g ? 'bg-zinc-900 border-zinc-900' : 'bg-white border-zinc-200'
                                }`}
                              >
                                <Text className={`text-xs font-bold ${fmGender === g ? 'text-white' : 'text-zinc-600'}`}>{g}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>

                        <TextInput
                          value={fmNotes}
                          onChangeText={setFmNotes}
                          placeholder="Special fitness notes or injuries"
                          placeholderTextColor="#A1A1AA"
                          multiline
                          className="border border-zinc-200 p-3 rounded-xl text-primary text-xs font-bold bg-white h-16 text-top"
                        />

                        <View className="flex-row gap-3 mt-2">
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setShowFamilyForm(false)}
                            className="flex-1 py-3 bg-zinc-200/50 rounded-xl items-center"
                          >
                            <Text className="text-primary text-xs font-bold">Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={handleAddFamilyMember}
                            className="flex-1 py-3 bg-zinc-900 rounded-xl items-center"
                          >
                            <Text className="text-white text-xs font-black">Save & Select</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      /* Family members list */
                      <View className="gap-2">
                        {familyMembers.map((member) => {
                          const isSelected = selectedFamilyMemberId === member.id;
                          return (
                            <TouchableOpacity
                              key={member.id}
                              activeOpacity={0.8}
                              onPress={() => setSelectedFamilyMemberId(member.id)}
                              className={`p-4 rounded-2xl border-2 flex-row justify-between items-center ${
                                isSelected ? 'border-accent bg-zinc-50/50' : 'border-zinc-100'
                              }`}
                            >
                              <View>
                                <Text className="text-primary text-sm font-black">{member.name}</Text>
                                <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">{member.relation}</Text>
                              </View>
                              <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${isSelected ? 'border-accent' : 'border-zinc-200'}`}>
                                {isSelected && <View className="w-2.5 h-2.5 rounded-full bg-orange-500" />}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Step 6: Booking Summary & Preferred Coach */}
            {step === 6 && (
              <View className="gap-4 pb-8">
                <Text className="text-zinc-500 text-sm font-medium">
                  Review your session details and select payment mode.
                </Text>
                
                <BookingSummaryCard
                  workoutTitle={activeWorkout.title}
                  workoutIcon={activeWorkout.icon}
                  goal={selectedGoal}
                  date={selectedDate}
                  time={selectedTimeSlot}
                  address={activeAddress.addressLine}
                  price={workoutPrice}
                  creditsBefore={membership.availableCredits}
                  useCreditsMode={useCreditsMode}
                />

                {/* Returning Coach Box (Preferred Coach Feature) */}
                <View className="bg-zinc-50 border border-zinc-100 p-5 rounded-[24px] gap-3.5 shadow-xs">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-primary text-xs font-black uppercase tracking-wider">Have a Preferred Coach?</Text>
                    {coachValidationStatus === 'valid' && (
                      <View className="bg-orange-500/10 px-2.5 py-0.5 rounded-full border border-orange-500/20">
                        <Text className="text-orange-600 text-[8px] font-black uppercase tracking-wider">Verified Match</Text>
                      </View>
                    )}
                  </View>
                  <TextInput
                    value={prefCoachId}
                    onChangeText={setPrefCoachId}
                    placeholder="Enter Coach ID (e.g. c-1)"
                    placeholderTextColor="#A1A1AA"
                    autoCapitalize="none"
                    className="border border-zinc-200 p-3.5 rounded-xl text-primary text-xs font-bold bg-white"
                  />
                  {coachValidationStatus === 'valid' && (
                    <Text className="text-orange-600 text-[10px] font-bold">
                      ✓ Requesting Coach {validatedCoachName}.
                    </Text>
                  )}
                  {coachValidationStatus === 'invalid' && (
                    <Text className="text-red-500 text-[10px] font-bold">
                      ⚠️ Coach ID not found. Leave blank to let VIRLA assign the best coach.
                    </Text>
                  )}
                  <Text className="text-[9px] text-zinc-400 font-medium leading-relaxed">
                    If your previous VIRLA coach shared their Coach ID with you, enter it here to request the same coach.
                  </Text>
                </View>

                {/* Selection of Payment Mode */}
                <View className="bg-zinc-50 border border-zinc-100 p-5 rounded-[24px] gap-3 shadow-xs">
                  <Text className="text-primary text-xs font-black uppercase tracking-wider">Payment Mode</Text>
                  
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setUseCreditsMode(true)}
                    className={`p-3.5 rounded-xl border flex-row justify-between items-center ${
                      useCreditsMode ? 'bg-zinc-900 border-zinc-900' : 'bg-white border-zinc-200'
                    }`}
                  >
                    <Text className={`text-xs font-bold ${useCreditsMode ? 'text-white' : 'text-zinc-600'}`}>Use Membership Credit (1 Credit)</Text>
                    <Text className={`text-[10px] font-black uppercase ${useCreditsMode ? 'text-orange-400' : 'text-zinc-400'}`}>
                      Balance: {membership.availableCredits}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setUseCreditsMode(false)}
                    className={`p-3.5 rounded-xl border flex-row justify-between items-center ${
                      !useCreditsMode ? 'bg-zinc-900 border-zinc-900' : 'bg-white border-zinc-200'
                    }`}
                  >
                    <Text className={`text-xs font-bold ${!useCreditsMode ? 'text-white' : 'text-zinc-600'}`}>Pay Cash / Card on Coach Arrival</Text>
                    <Text className={`text-xs font-black ${!useCreditsMode ? 'text-white' : 'text-primary'}`}>
                      ₹{workoutPrice - Math.round(workoutPrice * 0.15) + Math.round((workoutPrice - Math.round(workoutPrice * 0.15)) * 0.18)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

          </ScrollView>
        ) : (
          /* Step 7: Booking Confirmed Splash (Feature 8) */
          <View className="flex-1 justify-center items-center px-6 py-10 bg-white">
            <SuccessAnimation />
            
            <Heading className="mb-2 text-center">Your Booking Is Placed!</Heading>
            <Subtitle className="mb-8 text-center">
              We are assigning the best available certified VIRLA coach for your {activeWorkout.title} session.
            </Subtitle>

            {/* Receipt Summary Card */}
            <View className="w-full bg-zinc-50 border border-zinc-100 p-6 rounded-3xl mb-12 gap-3.5">
              <View className="flex-row justify-between items-center">
                <Text className="text-zinc-500 text-xs font-semibold">Booking ID</Text>
                <Text className="text-primary text-xs font-black">{newBookingId}</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-zinc-500 text-xs font-semibold">Workout Type</Text>
                <Text className="text-primary text-xs font-black">{activeWorkout.title}</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-zinc-500 text-xs font-semibold">Date</Text>
                <Text className="text-primary text-xs font-black">{selectedDate}</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-zinc-500 text-xs font-semibold">Time</Text>
                <Text className="text-primary text-xs font-black">{selectedTimeSlot.split(' - ')[0]}</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-zinc-500 text-xs font-semibold">Payment Status</Text>
                <Text className="text-orange-500 text-xs font-black">
                  {useCreditsMode ? 'Paid via Credit' : 'Cash/Card on Arrival'}
                </Text>
              </View>
              <View className="h-[1px] bg-zinc-200/50 my-1" />
              <View className="bg-orange-500/10 p-3 rounded-2xl border border-orange-500/15 items-center justify-center">
                <Text className="text-orange-600 text-[10px] font-black uppercase text-center leading-normal">
                  ⚡ Automatic coach matching active
                </Text>
              </View>
            </View>

            {/* Navigation actions */}
            <View className="w-full gap-4">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  router.replace({
                    pathname: '/session-detail' as any,
                    params: { id: newBookingId },
                  });
                }}
                className="w-full py-4 bg-zinc-900 rounded-2xl items-center justify-center shadow-sm"
              >
                <Text className="text-white text-base font-bold">
                  View Booking Details
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

      {/* Continue Action Button */}
      {step < 6 && (
        <View className="p-6 bg-white border-t border-zinc-100">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleNext}
            className="w-full py-4 bg-zinc-900 rounded-[20px] items-center justify-center shadow-sm"
          >
            <Text className="text-white text-base font-extrabold tracking-wide">
              Continue
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Confirm Booking Action Button */}
      {step === 6 && (
        <View className="p-6 bg-white border-t border-zinc-100">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleConfirmBooking}
            className="w-full py-4 bg-zinc-900 rounded-[20px] items-center justify-center shadow-sm"
          >
            <Text className="text-white text-base font-extrabold tracking-wide">
              Confirm Booking
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
