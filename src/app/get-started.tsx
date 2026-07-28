import React, { useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Heading, Subtitle, PrimaryButton, SecondaryButton, AppLogo } from '@/presentation/components';
import { useUserStore } from '../store/userStore';
import { Database } from '../database/Database';

export default function GetStartedScreen() {
  const router = useRouter();
  const { setLoggedIn, setCompletedOnboarding, setRole, updateProfile } = useUserStore();

  const [showMobileForm, setShowMobileForm] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // Trainer and OTP mode states
  const [isTrainerMode, setIsTrainerMode] = useState(false);
  const [useOtp, setUseOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const handleMobileSubmit = async () => {
    if (!phone || (isRegisterMode && !name)) {
      Alert.alert('Required Fields', 'Please fill in all details');
      return;
    }
    if (!useOtp && !password) {
      Alert.alert('Required Fields', 'Please enter your password');
      return;
    }
    if (useOtp && !otpCode) {
      Alert.alert('Required Fields', 'Please enter the OTP code');
      return;
    }

    try {
      let userObj;
      if (useOtp) {
        if (otpCode !== '1234') {
          Alert.alert('Invalid OTP', 'The OTP code is incorrect. Hint: Use 1234.');
          return;
        }
        // Simulated OTP Verification against Database user
        const matched = Database.schema.users.find(u => u.phone === phone);
        if (!matched) {
          if (isTrainerMode) {
            Alert.alert(
              'Trainer Not Found', 
              'No approved trainer account matches this phone number. Please submit an application first.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Apply as Trainer', onPress: () => router.push('/trainer-application') }
              ]
            );
          } else {
            Alert.alert('User Not Found', 'No customer account matches this phone number. Please register first.');
          }
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
        if (isTrainerMode) {
          // Verify user exists and is a trainer
          const matched = Database.schema.users.find(u => u.phone === phone);
          if (!matched || matched.role !== 'trainer') {
            Alert.alert(
              'Trainer Not Found', 
              'No approved trainer account matches this phone. Click "Apply as Trainer" below if you are new.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Apply as Trainer', onPress: () => router.push('/trainer-application') }
              ]
            );
            return;
          }
        }
        userObj = isRegisterMode
          ? await Database.register(name, phone, password)
          : await Database.login(phone, password);
      }

      // Finalize Role validation
      if (isTrainerMode && userObj.role !== 'trainer') {
        Alert.alert('Access Denied', 'This phone number is associated with a customer account. Please use Customer Login.');
        return;
      }
      if (!isTrainerMode && userObj.role === 'trainer') {
        Alert.alert('Access Redirect', 'This is a trainer account. Redirecting you to the Trainer Console.');
        setRole('trainer');
      } else {
        setRole(userObj.role || 'customer');
      }

      setLoggedIn(true);
      setCompletedOnboarding(true);
      updateProfile(userObj);
      
      Alert.alert('Welcome', `Successfully authenticated as ${userObj.name}!`);
      router.replace('/(tabs)');
    } catch (err: any) {
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

  const handleOAuth = async (provider: 'google' | 'apple') => {
    try {
      const randId = Math.floor(1000 + Math.random() * 9000).toString();
      const mockName = provider === 'google' ? 'Google User' : 'Apple User';
      const userObj = await Database.oauthLogin(provider, `${provider}-${randId}`, mockName);
      
      setLoggedIn(true);
      setCompletedOnboarding(true);
      setRole('customer');
      updateProfile(userObj);
      
      Alert.alert('Success', `Authenticated via ${provider === 'google' ? 'Google' : 'Apple'}`);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('OAuth Error', err.message || 'An error occurred during OAuth simulation');
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
              ? (isTrainerMode ? 'Trainer Console' : (isRegisterMode ? 'Create Account' : 'Welcome Back')) 
              : (isTrainerMode ? 'Trainer Portal' : 'Begin Your Journey')}
          </Heading>
          <Subtitle align="center" className="max-w-[85%] mt-1">
            {showMobileForm 
              ? (isTrainerMode 
                  ? 'Access the secure Trainer OTP workspace to manage schedules and payouts.' 
                  : (isRegisterMode ? 'Enter details to start your home wellness journey.' : 'Log in using your registered mobile number.'))
              : (isTrainerMode 
                  ? 'Manage sessions, track analytics, and handle VIP wellness jobs.' 
                  : 'Access India\'s premium home wellness platform. Professional coaching, personalized for you.')}
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
              {!isTrainerMode && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setIsRegisterMode(!isRegisterMode)}
                  className="items-center py-1"
                >
                  <Text className="text-indigo-600 text-xs font-black uppercase tracking-wider">
                    {isRegisterMode ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                  </Text>
                </TouchableOpacity>
              )}
              {isTrainerMode && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => router.push('/trainer-application')}
                  className="items-center py-1"
                >
                  <Text className="text-[#E11D48] text-xs font-black uppercase tracking-wider">
                    Apply as Trainer
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  setShowMobileForm(false);
                  setIsTrainerMode(false);
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
              title={isTrainerMode ? "Continue with Trainer Phone" : "Continue with Mobile Number"}
              onPress={() => setShowMobileForm(true)}
              icon={<Text className="text-white text-base">📱</Text>}
            />

            {!isTrainerMode && (
              <>
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
              </>
            )}

            {/* Subtle elegant link for role-based toggle entry point */}
            <View className="items-center mt-4">
              {isTrainerMode ? (
                <TouchableOpacity 
                  activeOpacity={0.7}
                  onPress={() => setIsTrainerMode(false)}
                  className="py-2"
                >
                  <Text className="text-zinc-500 text-xs font-black uppercase tracking-wider underline">Customer Access Portal</Text>
                </TouchableOpacity>
              ) : (
                <View className="items-center gap-1.5">
                  <Text className="text-zinc-400 text-[10px] font-semibold">Are you a VIRLA Trainer?</Text>
                  <TouchableOpacity 
                    activeOpacity={0.7}
                    onPress={() => {
                      setIsTrainerMode(true);
                      setUseOtp(true); // Default trainers to OTP mode
                    }}
                  >
                    <Text className="text-[#E11D48] text-xs font-black uppercase tracking-wider">Trainer Login</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
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
