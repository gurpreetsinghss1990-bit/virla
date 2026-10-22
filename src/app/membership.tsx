import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Animated, Platform, BackHandler, LayoutAnimation, UIManager, InteractionManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useWalletStore } from '../store/walletStore';
import { useUserStore } from '../store/userStore';
import { PayPhiService } from '../services/payphiService';
import { Feather, Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

interface Plan {
  id: string;
  name: string;
  credits: number;
  price: string;
  originalPrice?: string;
  savings: string;
  gstText: string;
  gstVal: string;
  amountVal: string;
  idealFor: string;
  popular?: boolean;
  badge?: string;
  ribbon?: string;
  category: 'individual' | 'couple';
  perSessionText?: string;
  bulletPoints?: string[];
}

const PLANS: Plan[] = [
  // Developer Test Plan (₹1 Verification)
  {
    id: 'plan-dev-test',
    name: 'Dev Test 1 Rupee Verification',
    credits: 1,
    price: '₹1',
    savings: 'Live Gateway Verification',
    gstText: '₹1.00 Incl. Taxes',
    gstVal: '₹0',
    amountVal: '₹1',
    idealFor: 'Safe real bank & gateway verification without charges.',
    category: 'individual',
    badge: 'DEV TEST (₹1)',
  },
  // Individual Plans (1 Person) - Image 1000080404.jpg
  {
    id: 'plan-ind-1',
    name: 'Single Session',
    credits: 1,
    price: '₹1,574',
    savings: 'Standard rate',
    gstText: '₹1,499 + 5% GST (₹75)',
    gstVal: '₹75',
    amountVal: '₹1,499',
    perSessionText: '₹1,499 per session',
    idealFor: 'Start your journey - Ideal for a single trial session.',
    bulletPoints: [
      'One trainer, one participant, personalized 60-minute session.',
      'Designed to test the experience or for occasional workout needs.',
    ],
    category: 'individual'
  },
  {
    id: 'plan-ind-2',
    name: '8-Session Package',
    credits: 8,
    price: '₹10,290',
    originalPrice: '₹12,592',
    savings: 'Save ₹2,192 · 18.27% off',
    gstText: '₹9,800 + 5% GST (₹490)',
    gstVal: '₹490',
    amountVal: '₹9,800',
    perSessionText: '₹1,225 per session',
    idealFor: 'Build consistency - Best entry package for regular workouts.',
    bulletPoints: [
      'FOUNDING 100 - EXCLUSIVE LAUNCH OFFER for first 100 members at ₹9,800.',
      'Save ₹2,192 compared with booking 8 single sessions at ₹1,499 each.',
      'Designed to establish a consistent, progressive training routine.',
    ],
    badge: 'LAUNCH OFFER',
    ribbon: 'FOUNDING 100 · SAVE ₹2,192',
    category: 'individual'
  },
  {
    id: 'plan-ind-3',
    name: '16-Session Package',
    credits: 16,
    price: '₹18,900',
    originalPrice: '₹25,184',
    savings: 'Save ₹5,984 · 24.95% off',
    gstText: '₹18,000 + 5% GST (₹900)',
    gstVal: '₹900',
    amountVal: '₹18,000',
    perSessionText: '₹1,125 per session',
    idealFor: 'Better results - Ideal for committed individuals targeting measurable goals.',
    bulletPoints: [
      'Save ₹5,984 compared with booking 16 single sessions at ₹1,499 each.',
      'Structured progression across multiple weeks for sustained fitness.',
      'A lower per-session rate for members committed to regular workouts.',
    ],
    popular: true,
    badge: 'MOST POPULAR',
    ribbon: 'BEST RESULTS · SAVE ₹5,984',
    category: 'individual'
  },
  {
    id: 'plan-ind-4',
    name: '32-Session Package',
    credits: 32,
    price: '₹36,120',
    originalPrice: '₹50,368',
    savings: 'Save ₹13,568 · 28.29% off',
    gstText: '₹34,400 + 5% GST (₹1,720)',
    gstVal: '₹1,720',
    amountVal: '₹34,400',
    perSessionText: '₹1,075 per session',
    idealFor: 'Maximum transformation - Long-term wellness routine at the lowest per-session cost.',
    bulletPoints: [
      'Save ₹13,568 compared with booking 32 single sessions at ₹1,499 each.',
      'Lowest per-session rate in our individual package range.',
      'Full lifestyle transformation program with steady trainer tracking.',
    ],
    badge: 'BEST VALUE',
    category: 'individual'
  },
  {
    id: 'plan-ind-addon-buddy',
    name: 'Workout Buddy Add-On',
    credits: 1,
    price: '₹524',
    savings: 'Bring a friend',
    gstText: '₹499 + 5% GST (₹25)',
    gstVal: '₹25',
    amountVal: '₹499',
    perSessionText: '₹499 per session add-on',
    idealFor: 'Bring a friend, partner, or family member to your existing solo session.',
    bulletPoints: [
      'Add a partner to an individual personal training session.',
      'Both participants train together in the same 60-minute slot.',
      'Valid as an add-on per session.',
    ],
    badge: 'OPTIONAL ADD-ON',
    category: 'individual'
  },
  // Couple Plans (Train Together) - Image 1000080407.jpg
  {
    id: 'plan-cpl-1',
    name: 'Single Couple Session',
    credits: 1,
    price: '₹1,994',
    savings: 'Train together',
    gstText: '₹1,899 + 5% GST (₹95)',
    gstVal: '₹95',
    amountVal: '₹1,899',
    perSessionText: '₹1,899 per 60-min session for both',
    idealFor: 'Train together - One trainer for two people.',
    bulletPoints: [
      'One trainer leads both participants in the same session.',
      'Both participants must attend together at the same location.',
    ],
    category: 'couple'
  },
  {
    id: 'plan-cpl-2',
    name: '8-Session Couple Package',
    credits: 8,
    price: '₹13,650',
    originalPrice: '₹15,952',
    savings: 'Save ₹2,192 · 14.43% off',
    gstText: '₹13,000 + 5% GST (₹650)',
    gstVal: '₹650',
    amountVal: '₹13,000',
    perSessionText: '₹1,625 per session for both',
    idealFor: 'Couple entry package - Train together consistently.',
    bulletPoints: [
      'FOUNDING 100 - EXCLUSIVE COUPLE LAUNCH OFFER at ₹13,000 (First 100 couples).',
      '8 shared personal training sessions for two people.',
      'Save ₹2,192 compared with booking 8 single couple sessions at ₹1,899 each.',
      'A convenient way to train together while sharing one trainer and session.',
    ],
    badge: 'COUPLE LAUNCH',
    ribbon: 'FOUNDING 100 · SAVE ₹2,192',
    category: 'couple'
  },
  {
    id: 'plan-cpl-3',
    name: '16-Session Couple Package',
    credits: 16,
    price: '₹25,620',
    originalPrice: '₹31,904',
    savings: 'Save ₹5,984 · 19.69% off',
    gstText: '₹24,400 + 5% GST (₹1,220)',
    gstVal: '₹1,220',
    amountVal: '₹24,400',
    perSessionText: '₹1,525 per session for both',
    idealFor: 'More consistency - Better shared value for partner training.',
    bulletPoints: [
      '16 shared personal training sessions for two people.',
      'Save ₹5,984 compared with booking 16 single couple sessions at ₹1,899 each.',
      'A lower per-session rate for couples who want to train together regularly.',
    ],
    popular: true,
    badge: 'MOST POPULAR',
    ribbon: 'BEST VALUE COUPLE · SAVE ₹5,984',
    category: 'couple'
  },
  {
    id: 'plan-cpl-4',
    name: '32-Session Couple Package',
    credits: 32,
    price: '₹49,560',
    originalPrice: '₹63,808',
    savings: 'Save ₹13,568 · 22.32% off',
    gstText: '₹47,200 + 5% GST (₹2,360)',
    gstVal: '₹2,360',
    amountVal: '₹47,200',
    perSessionText: '₹1,475 per session for both',
    idealFor: 'Best shared value - Long-term commitment and lifestyle change.',
    bulletPoints: [
      '32 shared personal training sessions for two people.',
      'Save ₹13,568 compared with booking 32 single couple sessions at ₹1,899 each.',
      'Lowest per-session rate in the couple package range.',
      'Designed for partners who want a consistent shared training routine.',
    ],
    badge: 'BEST VALUE',
    category: 'couple'
  }
];

export default function MembershipScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { purchasePlan, creditBalance } = useWalletStore();

  const [activeCategory, setActiveCategory] = useState<'individual' | 'couple'>('individual');

  const activePlans = useMemo(() => {
    return PLANS.filter((p) => p.category === activeCategory);
  }, [activeCategory]);

  // Selection states - default to the popular Active Pack (plan-ind-3) matching design
  const [selectedPlan, setSelectedPlan] = useState<Plan>(() => {
    return PLANS.find((p) => p.id === 'plan-ind-3') || PLANS[0];
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [checkoutActive, setCheckoutActive] = useState(false);
  const [isBenefitsExpanded, setIsBenefitsExpanded] = useState(false);

  const toggleBenefits = () => {
    setIsBenefitsExpanded((prev) => !prev);
  };


  const handleSelectCategory = (cat: 'individual' | 'couple') => {
    setActiveCategory(cat);
    const defaultForCat = PLANS.find((p) => p.category === cat && p.popular) || PLANS.find((p) => p.category === cat);
    if (defaultForCat) {
      setSelectedPlan(defaultForCat);
    }
  };

  // Animations using useMemo to avoid render-phase ref reads
  const slideUpAnim = useMemo(() => new Animated.Value(600), []);
  const overlayOpacity = useMemo(() => new Animated.Value(0), []);
  const progressAnim = useMemo(() => new Animated.Value(0), []);
  const spinAnim = useMemo(() => new Animated.Value(0), []);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Revolving spinning animation for the loader ring
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (isProcessing) {
      spinAnim.setValue(0);
      animation = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        })
      );
      animation.start();
    } else {
      spinAnim.setValue(0);
    }
    return () => {
      if (animation) animation.stop();
    };
  }, [isProcessing, spinAnim]);

  // Hardware back button: close payment modal instead of navigating away
  useEffect(() => {
    const onBackPress = () => {
      if (isModalOpen) {
        closeDetails();
        return true; // consumed
      }
      return false; // let default back happen
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [isModalOpen]);

  const openPlanDetails = (plan: Plan) => {
    setSelectedPlan(plan);
    setIsModalOpen(true);
    setCheckoutActive(false);
    setIsProcessing(false);
    setIsSuccess(false);
    
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(slideUpAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true })
    ]).start();
  };

  const closeDetails = () => {
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideUpAnim, { toValue: 600, duration: 200, useNativeDriver: true })
    ]).start(() => {
      setIsModalOpen(false);
    });
  };

  const startCheckout = () => {
    setCheckoutActive(true);
  };

  const userEmail = useUserStore((state) => state.user?.email);

  // Asynchronous background hydration & non-blocking DB sync
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(async () => {
      try {
        // Sync wallet & user state in background asynchronously without stalling transition
        await useWalletStore.getState().syncFromDB();
      } catch (err) {
        console.warn('[Membership] Non-blocking background sync warning:', err);
      }
    });

    return () => {
      task.cancel();
    };
  }, []);

  // PayPhi Gateway Integration
  useEffect(() => {
    const unsubscribe = PayPhiService.registerResponseListener(
      () => {
        setIsProcessing(false);
        setIsSuccess(true);
      },
      (errorMsg) => {
        setIsProcessing(false);
        Alert.alert('Payment Failed', errorMsg || 'Transaction was not completed.');
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handlePayPhiPayment = async () => {
    if (!selectedPlan) return;

    setIsProcessing(true);

    const res = await PayPhiService.startPayment(
      selectedPlan.id,
      userEmail
    );

    if (!res.success) {
      setIsProcessing(false);
      Alert.alert('Payment Error', res.error || 'Failed to initialize payment gateway.');
    }
  };



  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar style="dark" />
      {/* Top Header — matching screenshot exactly */}
      <View 
        style={{ paddingTop: insets.top, backgroundColor: '#FFFFFF' }}
        className="px-5 pb-2"
      >
        <View className="h-12 flex-row items-center justify-between">
          {/* Circular Back Button */}
          <TouchableOpacity 
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/profile');
              }
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            className="w-10 h-10 rounded-full items-center justify-center"
          >
            <Feather name="arrow-left" size={20} color="#18181B" />
          </TouchableOpacity>

          {/* Centered Editorial Title */}
          <View className="items-center justify-center">
            <View className="flex-row items-center gap-1.5">
              <View className="w-1.5 h-1.5 rounded-full bg-[#E11D48]" />
              <Text className="text-zinc-400 text-[10px] font-bold tracking-[0.8px] uppercase">
                MEMBERSHIP & PACKS
              </Text>
            </View>
            <Text className="text-zinc-950 text-[15px] font-extrabold tracking-tight mt-0.5">
              VIRLA Credits
            </Text>
          </View>

          {/* Circular Help Button */}
          <TouchableOpacity 
            activeOpacity={0.7} 
            onPress={() => router.push('/help-support' as any)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            className="w-10 h-10 rounded-full items-center justify-center"
          >
            <Feather name="help-circle" size={20} color="#18181B" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        className="flex-1" 
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24 }}
      >
        {/* Hero Title */}
        <View className="mb-4">
          <Text className="text-zinc-950 text-[28px] font-extrabold tracking-[-0.6px] leading-[34px]">Select Credits Pack</Text>
          <Text className="text-zinc-500 text-[13px] font-normal leading-[19px] mt-1.5">
            Book wellness sessions instantly with top-tier private coaches.
          </Text>
        </View>

        {/* Segmented Switcher Category Selector */}
        <View style={{ backgroundColor: '#F2F2F5', padding: 4, borderRadius: 16, flexDirection: 'row', marginBottom: 20 }}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleSelectCategory('individual')}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: activeCategory === 'individual' ? '#141416' : 'transparent',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: activeCategory === 'individual' ? '#FFFFFF' : '#71717A' }}>
              Individual (1 Person)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleSelectCategory('couple')}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: activeCategory === 'couple' ? '#141416' : 'transparent',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: activeCategory === 'couple' ? '#FFFFFF' : '#71717A' }}>
              Train Together
            </Text>
          </TouchableOpacity>
        </View>

        {/* Available Packs Header */}
        <View className="flex-row justify-between items-center mb-2.5 px-0.5">
          <Text className="text-zinc-400 text-[11px] font-bold tracking-[0.6px] uppercase">AVAILABLE PACKS</Text>
          <Text className="text-zinc-400 text-[12px] font-normal">Instant Activation</Text>
        </View>

        {/* Plan Cards */}
        <View>
          {activePlans.map((plan, idx) => {
            const isSelected = selectedPlan?.id === plan.id;
            const displayName = plan.name === 'Active Pack' ? 'Active' : plan.name;

            if (isSelected) {
              return (
                <TouchableOpacity
                  key={`plan-card-${idx}`}
                  activeOpacity={0.92}
                  onPress={() => openPlanDetails(plan)}
                  style={{
                    backgroundColor: '#0B0C15',
                    borderRadius: 20,
                    padding: 18,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(49, 46, 129, 0.6)',
                    shadowColor: '#4F46E5',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.16,
                    shadowRadius: 12,
                    elevation: 3,
                  }}
                >
                  {/* Badges */}
                  {(plan.badge || plan.ribbon) && (
                    <View className="flex-row items-center gap-2 mb-3">
                      {plan.badge && (
                        <View className="bg-[#1E1F38] border border-indigo-500/30 px-2.5 py-1 rounded-[6px]">
                          <Text className="text-[#818CF8] text-[10px] font-extrabold uppercase">{plan.badge}</Text>
                        </View>
                      )}
                      {plan.ribbon && (
                        <View className="bg-white px-2.5 py-1 rounded-[6px]">
                          <Text className="text-zinc-950 text-[10px] font-extrabold uppercase">{plan.ribbon}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  <View className="flex-row items-start justify-between">
                    <View className="flex-row items-start gap-3.5 flex-1 pr-3">
                      <View className="w-[22px] h-[22px] rounded-full bg-[#4F46E5] items-center justify-center mt-0.5">
                        <Feather name="check" size={13} color="white" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-white text-[16px] font-bold tracking-tight">{displayName}</Text>
                        <View className="flex-row items-center gap-1.5 mt-1">
                          <Feather name="zap" size={11} color="#FB7185" />
                          <Text className="text-[#FB7185] text-[12px] font-semibold">
                            {plan.credits} {plan.credits === 1 ? 'Session / Credit' : 'Sessions / Credits'}
                          </Text>
                        </View>
                        {plan.perSessionText && (
                          <Text className="text-zinc-300 text-[11px] font-semibold mt-0.5">
                            {plan.perSessionText}
                          </Text>
                        )}
                        <Text className="text-zinc-400 text-[12px] font-normal leading-[17px] mt-1">
                          {plan.idealFor}
                        </Text>
                      </View>
                    </View>

                    <View className="items-end justify-start">
                      {plan.originalPrice && (
                        <Text className="text-zinc-400 text-[11.5px] line-through font-medium mb-0.5">{plan.originalPrice}</Text>
                      )}
                      <Text className="text-white text-[22px] font-extrabold tracking-tight">{plan.price}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }

            return (
              <TouchableOpacity
                key={`plan-card-${idx}`}
                activeOpacity={0.85}
                onPress={() => setSelectedPlan(plan)}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 20,
                  padding: 18,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: '#E4E4E7',
                }}
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-row items-start gap-3.5 flex-1 pr-3">
                    <View className="w-[22px] h-[22px] rounded-full border-[1.5px] border-zinc-300 bg-white items-center justify-center mt-0.5" />
                    <View className="flex-1">
                      <Text className="text-zinc-950 text-[16px] font-bold tracking-tight">{displayName}</Text>
                      <View className="flex-row items-center gap-1.5 mt-1">
                        <Feather name="zap" size={11} color="#E11D48" />
                        <Text className="text-[#E11D48] text-[12px] font-semibold">
                          {plan.credits} {plan.credits === 1 ? 'Session / Credit' : 'Sessions / Credits'}
                        </Text>
                      </View>
                      {plan.perSessionText && (
                        <Text className="text-zinc-600 text-[11px] font-semibold mt-0.5">
                          {plan.perSessionText}
                        </Text>
                      )}
                      <Text className="text-zinc-400 text-[12px] font-normal leading-[17px] mt-1">
                        {plan.idealFor}
                      </Text>
                    </View>
                  </View>

                  <View className="items-end justify-start">
                    <Text className="text-zinc-950 text-[17px] font-bold tracking-tight mt-0.5">
                      {plan.price}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* HOW WORKOUTS WORK — Informative Section from Posters */}
        <View className="mt-5 mb-4 p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80">
          <View className="flex-row items-center gap-2 mb-2">
            <Feather name="info" size={14} color="#18181B" />
            <Text className="text-zinc-950 text-xs font-bold uppercase tracking-wider">
              {activeCategory === 'individual' ? 'HOW INDIVIDUAL WORKOUTS WORK' : 'HOW COUPLE WORKOUTS WORK'}
            </Text>
          </View>
          <Text className="text-zinc-600 text-[12.5px] font-normal leading-[19px]">
            {activeCategory === 'individual'
              ? 'Individual packages cover one participant training 1-on-1 with a certified trainer for a personalized 60-minute session at your home or doorstep. The optional ₹499 Workout Buddy add-on allows you to bring a friend or partner to your solo session.'
              : 'Couple packages cover two people training together with one trainer, at the same location, for the same 60-minute session. They cannot be used to book separate solo sessions. The ₹499 individual workout-buddy add-on is a separate option for occasional shared sessions and is not a standalone service.'}
          </Text>
          <Text className="text-zinc-400 text-[10.5px] font-medium leading-[15px] mt-2.5">
            {activeCategory === 'individual'
              ? 'Individual package savings are calculated against the single session price of ₹1,499, before 5% GST. Founding 100 offer applies to the 8-session package.'
              : 'Couple package savings are calculated against the single couple session price of ₹1,899, before 5% GST. Founding 100 offer applies to the 8-session couple package.'}
          </Text>
        </View>

        {/* GOOD TO KNOW — Clean Seamless Section */}
        <View className="mt-2 mb-4 px-0.5">
          <View className="flex-row items-center gap-2 mb-3">
            <Feather name="check-circle" size={14} color="#18181B" />
            <Text className="text-zinc-950 text-xs font-bold uppercase tracking-wider">GOOD TO KNOW</Text>
          </View>

          <View className="gap-2.5">
            {[
              'Each session equals one 60-minute training session at your doorstep.',
              'All package prices are exclusive of 5% GST (GST charged at 5% checkout).',
              'Sessions can be used for any available workout style (Strength, Flow, Cardio, Reset, Combat).',
              'Credits/Sessions can be scheduled flexibly with top verified VIRLA coaches.',
              'Individual packages: 1 participant. Couple packages: 2 participants together.',
              'Unused sessions follow the VIRLA renewal & validity policy.'
            ].map((text, idx) => (
              <View key={idx} className="flex-row items-start gap-2.5">
                <View className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-2" />
                <Text className="text-zinc-700 text-[13px] font-normal leading-[19px] flex-1">
                  {text}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* PREMIUM BENEFITS — Seamless Collapsible Dropdown */}
        <View className="mt-4 mb-4 px-0.5">
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={toggleBenefits}
            className="flex-row items-center justify-between mb-3"
          >
            <View>
              <View className="flex-row items-center gap-2">
                <Text className="text-zinc-950 text-xs font-bold uppercase tracking-wider">PREMIUM BENEFITS</Text>
                <View className="bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                  <Text className="text-[#4F46E5] text-[10px] font-bold">7 Perks</Text>
                </View>
              </View>
              <Text className="text-zinc-500 text-[12px] font-normal mt-0.5">
                {isBenefitsExpanded ? 'Tap to collapse perks' : 'Tap to view all VIP perks included'}
              </Text>
            </View>

            <View className="w-7 h-7 rounded-full bg-zinc-100 items-center justify-center">
              <Feather name={isBenefitsExpanded ? "chevron-up" : "chevron-down"} size={14} color="#18181B" />
            </View>
          </TouchableOpacity>

          {isBenefitsExpanded && (
            <View className="gap-3 pt-1">
              {[
                { title: 'KYC Verified Trainers', desc: 'Secure, professional background checks.' },
                { title: 'Live Trainer Tracking', desc: 'Real-time GPS routing to your doorstep.' },
                { title: 'Flexible Scheduling', desc: 'Reschedule or cancel instantly anytime.' },
                { title: 'AI Wellness Support', desc: 'Custom AI recovery recommendations.' },
                { title: 'Easy Credit Sharing', desc: 'Share credits with family at zero fees.' },
                { title: 'Premium Support', desc: 'Dedicated 24/7 VIP concierge.' },
                { title: 'Secure Cashless Pay', desc: 'Encrypted Apple Pay and card checkouts.' }
              ].map((item, idx) => (
                <View key={idx} className="flex-row items-start gap-2.5">
                  <View className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-2" />
                  <View className="flex-1">
                    <Text className="text-zinc-900 text-[13px] font-semibold leading-[18px]">{item.title}</Text>
                    <Text className="text-zinc-500 text-[12px] font-normal mt-0.5 leading-[17px]">{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Pricing Disclaimers */}
        <View className="mt-6 mb-8 gap-1">
          <Text className="text-zinc-400 text-[10.5px] font-normal leading-[15px]">
            * All prices are subject to 5% GST as displayed at checkout.
          </Text>
          <Text className="text-zinc-400 text-[10.5px] font-normal leading-[15px]">
            * Founding 100 promotional pricing applies exclusively to the 8-session packages.
          </Text>
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      {selectedPlan && (
        <View 
          style={{ 
            paddingBottom: Math.max((insets.bottom || 0), 14),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -3 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 6,
          }}
          className="border-t border-zinc-200 bg-white px-4 pt-3 flex-row items-center justify-between"
        >
          <View className="gap-0.5">
            <Text className="text-zinc-400 text-[9.5px] font-bold uppercase tracking-[0.8px] mb-0.5">
              SELECTED PLAN
            </Text>
            {(() => {
              const rawName = selectedPlan.name === 'Active Pack' ? 'Active Pack' : selectedPlan.name;
              const [firstWord, ...restWords] = rawName.split(' ');
              const secondWord = restWords.join(' ');
              return (
                <View>
                  <Text className="text-zinc-950 text-[16px] font-extrabold leading-tight">
                    {firstWord}
                  </Text>
                  <View className="flex-row items-center gap-1.5">
                    {Boolean(secondWord) && (
                      <Text className="text-zinc-950 text-[16px] font-extrabold leading-tight">
                        {secondWord}
                      </Text>
                    )}
                    <Text className="text-zinc-400 text-[12px] font-medium">
                      • {selectedPlan.credits} Credits
                    </Text>
                  </View>
                </View>
              );
            })()}
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => openPlanDetails(selectedPlan)}
            className="bg-[#121214] rounded-2xl px-5 py-3 flex-row items-center gap-3.5 shadow-sm"
          >
            <Text className="text-white text-[11.5px] font-bold leading-[14px]">
              Continue to{'\n'}Checkout
            </Text>
            <View className="flex-row items-center gap-1 pl-1">
              <Text className="text-white text-[15px] font-extrabold">
                {selectedPlan.price}
              </Text>
              <Feather name="arrow-right" size={14} color="white" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Details & Checkout Overlay Modal (Feature 2) */}
      {isModalOpen && selectedPlan && (
        <Animated.View 
          style={{ opacity: overlayOpacity }}
          className="absolute top-0 left-0 right-0 bottom-0 bg-black/60 z-50 justify-end pb-6 px-4"
        >
          {/* Transparent dismiss header */}
          <TouchableOpacity onPress={closeDetails} className="flex-1" />

          <Animated.View 
            style={{ 
              transform: [{ translateY: slideUpAnim }],
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.18,
              shadowRadius: 20,
              elevation: 16,
            }}
            className="bg-white rounded-[32px] p-6 pb-8 gap-5 min-h-[480px] border border-zinc-100/80"
          >
            {/* Modal Drag handle indicator */}
            <View className="w-10 h-1 bg-zinc-200 rounded-full align-self-center mx-auto" />

            {/* Demo payment simulation notice hidden — dev only
            <View className="bg-red-50 border border-red-200 p-3.5 rounded-2xl flex-row items-center gap-3">
              <Feather name="info" size={16} color="#DC2626" />
              <Text className="text-red-700 text-xs font-bold leading-tight flex-1">
                This is just a demo payment simulation. Real payment gateway will integrate after the production approval.
              </Text>
            </View>
            */}

            {!isProcessing && !isSuccess && (
              <>
                {!checkoutActive ? (
                  // Plan details list (Feature 2)
                  <View className="gap-5">
                    <View className="flex-row justify-between items-center border-b border-zinc-100 pb-4">
                      <View className="gap-1 flex-1 pr-3">
                        <Text className="text-zinc-400 text-[10px] font-bold uppercase">Plan Selected</Text>
                        <Text className="text-zinc-950 text-lg font-bold mt-0.5">{selectedPlan.name}</Text>
                        <View className="flex-row items-center gap-1.5 mt-1.5">
                          <Feather name="tag" size={11} color="#4F46E5" />
                          <Text className="text-[#4F46E5] text-[10px] font-semibold">GST Tax Note: {selectedPlan.gstText}</Text>
                        </View>
                      </View>
                      <TouchableOpacity onPress={closeDetails} className="w-8 h-8 rounded-full bg-zinc-100 items-center justify-center">
                        <Feather name="x" size={14} color="#101828" />
                      </TouchableOpacity>
                    </View>

                    <View className="gap-1.5">
                      <Text className="text-zinc-950 text-[10px] font-bold uppercase">Plan overview</Text>
                      <Text className="text-zinc-500 text-xs font-normal leading-relaxed pl-0.5">
                        {selectedPlan.idealFor}
                      </Text>
                    </View>

                    <View className="gap-2.5">
                      <Text className="text-zinc-950 text-[10px] font-bold uppercase">Package Highlights</Text>
                      {(selectedPlan.bulletPoints && selectedPlan.bulletPoints.length > 0
                        ? selectedPlan.bulletPoints
                        : [
                            'One trainer, private personalized 60-minute session.',
                            'Book any workout category (Strength, Flow, Cardio, Reset, Combat)',
                            'Premium verified VIRLA trainers automatically assigned',
                            'Unused credits follow the VIRLA renewal policy.'
                          ]
                      ).map((item, idx) => (
                        <View key={idx} className="flex-row gap-2.5 items-start pl-1">
                          <View className="mt-0.5">
                            <Feather name="check" size={12} color="#10B981" />
                          </View>
                          <Text className="text-zinc-600 text-xs font-medium leading-relaxed flex-1">{item}</Text>
                        </View>
                      ))}
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={startCheckout}
                      className="bg-zinc-950 rounded-2xl items-center justify-center mt-3 shadow-sm"
                      style={{ height: 52 }}
                    >
                      <Text className="text-white text-xs font-bold uppercase">Continue →</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  // Slide To Purchase Checkout (Feature 5)
                  <View className="gap-5 py-2">
                    <View className="flex-row justify-between items-center border-b border-zinc-100 pb-4">
                      <Text className="text-zinc-950 text-base font-bold uppercase pl-1">Checkout</Text>
                      <TouchableOpacity onPress={() => setCheckoutActive(false)} className="w-8 h-8 rounded-full bg-zinc-100 items-center justify-center">
                        <Feather name="arrow-left" size={14} color="#101828" />
                      </TouchableOpacity>
                    </View>

                    <View className="bg-zinc-50 border border-zinc-100 p-[18px] rounded-2xl gap-3">
                      <View className="flex-row justify-between items-center">
                        <Text className="text-zinc-500 text-xs font-semibold">Subtotal (Base Price)</Text>
                        <Text className="text-zinc-900 text-xs font-extrabold">{selectedPlan.amountVal}</Text>
                      </View>
                      <View className="flex-row justify-between items-center">
                        <Text className="text-zinc-500 text-xs font-semibold">GST (5%)</Text>
                        <Text className="text-zinc-900 text-xs font-extrabold">{selectedPlan.gstVal}</Text>
                      </View>
                      <View className="h-[1px] bg-zinc-100 my-1" />
                      <View className="flex-row justify-between items-center">
                        <Text className="text-zinc-950 text-sm font-extrabold">Total Amount</Text>
                        <Text className="text-[#4F46E5] text-sm font-extrabold">{selectedPlan.price}</Text>
                      </View>
                    </View>

                    {/* Universal Real Payment Gateway Button (Both iOS & Android) */}
                    <View className="gap-3 mt-2">
                      <TouchableOpacity
                        activeOpacity={0.85}
                        disabled={isProcessing}
                        onPress={handlePayPhiPayment}
                        className="h-14 bg-[#4F46E5] rounded-2xl items-center justify-center shadow-md"
                        style={{ height: 54 }}
                      >
                        <Text className="text-white text-xs font-extrabold uppercase tracking-wide">
                          Pay {selectedPlan.price} with Payment Gateway
                        </Text>
                      </TouchableOpacity>

                      {/* Safety Guidance Warning */}
                      <View className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-3 flex-row items-center gap-2.5">
                        <Feather name="alert-circle" size={14} color="#D97706" />
                        <Text className="text-amber-900 text-[11px] font-bold flex-1 leading-tight">
                          Please don't close the App or press back during payment operations.
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </>
            )}

            {/* Spinner loader processing ring screen (Feature 5) */}
            {isProcessing && (
              <View className="items-center justify-center py-16 gap-6 min-h-[400px]">
                <View className="relative w-16 h-16 items-center justify-center">
                  <Animated.View
                    style={{
                      position: 'absolute',
                      width: 64,
                      height: 64,
                      transform: [
                        {
                          rotate: spinAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '360deg'],
                          }),
                        },
                      ],
                    }}
                  >
                    <Svg width={64} height={64} viewBox="0 0 64 64">
                      <Circle cx={32} cy={32} r={28} stroke="#E5E7EB" strokeWidth={4} fill="none" />
                      <Circle cx={32} cy={32} r={28} stroke="#4F46E5" strokeWidth={4} fill="none" strokeDasharray="176" strokeDashoffset="44" strokeLinecap="round" />
                    </Svg>
                  </Animated.View>
                  <Feather name="lock" size={20} color="#4F46E5" />
                </View>
                <View className="items-center gap-1.5 px-6">
                  <Text className="text-zinc-900 text-sm font-extrabold uppercase">Securing Checkout Payout</Text>
                  <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-2">Connecting to payment hub</Text>
                  
                  {/* Highlighted Warning on Loader */}
                  <View className="bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-xl flex-row items-center gap-2">
                    <Feather name="alert-triangle" size={13} color="#D97706" />
                    <Text className="text-amber-900 text-[11px] font-black text-center">
                      Please don't close the App or press back in payment operations
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Success flight celebration details card (Feature 9) */}
            {isSuccess && (
              <View className="items-center justify-center py-10 gap-6 min-h-[400px]">
                <View className="w-16 h-16 rounded-full bg-emerald-500 items-center justify-center shadow-lg">
                  <Feather name="check" size={32} color="white" />
                </View>

                <View className="items-center gap-1.5 px-3">
                  <Text className="text-[#10B981] text-[10px] font-extrabold uppercase">Payment Successful</Text>
                  <Text className="text-zinc-950 text-xl font-extrabold mt-1 text-center">
                    +{selectedPlan.credits} {selectedPlan.credits === 1 ? 'Credit' : 'Credits'} Added
                  </Text>
                  <Text className="text-zinc-500 text-xs font-semibold text-center leading-relaxed max-w-[85%] mt-1">
                    Your wallet now contains: <Text className="font-extrabold text-[#4F46E5]">{creditBalance} Credits</Text>
                  </Text>
                </View>

                <View className="w-full gap-3 mt-4">
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      closeDetails();
                      router.replace('/wallet');
                    }}
                    className="w-full bg-[#101828] h-14 rounded-2xl items-center justify-center shadow-md"
                    style={{ height: 54 }}
                  >
                    <Text className="text-white text-sm font-extrabold uppercase">View Wallet</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      closeDetails();
                    }}
                    className="w-full bg-zinc-100 border border-zinc-200 h-14 rounded-2xl items-center justify-center"
                    style={{ height: 54 }}
                  >
                    <Text className="text-zinc-700 text-sm font-extrabold uppercase">Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}
