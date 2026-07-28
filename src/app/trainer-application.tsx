import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, Switch, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Database, TrainerApplication } from '../database/Database';
import { LuxuryCard } from '../components/LuxuryCard';

export default function TrainerApplicationScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [appId, setAppId] = useState<string | null>(null);
  const [appStatus, setAppStatus] = useState<'draft' | 'pending' | 'approved' | 'rejected'>('draft');

  // Step 1: Personal Info
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Male');
  const [avatar, setAvatar] = useState('https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=300&q=80');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Mumbai');
  const [state, setState] = useState('Maharashtra');
  const [pinCode, setPinCode] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Step 2: Professional Info
  const [primaryWorkout, setPrimaryWorkout] = useState('Strength Training');
  const [secondarySkills, setSecondarySkills] = useState('HIIT, Core, Mobility');
  const [yearsOfExperience, setYearsOfExperience] = useState('5');
  const [languages, setLanguages] = useState('English, Hindi');
  const [aboutMe, setAboutMe] = useState('');
  const [fitnessQualifications, setFitnessQualifications] = useState('ACE Certified Personal Trainer');

  // Step 3: Working Preferences
  const [workingDays, setWorkingDays] = useState<string[]>(['Mon', 'Wed', 'Fri']);
  const [availabilityMorning, setAvailabilityMorning] = useState(true);
  const [availabilityAfternoon, setAvailabilityAfternoon] = useState(true);
  const [availabilityEvening, setAvailabilityEvening] = useState(true);
  const [maxSessionsPerDay, setMaxSessionsPerDay] = useState('4');
  const [preferredWorkingRadius, setPreferredWorkingRadius] = useState('10');
  const [preferredCities, setPreferredCities] = useState<string[]>(['Mumbai']);

  // Step 4: Bank Details
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankUpiId, setBankUpiId] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [gstNumber, setGstNumber] = useState('');

  // Step 5: Verification uploads (Simulated paths)
  const [documentAadhaar, setDocumentAadhaar] = useState('');
  const [documentPan, setDocumentPan] = useState('');
  const [documentSelfie, setDocumentSelfie] = useState('');
  const [documentCertifications, setDocumentCertifications] = useState('');

  const toggleDay = (day: string) => {
    if (workingDays.includes(day)) {
      setWorkingDays(workingDays.filter(d => d !== day));
    } else {
      setWorkingDays([...workingDays, day]);
    }
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!fullName || !phone || !email || !dob || !address || !pinCode) {
        Alert.alert('Missing Info', 'Please fill in all personal details.');
        return;
      }
    } else if (currentStep === 2) {
      if (!aboutMe || !fitnessQualifications) {
        Alert.alert('Missing Info', 'Please describe your qualifications and background.');
        return;
      }
    } else if (currentStep === 4) {
      if (!bankAccountName || !bankName || !bankAccountNumber || !bankIfsc || !panNumber) {
        Alert.alert('Missing Info', 'Please provide banking details for payouts.');
        return;
      }
    }
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    if (!documentAadhaar || !documentPan || !documentSelfie) {
      Alert.alert('Required Documents', 'Please upload Aadhaar, PAN, and selfie mock files.');
      return;
    }

    try {
      const emergencyContactJSON = JSON.stringify({
        name: emergencyName || 'Neha Sharma',
        relationship: 'Sister',
        phone: emergencyPhone || '+91 98200 11223'
      });

      const application = await Database.submitTrainerApplication({
        fullName,
        phone,
        email,
        dob,
        gender,
        avatar,
        address,
        city,
        state,
        pinCode,
        emergencyContact: emergencyContactJSON,
        primaryWorkout,
        secondarySkills,
        yearsOfExperience: parseInt(yearsOfExperience) || 3,
        languages,
        aboutMe,
        fitnessQualifications,
        workingDays,
        availabilityMorning,
        availabilityAfternoon,
        availabilityEvening,
        maxSessionsPerDay: parseInt(maxSessionsPerDay) || 4,
        preferredWorkingRadius: parseInt(preferredWorkingRadius) || 10,
        preferredCities,
        bankAccountName,
        bankName,
        bankAccountNumber,
        bankIfsc,
        bankUpiId,
        panNumber,
        gstNumber: gstNumber || undefined,
        documentAadhaar,
        documentPan,
        documentSelfie,
        documentCertifications: JSON.stringify([documentCertifications])
      });

      setAppId(application.id);
      setAppStatus('pending');
      Alert.alert('Application Submitted', 'Your onboarding credentials are under review by the admin panel.');
    } catch (err: any) {
      Alert.alert('Submission Error', err.message || 'Error occurred while saving application.');
    }
  };

  const handleSimulateApproval = async () => {
    if (!appId) return;
    try {
      await Database.approveTrainerApplication(appId);
      setAppStatus('approved');
      Alert.alert('Onboarding Approved 🎉', `Trainer account created! Log in with number: ${phone} and OTP: 1234.`);
    } catch (err: any) {
      Alert.alert('Simulation Error', err.message);
    }
  };

  const handleSimulateRejection = async () => {
    if (!appId) return;
    try {
      await Database.rejectTrainerApplication(appId);
      setAppStatus('rejected');
      Alert.alert('Onboarding Rejected ❌', 'Application rejected. You can edit and resubmit.');
    } catch (err: any) {
      Alert.alert('Simulation Error', err.message);
    }
  };

  return (
    <SafeAreaViewWrapper>
      <View className="h-16 flex-row items-center px-6 justify-between bg-white border-b border-zinc-150">
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.back()} className="flex-row items-center gap-1">
          <Feather name="arrow-left" size={16} color="#101828" />
          <Text className="text-zinc-900 text-xs font-bold uppercase tracking-wider">Back</Text>
        </TouchableOpacity>
        <Text className="text-[#E11D48] text-sm font-black tracking-widest uppercase">Trainer Join</Text>
        <View className="w-10" />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 140 }}
        className="flex-1 bg-[#F7F8FC]"
      >
        <View className="mb-6">
          <Text className="text-zinc-400 text-xs font-extrabold uppercase tracking-widest">Apply as Partner</Text>
          <Text className="text-[#101828] text-2xl font-black tracking-tight mt-1">Onboarding Application</Text>
          {appStatus === 'draft' && (
            <View className="flex-row items-center gap-1.5 mt-3">
              {[1, 2, 3, 4, 5].map(step => (
                <View 
                  key={step} 
                  className={`h-2 rounded-full flex-1 ${step <= currentStep ? 'bg-[#E11D48]' : 'bg-zinc-200'}`}
                />
              ))}
            </View>
          )}
        </View>

        {appStatus === 'pending' && (
          <LuxuryCard className="p-6 gap-5 items-center justify-center bg-amber-50/20 border-amber-100/50" interactive={false}>
            <Text className="text-4xl">⏳</Text>
            <Text className="text-[#101828] text-lg font-extrabold text-center uppercase tracking-wider">Verification Pending</Text>
            <Text className="text-zinc-500 text-xs text-center leading-relaxed">
              Your trainer profile verification is under review. Our operations team is auditing your certificates and PAN card documents.
            </Text>
            
            <View className="w-full h-[1px] bg-zinc-200 my-2" />
            
            <Text className="text-[#6B7280] text-[10px] font-bold uppercase">Simulate Verification Actions</Text>
            <View className="w-full gap-3">
              <TouchableOpacity
                onPress={handleSimulateApproval}
                className="w-full py-4 bg-emerald-600 rounded-xl items-center justify-center"
              >
                <Text className="text-white text-xs font-black uppercase tracking-wider">Simulate Admin Approval</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSimulateRejection}
                className="w-full py-4 bg-rose-600 rounded-xl items-center justify-center"
              >
                <Text className="text-white text-xs font-black uppercase tracking-wider">Simulate Admin Rejection</Text>
              </TouchableOpacity>
            </View>
          </LuxuryCard>
        )}

        {appStatus === 'approved' && (
          <LuxuryCard className="p-6 gap-5 items-center justify-center bg-emerald-50/20 border-emerald-100/50" interactive={false}>
            <Text className="text-4xl">🎉</Text>
            <Text className="text-[#101828] text-lg font-extrabold text-center uppercase tracking-wider">Application Approved</Text>
            <Text className="text-zinc-500 text-xs text-center leading-relaxed">
              Congratulations! Your coach profile is now active on the platform. Go back and log in with your phone number and OTP code.
            </Text>
            <TouchableOpacity
              onPress={() => router.replace('/get-started')}
              className="w-full py-4 bg-[#101828] rounded-xl items-center justify-center mt-2"
            >
              <Text className="text-white text-xs font-black uppercase tracking-wider">Return to Login</Text>
            </TouchableOpacity>
          </LuxuryCard>
        )}

        {appStatus === 'rejected' && (
          <LuxuryCard className="p-6 gap-5 items-center justify-center bg-rose-50/20 border-rose-100/50" interactive={false}>
            <Text className="text-4xl">❌</Text>
            <Text className="text-[#101828] text-lg font-extrabold text-center uppercase tracking-wider">Application Rejected</Text>
            <Text className="text-zinc-500 text-xs text-center leading-relaxed">
              Your certificates do not comply with the standards. Resubmit correct qualifications.
            </Text>
            <TouchableOpacity
              onPress={() => setAppStatus('draft')}
              className="w-full py-4 bg-zinc-900 rounded-xl items-center justify-center mt-2"
            >
              <Text className="text-white text-xs font-black uppercase tracking-wider">Modify Application</Text>
            </TouchableOpacity>
          </LuxuryCard>
        )}

        {appStatus === 'draft' && (
          <>
            {currentStep === 1 && (
              <LuxuryCard className="p-5 gap-4" interactive={false}>
                <Text className="text-[#101828] text-xs font-black uppercase tracking-widest border-b border-zinc-100 pb-2">Step 1: Personal Details</Text>
                
                <View className="gap-3.5">
                  <View>
                    <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Full Name</Text>
                    <TextInput 
                      value={fullName} onChangeText={setFullName} placeholder="Karan Sharma"
                      className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold"
                    />
                  </View>
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Mobile Number</Text>
                      <TextInput 
                        value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+91 99999 88888"
                        className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Email</Text>
                      <TextInput 
                        value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="karan@virla.pro"
                        className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold"
                      />
                    </View>
                  </View>
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Date of Birth</Text>
                      <TextInput 
                        value={dob} onChangeText={setDob} placeholder="14/10/1995"
                        className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Gender</Text>
                      <TextInput 
                        value={gender} onChangeText={setGender} placeholder="Male"
                        className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold"
                      />
                    </View>
                  </View>
                  <View>
                    <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Residential Address</Text>
                    <TextInput 
                      value={address} onChangeText={setAddress} placeholder="A-404, Sea Breeze Towers, Worli"
                      className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold"
                    />
                  </View>
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">City</Text>
                      <TextInput value={city} onChangeText={setCity} className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">PIN Code</Text>
                      <TextInput 
                        value={pinCode} onChangeText={setPinCode} placeholder="400018"
                        className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold"
                      />
                    </View>
                  </View>
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Emergency Contact Name</Text>
                      <TextInput value={emergencyName} onChangeText={setEmergencyName} placeholder="Neha Sharma" className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Emergency Phone</Text>
                      <TextInput value={emergencyPhone} onChangeText={setEmergencyPhone} placeholder="+91 98200 11223" className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold" />
                    </View>
                  </View>
                </View>
              </LuxuryCard>
            )}

            {currentStep === 2 && (
              <LuxuryCard className="p-5 gap-4" interactive={false}>
                <Text className="text-[#101828] text-xs font-black uppercase tracking-widest border-b border-zinc-100 pb-2">Step 2: Professional Details</Text>
                
                <View className="gap-3.5">
                  <View>
                    <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Primary Workout Specialization</Text>
                    <TextInput 
                      value={primaryWorkout} onChangeText={setPrimaryWorkout} placeholder="Strength Training"
                      className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold"
                    />
                  </View>
                  <View>
                    <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Secondary Skills</Text>
                    <TextInput value={secondarySkills} onChangeText={setSecondarySkills} placeholder="HIIT, Core, Boxing Conditioning" className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold" />
                  </View>
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Years of Experience</Text>
                      <TextInput value={yearsOfExperience} onChangeText={setYearsOfExperience} keyboardType="number-pad" className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Languages Spoken</Text>
                      <TextInput value={languages} onChangeText={setLanguages} placeholder="English, Hindi, Punjabi" className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold" />
                    </View>
                  </View>
                  <View>
                    <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Fitness Qualifications</Text>
                    <TextInput value={fitnessQualifications} onChangeText={setFitnessQualifications} placeholder="ACE Certified Trainer, CPR/AED" className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold" />
                  </View>
                  <View>
                    <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">About Me / Coach Bio</Text>
                    <TextInput 
                      value={aboutMe} onChangeText={setAboutMe} multiline numberOfLines={3} placeholder="Tell clients about your coaching style and philosophy..."
                      className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold h-20 text-start"
                    />
                  </View>
                </View>
              </LuxuryCard>
            )}

            {currentStep === 3 && (
              <LuxuryCard className="p-5 gap-4" interactive={false}>
                <Text className="text-[#101828] text-xs font-black uppercase tracking-widest border-b border-zinc-100 pb-2">Step 3: Working Preferences</Text>
                
                <View className="gap-4">
                  <View>
                    <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-2">Available Working Days</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                        const selected = workingDays.includes(day);
                        return (
                          <TouchableOpacity 
                            key={day} onPress={() => toggleDay(day)}
                            className={`px-3.5 py-2 rounded-xl border ${selected ? 'bg-[#101828] border-[#101828]' : 'bg-white border-zinc-200'}`}
                          >
                            <Text className={`text-[9px] font-bold uppercase ${selected ? 'text-white' : 'text-zinc-500'}`}>{day}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <View>
                    <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-2.5 border-b border-zinc-100 pb-1.5">Availability Segments</Text>
                    <View className="gap-2.5">
                      <View className="flex-row justify-between items-center">
                        <Text className="text-zinc-700 text-xs font-semibold">Morning Slot (06:00 AM - 12:00 PM)</Text>
                        <Switch value={availabilityMorning} onValueChange={setAvailabilityMorning} trackColor={{ true: '#E11D48' }} />
                      </View>
                      <View className="flex-row justify-between items-center">
                        <Text className="text-zinc-700 text-xs font-semibold">Afternoon Slot (12:00 PM - 04:00 PM)</Text>
                        <Switch value={availabilityAfternoon} onValueChange={setAvailabilityAfternoon} trackColor={{ true: '#E11D48' }} />
                      </View>
                      <View className="flex-row justify-between items-center">
                        <Text className="text-zinc-700 text-xs font-semibold">Evening Slot (04:00 PM - 09:00 PM)</Text>
                        <Switch value={availabilityEvening} onValueChange={setAvailabilityEvening} trackColor={{ true: '#E11D48' }} />
                      </View>
                    </View>
                  </View>

                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Max Sessions/Day</Text>
                      <TextInput value={maxSessionsPerDay} onChangeText={setMaxSessionsPerDay} keyboardType="number-pad" className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Working Radius (km)</Text>
                      <TextInput value={preferredWorkingRadius} onChangeText={setPreferredWorkingRadius} keyboardType="number-pad" className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold" />
                    </View>
                  </View>
                </View>
              </LuxuryCard>
            )}

            {currentStep === 4 && (
              <LuxuryCard className="p-5 gap-4" interactive={false}>
                <Text className="text-[#101828] text-xs font-black uppercase tracking-widest border-b border-zinc-100 pb-2">Step 4: Banking Details</Text>
                
                <View className="gap-3.5">
                  <View>
                    <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Account Holder Name</Text>
                    <TextInput value={bankAccountName} onChangeText={setBankAccountName} placeholder="Karan Sharma" className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold" />
                  </View>
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Bank Name</Text>
                      <TextInput value={bankName} onChangeText={setBankName} placeholder="HDFC Bank" className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">IFSC Code</Text>
                      <TextInput value={bankIfsc} onChangeText={setBankIfsc} placeholder="HDFC0000060" className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold" />
                    </View>
                  </View>
                  <View>
                    <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Bank Account Number</Text>
                    <TextInput value={bankAccountNumber} onChangeText={setBankAccountNumber} placeholder="50100412345678" className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold" />
                  </View>
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">UPI ID</Text>
                      <TextInput value={bankUpiId} onChangeText={setBankUpiId} placeholder="karan@okhdfc" className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">PAN Card Number</Text>
                      <TextInput value={panNumber} onChangeText={setPanNumber} placeholder="ABCDE1234F" className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold" />
                    </View>
                  </View>
                </View>
              </LuxuryCard>
            )}

            {currentStep === 5 && (
              <LuxuryCard className="p-5 gap-4" interactive={false}>
                <Text className="text-[#101828] text-xs font-black uppercase tracking-widest border-b border-zinc-100 pb-2">Step 5: Document Uploads</Text>
                
                <View className="gap-3.5">
                  <View className="flex-row justify-between items-center border-b border-zinc-100 pb-3">
                    <View>
                      <Text className="text-zinc-900 text-xs font-semibold">Aadhaar Card (PDF/Image)</Text>
                      <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">{documentAadhaar ? '✓ Uploaded Successfully' : '⚠️ Missing Aadhaar upload'}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setDocumentAadhaar('uploads/aadhaar_mock.jpg')}
                      className={`px-4 py-2.5 rounded-xl border ${documentAadhaar ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-zinc-200'}`}
                    >
                      <Text className={`text-[8.5px] font-bold uppercase ${documentAadhaar ? 'text-emerald-600' : 'text-zinc-800'}`}>{documentAadhaar ? 'Modify' : 'Upload'}</Text>
                    </TouchableOpacity>
                  </View>

                  <View className="flex-row justify-between items-center border-b border-zinc-100 pb-3">
                    <View>
                      <Text className="text-zinc-900 text-xs font-semibold">PAN Card (PDF/Image)</Text>
                      <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">{documentPan ? '✓ Uploaded Successfully' : '⚠️ Missing PAN upload'}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setDocumentPan('uploads/pan_mock.jpg')}
                      className={`px-4 py-2.5 rounded-xl border ${documentPan ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-zinc-200'}`}
                    >
                      <Text className={`text-[8.5px] font-bold uppercase ${documentPan ? 'text-emerald-600' : 'text-zinc-800'}`}>{documentPan ? 'Modify' : 'Upload'}</Text>
                    </TouchableOpacity>
                  </View>

                  <View className="flex-row justify-between items-center border-b border-zinc-100 pb-3">
                    <View>
                      <Text className="text-zinc-900 text-xs font-semibold">Profile Selfie Photo</Text>
                      <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">{documentSelfie ? '✓ Uploaded Successfully' : '⚠️ Missing Selfie upload'}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setDocumentSelfie('uploads/selfie_mock.jpg');
                        setAvatar('https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=300&q=80');
                      }}
                      className={`px-4 py-2.5 rounded-xl border ${documentSelfie ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-zinc-200'}`}
                    >
                      <Text className={`text-[8.5px] font-bold uppercase ${documentSelfie ? 'text-emerald-600' : 'text-zinc-800'}`}>{documentSelfie ? 'Modify' : 'Upload'}</Text>
                    </TouchableOpacity>
                  </View>

                  <View className="flex-row justify-between items-center pb-2">
                    <View>
                      <Text className="text-zinc-900 text-xs font-semibold">Certifications Documents</Text>
                      <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">{documentCertifications ? '✓ Uploaded Successfully' : '⚠️ Optional certifications file'}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setDocumentCertifications('uploads/certs_mock.pdf')}
                      className={`px-4 py-2.5 rounded-xl border ${documentCertifications ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-zinc-200'}`}
                    >
                      <Text className={`text-[8.5px] font-bold uppercase ${documentCertifications ? 'text-emerald-600' : 'text-zinc-800'}`}>{documentCertifications ? 'Modify' : 'Upload'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </LuxuryCard>
            )}

            <View className="flex-row gap-3 mt-6">
              {currentStep > 1 && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleBack}
                  className="flex-1 py-4 bg-zinc-200 rounded-xl items-center justify-center"
                >
                  <Text className="text-zinc-800 text-xs font-black uppercase tracking-wider">Back</Text>
                </TouchableOpacity>
              )}
              
              {currentStep < 5 ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleNext}
                  className="flex-1 py-4 bg-[#101828] rounded-xl items-center justify-center"
                >
                  <Text className="text-white text-xs font-black uppercase tracking-wider">Next</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleSubmit}
                  className="flex-1 py-4 bg-[#E11D48] rounded-xl items-center justify-center shadow-lg shadow-rose-950/20"
                >
                  <Text className="text-white text-xs font-black uppercase tracking-wider">Submit Application</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaViewWrapper>
  );
}

function SafeAreaViewWrapper({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'ios') {
    return <View style={styles.container}>{children}</View>;
  }
  return <View className="flex-1 bg-[#F7F8FC]">{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FC',
    paddingTop: 48
  }
});
