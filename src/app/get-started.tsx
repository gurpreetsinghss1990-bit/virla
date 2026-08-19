import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, Platform, KeyboardAvoidingView, ScrollView, TouchableWithoutFeedback, Keyboard, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Heading, Subtitle, PrimaryButton, SecondaryButton, AppLogo } from '@/presentation/components';
import { useUserStore } from '../store/userStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { useBookingStore } from '../store/bookingStore';
import { useMembershipStore } from '../store/membershipStore';
import { useWalletStore } from '../store/walletStore';
import { useAddressStore } from '../store/addressStore';
import { Database } from '../database/Database';
import { supabase } from '../database/supabaseClient';
import { OTPService } from '../services/OTPService';
import Constants from 'expo-constants';

export default function GetStartedScreen() {
  const insets = useSafeAreaInsets();
  const { setLoggedIn, setCompletedOnboarding, setRole, updateProfile } = useUserStore();

  const [showMobileForm, setShowMobileForm] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [formattedPhone, setFormattedPhone] = useState('');
  const [msg91AccessToken, setMsg91AccessToken] = useState('');

  // Trainer and OTP mode states
  const [useOtp] = useState(true);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [reqId, setReqId] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // New user onboarding setup states
  const [newUserIdToRegister, setNewUserIdToRegister] = useState<string | null>(null);
  const [tempUserObj, setTempUserObj] = useState<any | null>(null);
  const [setupStep, setSetupStep] = useState<number>(0);
  const [selectedGender, setSelectedGender] = useState<string>('Male');
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [age, setAge] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [weight, setWeight] = useState<string>('');

  const handlePhoneChange = (val: string) => {
    const cleanDigits = val.replace(/\D/g, '').slice(0, 10);
    setPhone(cleanDigits);

    if (cleanDigits.length > 5) {
      setFormattedPhone(`${cleanDigits.slice(0, 5)} ${cleanDigits.slice(5, 10)}`);
    } else {
      setFormattedPhone(cleanDigits);
    }
  };

  // Initialize the MSG91 OTP widget SDK and check resume state on mount
  useEffect(() => {
    const diag = OTPService.getDiagnostics();
    console.log('[OTP Service] Safe Diagnostics on Mount:', diag);
    const widgetId = process.env.EXPO_PUBLIC_MSG91_WIDGET_ID || '';
    const tokenAuth = process.env.EXPO_PUBLIC_MSG91_TOKEN_AUTH || '';
    OTPService.initialize(widgetId, tokenAuth);

    const checkResumeState = async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
      const { isLoggedIn, user } = useUserStore.getState();
      if (isLoggedIn && user && user.registrationStatus !== 'complete') {
        console.log(`[get-started] Resuming incomplete user: ${user.name} (status: ${user.registrationStatus})`);
        setTempUserObj(user);
        setNewUserIdToRegister(user.id);
        
        // Sync profile
        Database.setCurrentUserId(user.id);
        await useUserProfileStore.getState().syncFromDB();
        const profile = Database.getProfile(user.id);
        
        if (user.registrationStatus === 'name_pending' || !user.name || user.name === 'Complete your profile') {
          setSetupStep(0);
        } else if (!profile?.gender) {
          setSetupStep(1);
        } else if (!profile?.selectedGoals || profile.selectedGoals.length === 0) {
          setSetupStep(2);
        } else {
          setSetupStep(3);
        }
      }
    };
    checkResumeState();
  }, []);

  // Track retry countdown
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  const handleMobileSubmit = async () => {
    console.log('[DEBUG] Mobile Submit Button pressed. Entering handleMobileSubmit.');
    if (!phone || phone.length !== 10) {
      console.log('[DEBUG] Mobile Submit Validation Failed: Invalid phone length');
      Alert.alert('Required Fields', 'Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!otpCode) {
      console.log('[DEBUG] Mobile Submit Validation Failed: Missing OTP code');
      Alert.alert('Required Fields', 'Please enter the OTP code');
      return;
    }

    setIsLoading(true);

    try {
      // Real MSG91 OTP verification
      console.log('[DEBUG] Initiating client verifyOTP check...');
      const verifyRes = await OTPService.verifyOTP(phone, otpCode, reqId);
      
      if (!verifyRes.success || !verifyRes.token) {
        throw new Error(verifyRes.error || 'The OTP is incorrect or has expired. Please try again.');
      }

      // Save token in state for subsequent registration step
      setMsg91AccessToken(verifyRes.token);

      // Backend secure token verification
      console.log('[DEBUG] Token verified by MSG91 client. Requesting backend database verification...');
      
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { accessToken: verifyRes.token }
      });

      if (error) {
        console.error('[OTP Error] Invocation failed:', error);
        let errorMsg = 'Virla couldn\'t complete your sign-in right now. Please try again.';
        try {
          if ((error as any).context) {
            const ctxResponse = (error as any).context;
            const cloned = ctxResponse.clone();
            const body = await cloned.json();
            if (body && body.message) {
              errorMsg = body.message;
            }
          }
        } catch (e) {
          // ignore
        }
        throw new Error(errorMsg);
      }

      console.log('[OTP] Function invocation completed, parsing result...');
      const result = data;

      // SAFE DIAGNOSTIC LOGGING OF THE BACKEND RESPONSE CONTRACT
      console.log('[OTP Diagnostics] Backend response structure keys:', result ? Object.keys(result) : 'null/undefined');
      if (result && typeof result === 'object') {
        console.log('[OTP Diagnostics] success:', result.success);
        console.log('[OTP Diagnostics] isNewUser:', result.isNewUser);
        console.log('[OTP Diagnostics] user keys:', result.user ? Object.keys(result.user) : 'null');
        if (result.user) {
          console.log('[OTP Diagnostics] user.id:', result.user.id ? 'exists (len: ' + result.user.id.length + ')' : 'empty');
          console.log('[OTP Diagnostics] user.name:', result.user.name ? 'exists (len: ' + result.user.name.length + ')' : 'empty');
          console.log('[OTP Diagnostics] user.registrationStatus:', result.user.registrationStatus);
        }
        console.log('[OTP Diagnostics] session keys:', result.session ? Object.keys(result.session) : 'null');
      }

      if (result && result.success === true && result.user) {
        const userObj = result.user;
        const regStatus = userObj.registrationStatus || 'name_pending';

        if (regStatus === 'complete') {
          console.log('[DEBUG] Existing complete user detected. Proceeding to finalize session...');
          await finalizeUserSession(userObj);
          Alert.alert('Welcome', `Successfully authenticated as ${userObj.name}!`);
          router.replace('/(tabs)');
        } else {
          console.log(`[DEBUG] Incomplete registration detected (status: ${regStatus}). Set up resume...`);
          setTempUserObj(userObj);
          setNewUserIdToRegister(userObj.id || "");

          // Initialize/persist user session immediately for incomplete state so closures resume from setup
          await finalizeUserSession(userObj);

          const profile = Database.getProfile(userObj.id);

          if (regStatus === 'name_pending' || !userObj.name || userObj.name === 'Complete your profile') {
            setSetupStep(0);
          } else if (!profile?.gender) {
            setSetupStep(1);
          } else if (!profile?.selectedGoals || profile.selectedGoals.length === 0) {
            setSetupStep(2);
          } else {
            setSetupStep(3);
          }
        }
      } else {
        const failMsg = result?.message || 'Something went wrong while signing you in. Please try again.';
        throw new Error(failMsg);
      }
    } catch (err: any) {
      console.error('[DEBUG ERROR] Mobile submit authentication failure:', err);
      
      let friendlyMsg = 'Something went wrong while signing you in. Please try again.';
      if (err.message) {
        const lowerMsg = err.message.toLowerCase();
        if (lowerMsg.includes('network') || lowerMsg.includes('fetch') || lowerMsg.includes('internet')) {
          friendlyMsg = 'Please check your internet connection and try again.';
        } else if (lowerMsg.includes('incorrect') || lowerMsg.includes('invalid otp') || lowerMsg.includes('expired')) {
          friendlyMsg = 'The OTP is incorrect or has expired. Please try again.';
        } else if (lowerMsg.includes('credentials') || lowerMsg.includes('authkey') || lowerMsg.includes('server')) {
          friendlyMsg = 'Virla couldn\'t complete your sign-in right now. Please try again.';
        } else {
          friendlyMsg = err.message;
        }
      }
      Alert.alert('Authentication Error', friendlyMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsLoading(true);
    try {
      if (tempUserObj) {
        // userId can be blank (for new users before name registration)
        const userId = newUserIdToRegister || tempUserObj.id;

        if (setupStep === 0) {
          // --- STEP 0: NAME (Direct DB update since we already have the session and user row seeded) ---
          if (!name.trim()) {
            Alert.alert('Name Required', 'Please enter your full name to proceed.');
            setIsLoading(false);
            return;
          }

          console.log(`[DEBUG] Updating new user name to "${name}"...`);
          
          const { error: updateError } = await supabase
            .from('users')
            .update({ name: name.trim(), registration_status: 'PROFILE_DETAILS_PENDING' })
            .eq('id', userId);

          if (updateError) {
            throw new Error(updateError.message || 'Server failed to register name.');
          }

          const registeredUser = { ...tempUserObj, name: name.trim(), registrationStatus: 'incomplete' };
          setTempUserObj(registeredUser);
          setNewUserIdToRegister(registeredUser.id);
          
          // Seed local user profile record and initialize session
          await finalizeUserSession(registeredUser);
          
          console.log('[DEBUG] Step 0 complete: Name registered.');
          setSetupStep(1); // Proceed to Gender Selection

        } else if (setupStep === 1) {
          // --- STEP 1: GENDER ---
          console.log(`[DEBUG] Saving gender preference: ${selectedGender}`);
          Database.updateProfile(userId, { gender: selectedGender });
          setSetupStep(2); // Proceed to Goals Selection

        } else if (setupStep === 2) {
          // --- STEP 2: FITNESS GOALS ---
          if (selectedGoals.length === 0) {
            Alert.alert('Goals Required', 'Please select at least one fitness target.');
            setIsLoading(false);
            return;
          }
          console.log(`[DEBUG] Saving fitness targets: ${selectedGoals.join(', ')}`);
          Database.updateProfile(userId, { selectedGoals });
          setSetupStep(3); // Proceed to Stats

        } else if (setupStep === 3) {
          // --- STEP 3: STATS (Age, Height, Weight) & FINISH ---
          if (!age.trim() || !height.trim() || !weight.trim()) {
            Alert.alert('Required Fields', 'Please complete your Age, Height, and Weight.');
            setIsLoading(false);
            return;
          }

          console.log('[DEBUG] Saving physical statistics and completing registration...');
          Database.updateProfile(userId, {
            age: parseInt(age) || 0,
            height: height.trim(),
            weight: weight.trim()
          });

          // Mark registration complete on remote Supabase users table
          const { error: completeError } = await supabase
            .from('users')
            .update({ registration_status: 'complete' })
            .eq('id', userId);

          if (completeError) {
            throw new Error(completeError.message || 'Failed to update registration status on server.');
          }

          const completedUserObj = { ...tempUserObj, registrationStatus: 'complete' };
          await finalizeUserSession(completedUserObj);

          Alert.alert('Welcome', `Successfully authenticated as ${completedUserObj.name}!`);
          router.replace('/(tabs)');

          // Clear wizard states
          setNewUserIdToRegister(null);
          setTempUserObj(null);
        }
      }
    } catch (err: any) {
      console.error('[DEBUG ERROR] Wizard step update failed:', err);
      Alert.alert('Setup Failed', err.message || 'Could not complete registration step. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const finalizeUserSession = async (userObj: any) => {
    // Sync store states with user details
    setRole(userObj.role || 'customer');
    Database.setCurrentUserId(userObj.id);
    await setLoggedIn(true);
    setCompletedOnboarding(true);
    updateProfile(userObj);
    
    console.log('[DEBUG] Session established. Syncing database caches...');
    await useUserProfileStore.getState().syncFromDB();
    await useMembershipStore.getState().syncFromDB();
    await useBookingStore.getState().syncFromDB();
    await useWalletStore.getState().syncFromDB();
    useAddressStore.getState().syncFromDB();
    console.log('[DEBUG] Store synchronization completed successfully.');
  };

  const handleSendOtp = async () => {
    if (otpSent) {
      await handleResendOtp();
      return;
    }

    if (!phone) {
      Alert.alert('Phone Required', 'Please enter your mobile number to receive an OTP.');
      return;
    }

    setIsLoading(true);
    try {
      console.log('[DEBUG] Calling OTPService.sendOTP...');
      const res = await OTPService.sendOTP(phone);
      if (res.success && res.reqId) {
        setReqId(res.reqId);
        setOtpSent(true);
        setResendCountdown(10); // Start 10s resend timer
        Alert.alert('OTP Sent', 'OTP has been sent to your mobile number.');
      } else {
        let friendlyMsg = 'We couldn\'t send the OTP. Please try again.';
        if (res.error && (res.error.includes('AuthenticationFailure') || res.error.includes('authkey') || res.error.includes('credentials'))) {
          friendlyMsg = 'Authentication configuration error. Please contact support.';
        } else if (res.error) {
          friendlyMsg = res.error;
        }
        Alert.alert('Send Failure', friendlyMsg);
      }
    } catch (e: any) {
      console.error('[DEBUG ERROR] Send OTP failed:', e);
      Alert.alert('Error', e.message || 'We couldn\'t send the OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0) {
      return;
    }
    if (resendCount >= 2) {
      Alert.alert('Limit Reached', 'Too many attempts. Please try again later.');
      return;
    }

    setIsLoading(true);
    try {
      console.log('[DEBUG] Calling OTPService.retryOTP...');
      const res = await OTPService.retryOTP(phone, reqId);
      if (res.success) {
        setResendCountdown(10);
        setResendCount(prev => prev + 1);
        Alert.alert('OTP Resent', 'OTP has been resent successfully.');
      } else {
        let friendlyMsg = 'OTP resend failed. Please try again.';
        if (res.error && (res.error.includes('AuthenticationFailure') || res.error.includes('authkey') || res.error.includes('credentials'))) {
          friendlyMsg = 'Authentication configuration error. Please contact support.';
        } else if (res.error) {
          friendlyMsg = res.error;
        }
        Alert.alert('Resend Failure', friendlyMsg);
      }
    } catch (e: any) {
      console.error('[DEBUG ERROR] Resend OTP failed:', e);
      Alert.alert('Error', e.message || 'OTP resend failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const proceedOAuth = async (provider: 'google' | 'apple', providerId: string, name: string, email: string, role?: 'customer' | 'trainer' | 'admin') => {
    console.log(`[DEBUG] proceedOAuth entered. Provider: ${provider}, ProviderId: ${providerId}, Name: ${name}, Email: ${email}, Role: ${role}`);
    try {
      console.log(`[DEBUG] OAuth request started for ${provider}`);
      const userObj = await Database.oauthLogin(provider, providerId, name, email, role);
      console.log(`[DEBUG] Provider response received successfully. Authenticated user ID: ${userObj.id}, Role: ${userObj.role}`);
      
      Database.setCurrentUserId(userObj.id);
      setLoggedIn(true);
      setCompletedOnboarding(true);
      setRole(userObj.role || 'customer');
      updateProfile(userObj);
      console.log(`[DEBUG] Session created in stores for user ID: ${userObj.id}`);

      // Load actual user profile and other stores from DB
      console.log('[DEBUG] Starting user/profile store synchronization from DB...');
      await useUserProfileStore.getState().syncFromDB();
      await useMembershipStore.getState().syncFromDB();
      await useBookingStore.getState().syncFromDB();
      await useWalletStore.getState().syncFromDB();
      console.log('[DEBUG] User/profile synchronization completed successfully.');
      
      Alert.alert('Welcome', `Successfully authenticated as ${userObj.name}!`);
      console.log('[DEBUG] Navigation starting to Home tab /(tabs)...');
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('[DEBUG ERROR] OAuth authentication failed:', err);
      Alert.alert('OAuth Error', err.message || 'An error occurred during OAuth simulation');
    }
  };

  const handleOAuth = async (provider: 'google' | 'apple') => {
    console.log(`[DEBUG] handleOAuth Button pressed for provider: ${provider}`);
    const formattedProvider = provider === 'google' ? 'Google' : 'Apple';
    
    // Compile-time environment flag to prevent mock login in production
    const ENABLE_MOCK_LOGIN = __DEV__;
    
    if (ENABLE_MOCK_LOGIN) {
      console.log('[DEBUG] Development environment detected. Launching Development Google/Apple login mock.');
      if (Platform.OS === 'web') {
        console.log('[DEBUG] Web platform detected. Showing window.prompt dialog.');
        const choice = window.prompt(
          `[DEVELOPMENT ONLY] Select Generic Test Account:\n\nType "1" for: Test Customer (customer.test@${provider}.com)\nType "2" for: Test Trainer (trainer.test@${provider}.com)\nType "3" for: Test Admin (admin.test@${provider}.com)`
        );
        
        if (choice === '1') {
          console.log('[DEBUG] Selected Test Customer account on web.');
          await proceedOAuth(provider, `${provider}-test-customer`, 'Test Customer', `customer.test@${provider}.com`, 'customer');
        } else if (choice === '2') {
          console.log('[DEBUG] Selected Test Trainer account on web.');
          await proceedOAuth(provider, `${provider}-test-trainer`, 'Test Trainer', `trainer.test@${provider}.com`, 'trainer');
        } else if (choice === '3') {
          console.log('[DEBUG] Selected Test Admin account on web.');
          await proceedOAuth(provider, `${provider}-test-admin`, 'Test Admin', `admin.test@${provider}.com`, 'admin');
        } else {
          console.log('[DEBUG] Invalid input or cancelled.');
        }
      } else {
        console.log('[DEBUG] Mobile platform detected. Showing Alert.alert dialogue.');
        Alert.alert(
          `[DEVELOPMENT ONLY] Development ${formattedProvider} Login`,
          `Choose a generic test account:`,
          [
            { 
              text: `Test Customer (customer.test@${provider}.com)`, 
              onPress: () => {
                console.log('[DEBUG] Selected Test Customer account on mobile.');
                proceedOAuth(provider, `${provider}-test-customer`, 'Test Customer', `customer.test@${provider}.com`, 'customer');
              }
            },
            { 
              text: `Test Trainer (trainer.test@${provider}.com)`, 
              onPress: () => {
                console.log('[DEBUG] Selected Test Trainer account on mobile.');
                proceedOAuth(provider, `${provider}-test-trainer`, 'Test Trainer', `trainer.test@${provider}.com`, 'trainer');
              }
            },
            { 
              text: `Test Admin (admin.test@${provider}.com)`, 
              onPress: () => {
                console.log('[DEBUG] Selected Test Admin account on mobile.');
                proceedOAuth(provider, `${provider}-test-admin`, 'Test Admin', `admin.test@${provider}.com`, 'admin');
              }
            },
            { 
              text: 'Cancel', 
              style: 'cancel',
              onPress: () => console.log('[DEBUG] OAuth selection cancelled.')
            }
          ]
        );
      }
    } else {
      console.log(`[DEBUG] Production environment detected. Triggering official Supabase OAuth flow for ${provider}`);
      try {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: provider,
          options: {
            redirectTo: Platform.OS === 'web' ? window.location.origin : 'virla://(tabs)'
          }
        });
        
        if (error) throw error;
        console.log(`[DEBUG] Production OAuth flow initiated successfully. Data:`, data);
      } catch (err: any) {
        console.error('[DEBUG ERROR] Production OAuth flow failed:', err);
        Alert.alert(`${formattedProvider} Sign-In Error`, err.message || 'An error occurred during authentication');
      }
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={{ flex: 1, backgroundColor: '#F7F8FC', paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          {/* Background Luxury Glowing Aura */}
          <View className="absolute top-0 left-0 right-0 h-[45%] overflow-hidden" pointerEvents="none">
            <Svg width="100%" height="100%" viewBox="0 0 360 300" fill="none">
              <Defs>
                <LinearGradient id="auraGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#4F46E5" stopOpacity="0.12" />
                  <Stop offset="50%" stopColor="#6D5EF7" stopOpacity="0.06" />
                  <Stop offset="100%" stopColor="#F5B942" stopOpacity="0.0" />
                </LinearGradient>
              </Defs>
              <Circle cx={180} cy={60} r={220} fill="url(#auraGrad)" />
              <Path d="M0 180 Q180 120 360 180" stroke="white" strokeWidth={2} opacity={0.3} />
              <Path d="M0 210 Q180 160 360 210" stroke="white" strokeWidth={1} opacity={0.15} />
            </Svg>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 24 }}
            className="flex-1 z-10"
          >
            {/* Top Header Logo */}
            <View className="items-center mt-6">
              <AppLogo size="large" />
              <Heading className="mt-8 mb-2">
                {newUserIdToRegister !== null
                  ? (setupStep === 0 ? 'Welcome!' : `Welcome back, ${tempUserObj?.name && tempUserObj.name !== 'Complete your profile' ? tempUserObj.name.split(' ')[0] : 'User'}!`)
                  : 'Welcome Back'}
              </Heading>
              <Subtitle align="center" className="max-w-[85%] mt-1">
                {newUserIdToRegister !== null
                  ? (setupStep === 0 ? 'Step 1 of 4: Enter your full name to start registration.' : `Step ${setupStep + 1} of 4: Complete your details.`)
                  : 'Log in using your registered mobile number.'}
              </Subtitle>
            </View>

            {newUserIdToRegister !== null ? (
              /* Profile Setup Form Wizard for New Users */
              <View 
                className="bg-white p-6 rounded-[28px] border border-zinc-150 gap-4 my-6"
                style={{
                  elevation: 1,
                  shadowColor: '#101828',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                }}
              >
                {setupStep === 0 && (
                  <View className="gap-4">
                    <Heading>What is your name?</Heading>
                    <Subtitle>Enter your full name to start registration.</Subtitle>
                    <TextInput
                      placeholder="Full Name"
                      placeholderTextColor="#9CA3AF"
                      value={name}
                      onChangeText={setName}
                      editable={!isLoading}
                      className="w-full bg-zinc-50 border border-zinc-150 p-4 rounded-xl text-zinc-900 text-sm font-semibold"
                    />
                  </View>
                )}

                {setupStep === 1 && (
                  <View className="gap-4">
                    <Heading>Select your gender</Heading>
                    <Subtitle>Helps match safety certified trainers.</Subtitle>
                    <View className="flex-row gap-3">
                      {['Male', 'Female', 'Other'].map((g) => {
                        const isSel = selectedGender === g;
                        return (
                          <TouchableOpacity
                            key={g}
                            activeOpacity={0.8}
                            onPress={() => setSelectedGender(g)}
                            className={`flex-1 py-3.5 rounded-xl border items-center justify-center ${isSel ? 'bg-[#101828] border-[#101828]' : 'bg-white border-zinc-200'}`}
                          >
                            <Text className={`text-[10px] font-black uppercase tracking-wider ${isSel ? 'text-white' : 'text-zinc-650'}`}>{g}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {setupStep === 2 && (
                  <View className="gap-4">
                    <Heading>Choose fitness targets</Heading>
                    <Subtitle>Select one or more workout priorities.</Subtitle>
                    <View className="flex-row flex-wrap gap-2">
                      {['Weight Loss', 'Fat Loss', 'Muscle Gain', 'Strength', 'Flexibility', 'General Fitness'].map((goal) => {
                        const isSel = selectedGoals.includes(goal);
                        return (
                          <TouchableOpacity
                            key={goal}
                            activeOpacity={0.8}
                            onPress={() => {
                              if (isSel) {
                                setSelectedGoals(selectedGoals.filter(x => x !== goal));
                              } else {
                                setSelectedGoals([...selectedGoals, goal]);
                              }
                            }}
                            className={`px-3.5 py-2 rounded-xl border ${isSel ? 'bg-[#E11D48] border-[#E11D48]' : 'bg-white border-zinc-200'}`}
                          >
                            <Text className={`text-[9px] font-black uppercase tracking-wider ${isSel ? 'text-white' : 'text-zinc-700'}`}>{goal}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {setupStep === 3 && (
                  <View className="gap-4">
                    <Heading>Physical Statistics</Heading>
                    <Subtitle>Complete your details to finish setup.</Subtitle>
                    <View className="gap-3">
                      <TextInput
                        placeholder="Age"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="number-pad"
                        value={age}
                        onChangeText={setAge}
                        editable={!isLoading}
                        className="w-full bg-zinc-50 border border-zinc-150 p-4 rounded-xl text-zinc-900 text-sm font-semibold"
                      />
                      <TextInput
                        placeholder="Height (e.g. 175 cm)"
                        placeholderTextColor="#9CA3AF"
                        value={height}
                        onChangeText={setHeight}
                        editable={!isLoading}
                        className="w-full bg-zinc-50 border border-zinc-150 p-4 rounded-xl text-zinc-900 text-sm font-semibold"
                      />
                      <TextInput
                        placeholder="Weight (e.g. 70 kg)"
                        placeholderTextColor="#9CA3AF"
                        value={weight}
                        onChangeText={setWeight}
                        editable={!isLoading}
                        className="w-full bg-zinc-50 border border-zinc-150 p-4 rounded-xl text-zinc-900 text-sm font-semibold"
                      />
                    </View>
                  </View>
                )}

                {isLoading && (
                  <View className="items-center justify-center py-2">
                    <ActivityIndicator size="small" color="#4F46E5" />
                  </View>
                )}

                <View className="mt-2 gap-3.5">
                  <PrimaryButton
                    title={isLoading ? 'Saving...' : setupStep === 3 ? 'Finish Setup' : 'Next Step'}
                    onPress={isLoading ? () => {} : handleSaveProfile}
                  />
                </View>
              </View>
            ) : (
              /* Mobile Login/Register Form */
              <View 
                className="bg-white p-6 rounded-[28px] border border-zinc-150 gap-4 my-6"
                style={{
                  elevation: 1,
                  shadowColor: '#101828',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                }}
              >
                <View className="flex-row gap-2 w-full items-center">
                  <View className="flex-1 flex-row items-center bg-zinc-50 border border-zinc-150 rounded-xl px-4">
                    <Text className="text-zinc-500 font-extrabold text-sm mr-2">+91</Text>
                    <TextInput
                      placeholder="98765 43210"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      value={formattedPhone}
                      onChangeText={handlePhoneChange}
                      editable={!isLoading}
                      className="flex-1 py-4 text-zinc-900 text-sm font-semibold"
                    />
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={isLoading ? () => {} : handleSendOtp}
                    disabled={isLoading || resendCountdown > 0}
                    className={`px-4 py-4 rounded-xl justify-center items-center ${isLoading || resendCountdown > 0 ? 'bg-zinc-400' : 'bg-[#101828]'}`}
                  >
                    <Text className="text-white text-xs font-bold uppercase tracking-wider">
                      {otpSent ? (resendCountdown > 0 ? `Resend (${resendCountdown}s)` : 'Resend') : 'Send OTP'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {otpSent && (
                  <TextInput
                    placeholder="Enter 6-Digit OTP Code"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    value={otpCode}
                    onChangeText={setOtpCode}
                    editable={!isLoading}
                    className="w-full bg-zinc-50 border border-zinc-150 p-4 rounded-xl text-zinc-900 text-sm font-semibold"
                  />
                )}

                {isLoading && (
                  <View className="items-center justify-center py-2">
                    <ActivityIndicator size="small" color="#4F46E5" />
                  </View>
                )}

                <View className="mt-2 gap-3.5">
                  <PrimaryButton
                    title={isLoading ? 'Processing...' : 'Verify & Log In'}
                    onPress={isLoading ? () => {} : handleMobileSubmit}
                  />
                </View>
              </View>
            )}


            {/* Terms & Privacy Policies at the Bottom */}
            <View className="px-4">
              <Text className="text-[12px] text-zinc-400 text-center leading-relaxed">
                By continuing, you agree to VIRLA&apos;s{'\n'}
                <Text className="text-zinc-500 font-extrabold underline">Terms of Service</Text>
                {'  '}&{'  '}
                <Text className="text-zinc-500 font-extrabold underline">Privacy Policy</Text>
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}
