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
  finalPrice?: string;
  idealFor: string;
  popular?: boolean;
  badge?: string;
  ribbon?: string;
  category: 'individual' | 'couple';
  perSessionText?: string;
  bulletPoints?: string[];
  isHighlighted?: boolean;
}

const PLANS: Plan[] = [
  // Individual Plans (1 Person) - Image 1000080404.jpg
  // 8-Session Pack placed at the TOP as requested
  {
    id: 'plan-ind-2',
    name: '8-SESSION PACK',
    credits: 8,
    price: '₹9,800',
    originalPrice: '₹11,992',
    savings: 'Save ₹2,192 · 18% off',
    gstText: '₹9,800 + 5% GST',
    gstVal: '₹490',
    amountVal: '₹9,800',
    finalPrice: '₹10,290',
    perSessionText: '₹1,225 / session',
    idealFor: 'For consistent weekly workout routines',
    bulletPoints: [
      'Founding 100 exclusive offer (₹9,800)',
      'Save ₹2,192 vs single sessions',
      'Dedicated weekly coach tracking',
      'Priority slot reservation'
    ],
    badge: 'LAUNCH OFFER',
    ribbon: 'FOUNDING 100',
    category: 'individual',
    isHighlighted: true,
  },
  {
    id: 'plan-ind-1',
    name: 'SINGLE SESSION',
    credits: 1,
    price: '₹1,499',
    savings: 'Standard rate',
    gstText: '₹1,499 + 5% GST',
    gstVal: '₹75',
    amountVal: '₹1,499',
    finalPrice: '₹1,574',
    perSessionText: '1 session / 60 min',
    idealFor: 'For exploring private fitness at your doorstep',
    bulletPoints: [
      '1-on-1 private training (60 min)',
      'Certified doorstep trainer',
      'Full equipment included',
      'Flexible time slots'
    ],
    category: 'individual'
  },
  {
    id: 'plan-ind-3',
    name: '16-SESSION PACK',
    credits: 16,
    price: '₹18,000',
    originalPrice: '₹23,984',
    savings: 'Save ₹5,984 · 25% off',
    gstText: '₹18,000 + 5% GST',
    gstVal: '₹900',
    amountVal: '₹18,000',
    finalPrice: '₹18,900',
    perSessionText: '₹1,125 / session',
    idealFor: 'For serious fitness and progressive body goals',
    bulletPoints: [
      'Save ₹5,984 vs single bookings',
      'Structured progressive programming',
      'Dedicated trainer continuity',
      'Free session rescheduling'
    ],
    popular: true,
    badge: 'MOST POPULAR',
    ribbon: 'BEST RESULTS',
    category: 'individual'
  },
  {
    id: 'plan-ind-4',
    name: '32-SESSION PACK',
    credits: 32,
    price: '₹34,400',
    originalPrice: '₹47,968',
    savings: 'Save ₹13,568 · 28% off',
    gstText: '₹34,400 + 5% GST',
    gstVal: '₹1,720',
    amountVal: '₹34,400',
    finalPrice: '₹36,120',
    perSessionText: '₹1,075 / session',
    idealFor: 'For complete lifestyle transformation',
    bulletPoints: [
      'Lowest per-session rate (₹1,075)',
      'Save ₹13,568 across 32 sessions',
      'VIP coach dedicated matching',
      'Unlimited validity & pause anytime'
    ],
    badge: 'BEST VALUE',
    category: 'individual'
  },
  {
    id: 'plan-ind-addon-buddy',
    name: 'WORKOUT BUDDY',
    credits: 1,
    price: '₹499',
    savings: 'Bring a friend',
    gstText: '₹499 + 5% GST',
    gstVal: '₹25',
    amountVal: '₹499',
    finalPrice: '₹524',
    perSessionText: 'per session add-on',
    idealFor: 'Bring a partner or friend to your solo session',
    bulletPoints: [
      'Shared 60-min workout at same venue',
      'Train together with 1 private coach',
      'Valid as an add-on per session'
    ],
    badge: 'OPTIONAL ADD-ON',
    category: 'individual'
  },
  // Couple Plans (Train Together) - Image 1000080407.jpg
  {
    id: 'plan-cpl-1',
    name: 'COUPLE SINGLE',
    credits: 1,
    price: '₹1,899',
    savings: 'Train together',
    gstText: '₹1,899 + 5% GST',
    gstVal: '₹95',
    amountVal: '₹1,899',
    finalPrice: '₹1,994',
    perSessionText: 'for two participants',
    idealFor: 'Single trial workout session for two partners',
    bulletPoints: [
      '1 coach for two people (60 min)',
      'Same location doorstep session',
      'Tailored dual workout routine'
    ],
    category: 'couple'
  },
  {
    id: 'plan-cpl-2',
    name: '8-SESSION COUPLE',
    credits: 8,
    price: '₹13,000',
    originalPrice: '₹15,192',
    savings: 'Save ₹2,192 · 14% off',
    gstText: '₹13,000 + 5% GST',
    gstVal: '₹650',
    amountVal: '₹13,000',
    finalPrice: '₹13,650',
    perSessionText: '₹1,625 / session for two',
    idealFor: 'Couple entry package for regular joint workouts',
    bulletPoints: [
      '8 shared workouts for 2 people',
      'Save ₹2,192 vs single couple sessions',
      'Punctual doorstep trainer delivery'
    ],
    category: 'couple'
  },
  {
    id: 'plan-cpl-3',
    name: '16-SESSION COUPLE',
    credits: 16,
    price: '₹24,400',
    originalPrice: '₹30,384',
    savings: 'Save ₹5,984 · 20% off',
    gstText: '₹24,400 + 5% GST',
    gstVal: '₹1,220',
    amountVal: '₹24,400',
    finalPrice: '₹25,620',
    perSessionText: '₹1,525 / session for two',
    idealFor: 'Consistent shared training with maximum value',
    bulletPoints: [
      'Save ₹5,984 vs single couple sessions',
      '16 shared personal training workouts',
      'Progressive couples training program',
      'Priority slot matching'
    ],
    popular: true,
    badge: 'MOST POPULAR',
    ribbon: 'BEST VALUE',
    category: 'couple'
  },
  {
    id: 'plan-cpl-4',
    name: '32-SESSION COUPLE',
    credits: 32,
    price: '₹47,200',
    originalPrice: '₹60,768',
    savings: 'Save ₹13,568 · 22% off',
    gstText: '₹47,200 + 5% GST',
    gstVal: '₹2,360',
    amountVal: '₹47,200',
    finalPrice: '₹49,560',
    perSessionText: '₹1,475 / session for two',
    idealFor: 'Long-term joint transformation routine',
    bulletPoints: [
      'Lowest couple rate (₹1,475 / session)',
      'Save ₹13,568 across 32 workouts',
      'Dedicated premier couple trainer',
      'Full lifestyle consistency'
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

  // Selection states - null initially, user selects manually
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [checkoutActive, setCheckoutActive] = useState(false);
  const [isBenefitsExpanded, setIsBenefitsExpanded] = useState(false);

  const toggleBenefits = () => {
    setIsBenefitsExpanded((prev) => !prev);
  };

  const handleSelectCategory = (cat: 'individual' | 'couple') => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveCategory(cat);
    setSelectedPlan(null); // Keep unselected on tab change
  };

  const [buddyNotice, setBuddyNotice] = useState(false);

  const handlePlanCardPress = (plan: Plan) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    // Rule: Workout Buddy (₹499 addon) is disabled if user has 0 credits
    if (plan.id === 'plan-ind-addon-buddy' && (creditBalance || 0) <= 0) {
      setBuddyNotice(true);
      return;
    }
    setBuddyNotice(false);
    if (selectedPlan?.id === plan.id) {
      setSelectedPlan(null);
    } else {
      setSelectedPlan(plan);
    }
  };

  // Animations using useMemo to avoid render-phase ref reads
  const slideUpAnim = useMemo(() => new Animated.Value(600), []);
  const overlayOpacity = useMemo(() => new Animated.Value(0), []);
  const progressAnim = useMemo(() => new Animated.Value(0), []);
  const spinAnim = useMemo(() => new Animated.Value(0), []);
  const footerBarAnim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.spring(footerBarAnim, {
      toValue: selectedPlan ? 1 : 0,
      friction: 8,
      tension: 50,
      useNativeDriver: true,
    }).start();
  }, [selectedPlan]);

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
            <Text className="text-zinc-950 text-[16px] font-black tracking-tight">
              Virla Membership
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
        {/* Hero Title - matching design screenshot */}
        <View className="mb-6 items-center">
          <Text className="text-zinc-950 text-[30px] font-black tracking-tight text-center">Pricing plans</Text>
          <Text className="text-zinc-500 text-[14px] font-medium leading-[20px] mt-1 text-center">
            Choose a plan that fits your needs
          </Text>
        </View>

        {/* Minimal Pill Segmented Switcher Category Selector */}
        <View className="flex-row items-center justify-center mb-6">
          <View style={{ backgroundColor: '#F4F4F6', padding: 4, borderRadius: 24, flexDirection: 'row' }}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleSelectCategory('individual')}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 18,
                borderRadius: 20,
                backgroundColor: activeCategory === 'individual' ? '#18181B' : 'transparent',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: activeCategory === 'individual' ? '#FFFFFF' : '#71717A' }}>
                Solo Training
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleSelectCategory('couple')}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 18,
                borderRadius: 20,
                backgroundColor: activeCategory === 'couple' ? '#18181B' : 'transparent',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: activeCategory === 'couple' ? '#FFFFFF' : '#71717A' }}>
                Train Together
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Plan Cards - Accordion replicating exact screenshot feel */}
        <View style={{ marginBottom: 28 }}>
          {activePlans.map((plan, idx) => {
            const isExpanded = selectedPlan?.id === plan.id;
            const displayName = plan.name;
            const is8SessionPack = plan.id === 'plan-ind-2'; // Exclusively for Solo 8-Session Pack
            const isBuddyAddon = plan.id === 'plan-ind-addon-buddy';
            const isBuddyDisabled = isBuddyAddon && (creditBalance || 0) <= 0;

            // Extra callout text between key packages
            let sectionCallout: { text: string; icon: any; color: string } | null = null;
            if (is8SessionPack) {
              sectionCallout = { text: 'LIMITED OFFER • FIRST 100 USERS', icon: 'zap', color: '#D97706' };
            } else if (plan.id === 'plan-ind-addon-buddy') {
              sectionCallout = { text: 'FLEXIBILITY PASS • BRING A FRIEND', icon: 'users', color: '#059669' };
            }

            return (
              <React.Fragment key={`plan-card-${idx}`}>
                {/* Attractive inline divider text with extra spacing */}
                {sectionCallout && (
                  <View style={{ marginTop: 14, marginBottom: 12, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Feather name={sectionCallout.icon} size={12} color={sectionCallout.color} />
                    <Text style={{ fontSize: 10.5, fontWeight: '900', color: sectionCallout.color, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                      {sectionCallout.text}
                    </Text>
                  </View>
                )}

                <View
                  style={{
                    backgroundColor: isBuddyDisabled 
                      ? '#FAFAFA' 
                      : (is8SessionPack 
                          ? '#FEFDF8' 
                          : '#FFFFFF'),
                    borderRadius: 22,
                    borderWidth: is8SessionPack ? 1.2 : (isBuddyDisabled ? 1 : 0),
                    borderColor: is8SessionPack ? '#FDE68A' : (isBuddyDisabled ? '#E4E4E7' : 'transparent'),
                    shadowColor: is8SessionPack ? '#D97706' : '#000000',
                    shadowOffset: { width: 0, height: 7 },
                    shadowOpacity: isExpanded ? 0.12 : (isBuddyDisabled ? 0.02 : (is8SessionPack ? 0.10 : 0.08)),
                    shadowRadius: isExpanded ? 12 : (isBuddyDisabled ? 4 : (is8SessionPack ? 10 : 9)),
                    elevation: isExpanded ? 5 : (isBuddyDisabled ? 1 : (is8SessionPack ? 4 : 3)),
                    position: 'relative',
                    opacity: isBuddyDisabled ? 0.72 : 1,
                    marginBottom: 16, // Clean increased spacing between cards
                  }}
                >
                {/* Floating Flag/Ribbon Badge at top-left outside */}
                {(plan.badge || plan.ribbon) && (
                  <View 
                    style={{
                      position: 'absolute',
                      top: -10,
                      left: 18,
                      zIndex: 10,
                      backgroundColor: isBuddyDisabled 
                        ? '#71717A' 
                        : (is8SessionPack 
                            ? '#D97706' 
                            : (plan.popular ? '#6366F1' : (plan.isHighlighted ? '#E11D48' : '#18181B'))),
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                      borderRadius: 6,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.15,
                      shadowRadius: 4,
                      elevation: 3,
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                      {isBuddyDisabled ? 'ADD-ON LOCKED' : (is8SessionPack ? 'FIRST 100 EXCLUSIVE' : (plan.ribbon || plan.badge))}
                    </Text>
                  </View>
                )}

                {/* Card Collapsed/Expanded Top Summary Bar */}
                <TouchableOpacity
                  activeOpacity={isBuddyDisabled ? 0.95 : 0.85}
                  onPress={() => handlePlanCardPress(plan)}
                  style={{
                    padding: 18,
                    paddingTop: (plan.badge || plan.ribbon) ? 20 : 18,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: isBuddyDisabled ? '#71717A' : '#18181B', letterSpacing: -0.2 }}>
                      {displayName}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#71717A', marginTop: 2, fontWeight: '500' }}>
                      {plan.idealFor}
                    </Text>

                    {/* Always visible promo point without enlarging / opening the card */}
                    {is8SessionPack && (
                      <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Feather name="gift" size={12} color="#D97706" />
                        <Text style={{ fontSize: 11, color: '#B45309', fontWeight: '800' }}>
                          Limited time offer for first 100 users
                        </Text>
                      </View>
                    )}

                    {/* Inline helper message when user with 0 credits clicks Workout Buddy */}
                    {isBuddyAddon && isBuddyDisabled && buddyNotice && (
                      <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Feather name="info" size={12} color="#E11D48" />
                        <Text style={{ fontSize: 11, color: '#E11D48', fontWeight: '700' }}>
                          This is an add-on plan, not a standalone pack.
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 6 }}>
                    <View style={{ alignItems: 'flex-end' }}>
                      {plan.originalPrice && (
                        <Text style={{ fontSize: 11, color: '#A1A1AA', textDecorationLine: 'line-through', fontWeight: '600' }}>
                          {plan.originalPrice}
                        </Text>
                      )}
                      <Text style={{ 
                        fontSize: 21, 
                        fontWeight: '900', 
                        color: is8SessionPack 
                          ? '#D97706' 
                          : (isBuddyDisabled ? '#71717A' : '#18181B'), 
                        letterSpacing: -0.5 
                      }}>
                        {plan.price}
                      </Text>
                      <Text style={{ fontSize: 10, color: '#A1A1AA', fontWeight: '600' }}>
                        {plan.perSessionText || 'per session'}
                      </Text>
                    </View>

                    <View 
                      style={{ 
                        width: 26, 
                        height: 26, 
                        borderRadius: 13,
                        backgroundColor: isExpanded ? (is8SessionPack ? '#FEF3C7' : '#FFF1F2') : (is8SessionPack ? '#FEF3C7' : '#F4F4F6'),
                        alignItems: 'center', 
                        justifyContent: 'center',
                        marginLeft: 4,
                      }}
                    >
                      <Feather 
                        name={isBuddyDisabled ? 'lock' : (isExpanded ? 'chevron-up' : 'chevron-down')} 
                        size={15} 
                        color={is8SessionPack ? '#D97706' : (isExpanded ? '#E11D48' : '#71717A')} 
                      />
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Expanded Details Section */}
                {isExpanded && (
                  <View style={{ paddingHorizontal: 18, paddingBottom: 16, borderTopWidth: 1, borderTopColor: is8SessionPack ? '#FEF3C7' : '#F4F4F6', paddingTop: 14 }}>
                    {/* Bullet Points with Clean Check / Tick mark */}
                    <View style={{ gap: 8 }}>
                      {plan.bulletPoints?.map((bullet, bIdx) => (
                        <View key={bIdx} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                          <Feather name="check" size={14} color={is8SessionPack ? '#D97706' : '#E11D48'} />
                          <Text style={{ fontSize: 12.5, color: '#3F3F46', fontWeight: '500', flex: 1, lineHeight: 17 }}>
                            {bullet}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </React.Fragment>
          );
        })}
      </View>

        {/* HOW WORKOUTS WORK — Lightweight Clean Editorial Section */}
        <View className="mt-6 mb-4 px-1 py-1">
          <View className="flex-row items-center gap-2 mb-2">
            <Feather name="info" size={13} color="#18181B" />
            <Text className="text-zinc-950 text-[12px] font-black uppercase tracking-wider">
              {activeCategory === 'individual' ? 'How 1-on-1 Workouts Work' : 'How Couple Workouts Work'}
            </Text>
          </View>
          <Text className="text-zinc-600 text-[13px] font-normal leading-[20px]">
            {activeCategory === 'individual'
              ? 'Individual packages cover 1 participant training 1-on-1 with a private certified coach for a personalized 60-minute session at your home or doorstep. Need a friend along occasionally? Use the ₹499 Workout Buddy add-on.'
              : 'Couple packages cover two partners training together with one private coach, at the same location, for a simultaneous 60-minute workout.'}
          </Text>
        </View>

        {/* GOOD TO KNOW — Clean Minimal List */}
        <View className="mt-3 mb-4 px-1 py-1">
          <View className="flex-row items-center gap-2 mb-3">
            <Feather name="shield" size={13} color="#18181B" />
            <Text className="text-zinc-950 text-[12px] font-black uppercase tracking-wider">Membership Perks & Terms</Text>
          </View>

          <View className="gap-2.5">
            {[
              'Each session equals one full 60-minute private workout at your doorstep.',
              'All workouts are flexible across the workouts shown in the app.',
              'Prices shown are base rates · 5% GST added cleanly at checkout.',
              'Unused credits carry over smoothly under the standard VIRLA policy.'
            ].map((text, idx) => (
              <View key={idx} className="flex-row items-start gap-2.5">
                <View className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-2" />
                <Text className="text-zinc-600 text-[13px] font-normal leading-[19px] flex-1">
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
                <Text className="text-zinc-950 text-[12px] font-black uppercase tracking-wider">PREMIUM BENEFITS</Text>
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

      {/* Sticky Bottom Bar with compact height and curved top corners */}
      {selectedPlan && (
        <Animated.View 
          style={{ 
            paddingBottom: Math.max((insets.bottom || 0) + (Platform.OS === 'android' ? 24 : 8), Platform.OS === 'android' ? 36 : 14),
            opacity: footerBarAnim,
            transform: [
              {
                translateY: footerBarAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0],
                }),
              },
            ],
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            backgroundColor: '#FFFFFF',
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: -6 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 12,
          }}
          className="border-t border-zinc-100 px-5 pt-3 pb-2.5 flex-row items-center justify-between"
        >
          <View className="flex-1 pr-3">
            <Text className="text-zinc-950 text-[15px] font-black tracking-tight leading-tight">
              {selectedPlan.name}
            </Text>
            <View className="flex-row items-center gap-1.5 mt-0.5">
              <Text className="text-zinc-400 text-[11px] font-medium">
                {selectedPlan.credits} {selectedPlan.credits === 1 ? 'Session' : 'Sessions'}
              </Text>
              <Text className="text-zinc-300 text-[10px]">•</Text>
              <Text className="text-zinc-400 text-[11px] font-normal">Price:</Text>
              <Text style={{ color: '#E11D48' }} className="text-[13.5px] font-black tracking-tight">
                {selectedPlan.price}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => openPlanDetails(selectedPlan)}
            style={{
              backgroundColor: '#E11D48', // Virla signature primary red
              borderRadius: 24, // Fully rounded pill shape
              paddingHorizontal: 16,
              height: 38,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              shadowColor: '#E11D48',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.25,
              shadowRadius: 6,
              elevation: 3,
            }}
          >
            <Text className="text-white text-[12px] font-black tracking-wider uppercase">
              Pay {selectedPlan.price}
            </Text>
            <Feather name="arrow-right" size={13} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Details & Checkout Overlay Modal (Feature 2) */}
      {isModalOpen && selectedPlan && (
        <Animated.View 
          style={{ 
            opacity: overlayOpacity,
            paddingBottom: Math.max((insets.bottom || 0) + (Platform.OS === 'android' ? 24 : 12), Platform.OS === 'android' ? 36 : 16)
          }}
          className="absolute top-0 left-0 right-0 bottom-0 bg-black/60 z-50 justify-end px-3.5"
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
            className="bg-white rounded-[28px] p-5 pt-3.5 pb-5 border border-zinc-100"
          >
            {/* Modal Drag handle indicator */}
            <View className="w-9 h-1 bg-zinc-200 rounded-full align-self-center mx-auto mb-2" />

            {!isProcessing && !isSuccess && (
              <>
                {!checkoutActive ? (
                  // Plan details list (Feature 2)
                  <View className="gap-3.5">
                    <View className="flex-row justify-between items-center border-b border-zinc-100 pb-2.5">
                      <View className="flex-1 pr-3">
                        <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">Plan Selected</Text>
                        <Text className="text-zinc-950 text-xl font-black tracking-tight mt-0.5">{selectedPlan.name}</Text>
                        <View className="flex-row items-center gap-1.5 mt-1">
                          <Feather name="tag" size={11} color="#E11D48" />
                          <Text style={{ color: '#E11D48' }} className="text-[10px] font-bold">
                            GST Tax Note: {selectedPlan.gstText}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity 
                        onPress={closeDetails} 
                        activeOpacity={0.7}
                        className="w-10 h-10 rounded-full bg-zinc-100 items-center justify-center border border-zinc-200"
                      >
                        <Feather name="x" size={19} color="#18181B" />
                      </TouchableOpacity>
                    </View>

                    <View className="gap-0.5">
                      <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">Plan overview</Text>
                      <Text className="text-zinc-600 text-xs font-normal leading-snug">
                        {selectedPlan.idealFor}
                      </Text>
                    </View>

                    <View className="gap-2">
                      <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">Package Highlights</Text>
                      {(selectedPlan.bulletPoints && selectedPlan.bulletPoints.length > 0
                        ? selectedPlan.bulletPoints
                        : [
                            'One trainer, private personalized 60-minute session.',
                            'Book any workout category (Strength, Flow, Cardio, Reset, Combat)',
                            'Premium verified VIRLA trainers automatically assigned',
                            'Unused credits follow the VIRLA renewal policy.'
                          ]
                      ).map((item, idx) => (
                        <View key={idx} className="flex-row gap-2 items-center">
                          <Feather name="check" size={13} color="#E11D48" />
                          <Text className="text-zinc-700 text-xs font-medium flex-1">{item}</Text>
                        </View>
                      ))}
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={startCheckout}
                      style={{ 
                        backgroundColor: '#E11D48', // Virla signature primary red
                        height: 42,
                        borderRadius: 21,
                        shadowColor: '#E11D48',
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.25,
                        shadowRadius: 6,
                        elevation: 3,
                      }}
                      className="items-center justify-center mt-2"
                    >
                      <Text className="text-white text-xs font-black uppercase tracking-wider">Continue →</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  // Slide To Purchase Checkout (Feature 5)
                  <View className="gap-3.5">
                    <View className="flex-row justify-between items-center border-b border-zinc-100 pb-2.5">
                      <Text className="text-zinc-950 text-base font-black uppercase tracking-tight">Checkout</Text>
                      <View className="flex-row items-center gap-2">
                        <TouchableOpacity 
                          onPress={() => setCheckoutActive(false)} 
                          activeOpacity={0.7}
                          className="w-9 h-9 rounded-full bg-zinc-100 items-center justify-center border border-zinc-200"
                        >
                          <Feather name="arrow-left" size={16} color="#18181B" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={closeDetails} 
                          activeOpacity={0.7}
                          className="w-9 h-9 rounded-full bg-zinc-100 items-center justify-center border border-zinc-200"
                        >
                          <Feather name="x" size={16} color="#18181B" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View className="bg-zinc-50 border border-zinc-200 p-3.5 rounded-2xl gap-2">
                      {/* Base Pack Price */}
                      <View className="flex-row justify-between items-center">
                        <Text className="text-zinc-600 text-xs font-semibold">{selectedPlan.name}</Text>
                        <Text className="text-zinc-950 text-xs font-black">{selectedPlan.amountVal}</Text>
                      </View>

                      {/* Plus Separator with Black accent line */}
                      <View className="flex-row items-center justify-center my-0.5">
                        <View className="h-[1px] bg-zinc-900 flex-1" />
                        <View className="w-5 h-5 rounded-full bg-zinc-900 items-center justify-center mx-2">
                          <Feather name="plus" size={12} color="#FFFFFF" />
                        </View>
                        <View className="h-[1px] bg-zinc-900 flex-1" />
                      </View>

                      {/* GST (5%) */}
                      <View className="flex-row justify-between items-center">
                        <View className="flex-row items-center gap-1.5">
                          <Text className="text-zinc-900 text-xs font-bold">GST (5%)</Text>
                          <View className="bg-zinc-900 px-1.5 py-0.5 rounded-md">
                            <Text className="text-white text-[9px] font-black uppercase">5% Govt GST</Text>
                          </View>
                        </View>
                        <Text className="text-zinc-900 text-xs font-black">{selectedPlan.gstVal}</Text>
                      </View>

                      {/* Solid Black Separator Line */}
                      <View className="h-[1.5px] bg-zinc-900 my-1" />

                      {/* Total Amount with Bold = icon */}
                      <View className="flex-row justify-between items-center">
                        <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider">Total Amount</Text>
                        <View className="flex-row items-center gap-1.5">
                          <Text style={{ color: '#E11D48' }} className="text-base font-black">
                            =
                          </Text>
                          <Text style={{ color: '#E11D48' }} className="text-[19px] font-black tracking-tight">
                            {selectedPlan.finalPrice || selectedPlan.price}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Compact Natural-Width Payment Gateway Button - App Primary Red Style */}
                    <View className="items-center gap-2 mt-2">
                      <TouchableOpacity
                        activeOpacity={0.75}
                        disabled={isProcessing}
                        onPress={handlePayPhiPayment}
                        style={{ 
                          backgroundColor: '#E11D48', // Virla signature primary red
                          height: 40,
                          borderRadius: 20, // Curvy pill shape
                          paddingHorizontal: 28, // Content-hugging natural width
                          shadowColor: '#E11D48',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.28,
                          shadowRadius: 8,
                          elevation: 4,
                        }}
                        className="items-center justify-center flex-row gap-2"
                      >
                        <Text className="text-white text-xs font-black uppercase tracking-wider">
                          Pay {selectedPlan.finalPrice || selectedPlan.price}
                        </Text>
                        <Feather name="arrow-right" size={13} color="#FFFFFF" />
                      </TouchableOpacity>

                      {/* Clean Safety Guidance Note in Red */}
                      <View className="flex-row items-center justify-center gap-1.5 pt-0.5 px-2">
                        <Feather name="shield" size={12} color="#EF4444" />
                        <Text className="text-red-500 text-[11px] font-semibold text-center">
                          Please don't close the app or press back during checkout
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
