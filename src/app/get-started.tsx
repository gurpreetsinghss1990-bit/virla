import React, { useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Heading, Subtitle, PrimaryButton, SecondaryButton, AppLogo } from '@/presentation/components';
import { useUserStore } from '../store/userStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { useBookingStore } from '../store/bookingStore';
import { useMembershipStore } from '../store/membershipStore';
import { useWalletStore } from '../store/walletStore';
import { Database } from '../database/Database';
import { supabase } from '../database/supabaseClient';

export default function GetStartedScreen() {
  const router = useRouter();
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

    try {
      let userObj;
      console.log('[DEBUG] Mobile Submit validation passed. Starting login request. useOtp:', useOtp);
      if (useOtp) {
        if (otpCode !== '1234') {
          console.log('[DEBUG] Mobile Submit Error: Invalid OTP code provided');
          Alert.alert('Invalid OTP', 'The OTP code is incorrect. Hint: Use 1234.');
          return;
        }
        // Simulated OTP Verification against Database user
        const matched = Database.schema.users.find(u => u.phone === phone);
        if (!matched) {
          console.log('[DEBUG] Mobile Submit Error: User not found for phone:', phone);
          Alert.alert('User Not Found', 'No customer or trainer account matches this phone number. Please register first.');
          return;
        }
        userObj = {
          id: matched.id,
          name: matched.name,
          email: matched.email,
          avatar: matched.avatar,
          location: 'Mumbai, India',
          role: matched.role
        };
      } else {
        userObj = isRegisterMode
          ? await Database.register(name, phone, password)
          : await Database.login(phone, password);
      }

      console.log(`[DEBUG] Login request completed successfully. User ID: ${userObj.id}, Name: ${userObj.name}, Role: ${userObj.role}`);

      // Finalize Role validation based on authenticated account capability
      setRole(userObj.role || 'customer');

      Database.setCurrentUserId(userObj.id);
      setLoggedIn(true);
      setCompletedOnboarding(true);
      updateProfile(userObj);
      console.log('[DEBUG] Session created in stores.');

      // Load actual user profile and other stores from DB
      console.log('[DEBUG] Starting database store sync for logged in user...');
      await useUserProfileStore.getState().syncFromDB();
      await useMembershipStore.getState().syncFromDB();
      await useBookingStore.getState().syncFromDB();
      await useWalletStore.getState().syncFromDB();
      console.log('[DEBUG] Database store sync completed successfully.');
      
      Alert.alert('Welcome', `Successfully authenticated as ${userObj.name}!`);
      console.log('[DEBUG] Navigation starting to Home tab /(tabs)...');
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('[DEBUG ERROR] Mobile submit authentication failure:', err);
      Alert.alert('Authentication Error', err.message || 'An error occurred during authentication');
    }
  };

  const handleSendOtp = () => {
    if (!phone) {
      Alert.alert('Phone Required', 'Please enter your mobile number to receive an OTP.');
      return;
    }
    setOtpSent(true);
    Alert.alert('OTP Sent', `A simulated verification code has been sent to ${phone}. Enter "1234" to login.`);
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
    <SafeAreaView className="flex-1 bg-[#F7F8FC]">
      {/* Background Luxury Glowing Aura */}
      <View className="absolute top-0 left-0 right-0 h-[45%] overflow-hidden">
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

      <View className="flex-1 justify-between px-6 py-10 z-10">
        {/* Top Header Logo */}
        <View className="items-center mt-10">
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
          <View className="bg-white p-6 rounded-[28px] border border-zinc-150 shadow-sm gap-4">
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
                className="flex-1 bg-zinc-50 border border-zinc-150 p-4 rounded-xl text-zinc-900 text-sm font-semibold"
              />
              {useOtp && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleSendOtp}
                  className="bg-[#101828] px-4 rounded-xl justify-center items-center"
                >
                  <Text className="text-white text-xs font-bold uppercase tracking-wider">{otpSent ? 'Resend' : 'Send OTP'}</Text>
                </TouchableOpacity>
              )}
            </View>

            {useOtp ? (
              <TextInput
                placeholder="Enter 4-Digit OTP Code (Hint: 1234)"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                value={otpCode}
                onChangeText={setOtpCode}
                className="w-full bg-zinc-50 border border-zinc-150 p-4 rounded-xl text-zinc-900 text-sm font-semibold"
              />
            ) : (
              <TextInput
                placeholder="Password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                className="w-full bg-zinc-50 border border-zinc-150 p-4 rounded-xl text-zinc-900 text-sm font-semibold"
              />
            )}

            <View className="mt-2 gap-3.5">
              <PrimaryButton
                title={isRegisterMode ? 'Create Account' : 'Log In'}
                onPress={handleMobileSubmit}
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
          <View className="gap-4 mb-4 px-2">
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
            By continuing, you agree to VIRLA's{'\n'}
            <Text className="text-zinc-500 font-extrabold underline">Terms of Service</Text>
            {'  '}&{'  '}
            <Text className="text-zinc-500 font-extrabold underline">Privacy Policy</Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
