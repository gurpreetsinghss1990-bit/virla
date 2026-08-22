import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useWalletStore } from '../store/walletStore';
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
}

export default function MembershipScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { purchasePlan, creditBalance } = useWalletStore();

  const [activeCategory, setActiveCategory] = useState<'individual' | 'couple'>('individual');

  const plans: Plan[] = [
    // Individual Plans (1 Person)
    {
      id: 'plan-ind-1',
      name: 'Single Session',
      credits: 1,
      price: '₹1,499',
      savings: '0% Save',
      gstText: '₹1,270 + 18% GST',
      gstVal: '₹229',
      amountVal: '₹1,270',
      idealFor: 'Casual visits or trying out a new program workout.',
      category: 'individual'
    },
    {
      id: 'plan-ind-2',
      name: 'Starter Pack',
      credits: 8,
      price: '₹10,999',
      savings: '8% Savings',
      gstText: '₹9,321 + 18% GST',
      gstVal: '₹1,678',
      amountVal: '₹9,321',
      idealFor: 'Weekly wellness routines at home.',
      category: 'individual'
    },
    {
      id: 'plan-ind-3',
      name: 'Active Pack',
      credits: 12,
      price: '₹11,999',
      originalPrice: '₹14,999',
      savings: '20% Savings',
      gstText: '₹10,169 + 18% GST',
      gstVal: '₹1,830',
      amountVal: '₹10,169',
      popular: true,
      idealFor: 'Our most popular pack for serious fitness goals.',
      badge: 'MOST POPULAR',
      ribbon: 'FIRST TIME OFFER – SAVE 20%',
      category: 'individual'
    },
    {
      id: 'plan-ind-4',
      name: 'Elite Pack',
      credits: 15,
      price: '₹17,999',
      savings: '20% Savings',
      gstText: '₹15,253 + 18% GST',
      gstVal: '₹2,746',
      amountVal: '₹15,253',
      idealFor: 'Complete consistency with private home training.',
      category: 'individual'
    },
    // Couple Plans (Train Together)
    {
      id: 'plan-cpl-1',
      name: 'Couple Single Session',
      credits: 1,
      price: '₹2,499',
      savings: '0% Save',
      gstText: '₹2,118 + 18% GST',
      gstVal: '₹381',
      amountVal: '₹2,118',
      idealFor: 'Single training session with your partner or friend.',
      category: 'couple'
    },
    {
      id: 'plan-cpl-2',
      name: 'Couple Starter Pack',
      credits: 8,
      price: '₹17,999',
      savings: '10% Savings',
      gstText: '₹15,253 + 18% GST',
      gstVal: '₹2,746',
      amountVal: '₹15,253',
      idealFor: 'Weekly routine for couples or training partners.',
      category: 'couple'
    },
    {
      id: 'plan-cpl-3',
      name: 'Couple Active Pack',
      credits: 12,
      price: '₹19,199',
      originalPrice: '₹23,988',
      savings: '20% Savings',
      gstText: '₹16,270 + 18% GST',
      gstVal: '₹2,929',
      amountVal: '₹16,270',
      popular: true,
      idealFor: 'Our hero couples package for regular training.',
      badge: 'MOST POPULAR',
      ribbon: 'FIRST TIME OFFER – SAVE 20%',
      category: 'couple'
    },
    {
      id: 'plan-cpl-4',
      name: 'Couple Elite Pack',
      credits: 15,
      price: '₹29,999',
      savings: '20% Savings',
      gstText: '₹25,423 + 18% GST',
      gstVal: '₹4,576',
      amountVal: '₹25,423',
      idealFor: 'Elite wellness consistency for partners.',
      category: 'couple'
    }
  ];

  const activePlans = plans.filter((p) => p.category === activeCategory);

  // Selection states
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [checkoutActive, setCheckoutActive] = useState(false);

  // Animations using useMemo to avoid render-phase ref reads
  const slideUpAnim = useMemo(() => new Animated.Value(600), []);
  const overlayOpacity = useMemo(() => new Animated.Value(0), []);
  const progressAnim = useMemo(() => new Animated.Value(0), []);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showDemoPayment, setShowDemoPayment] = useState(false);

  const openPlanDetails = (plan: Plan) => {
    setSelectedPlan(plan);
    setCheckoutActive(false);
    setIsProcessing(false);
    setIsSuccess(false);
    setShowDemoPayment(false);
    
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
      setSelectedPlan(null);
      setShowDemoPayment(false);
    });
  };

  const startCheckout = () => {
    setCheckoutActive(true);
  };

  // Simulated Apple Pay Confirm Swipe
  const handleConfirmPay = () => {
    setIsProcessing(true);
    progressAnim.setValue(0);
    
    // Animate loader ring
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true
    }).start(() => {
      // Finalize transaction
      if (selectedPlan) {
        purchasePlan(
          selectedPlan.name,
          selectedPlan.credits,
          selectedPlan.amountVal,
          selectedPlan.price,
          selectedPlan.gstVal
        );
      }
      setIsProcessing(false);
      setIsSuccess(true);
    });
  };



  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FC', paddingTop: insets.top }}>
      {/* Header */}
      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white">
        <TouchableOpacity 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/profile');
            }
          }} 
          className="w-8 h-8 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={20} color="#101828" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-[#101828] text-sm font-black uppercase tracking-wider mr-8">
          VIRLA Credits
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 140 }}>
        <View className="gap-6">
          
          <View>
            <Text className="text-zinc-900 text-2xl font-black tracking-tight leading-tight">Select Credits Pack</Text>
            <Text className="text-zinc-500 text-xs font-semibold mt-1 leading-relaxed">
              Book wellness sessions instantly with top-tier private coaches.
            </Text>
          </View>

          {/* Segmented Switcher Category Selector */}
          <View className="flex-row border border-zinc-200/80 p-1.5 rounded-[22px] bg-zinc-50">
            {[
              { id: 'individual', label: 'Individual (1 Person)' },
              { id: 'couple', label: 'Train Together' }
            ].map((cat) => {
              const isCatActive = activeCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  activeOpacity={0.85}
                  onPress={() => setActiveCategory(cat.id as any)}
                  className={`flex-1 py-3 rounded-[16px] items-center justify-center`}
                  style={isCatActive ? {
                    backgroundColor: '#101828',
                    shadowColor: '#101828',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 2,
                  } : undefined}
                >
                  <Text className={`text-[10px] font-black uppercase tracking-wider ${isCatActive ? 'text-white' : 'text-[#6B7280]'}`}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Subtitle Description */}
          {activeCategory === 'couple' && (
            <View className="bg-indigo-50/50 border border-indigo-100/50 p-4.5 rounded-[20px] -mt-2">
              <Text className="text-zinc-600 text-xs font-semibold leading-relaxed text-center">
                🧘 Perfect for couples, friends or family members training together in the same session.
              </Text>
            </View>
          )}

          {/* Plan cards */}
          <View className="gap-4">
            {activePlans.map((plan) => {
              const isHero = plan.popular;
              return (
                <TouchableOpacity
                  key={plan.id}
                  activeOpacity={0.95}
                  onPress={() => openPlanDetails(plan)}
                  className={`bg-white border rounded-[28px] flex-row justify-between items-center relative ${
                    isHero ? 'border-indigo-600 p-6' : 'border-[#E5E7EB] p-5'
                  }`}
                  style={isHero ? {
                    shadowColor: '#4F46E5',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.08,
                    shadowRadius: 20,
                    elevation: 4,
                    transform: [{ scale: 1.01 }],
                    marginTop: 4,
                    marginBottom: 4,
                  } : {
                    shadowColor: '#101828',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.02,
                    shadowRadius: 4,
                    elevation: 1,
                  }}
                >
                  {isHero && plan.ribbon && (
                    <View className="absolute top-0 right-6 -translate-y-1/2 bg-indigo-600 px-3 py-1 rounded-full shadow-xs">
                      <Text className="text-white text-[8px] font-black uppercase tracking-widest">{plan.ribbon}</Text>
                    </View>
                  )}

                  <View className="flex-1 pr-4 gap-1">
                    <View className="flex-row items-center gap-1.5 flex-wrap">
                      <Text className="text-zinc-950 text-base font-black">{plan.name}</Text>
                      {isHero && (
                        <View className="bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md">
                          <Text className="text-[#4F46E5] text-[7px] font-black uppercase tracking-widest">Most Popular</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-zinc-500 text-[10px] font-semibold">{plan.credits} Booking Credits Included</Text>
                    <Text className="text-zinc-400 text-[8px] font-bold mt-1 uppercase tracking-wider">{plan.idealFor}</Text>
                  </View>

                  <View className="items-end gap-2.5">
                    <View className="items-end">
                      {plan.originalPrice && (
                        <Text className="text-zinc-400 text-[10px] line-through font-bold">{plan.originalPrice}</Text>
                      )}
                      <Text className="text-zinc-950 text-xl font-black tracking-tight">{plan.price}</Text>
                    </View>
                    <View className="bg-zinc-950 px-4 py-2.5 rounded-xl border border-zinc-800 flex-row items-center gap-1.5 min-h-[44px] justify-center min-w-[90px]">
                      <Text className="text-white text-[9px] font-black uppercase tracking-wider">Continue</Text>
                      <Feather name="arrow-right" size={10} color="white" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Important Information Card (Good to Know) */}
          <View 
            className="bg-white border border-[#E5E7EB] p-6 rounded-[28px] gap-5"
            style={{
              shadowColor: '#101828',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.03,
              shadowRadius: 12,
              elevation: 2,
            }}
          >
            <View className="flex-row items-center gap-2.5 border-b border-zinc-100 pb-3.5">
              <Feather name="info" size={14} color="#101828" />
              <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider pl-0.5">Good to Know</Text>
            </View>

            <View className="gap-4">
              {[
                { text: 'Each credit equals one 60-minute training session.', icon: 'clock' },
                { text: 'Credits can be used for any available workout category.', icon: 'award' },
                { text: 'Credits can be shared with your friends and family.', icon: 'share-2' },
                { text: 'Individual packages are valid for one participant per session.', icon: 'user' },
                { text: 'Couple packages are valid for two participants training together in the same session.', icon: 'users' },
                { text: 'Unused credits follow the VIRLA renewal policy.', icon: 'refresh-cw' }
              ].map((item, idx) => (
                <View key={idx} className="flex-row gap-3.5 items-start pl-0.5">
                  <View className="w-6.5 h-6.5 rounded-lg bg-zinc-50 border border-zinc-150 items-center justify-center mt-0.5">
                    <Feather name={item.icon as any} size={11} color="#6B7280" />
                  </View>
                  <Text className="text-zinc-600 text-xs font-semibold leading-relaxed flex-1">{item.text}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Premium Benefits Grid (Feature 8 Redesign) */}
          <View 
            className="bg-white border border-[#E5E7EB] p-6 rounded-[28px] gap-5"
            style={{
              shadowColor: '#101828',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.03,
              shadowRadius: 12,
              elevation: 2,
            }}
          >
            <View className="flex-row items-center gap-2.5 border-b border-zinc-100 pb-3.5">
              <Feather name="shield" size={14} color="#101828" />
              <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider pl-0.5">Premium Benefits</Text>
            </View>

            <View className="flex-row flex-wrap justify-between gap-y-4">
              {[
                { title: 'KYC Verified Trainers', desc: 'Secure, professional background checks.', icon: 'check-circle' },
                { title: 'Live Trainer Tracking', desc: 'Real-time GPS routing to your doorstep.', icon: 'map-pin' },
                { title: 'Flexible Scheduling', desc: 'Reschedule or cancel instantly anytime.', icon: 'calendar' },
                { title: 'AI Wellness Support', desc: 'Custom AI recovery recommendations.', icon: 'cpu' },
                { title: 'Easy Credit Sharing', desc: 'Share credits with family at zero fees.', icon: 'share-2' },
                { title: 'Premium Support', desc: 'Dedicated 24/7 VIP wellness concierge.', icon: 'headphones' },
                { title: 'Secure Cashless Pay', desc: 'Encrypted Apple Pay and card checkouts.', icon: 'credit-card' }
              ].map((item, idx) => (
                <View key={idx} className="w-[47%] gap-2 bg-zinc-50/50 border border-zinc-150/40 p-3.5 rounded-2xl">
                  <View className="w-7.5 h-7.5 rounded-xl bg-indigo-50 border border-indigo-100 items-center justify-center">
                    <Feather name={item.icon as any} size={13} color="#4F46E5" />
                  </View>
                  <View className="gap-0.5">
                    <Text className="text-[#101828] text-[10px] font-black tracking-tight">{item.title}</Text>
                    <Text className="text-zinc-500 text-[8px] font-bold leading-normal">{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Pricing Disclaimers */}
          <View className="px-1 gap-1.5">
            <Text className="text-zinc-400 text-[9px] font-semibold leading-relaxed">
              * Prices shown include all applicable taxes.
            </Text>
            <Text className="text-zinc-400 text-[9px] font-semibold leading-relaxed">
              * First-time discount is applicable only on the first purchase of the 12 Credit Active Pack.
            </Text>
          </View>

        </View>
      </ScrollView>

      {/* Details & Checkout Overlay Modal (Feature 2) */}
      {selectedPlan && (
        <Animated.View 
          style={{ opacity: overlayOpacity }}
          className="absolute top-0 left-0 right-0 bottom-0 bg-black/60 z-50 justify-end"
        >
          {/* Transparent dismiss header */}
          <TouchableOpacity onPress={closeDetails} className="flex-1" />

          <Animated.View 
            style={{ transform: [{ translateY: slideUpAnim }] }}
            className="bg-white rounded-t-[36px] p-6 pb-12 gap-6 min-h-[500px]"
          >
            {/* Modal Drag handle indicator */}
            <View className="w-10 h-1 bg-zinc-200 rounded-full align-self-center mx-auto" />

            {!isProcessing && !isSuccess && (
              <>
                {showDemoPayment ? (
                  /* Demo Payment screen */
                  <View className="gap-6 py-2">
                    <View className="flex-row justify-between items-center border-b border-zinc-100 pb-4">
                      <View className="gap-0.5">
                        <Text className="text-zinc-400 text-[8px] font-black uppercase">Sandbox Gateway</Text>
                        <Text className="text-zinc-950 text-base font-black uppercase tracking-wider pl-0.5">Test Payment Gateway</Text>
                      </View>
                      <TouchableOpacity 
                        onPress={() => {
                          setShowDemoPayment(false);
                        }} 
                        className="w-8 h-8 rounded-full bg-zinc-50 items-center justify-center border border-zinc-150"
                      >
                        <Feather name="arrow-left" size={14} color="#101828" />
                      </TouchableOpacity>
                    </View>

                    {/* Warning banner */}
                    <View className="bg-amber-50 border border-amber-100 p-4.5 rounded-2xl gap-2">
                      <View className="flex-row items-center gap-2">
                        <Feather name="alert-triangle" size={14} color="#D97706" />
                        <Text className="text-amber-800 text-[10px] font-black uppercase">DEMO MODE ACTIVE</Text>
                      </View>
                      <Text className="text-amber-700 text-[10px] font-semibold leading-relaxed">
                        This is a sandbox test transaction simulator. No real money will be charged.
                      </Text>
                    </View>

                    {/* Cost Summary details */}
                    <View className="bg-zinc-50 border border-zinc-100 p-4.5 rounded-2xl gap-3">
                      <View className="flex-row justify-between items-center">
                        <Text className="text-zinc-500 text-xs font-semibold">Selected Pack</Text>
                        <Text className="text-zinc-900 text-xs font-extrabold">{selectedPlan.name}</Text>
                      </View>
                      <View className="flex-row justify-between items-center">
                        <Text className="text-zinc-500 text-xs font-semibold">Credits Included</Text>
                        <Text className="text-zinc-900 text-xs font-extrabold">+{selectedPlan.credits} Credits</Text>
                      </View>
                      <View className="h-[1px] bg-zinc-150 my-0.5" />
                      <View className="flex-row justify-between items-center">
                        <Text className="text-zinc-500 text-xs font-semibold">Subtotal Price</Text>
                        <Text className="text-zinc-900 text-xs font-extrabold">{selectedPlan.amountVal}</Text>
                      </View>
                      <View className="flex-row justify-between items-center">
                        <Text className="text-zinc-500 text-xs font-semibold">GST (18% Sandbox Tax)</Text>
                        <Text className="text-zinc-900 text-xs font-extrabold">{selectedPlan.gstVal}</Text>
                      </View>
                      <View className="h-[1px] bg-zinc-150 my-0.5" />
                      <View className="flex-row justify-between items-center">
                        <Text className="text-zinc-950 text-xs font-black">Total Paid amount</Text>
                        <Text className="text-[#4F46E5] text-sm font-black">{selectedPlan.price}</Text>
                      </View>
                    </View>

                    {/* Action buttons */}
                    <View className="gap-3.5 mt-3">
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => {
                          setShowDemoPayment(false);
                          handleConfirmPay();
                        }}
                        className="w-full bg-[#10B981] rounded-2xl items-center justify-center shadow-md"
                        style={{ height: 56 }}
                      >
                        <Text className="text-white text-xs font-black uppercase tracking-wider">Pay {selectedPlan.price} (Sandbox Test)</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          setShowDemoPayment(false);
                        }}
                        className="w-full bg-zinc-50 border border-zinc-150 rounded-2xl items-center justify-center"
                        style={{ height: 56 }}
                      >
                        <Text className="text-zinc-600 text-xs font-black uppercase tracking-wider">Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : !checkoutActive ? (
                  // Plan details list (Feature 2)
                  <View className="gap-5">
                    <View className="flex-row justify-between items-center border-b border-zinc-100 pb-4">
                      <View className="gap-1 flex-1 pr-3">
                        <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">Plan Selected</Text>
                        <Text className="text-zinc-950 text-xl font-black mt-0.5">{selectedPlan.name}</Text>
                        <View className="flex-row items-center gap-1.5 mt-1.5">
                          <Feather name="tag" size={11} color="#4F46E5" />
                          <Text className="text-[#4F46E5] text-[10px] font-bold">GST Tax Note: {selectedPlan.gstText}</Text>
                        </View>
                      </View>
                      <TouchableOpacity onPress={closeDetails} className="w-8 h-8 rounded-full bg-zinc-100 items-center justify-center">
                        <Feather name="x" size={14} color="#101828" />
                      </TouchableOpacity>
                    </View>

                    <View className="gap-2">
                      <Text className="text-zinc-950 text-[10px] font-black uppercase tracking-widest">Plan overview</Text>
                      <Text className="text-zinc-500 text-xs font-medium leading-relaxed pl-0.5">
                        {selectedPlan.idealFor}
                      </Text>
                    </View>

                    <View className="gap-3">
                      <Text className="text-zinc-950 text-[10px] font-black uppercase tracking-widest">What&apos;s included</Text>
                      {[
                        'Book any workout category (Strength, Flow, Cardio, Reset, Combat)',
                        'Pause anytime options (up to validity limits)',
                        'Premium verified VIRLA trainers automatically assigned',
                        'Priority matching support algorithms',
                        'Dedicated VIP Concierge customer support'
                      ].map((item, idx) => (
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
                      className="bg-zinc-950 rounded-2xl items-center justify-center mt-3 shadow-md"
                      style={{ height: 56 }}
                    >
                      <Text className="text-white text-xs font-black uppercase tracking-wider">Continue →</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  // Slide To Purchase Checkout Slider (Feature 5)
                  <View className="gap-6 py-2">
                    <View className="flex-row justify-between items-center border-b border-zinc-100 pb-4">
                      <Text className="text-zinc-950 text-base font-black uppercase tracking-wider pl-1">Apple Checkout</Text>
                      <TouchableOpacity onPress={() => setCheckoutActive(false)} className="w-8 h-8 rounded-full bg-zinc-100 items-center justify-center">
                        <Feather name="arrow-left" size={14} color="#101828" />
                      </TouchableOpacity>
                    </View>

                    <View className="bg-zinc-50 border border-zinc-100 p-4.5 rounded-2xl gap-3">
                      <View className="flex-row justify-between items-center">
                        <Text className="text-zinc-500 text-xs font-semibold">Subtotal Price</Text>
                        <Text className="text-zinc-900 text-xs font-extrabold">{selectedPlan.amountVal}</Text>
                      </View>
                      <View className="flex-row justify-between items-center">
                        <Text className="text-zinc-500 text-xs font-semibold">GST charge (18%)</Text>
                        <Text className="text-zinc-900 text-xs font-extrabold">{selectedPlan.gstVal}</Text>
                      </View>
                      <View className="h-[1px] bg-zinc-100 my-1" />
                      <View className="flex-row justify-between items-center">
                        <Text className="text-zinc-950 text-sm font-black">Total Paid amount</Text>
                        <Text className="text-[#4F46E5] text-sm font-black">{selectedPlan.price}</Text>
                      </View>
                    </View>

                    {/* Purchase confirmation button */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      disabled={isProcessing}
                      onPress={() => {
                        setShowDemoPayment(true);
                      }}
                      className={`h-14 rounded-2xl items-center justify-center mt-2 shadow-md ${isProcessing ? 'bg-zinc-800' : 'bg-zinc-950'}`}
                      style={{ height: 56 }}
                    >
                      <Text className="text-white text-xs font-black uppercase tracking-wider">
                        {isProcessing ? 'Purchasing...' : 'Purchase Now'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            {/* Spinner loader processing ring screen (Feature 5) */}
            {isProcessing && (
              <View className="items-center justify-center py-16 gap-6 min-h-[400px]">
                <View className="relative w-16 h-16 items-center justify-center">
                  <Svg width={64} height={64} viewBox="0 0 64 64" className="absolute">
                    <Circle cx={32} cy={32} r={28} stroke="#E5E7EB" strokeWidth={4} fill="none" />
                    <Circle cx={32} cy={32} r={28} stroke="#4F46E5" strokeWidth={4} fill="none" strokeDasharray="176" strokeDashoffset="44" strokeLinecap="round" />
                  </Svg>
                  <Feather name="lock" size={20} color="#4F46E5" />
                </View>
                <View className="items-center gap-1">
                  <Text className="text-zinc-900 text-sm font-black uppercase tracking-wider">Securing Checkout Payout</Text>
                  <Text className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Connecting to payment hub</Text>
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
                  <Text className="text-[#10B981] text-[10px] font-black uppercase tracking-widest">Payment Successful</Text>
                  <Text className="text-zinc-950 text-xl font-black mt-1 text-center">
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
                    className="w-full bg-[#101828] py-4.5 rounded-2xl items-center justify-center"
                  >
                    <Text className="text-white text-xs font-black uppercase tracking-wider">View Wallet</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      closeDetails();
                    }}
                    className="w-full bg-zinc-100 border border-zinc-200 py-4.5 rounded-2xl items-center justify-center"
                  >
                    <Text className="text-zinc-700 text-xs font-black uppercase tracking-wider">Done</Text>
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
