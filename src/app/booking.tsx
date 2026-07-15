import React, { useState, useEffect } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Image } from 'react-native';
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
  const workoutId = params.workoutId as string;

  const { workouts } = useWorkoutStore();
  const { addBooking } = useBookingStore();
  const { membership, useCredit } = useMembershipStore();
  const { familyMembers } = useUserStore();
  
  // Zustand Stores for Step State Management (Feature 14)
  const { addresses, addAddress, selectedAddressId, setSelectedAddressId } = useAddressStore();
  const { selectedCoachId, setSelectedCoachId, coaches } = useCoachStore();
  const { selectedDate, setSelectedDate } = useCalendarStore();
  const { selectedTimeSlot, setSelectedTimeSlot, timeSlots } = useTimeSlotStore();

  const workout = workouts.find((w) => w.id === workoutId) || workouts[0];

  // Wizard Steps (Steps 2 to 8)
  const [step, setStep] = useState(2);

  // --- Sub-states for Forms ---
  const [beneficiary, setBeneficiary] = useState('myself'); // 'myself' | 'family'
  const [selectedFamilyMemberId, setSelectedFamilyMemberId] = useState('');
  
  // New Family Member Form
  const [showFamilyForm, setShowFamilyForm] = useState(false);
  const [fmName, setFmName] = useState('');
  const [fmAge, setFmAge] = useState('');
  const [fmGender, setFmGender] = useState('Female');
  const [fmRelation, setFmRelation] = useState('');
  const [fmNotes, setFmNotes] = useState('');

  // New Address Form
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addrLabel, setAddrLabel] = useState('');
  const [addrLine, setAddrLine] = useState('');
  const [addrDefault, setAddrDefault] = useState(false);

  // Booking details confirmation state
  const [newBookingId, setNewBookingId] = useState('');
  const [assigningCoach, setAssigningCoach] = useState(false);
  const [useCreditsMode, setUseCreditsMode] = useState(true);

  // Set initial selected values if empty
  useEffect(() => {
    if (addresses.length > 0 && !selectedAddressId) {
      const defaultAddr = addresses.find(a => a.isDefault) || addresses[0];
      setSelectedAddressId(defaultAddr.id);
    }
  }, [addresses]);

  const handleNext = () => {
    // Validations
    if (step === 2) {
      if (!selectedAddressId) {
        Alert.alert('Address Required', 'Please select a delivery address for the workout session.');
        return;
      }
    }
    if (step === 3) {
      if (beneficiary === 'family' && !selectedFamilyMemberId && !showFamilyForm) {
        Alert.alert('Selection Required', 'Please select a family member or add a new one.');
        return;
      }
    }
    if (step === 4 && !selectedDate) {
      Alert.alert('Date Required', 'Please select a workout date.');
      return;
    }
    if (step === 5 && !selectedTimeSlot) {
      Alert.alert('Time Slot Required', 'Please select an hourly slot.');
      return;
    }
    if (step === 6 && !selectedCoachId) {
      Alert.alert('Coach Required', 'Please select a wellness coach.');
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

  // Add a new family member to user store inline
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

    // Push into store (inline update)
    useUserStore.setState((state) => ({
      familyMembers: [...state.familyMembers, newMember]
    }));

    setSelectedFamilyMemberId(newMember.id);
    setShowFamilyForm(false);
    
    // Reset form
    setFmName('');
    setFmAge('');
    setFmGender('Female');
    setFmRelation('');
    setFmNotes('');
    
    Alert.alert('Success', `${newMember.name} has been added to your profile.`);
  };

  // Add a new address inline
  const handleAddNewAddress = () => {
    if (!addrLabel.trim() || !addrLine.trim()) {
      Alert.alert('Incomplete Form', 'Please enter a Label (e.g. Work, Gym) and full Address.');
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

  // Processes booking completion
  const handleConfirmBooking = () => {
    if (useCreditsMode && membership.availableCredits <= 0) {
      Alert.alert('No Credits Available', 'You do not have enough credits. Purchase more credits or pay with card.');
      return;
    }

    const bookingId = `b-wiz-${Date.now()}`;
    setNewBookingId(bookingId);

    const activeCoach = coaches.find(c => c.id === selectedCoachId) || coaches[0];
    const activeAddress = addresses.find(a => a.id === selectedAddressId) || addresses[0];
    const activeFamily = familyMembers.find(f => f.id === selectedFamilyMemberId);

    if (useCreditsMode) {
      useCredit(); // Deduct credits in store (Feature 9)
    }

    const coachPrice = activeCoach?.price || 1200;

    // Add to booking list (Feature 14)
    addBooking({
      id: bookingId,
      trainerName: activeCoach.name,
      trainerPhoto: activeCoach.photo,
      workoutTitle: workout.title,
      date: selectedDate,
      time: selectedTimeSlot.split(' - ')[0],
      price: coachPrice,
      address: activeAddress.addressLine,
      familyMember: activeFamily ? {
        name: activeFamily.name,
        age: activeFamily.age || 25,
        gender: activeFamily.gender || 'Female',
        relation: activeFamily.relation,
        notes: activeFamily.notes || ''
      } : undefined
    });

    setStep(8); // confirmation success
  };

  // Dynamic titles for the layout header
  const getHeaderTitle = () => {
    switch (step) {
      case 2: return 'Select Location';
      case 3: return 'Who is joining?';
      case 4: return 'Choose Date';
      case 5: return 'Choose Time';
      case 6: return 'Select Wellness Coach';
      case 7: return 'Review Summary';
      case 8: return 'Confirmed';
      default: return 'Book Session';
    }
  };

  const activeCoach = coaches.find(c => c.id === selectedCoachId) || coaches[0];
  const coachPrice = activeCoach?.price || 1200;
  const activeAddress = addresses.find(a => a.id === selectedAddressId) || addresses[0];
  const activeFamily = familyMembers.find(f => f.id === selectedFamilyMemberId);

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
            
            {/* Step 2: Address Selection (Feature 2) */}
            {step === 2 && (
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
                      <View className={`w-4 h-4 rounded border items-center justify-center ${addrDefault ? 'bg-green-500 border-green-500' : 'border-zinc-300'}`}>
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
                            isSelected ? 'border-primary bg-zinc-50/50' : 'border-zinc-100'
                          }`}
                        >
                          <View className="flex-1 pr-4">
                            <View className="flex-row items-center gap-2 mb-1">
                              <Text className="text-primary text-sm font-black">{addr.label}</Text>
                              {addr.isDefault && (
                                <View className="bg-green-500/10 px-2.5 py-0.5 rounded-full border border-green-500/20">
                                  <Text className="text-green-600 text-[8px] font-black uppercase tracking-wider">Default</Text>
                                </View>
                              )}
                            </View>
                            <Text className="text-zinc-500 text-xs font-semibold leading-relaxed" numberOfLines={2}>
                              {addr.addressLine}
                            </Text>
                          </View>
                          <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${isSelected ? 'border-primary' : 'border-zinc-200'}`}>
                            {isSelected && <View className="w-2.5 h-2.5 rounded-full bg-green-500" />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Step 3: Family Selection (Feature 3) */}
            {step === 3 && (
              <View className="gap-4">
                <Text className="text-zinc-500 text-sm font-medium">
                  Select who this wellness workout session is for:
                </Text>
                
                {/* Beneficiary choices */}
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      setBeneficiary('myself');
                      setSelectedFamilyMemberId('');
                      setShowFamilyForm(false);
                    }}
                    className={`flex-1 p-4 rounded-2xl border-2 items-center justify-center ${
                      beneficiary === 'myself' ? 'border-primary bg-zinc-50/50' : 'border-zinc-100'
                    }`}
                  >
                    <Text className="text-lg mb-1">🙋‍♂️</Text>
                    <Text className="text-primary text-xs font-black">Myself</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setBeneficiary('family')}
                    className={`flex-1 p-4 rounded-2xl border-2 items-center justify-center ${
                      beneficiary === 'family' ? 'border-primary bg-zinc-50/50' : 'border-zinc-100'
                    }`}
                  >
                    <Text className="text-lg mb-1">👨‍👩‍👧‍👦</Text>
                    <Text className="text-primary text-xs font-black">Family Member</Text>
                  </TouchableOpacity>
                </View>

                {/* Family selection sub-view */}
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
                            placeholder="Relation (e.g. Mother, Sister)"
                            placeholderTextColor="#A1A1AA"
                            className="flex-1 border border-zinc-200 p-3 rounded-xl text-primary text-xs font-bold bg-white"
                          />
                        </View>
                        
                        {/* Gender Selector */}
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
                          placeholder="Special fitness notes, safety alerts, or requirements"
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
                      /* Family member cards list */
                      <View className="gap-2">
                        {familyMembers.map((member) => {
                          const isSelected = selectedFamilyMemberId === member.id;
                          return (
                            <TouchableOpacity
                              key={member.id}
                              activeOpacity={0.8}
                              onPress={() => setSelectedFamilyMemberId(member.id)}
                              className={`p-4 rounded-2xl border-2 flex-row justify-between items-center ${
                                isSelected ? 'border-primary bg-zinc-50/50' : 'border-zinc-100'
                              }`}
                            >
                              <View>
                                <Text className="text-primary text-sm font-black">{member.name}</Text>
                                <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">{member.relation}</Text>
                              </View>
                              <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${isSelected ? 'border-primary' : 'border-zinc-200'}`}>
                                {isSelected && <View className="w-2.5 h-2.5 rounded-full bg-green-500" />}
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

            {/* Step 4: Date Picker (Feature 4) */}
            {step === 4 && (
              <View className="gap-4">
                <Text className="text-zinc-500 text-sm font-medium mb-2 px-6">
                  Select your preferred workout date
                </Text>
                <DatePicker 
                  selectedDate={selectedDate} 
                  onSelect={setSelectedDate} 
                />
                <Text className="text-[10px] text-zinc-400 font-semibold px-6 mt-4">
                  Note: Available weekdays are highlighted. Weekend booking slots are fully booked.
                </Text>
              </View>
            )}

            {/* Step 5: Time Selector (Feature 5) */}
            {step === 5 && (
              <View className="gap-4">
                <Text className="text-zinc-500 text-sm font-medium">
                  Select a preferred hourly slot
                </Text>
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
            )}

            {/* Step 6: Coach Selection (Feature 6 & 12) */}
            {step === 6 && (
              <View className="gap-4">
                <Text className="text-zinc-500 text-sm font-medium mb-2">
                  Select an elite wellness coach for your session:
                </Text>
                
                {coaches.map((coach) => {
                  const isSelected = selectedCoachId === coach.id;
                  return (
                    <TouchableOpacity
                      key={coach.id}
                      activeOpacity={0.9}
                      onPress={() => setSelectedCoachId(coach.id)}
                      className={`bg-white border-2 rounded-[24px] overflow-hidden p-5 flex-row gap-4 shadow-sm ${
                        isSelected ? 'border-primary bg-zinc-50/50' : 'border-zinc-100'
                      }`}
                    >
                      <Image
                        source={{ uri: coach.photo }}
                        className="w-20 h-20 rounded-full border border-zinc-100"
                      />
                      
                      <View className="flex-1 gap-1">
                        <View className="flex-row justify-between items-start">
                          <View className="flex-row items-center gap-1.5">
                            <Text className="text-primary text-base font-extrabold tracking-tight">{coach.name}</Text>
                            {coach.verifiedBadge && (
                              <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
                            )}
                          </View>
                          <View className="flex-row items-center gap-1">
                            <Ionicons name="star" size={12} color="#EAB308" />
                            <Text className="text-primary text-xs font-black">{coach.rating}</Text>
                          </View>
                        </View>

                        <Text className="text-zinc-400 text-[9px] font-bold uppercase tracking-wider">
                          {coach.specialization || coach.specialty}
                        </Text>
                        <Text className="text-zinc-500 text-xs font-semibold leading-relaxed mt-1" numberOfLines={2}>
                          {coach.shortBio}
                        </Text>

                        <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-zinc-100/50">
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => {
                              router.push({
                                pathname: '/coach-profile' as any,
                                params: { id: coach.id }
                              });
                            }}
                            className="bg-zinc-100 px-3.5 py-1.5 rounded-xl border border-zinc-200/50"
                          >
                            <Text className="text-zinc-700 text-[10px] font-bold uppercase tracking-wider">View Profile</Text>
                          </TouchableOpacity>
                          
                          <Text className="text-primary text-xs font-black">₹{coach.price || 1200}/session</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Step 7: Summary & Receipt (Feature 7) */}
            {step === 7 && (
              <View className="gap-4">
                <Text className="text-zinc-500 text-sm font-medium">
                  Please review and confirm your session invoice details.
                </Text>
                
                <BookingSummaryCard
                  workoutTitle={workout.title}
                  workoutIcon={workout.icon}
                  coachName={activeCoach.name}
                  coachPhoto={activeCoach.photo}
                  date={selectedDate}
                  time={selectedTimeSlot}
                  address={activeAddress.addressLine}
                  price={activeCoach.price || workout.sessionPrice || 1200}
                  creditsBefore={membership.availableCredits}
                  useCreditsMode={useCreditsMode}
                />

                {/* Selection of Payment Mode */}
                <View className="bg-zinc-50 border border-zinc-100 p-5 rounded-[24px] gap-3 mt-2 shadow-xs">
                  <Text className="text-primary text-xs font-black uppercase tracking-wider">Payment Mode</Text>
                  
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setUseCreditsMode(true)}
                    className={`p-3.5 rounded-xl border flex-row justify-between items-center ${
                      useCreditsMode ? 'bg-zinc-900 border-zinc-900' : 'bg-white border-zinc-200'
                    }`}
                  >
                    <Text className={`text-xs font-bold ${useCreditsMode ? 'text-white' : 'text-zinc-600'}`}>Use Membership Credit (1 Credit)</Text>
                    <Text className={`text-[10px] font-black uppercase ${useCreditsMode ? 'text-green-400' : 'text-zinc-400'}`}>
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
                      ₹{coachPrice - Math.round(coachPrice * 0.15) + Math.round((coachPrice - Math.round(coachPrice * 0.15)) * 0.18)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

          </ScrollView>
        ) : (
          /* Step 8: Success Splash confirmation (Feature 8) */
          <View className="flex-1 justify-center items-center px-6 py-10 bg-white">
            <SuccessAnimation />
            
            <Heading className="mb-2">Your Session Is Confirmed!</Heading>
            <Subtitle className="mb-8">
              Wellness coach {activeCoach.name} has been booked for your {workout.title} session.
            </Subtitle>

            {/* Receipt Summary Card */}
            <View className="w-full bg-zinc-50 border border-zinc-100 p-5 rounded-3xl mb-12 gap-3">
              <View className="flex-row justify-between items-center">
                <Text className="text-zinc-500 text-xs font-semibold">Booking ID</Text>
                <Text className="text-primary text-xs font-black">{newBookingId}</Text>
              </View>
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
                <Text className="text-primary text-xs font-black">{selectedTimeSlot.split(' - ')[0]}</Text>
              </View>
              <View className="flex-row justify-between items-start">
                <Text className="text-zinc-500 text-xs font-semibold mr-4">Address</Text>
                <Text className="text-primary text-xs font-black flex-1 text-right leading-tight">{activeAddress.addressLine}</Text>
              </View>
              <View className="h-[1px] bg-zinc-200/50 my-1" />
              <View className="flex-row justify-between items-center">
                <Text className="text-zinc-500 text-xs font-semibold">Estimated Arrival</Text>
                <Text className="text-green-500 text-xs font-black">Trainer arrives 10m early</Text>
              </View>
            </View>

            {/* Success Navigation actions */}
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
