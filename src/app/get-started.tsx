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

  const [showMobileForm, setShowMobileForm] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // Trainer and OTP mode states
  const [useOtp, setUseOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [reqId, setReqId] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize the MSG91 OTP widget SDK on mount
  useEffect(() => {
    const diag = OTPService.getDiagnostics();
    console.log('[OTP Service] Safe Diagnostics on Mount:', diag);
    const widgetId = process.env.EXPO_PUBLIC_MSG91_WIDGET_ID || '';
    const tokenAuth = process.env.EXPO_PUBLIC_MSG91_TOKEN_AUTH || '';
    OTPService.initialize(widgetId, tokenAuth);
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
    if (!phone || (isRegisterMode && !name)) {
      console.log('[DEBUG] Mobile Submit Validation Failed: Missing phone or name');
      Alert.alert('Required Fields', 'Please fill in all details');
      return;
    }
    if (!useOtp && !password) {
      console.log('[DEBUG] Mobile Submit Validation Failed: Missing password');
      Alert.alert('Required Fields', 'Please enter your password');
      return;
    }
    if (useOtp && !otpCode) {
      console.log('[DEBUG] Mobile Submit Validation Failed: Missing OTP code');
      Alert.alert('Required Fields', 'Please enter the OTP code');
      return;
    }

    setIsLoading(true);

    try {
      if (useOtp) {
        // Real MSG91 OTP verification
        console.log('[DEBUG] Initiating client verifyOTP check...');
        const verifyRes = await OTPService.verifyOTP(phone, otpCode, reqId);
        
        if (!verifyRes.success || !verifyRes.token) {
          throw new Error(verifyRes.error || 'The OTP is incorrect. Please try again.');
        }

        // Backend secure token verification
        console.log('[DEBUG] Token verified by MSG91 client. Requesting backend database verification...');
        
        // Optional local Edge Function override for local simulator testing
        const localUrl = process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_LOCAL_URL;
        let result: any;

        if (localUrl && __DEV__) {
          console.log('[DEBUG] Testing locally served Edge Function:', localUrl);
          const res = await fetch(localUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: verifyRes.token })
          });
          result = await res.json();
          if (!res.ok) {
            throw new Error(result.error || 'Backend verification failed');
          }
        } else {
          console.log('[DEBUG] Invoking Supabase production Edge Function: verify-otp');
          
          // Log client-side details before invocation
          const tokenStr = verifyRes.token || '';
          const tokenParts = tokenStr.split('.');
          console.log(`[DEBUG] Forwarding token to verify-otp. Length: ${tokenStr.length}, segments: ${tokenParts.length}`);

          const { data, error } = await supabase.functions.invoke('verify-otp', {
            body: { accessToken: verifyRes.token }
          });
          if (error) {
            let serverErrorMsg = '';
            try {
              if (error && (error as any).context) {
                const ctxResponse = (error as any).context;
                const cloned = ctxResponse.clone();
                const body = await cloned.json();
                serverErrorMsg = body.message || body.error || '';
                
                // Formulate descriptive diagnostic error for alert visibility
                if (body.diagnostics) {
                  const diag = body.diagnostics;
                  const resKeys = diag.result ? Object.keys(diag.result).join(', ') : 'null';
                  const jwtKeys = diag.jwtPayload ? Object.keys(diag.jwtPayload).join(', ') : 'null';
                  
                  // Safe type representation of potential fields
                  const msgType = diag.result?.message || 'undefined';
                  const statusType = diag.result?.status || 'undefined';
                  const typeType = diag.result?.type || 'undefined';
                  
                  serverErrorMsg += `\n\n[Diagnostics - Result keys: [${resKeys}], JWT claims: [${jwtKeys}], msg: ${msgType}, status: ${statusType}, type: ${typeType}]`;
                }
              }
            } catch (e) {
              console.error('[DEBUG] Failed to parse backend error body:', e);
            }
            throw new Error(serverErrorMsg || error.message || 'Backend verification failed');
          }
          result = data;
        }

        if (result && result.success && result.user) {
          const userObj = result.user;
          await finalizeUserSession(userObj);
        } else {
          throw new Error(result?.error || 'Invalid backend validation response');
        }
      } else {
        // Standard password login
        const userObj = isRegisterMode
          ? await Database.register(name, phone, password)
          : await Database.login(phone, password);
        await finalizeUserSession(userObj);
      }
    } catch (err: any) {
      console.error('[DEBUG ERROR] Mobile submit authentication failure:', err);
      
      let friendlyMsg = 'Something went wrong. Please try again.';
      if (err.message) {
        const lowerMsg = err.message.toLowerCase();
        if (lowerMsg.includes('authenticationfailure') || lowerMsg.includes('authkey') || lowerMsg.includes('credentials')) {
          friendlyMsg = 'Authentication configuration error. Please try again later or contact support.';
        } else if (lowerMsg.includes('incorrect') || lowerMsg.includes('invalid otp')) {
          friendlyMsg = 'The OTP is incorrect. Please try again.';
        } else if (lowerMsg.includes('expired')) {
          friendlyMsg = 'The OTP has expired. Please request a new OTP.';
        } else if (lowerMsg.includes('limit reached') || lowerMsg.includes('too many attempts')) {
          friendlyMsg = 'Too many attempts. Please try again later.';
        } else if (lowerMsg.includes('network') || lowerMsg.includes('timeout')) {
          friendlyMsg = 'Network timeout. Please check your connection and try again.';
        } else {
          friendlyMsg = err.message;
        }
      }
      Alert.alert('Authentication Error', friendlyMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const finalizeUserSession = async (userObj: any) => {
    // Sync store states with user details
    setRole(userObj.role || 'customer');
    Database.setCurrentUserId(userObj.id);
    setLoggedIn(true);
    setCompletedOnboarding(true);
    updateProfile(userObj);
    
    console.log('[DEBUG] Session established. Syncing database caches...');
    await useUserProfileStore.getState().syncFromDB();
    await useMembershipStore.getState().syncFromDB();
    await useBookingStore.getState().syncFromDB();
    await useWalletStore.getState().syncFromDB();
    useAddressStore.getState().syncFromDB();
    console.log('[DEBUG] Store synchronization completed successfully.');

    Alert.alert('Welcome', `Successfully authenticated as ${userObj.name}!`);
    router.replace('/(tabs)');
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
                {showMobileForm 
                  ? (isRegisterMode ? 'Create Account' : 'Welcome Back') 
                  : 'Begin Your Journey'}
              </Heading>
              <Subtitle align="center" className="max-w-[85%] mt-1">
                {showMobileForm 
                  ? (isRegisterMode ? 'Enter details to start your home wellness journey.' : 'Log in using your registered mobile number.')
                  : 'Access India\'s premium home wellness platform. Professional coaching, personalized for you.'}
              </Subtitle>
            </View>

            {showMobileForm ? (
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
                {/* Password vs OTP Login toggle selector */}
                {!isRegisterMode && (
                  <View className="flex-row bg-zinc-50 border border-zinc-150 p-1.5 rounded-2xl mb-1">
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => { setUseOtp(false); setOtpSent(false); }}
                      className={`flex-1 py-2.5 rounded-xl items-center justify-center ${!useOtp ? 'bg-[#101828]' : ''}`}
                    >
                      <Text className={`text-[10px] font-black uppercase tracking-wider ${!useOtp ? 'text-white' : 'text-zinc-500'}`}>Password</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setUseOtp(true)}
                      className={`flex-1 py-2.5 rounded-xl items-center justify-center ${useOtp ? 'bg-[#101828]' : ''}`}
                    >
                      <Text className={`text-[10px] font-black uppercase tracking-wider ${useOtp ? 'text-white' : 'text-zinc-500'}`}>OTP Login</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {isRegisterMode && (
                  <TextInput
                    placeholder="Full Name"
                    placeholderTextColor="#9CA3AF"
                    value={name}
                    onChangeText={setName}
                    className="w-full bg-zinc-50 border border-zinc-150 p-4 rounded-xl text-zinc-900 text-sm font-semibold"
                  />
                )}
                
                <View className="flex-row gap-2 w-full">
                  <TextInput
                    placeholder="Mobile Number"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                    editable={!isLoading}
                    className="flex-1 bg-zinc-50 border border-zinc-150 p-4 rounded-xl text-zinc-900 text-sm font-semibold"
                  />
                  {useOtp && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={isLoading ? () => {} : handleSendOtp}
                      disabled={isLoading || resendCountdown > 0}
                      className={`px-4 rounded-xl justify-center items-center ${isLoading || resendCountdown > 0 ? 'bg-zinc-400' : 'bg-[#101828]'}`}
                    >
                      <Text className="text-white text-xs font-bold uppercase tracking-wider">
                        {otpSent ? (resendCountdown > 0 ? `Resend (${resendCountdown}s)` : 'Resend') : 'Send OTP'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {useOtp ? (
                  <TextInput
                    placeholder="Enter 6-Digit OTP Code"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    value={otpCode}
                    onChangeText={setOtpCode}
                    editable={!isLoading}
                    className="w-full bg-zinc-50 border border-zinc-150 p-4 rounded-xl text-zinc-900 text-sm font-semibold"
                  />
                ) : (
                  <TextInput
                    placeholder="Password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
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
                    title={isLoading ? 'Processing...' : (isRegisterMode ? 'Create Account' : 'Log In')}
                    onPress={isLoading ? () => {} : handleMobileSubmit}
                  />
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setIsRegisterMode(!isRegisterMode)}
                    className="items-center py-1"
                  >
                    <Text className="text-indigo-600 text-xs font-black uppercase tracking-wider">
                      {isRegisterMode ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      setShowMobileForm(false);
                    }}
                    className="items-center py-1"
                  >
                    <Text className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                      Go Back
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* Auth Buttons Group */
              <View className="gap-4 my-8 px-2">
                {/* Primary Mobile Button */}
                <PrimaryButton
                  title="Continue with Mobile Number"
                  onPress={() => setShowMobileForm(true)}
                  icon={<Text className="text-white text-base">📱</Text>}
                />

                {/* Secondary Google Button */}
                <SecondaryButton
                  title="Continue with Google"
                  onPress={() => handleOAuth('google')}
                  icon={<Text className="text-zinc-800 text-base">🌐</Text>}
                />

                {/* Secondary Apple Button */}
                <SecondaryButton
                  title="Continue with Apple"
                  onPress={() => handleOAuth('apple')}
                  icon={<Text className="text-zinc-800 text-lg font-bold"></Text>}
                />
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
