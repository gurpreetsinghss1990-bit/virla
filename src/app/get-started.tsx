import { Loading } from '../components/Loading';
import { AppLogo, Heading, PrimaryButton, Subtitle } from '@/presentation/components';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Dimensions, Keyboard, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, Pressable, TouchableWithoutFeedback, View } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming, 
  Easing, 
  interpolate,
  runOnJS
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Database } from '../database/Database';
import { supabase } from '../database/supabaseClient';
import { OTPService } from '../services/OTPService';
import { useAddressStore } from '../store/addressStore';
import { useBookingStore } from '../store/bookingStore';
import { useMembershipStore } from '../store/membershipStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { useUserStore } from '../store/userStore';
import { useWalletStore } from '../store/walletStore';
import Constants from 'expo-constants';
import { LegalWebViewModal } from '../components/LegalWebViewModal';
import { NativePrimaryButton } from '../components/NativePrimaryButton';
import { NativeAlertDialog } from '../components/NativeAlertDialog';
import { cleanOtp, clampInt } from '../utils/inputSafety';
import { claimDeviceSession } from '../services/DeviceSession';

import { softShadow } from '../utils/shadows';
export default function GetStartedScreen() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular: require('../../node_modules/@expo-google-fonts/outfit/400Regular/Outfit_400Regular.ttf'),
    Outfit_500Medium: require('../../node_modules/@expo-google-fonts/outfit/500Medium/Outfit_500Medium.ttf'),
    Outfit_600SemiBold: require('../../node_modules/@expo-google-fonts/outfit/600SemiBold/Outfit_600SemiBold.ttf'),
    Outfit_700Bold: require('../../node_modules/@expo-google-fonts/outfit/700Bold/Outfit_700Bold.ttf'),
    Outfit_800ExtraBold: require('../../node_modules/@expo-google-fonts/outfit/800ExtraBold/Outfit_800ExtraBold.ttf'),
    PlusJakartaSans_500Medium: require('../../node_modules/@expo-google-fonts/plus-jakarta-sans/500Medium/PlusJakartaSans_500Medium.ttf'),
    PlusJakartaSans_600SemiBold: require('../../node_modules/@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf'),
    PlusJakartaSans_700Bold: require('../../node_modules/@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf'),
  });

  const insets = useSafeAreaInsets();
  const { setLoggedIn, setCompletedOnboarding, setRole, updateProfile } = useUserStore();

  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [legalModalTab, setLegalModalTab] = useState<'terms' | 'privacy'>('terms');

  const handleOpenTerms = () => {
    setLegalModalTab('terms');
    setLegalModalVisible(true);
  };

  const handleOpenPrivacy = () => {
    setLegalModalTab('privacy');
    setLegalModalVisible(true);
  };

  const handleOpenWeb = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        toolbarColor: '#FFFFFF',
        controlsColor: '#E11D48',
        showTitle: true,
        enableBarCollapsing: false,
        showInRecents: false,
        createTask: false,
        dismissButtonStyle: 'close',
      });
    } catch (err) {
      console.error('Failed to open in-app webview:', err);
      router.push('/legal-center');
    }
  };

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
  const [otpStatusMessage, setOtpStatusMessage] = useState<string>('');
  const [isOtpSuccessAnimating, setIsOtpSuccessAnimating] = useState(false);
  const [authenticatedUserName, setAuthenticatedUserName] = useState('');
  const [isAppActive, setIsAppActive] = useState(AppState.currentState === 'active');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const otpInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  // 🚀 Native Reanimated UI-thread SharedValues
  const otpShiftAnim = useSharedValue(0);
  const inputShiftAnim = useSharedValue(0);
  const spinAnim = useSharedValue(0);

  // Animate OTP container shift natively on UI thread
  useEffect(() => {
    otpShiftAnim.value = withSpring(otpSent ? -75 : 0, {
      damping: 20,
      stiffness: 180,
      mass: 0.8,
    });
  }, [otpSent]);

  // Animate input box shift ONLY natively on UI thread when keyboard opens/closes
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
      // Natively translate ONLY the input section on the UI thread
      inputShiftAnim.value = withSpring(-80, {
        damping: 20,
        stiffness: 180,
        mass: 0.8,
      });
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
      inputShiftAnim.value = withSpring(0, {
        damping: 20,
        stiffness: 180,
        mass: 0.8,
      });
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // UI-thread animated styles
  const animatedInputContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: inputShiftAnim.value + otpShiftAnim.value },
      ],
    };
  });

  const animatedSpinCircleStyle = useAnimatedStyle(() => {
    const rotateDeg = interpolate(spinAnim.value, [0, 1], [0, 1080]);
    return {
      transform: [{ rotate: `${rotateDeg}deg` }],
    };
  });

  const animatedDumbbellStyle = useAnimatedStyle(() => {
    const opacity = interpolate(spinAnim.value, [0, 0.7, 1], [0, 0, 1]);
    const scale = interpolate(spinAnim.value, [0, 0.7, 1], [0.5, 0.7, 1]);
    return {
      opacity,
      transform: [{ scale }],
    };
  });

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
    // Strictly strip all non-digit and special characters, allowing only numbers
    const cleanDigits = val.replace(/[^0-9]/g, '').slice(0, 10);
    setPhone(cleanDigits);

    if (cleanDigits.length > 5) {
      setFormattedPhone(`${cleanDigits.slice(0, 5)} ${cleanDigits.slice(5, 10)}`);
    } else {
      setFormattedPhone(cleanDigits);
    }
  };

  const handleOpenUrl = async (url: string) => {
    Keyboard.dismiss();
    await new Promise<void>(resolve => setTimeout(resolve, Platform.OS === 'android' ? 150 : 0));
    try {
      if (Platform.OS === 'android') {
        const browserInfo = await WebBrowser.getCustomTabsSupportingBrowsersAsync();
        console.log('[WebBrowser] Android Custom Tabs browsers found:', JSON.stringify(browserInfo));
        
        const preferredPackage = browserInfo.preferredBrowserPackage || browserInfo.defaultBrowserPackage || browserInfo.browserPackages?.[0];
        console.log('[WebBrowser] Selected browser package for Custom Tabs:', preferredPackage);

        if (preferredPackage) {
          await WebBrowser.warmUpAsync(preferredPackage).catch(e => console.log('[WebBrowser] warmUp error:', e));
        }

        await WebBrowser.openBrowserAsync(url, {
          browserPackage: preferredPackage,
          showInRecents: false,
          createTask: false,
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
        });
      } else {
        await WebBrowser.openBrowserAsync(url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
        });
      }
    } catch (err) {
      console.error('[WebBrowser] Open error:', err);
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
        console.log(`[get-started] Resuming incomplete user: ${user.name} (status: ${user.registrationStatus}). Redirecting to /user-metrics.`);
        router.replace('/user-metrics' as any);
      }
    };
    checkResumeState();
  }, []);



  // Keep the keyboard-avoiding layout still while the app is not in the foreground.
  // iOS fires keyboardWillHide as the app backgrounds, and KeyboardAvoidingView would
  // otherwise animate its padding during the app-switcher transition.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setIsAppActive(nextState === 'active');
      if (nextState === 'background') {
        Keyboard.dismiss();
      }
    });

    return () => subscription.remove();
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
    if (!(typeof __DEV__ !== 'undefined' && __DEV__ && phone === 'demo.trainer')) {
      if (!phone || phone.length !== 10) {
        console.log('[DEBUG] Mobile Submit Validation Failed: Invalid phone length');
        setOtpStatusMessage('Please enter a valid 10-digit Indian mobile number.');
        return;
      }
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
        setAuthenticatedUserName(userObj.name || '');

        if (regStatus === 'complete') {
          console.log('[DEBUG] Existing complete user detected. Triggering success animation...');
          if (!(await finalizeUserSession(userObj))) return;

          // Trigger 6 boxes -> circle -> 3x spin -> dumbbell success animation
          setIsOtpSuccessAnimating(true);
          const navigateToTabs = () => {
            router.replace('/(tabs)');
          };
          spinAnim.value = withTiming(1, {
            duration: 1200,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          }, (finished) => {
            if (finished) {
              runOnJS(navigateToTabs)();
            }
          });
        } else {
          console.log(`[DEBUG] Incomplete registration detected (status: ${regStatus}). Redirecting new user to user-metrics landing page...`);
          setTempUserObj(userObj);
          setNewUserIdToRegister(userObj.id || "");
          if (!(await finalizeUserSession(userObj))) return;

          // For brand new / incomplete users, route directly to the user-metrics onboarding page
          router.replace('/user-metrics' as any);
        }
      } else {
        const failMsg = result?.message || 'Something went wrong while signing you in. Please try again.';
        throw new Error(failMsg);
      }
    } catch (err: any) {
      console.log('[DEBUG] Mobile submit authentication failure:', err?.message || err);

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
      Keyboard.dismiss();
      setAuthErrorMessage(friendlyMsg);
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
          if (!(await finalizeUserSession(registeredUser))) return;

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
          if (!(await finalizeUserSession(completedUserObj))) return;

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

  const finalizeUserSession = async (userObj: any): Promise<boolean> => {
    const claim = await claimDeviceSession(userObj.id);
    if (!claim.ok && claim.reason === 'active_elsewhere') {
      setIsLoading(false);
      Alert.alert(
        'Already logged in',
        `This account is currently logged in on ${claim.deviceName || 'another device'}. Please log out from that device first, then try again.`,
        [{ text: 'OK' }]
      );
      return false;
    }

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
    return true;
  };

  const handleSendOtp = async () => {
    if (otpSent) {
      await handleResendOtp();
      return;
    }

    if (!phone) {
      setOtpStatusMessage('Please enter your mobile number');
      return;
    }

    setIsLoading(true);
    setOtpStatusMessage('');
    try {
      console.log('[DEBUG] Calling OTPService.sendOTP...');
      const res = await OTPService.sendOTP(phone);
      if (res.success && res.reqId) {
        setReqId(res.reqId);
        setOtpSent(true);
        setResendCountdown(10); // Start 10s resend timer
        setOtpStatusMessage('OTP sent to mobile number');
        setTimeout(() => {
          otpInputRef.current?.focus();
        }, 300);
      } else {
        let friendlyMsg = 'We couldn\'t send the OTP. Please try again.';
        if (res.error && (res.error.includes('AuthenticationFailure') || res.error.includes('authkey') || res.error.includes('credentials'))) {
          friendlyMsg = 'Authentication configuration error. Please contact support.';
        } else if (res.error) {
          friendlyMsg = res.error;
        }
        setOtpStatusMessage(friendlyMsg);
      }
    } catch (e: any) {
      console.error('[DEBUG ERROR] Send OTP failed:', e);
      setOtpStatusMessage(e.message || 'We couldn\'t send the OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0) {
      return;
    }
    if (resendCount >= 2) {
      setOtpStatusMessage('Too many attempts. Please try again later.');
      return;
    }

    setIsLoading(true);
    setOtpStatusMessage('');
    try {
      console.log('[DEBUG] Calling OTPService.retryOTP...');
      const res = await OTPService.retryOTP(phone, reqId);
      if (res.success) {
        setResendCountdown(10);
        setResendCount(prev => prev + 1);
        setOtpStatusMessage('OTP resent to mobile number');
      } else {
        let friendlyMsg = 'OTP resend failed. Please try again.';
        if (res.error && (res.error.includes('AuthenticationFailure') || res.error.includes('authkey') || res.error.includes('credentials'))) {
          friendlyMsg = 'Authentication configuration error. Please contact support.';
        } else if (res.error) {
          friendlyMsg = res.error;
        }
        setOtpStatusMessage(friendlyMsg);
      }
    } catch (e: any) {
      console.error('[DEBUG ERROR] Resend OTP failed:', e);
      setOtpStatusMessage(e.message || 'OTP resend failed. Please try again.');
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

      const claim = await claimDeviceSession(userObj.id);
      if (!claim.ok && claim.reason === 'active_elsewhere') {
        setIsLoading(false);
        Alert.alert(
          'Already logged in',
          `This account is currently logged in on ${claim.deviceName || 'another device'}. Please log out from that device first, then try again.`,
          [{ text: 'OK' }]
        );
        return;
      }

      Database.setCurrentUserId(userObj.id);
      await setLoggedIn(true);
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

  // Remove animated loop values - keep background solid & calm without jumping
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // Exact geometric arc dimensions proportional to screen
  const outerWidth = screenWidth * 1.7;
  const outerHeight = 600;
  const midWidth = screenWidth * 1.35;
  const midHeight = 480;
  const innerWidth = screenWidth * 1.05;
  const innerHeight = 380;

  return (
    <TouchableWithoutFeedback onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}>
      <View style={{ flex: 1, backgroundColor: '#FFF5F6', paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          enabled={Platform.OS === 'ios' && isAppActive}
          className="flex-1"
        >
          {/* Balanced Rose-Silk Concierge Canvas with visible gentle warmth */}
          <View 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              overflow: 'hidden',
            }} 
            pointerEvents="none"
          >
            <Svg width="100%" height="100%" viewBox={`0 0 ${screenWidth} ${screenHeight}`} fill="none">
              <Defs>
                {/* 1. Rose Silk Top */}
                <LinearGradient id="roseSilkTop" x1="50%" y1="0%" x2="50%" y2="100%">
                  <Stop offset="0%" stopColor="#FECDD3" stopOpacity="0.8" />
                  <Stop offset="45%" stopColor="#FFE4E6" stopOpacity="0.5" />
                  <Stop offset="100%" stopColor="#FFF5F6" stopOpacity="0" />
                </LinearGradient>
                {/* 2. Top-Right Athletic Crimson Bloom */}
                <LinearGradient id="crimsonAuraRight" x1="100%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#E11D48" stopOpacity="0.14" />
                  <Stop offset="60%" stopColor="#FFF5F6" stopOpacity="0" />
                </LinearGradient>
                {/* 3. Bottom-Left Warm Amber/Gold Whisper */}
                <LinearGradient id="amberAuraLeft" x1="0%" y1="100%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#F59E0B" stopOpacity="0.08" />
                  <Stop offset="60%" stopColor="#FFF5F6" stopOpacity="0" />
                </LinearGradient>
                {/* 4. Bottom Center Crimson Footprint */}
                <LinearGradient id="crimsonFootprint" x1="50%" y1="100%" x2="50%" y2="0%">
                  <Stop offset="0%" stopColor="#E11D48" stopOpacity="0.08" />
                  <Stop offset="100%" stopColor="#FFF5F6" stopOpacity="0" />
                </LinearGradient>
              </Defs>

              {/* Balanced gradient washes */}
              <Circle cx={screenWidth * 0.5} cy={-20} r={screenWidth * 0.88} fill="url(#roseSilkTop)" />
              <Circle cx={screenWidth * 0.9} cy={screenHeight * 0.22} r={screenWidth * 0.68} fill="url(#crimsonAuraRight)" />
              <Circle cx={screenWidth * 0.1} cy={screenHeight * 0.75} r={screenWidth * 0.62} fill="url(#amberAuraLeft)" />
              <Circle cx={screenWidth * 0.5} cy={screenHeight} r={screenWidth * 0.78} fill="url(#crimsonFootprint)" />
            </Svg>
          </View>

          {/* 🌊 Circular Waves & Concentric Lines: Whisper-Soft Pearl Slate (rgba(15, 23, 42, 0.05)) */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: insets.top,
              left: 0,
              right: 0,
              bottom: 0,
              overflow: 'hidden',
              zIndex: 1,
            }}
          >
            {/* Outer Arc (width: 170%, height: 600px, top: -160px relative to header) */}
            <View
              style={{
                position: 'absolute',
                top: -160 - insets.top,
                left: (screenWidth - outerWidth) / 2,
                width: outerWidth,
                height: outerHeight,
                borderRadius: outerWidth / 2,
                borderWidth: 1,
                borderColor: 'rgba(15, 23, 42, 0.06)',
              }}
            />

            {/* Mid Arc (Dashed - width: 135%, height: 480px, top: -90px) */}
            <View
              style={{
                position: 'absolute',
                top: -90 - insets.top,
                left: (screenWidth - midWidth) / 2,
                width: midWidth,
                height: midHeight,
                borderRadius: midWidth / 2,
                borderWidth: 1.2,
                borderStyle: 'dashed',
                borderColor: 'rgba(15, 23, 42, 0.07)',
              }}
            />

            {/* Inner Arc (width: 105%, height: 380px, top: -30px) */}
            <View
              style={{
                position: 'absolute',
                top: -30 - insets.top,
                left: (screenWidth - innerWidth) / 2,
                width: innerWidth,
                height: innerHeight,
                borderRadius: innerWidth / 2,
                borderWidth: 1,
                borderColor: 'rgba(15, 23, 42, 0.05)',
              }}
            />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'space-between',
              paddingHorizontal: 24,
              paddingTop: 16,
              paddingBottom: 20,
            }}
            className="flex-1 z-10"
          >
            {/* Top Brand Header */}
            <View className="items-center pt-2">
              {/* AppLogo using brand V mark & IRLA */}
              <View className="items-center">
                <AppLogo size="large" textColor="#09090B" />
              </View>

              {/* Micro Concierge Access Badge */}
              <View
                style={{
                  marginTop: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 7,
                  borderRadius: 9999,
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  borderWidth: 1,
                  borderColor: 'rgba(226, 232, 240, 0.9)',
                  shadowColor: '#101828',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 4,
                  elevation: 1,
                  gap: 8,
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: '#E11D48',
                  }}
                />
                <Text
                  style={{
                    fontFamily: 'Outfit_700Bold',
                    fontSize: 10.5,
                    letterSpacing: 1.2,
                    color: '#1E293B',
                    textTransform: 'uppercase',
                    paddingRight: 2,
                  }}
                >
                  Doorstep Personal Training Concierge
                </Text>
              </View>
            </View>

            {/* Pure Whitespace Hero Headline & Subtitle */}
            <View className="items-center my-6">
              <Text
                style={{
                  fontFamily: 'Outfit_700Bold',
                  fontSize: 34,
                  fontWeight: '700',
                  color: '#09090B',
                  letterSpacing: -0.8,
                  lineHeight: 40,
                  textAlign: 'center',
                }}
              >
                {newUserIdToRegister !== null
                  ? (setupStep === 0 ? 'Welcome!' : `Welcome back, ${tempUserObj?.name && tempUserObj.name !== 'Complete your profile' ? tempUserObj.name.split(' ')[0] : 'User'}!`)
                  : 'Welcome Back'}
              </Text>
              <Text
                style={{
                  fontFamily: 'Outfit_500Medium',
                  fontSize: 14.5,
                  fontWeight: '500',
                  color: '#475569',
                  marginTop: 8,
                  textAlign: 'center',
                  maxWidth: 290,
                  lineHeight: 22,
                }}
              >
                {newUserIdToRegister !== null
                  ? (setupStep === 0 ? 'Step 1 of 4: Enter your full name to start registration.' : `Step ${setupStep + 1} of 4: Complete your details.`)
                  : 'Log in using your registered mobile number.'}
              </Text>
            </View>

            {newUserIdToRegister !== null ? (
              /* Profile Setup Form Wizard for New Users */
              <View
                className="bg-white p-6 rounded-[28px] border border-zinc-150 gap-4 my-6"
                style={{
                  ...softShadow({ color: '#101828', opacity: 0.05, radius: 2, offsetY: 1 }),
                }}
              >
                {setupStep === 0 && (
                  <View className="gap-4">
                    <Heading>What is your name?</Heading>
                    <Subtitle>Enter your full name to start registration.</Subtitle>
                    <TextInput
                      maxLength={250}
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
                          <Pressable
                            key={g}
                            onPress={() => setSelectedGender(g)}
                            className={`flex-1 py-3.5 rounded-xl border items-center justify-center ${isSel ? 'bg-[#101828] border-[#101828]' : 'bg-white border-zinc-200'}`}
                          >
                            <Text className={`text-[10px] font-black uppercase tracking-wider ${isSel ? 'text-white' : 'text-zinc-650'}`}>{g}</Text>
                          </Pressable>
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
                          <Pressable
                            key={goal}
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
                          </Pressable>
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
                        maxLength={3}
                        placeholder="Age"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="number-pad"
                        value={age}
                        onChangeText={(v) => setAge(clampInt(v, 3))}
                        editable={!isLoading}
                        className="w-full bg-zinc-50 border border-zinc-150 p-4 rounded-xl text-zinc-900 text-sm font-semibold"
                      />
                      <TextInput
                        maxLength={20}
                        keyboardType="numeric"
                        placeholder="Height (e.g. 175 cm)"
                        placeholderTextColor="#9CA3AF"
                        value={height}
                        onChangeText={(v) => setHeight(clampInt(v, 3))}
                        editable={!isLoading}
                        className="w-full bg-zinc-50 border border-zinc-150 p-4 rounded-xl text-zinc-900 text-sm font-semibold"
                      />
                      <TextInput
                        maxLength={20}
                        keyboardType="numeric"
                        placeholder="Weight (e.g. 70 kg)"
                        placeholderTextColor="#9CA3AF"
                        value={weight}
                        onChangeText={(v) => setWeight(clampInt(v, 3))}
                        editable={!isLoading}
                        className="w-full bg-zinc-50 border border-zinc-150 p-4 rounded-xl text-zinc-900 text-sm font-semibold"
                      />
                    </View>
                  </View>
                )}

                {isLoading && (
                  <View className="items-center justify-center py-2">
                    <Loading size="small" color="#4F46E5" />
                  </View>
                )}

                <View className="mt-2 gap-3.5">
                  <PrimaryButton
                    title={isLoading ? 'Saving...' : setupStep === 3 ? 'Finish Setup' : 'Next Step'}
                    onPress={isLoading ? () => { } : handleSaveProfile}
                  />
                </View>
              </View>
            ) : (
              /* Mobile Login/Register Form - Fluid Stitch Inspired UI */
              <Animated.View
                className="w-full gap-4 my-2 items-center"
                style={animatedInputContainerStyle}
              >
                {/* Seamless Fluid Phone Input Container (Exact User Specification) */}
                <View className="w-full max-w-[340px] gap-3">
                  {/* Outer Input Pill Container */}
                  <View
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 9999,
                      borderWidth: 1,
                      borderColor: 'rgba(226, 232, 240, 0.8)',
                      padding: 6,
                      flexDirection: 'row',
                      alignItems: 'center',
                      shadowColor: '#0F172A',
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: 0.04,
                      shadowRadius: 20,
                      elevation: 2,
                    }}
                  >
                    {/* Left Pill — Country Code Badge (+91 with Flag) */}
                    <View
                      style={{
                        backgroundColor: '#0F172A',
                        borderRadius: 9999,
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        shadowColor: '#000000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.12,
                        shadowRadius: 6,
                        elevation: 3,
                      }}
                    >
                      <Text style={{ fontSize: 16, lineHeight: 18 }}>🇮🇳</Text>
                      <Text
                        style={{
                          color: '#FFFFFF',
                          fontFamily: 'Outfit_600SemiBold',
                          fontWeight: '600',
                          fontSize: 15,
                          paddingRight: 2,
                        }}
                      >
                        +91
                      </Text>
                    </View>

                    {/* Right Section — Phone Number Input Box & Shield Icon */}
                    <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 4, justifyContent: 'center' }}>
                      <TextInput
                        maxLength={11}
                        placeholder="98765 43210"
                        placeholderTextColor="#94A3B8"
                        keyboardType="number-pad"
                        value={formattedPhone}
                        onChangeText={handlePhoneChange}
                        editable={!isLoading}
                        multiline={false}
                        numberOfLines={1}
                        style={{
                          fontFamily: 'Outfit_500Medium',
                          fontSize: 17,
                          fontWeight: '500',
                          color: '#0F172A',
                          letterSpacing: 0.5,
                          backgroundColor: 'transparent',
                          paddingVertical: 0,
                          includeFontPadding: false,
                        }}
                      />
                    </View>

                    {/* Right Shield / Verified Icon */}
                    <View style={{ paddingRight: 12, justifyContent: 'center', alignItems: 'center' }}>
                      <Feather
                        name="shield"
                        size={16}
                        color={phone.replace(/\D/g, '').length >= 10 ? '#059669' : '#CBD5E1'}
                      />
                    </View>
                  </View>

                  {/* Primary Action Button: Virla Signature Crimson Red Pill */}
                  {!otpSent && (
                    <Pressable
                      disabled={isLoading || phone.replace(/\D/g, '').length < 10}
                      onPress={handleSendOtp}
                      style={{
                        width: '100%',
                        height: 54,
                        borderRadius: 9999,
                        backgroundColor: phone.replace(/\D/g, '').length >= 10 ? '#E11D48' : '#F1F5F9',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        paddingHorizontal: 20,
                        shadowColor: '#E11D48',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: phone.replace(/\D/g, '').length >= 10 ? 0.35 : 0,
                        shadowRadius: 14,
                        elevation: phone.replace(/\D/g, '').length >= 10 ? 5 : 0,
                      }}
                    >
                      {isLoading ? (
                        <Loading size="small" color="#000000" />
                      ) : (
                        <>
                          <Text
                            style={{
                              fontFamily: 'Outfit_700Bold',
                              fontSize: 16,
                              letterSpacing: 0.2,
                              color: phone.replace(/\D/g, '').length >= 10 ? '#FFFFFF' : '#94A3B8',
                              paddingRight: 4,
                            }}
                          >
                            Continue
                          </Text>
                          <Feather
                            name="arrow-right"
                            size={16}
                            color={phone.replace(/\D/g, '').length >= 10 ? '#FFFFFF' : '#94A3B8'}
                          />
                        </>
                      )}
                    </Pressable>
                  )}

                  {otpStatusMessage ? (
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        textAlign: 'center',
                        marginTop: 2,
                        color:
                          otpStatusMessage.toLowerCase().includes('otp sent') ||
                          otpStatusMessage.toLowerCase().includes('otp resent')
                            ? '#059669'
                            : '#E11D48',
                      }}
                    >
                      {otpStatusMessage}
                    </Text>
                  ) : null}
                </View>

                {/* 6-Digit Animated OTP Entry & Success Sequence Component (Preserved Exact Styling & Rotated Boxes) */}
                {otpSent && (
                  <View className="w-full items-center gap-2 mt-2 mb-0.5">
                    <View className="flex-row justify-between items-center w-full max-w-[340px] px-1">
                      <Text className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                        Verify 6-Digit Code
                      </Text>
                      <Pressable
                        disabled={resendCountdown > 0 || isLoading}
                        onPress={handleResendOtp}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: resendCountdown > 0 ? '#94A3B8' : '#E11D48',
                          }}
                        >
                          {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend Code'}
                        </Text>
                      </Pressable>
                    </View>

                    {/* Container for 6 Animated Rotated Digit Cards */}
                    <TouchableWithoutFeedback onPress={() => otpInputRef.current?.focus()}>
                      <View className="relative w-full max-w-[340px] py-1 items-center justify-center min-h-[76px]">
                        {/* Hidden Native TextInput for 6-digit Keyboard Entry & Autofill */}
                        <TextInput
                          ref={otpInputRef}
                          placeholder=""
                          placeholderTextColor="transparent"
                          keyboardType="number-pad"
                          textContentType="oneTimeCode"
                          autoComplete="one-time-code"
                          maxLength={6}
                          value={otpCode}
                          onChangeText={(v) => setOtpCode(cleanOtp(v))}
                          editable={!isLoading && !isOtpSuccessAnimating}
                          className="absolute w-full h-full opacity-0 z-50"
                          autoFocus
                        />

                        {!isOtpSuccessAnimating ? (
                          /* Visual State 1: 6 Individual Rotated Digit Boxes */
                          <View className="flex-row justify-between w-full px-1 z-10 pointer-events-none">
                            {Array.from({ length: 6 }).map((_, idx) => {
                              const digit = otpCode[idx] || '';
                              const isFocusedIndex = otpCode.length === idx || (idx === 5 && otpCode.length === 6);
                              const rotations = ['-6deg', '8deg', '-4deg', '6deg', '-8deg', '5deg'];
                              const rot = rotations[idx % rotations.length];

                              return (
                                <View
                                  key={idx}
                                  className={`w-11 h-14 rounded-2xl items-center justify-center border ${digit
                                    ? 'bg-[#1F1F24] border-[#E11D48]'
                                    : isFocusedIndex
                                      ? 'bg-[#1F1F24] border-[#E11D48]'
                                      : 'bg-[#141417] border-white/20'
                                    }`}
                                  style={{
                                    transform: [{ rotate: rot }, { scale: isFocusedIndex ? 1.08 : 1 }],
                                    ...softShadow({ color: (digit || isFocusedIndex) ? '#E11D48' : '#000', opacity: (digit || isFocusedIndex) ? 0.5 : 0.2, radius: (digit || isFocusedIndex) ? 8 : 4, offsetY: (digit || isFocusedIndex) ? 4 : 2 }),
                                  }}
                                >
                                  <Text className="text-white text-xl font-black">
                                    {digit}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        ) : (
                          /* Visual State 2: Post-Verification Success Animation (Circle Spin 2-3x -> Dumbbell -> Welcome) */
                          <View className="items-center justify-center gap-3 py-2 z-20">
                            {/* Animated Rotating Circle or Transformed Dumbbell */}
                            <View className="relative items-center justify-center">
                              {/* Step A: 2-3 Rapid Rotations Spinning Circle */}
                              <Animated.View
                                style={animatedSpinCircleStyle}
                              >
                                <View
                                  className="w-14 h-14 rounded-full border-2 border-[#E11D48] items-center justify-center bg-[#1F1F24]"
                                  style={{
                                    ...softShadow({ color: '#E11D48', opacity: 0.8, radius: 12, offsetY: 0 }),
                                  }}
                                >
                                  <View className="w-3 h-3 rounded-full bg-white" />
                                </View>
                              </Animated.View>

                              {/* Step B: Vector Dumbbell Overlaid on Completion */}
                              <Animated.View
                                className="absolute items-center justify-center"
                                style={animatedDumbbellStyle}
                              >
                                <View className="flex-row items-center justify-center bg-[#0F0F12] p-3 rounded-2xl shadow-lg">
                                  <Svg width="40" height="22" viewBox="0 0 42 24" fill="none">
                                    <Path d="M 2 2 L 6 2 L 6 22 L 2 22 Z" fill="#E11D48" />
                                    <Path d="M 8 5 L 12 5 L 12 19 L 8 19 Z" fill="#FFFFFF" />
                                    <Path d="M 12 10 L 30 10 L 30 14 L 12 14 Z" fill="#E11D48" />
                                    <Path d="M 30 5 L 34 5 L 34 19 L 30 19 Z" fill="#FFFFFF" />
                                    <Path d="M 36 2 L 40 2 L 40 22 L 36 22 Z" fill="#E11D48" />
                                  </Svg>
                                </View>
                              </Animated.View>
                            </View>

                            <View className="items-center">
                              <Text className="text-[#E11D48] text-xs font-black uppercase tracking-widest">
                                VERIFIED • VIRLA ACTIVATED
                              </Text>
                              <Text className="text-white text-base font-bold mt-0.5">
                                {authenticatedUserName
                                  ? `Welcome, ${authenticatedUserName.split(' ')[0]}`
                                  : 'Welcome to VIRLA'}
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    </TouchableWithoutFeedback>
                  </View>
                )}

                {otpSent && (
                  <View className="mt-2 w-full max-w-[340px]">
                    <Pressable
                      disabled={isLoading || otpCode.length < 6}
                      onPress={handleMobileSubmit}
                      style={{
                        width: '100%',
                        height: 54,
                        borderRadius: 9999,
                        backgroundColor: otpCode.length >= 6 ? '#E11D48' : '#F1F5F9',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        shadowColor: '#E11D48',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: otpCode.length >= 6 ? 0.35 : 0,
                        shadowRadius: 14,
                        elevation: otpCode.length >= 6 ? 5 : 0,
                      }}
                    >
                      {isLoading ? (
                        <Loading size="small" color="#000000" />
                      ) : (
                        <>
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: '700',
                              letterSpacing: 0.3,
                              color: otpCode.length >= 6 ? '#FFFFFF' : '#94A3B8',
                            }}
                          >
                            Verify & Log In
                          </Text>
                          <Feather
                            name="arrow-right"
                            size={16}
                            color={otpCode.length >= 6 ? '#FFFFFF' : '#94A3B8'}
                          />
                        </>
                      )}
                    </Pressable>
                  </View>
                )}
              </Animated.View>
            )}

            {/* Refined Minimal Footer & Concierge Whisper Note matching Stitch code.html */}
            <View className="px-4 pb-2 items-center">
              {/* Whisper-soft luxury brand touch */}
              <View className="flex-row items-center justify-center gap-2 mb-3">
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 2.5,
                    backgroundColor: '#E11D48',
                  }}
                />
                <Text
                  style={{
                    fontFamily: 'Outfit_500Medium',
                    fontSize: 12.5,
                    fontWeight: '500',
                    color: '#334155',
                    letterSpacing: 0.2,
                    paddingRight: 2,
                  }}
                >
                  Personal training, delivered to your doorstep
                </Text>
              </View>

              {/* Clean Minimal Legal Terms - High Contrast & Clearly Legible */}
              <Text
                style={{
                  fontFamily: 'PlusJakartaSans_500Medium',
                  fontSize: 11.5,
                  color: '#475569',
                  textAlign: 'center',
                  lineHeight: 18,
                  paddingHorizontal: 4,
                }}
              >
                By continuing, you agree to VIRLA&apos;s
              </Text>
              <View className="flex-row items-center justify-center mt-1 gap-1.5 flex-wrap">
                <Pressable
                  onPress={handleOpenTerms}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text
                    style={{
                      fontFamily: 'PlusJakartaSans_700Bold',
                      fontSize: 11.5,
                      color: '#0F172A',
                      textDecorationLine: 'underline',
                      paddingRight: 2,
                    }}
                  >
                    Terms of Service
                  </Text>
                </Pressable>
                <Text style={{ color: '#94A3B8', fontSize: 11.5, marginHorizontal: 3 }}>·</Text>
                <Pressable
                  onPress={handleOpenPrivacy}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text
                    style={{
                      fontFamily: 'PlusJakartaSans_700Bold',
                      fontSize: 11.5,
                      color: '#0F172A',
                      textDecorationLine: 'underline',
                      paddingRight: 4,
                    }}
                  >
                    Privacy Policy
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* In-App Zepto-Style Legal WebView Modal */}
        <LegalWebViewModal
          visible={legalModalVisible}
          initialTab={legalModalTab}
          onClose={() => setLegalModalVisible(false)}
        />
        <NativeAlertDialog
          visible={!!authErrorMessage}
          title="Authentication Error"
          message={authErrorMessage || ''}
          confirmText="OK"
          onClose={() => setAuthErrorMessage(null)}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}
