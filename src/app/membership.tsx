import React, { useState, useEffect, useRef } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, Alert, Animated, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useWalletStore } from '../store/walletStore';
import { Feather, Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';

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
}

export default function MembershipScreen() {
  const router = useRouter();
  const { purchasePlan } = useWalletStore();

  const plans: Plan[] = [
    {
      id: 'plan-1',
      name: 'Single Session',
      credits: 1,
      price: '₹999',
      savings: '0% Save',
      gstText: '₹846 + 18% GST',
      gstVal: '₹153',
      amountVal: '₹846',
      idealFor: 'Casual visits or trying out a new program specialty.'
    },
    {
      id: 'plan-2',
      name: 'Starter Pack',
      credits: 8,
      price: '₹6,999',
      originalPrice: '₹7,992',
      savings: '12% Savings',
      gstText: '₹5,931 + 18% GST',
      gstVal: '₹1,068',
      amountVal: '₹5,931',
      idealFor: 'Weekly home conditioning workouts.'
    },
    {
      id: 'plan-3',
      name: 'Premium Pack',
      credits: 12,
      price: '₹9,999',
      originalPrice: '₹11,988',
      savings: '20% Savings',
      gstText: '₹8,474 + 18% GST',
      gstVal: '₹1,525',
      amountVal: '₹8,474',
      popular: true,
      idealFor: 'Our most popular pack for serious fitness goals.'
    },
    {
      id: 'plan-4',
      name: 'Elite Pack',
      credits: 15,
      price: '₹11,999',
      originalPrice: '₹14,985',
      savings: '25% Savings',
      gstText: '₹10,168 + 18% GST',
      gstVal: '₹1,831',
      amountVal: '₹10,168',
      idealFor: 'Complete wellness transformation directly from home.'
    }
  ];

  // Selection states
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [checkoutActive, setCheckoutActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Animations
  const slideUpAnim = useRef(new Animated.Value(600)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Swipe slider state
  const swipeX = useRef(new Animated.Value(0)).current;

  const openPlanDetails = (plan: Plan) => {
    setSelectedPlan(plan);
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
      setSelectedPlan(null);
    });
  };

  const startCheckout = () => {
    setCheckoutActive(true);
    swipeX.setValue(0);
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

  const onSwipeRelease = (e: any) => {
    const offset = e.nativeEvent.translationX;
    if (offset > 180) {
      Animated.timing(swipeX, { toValue: 220, duration: 150, useNativeDriver: true }).start(() => {
        handleConfirmPay();
      });
    } else {
      Animated.spring(swipeX, { toValue: 0, useNativeDriver: true }).start();
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FB]">
      {/* Header */}
      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-[#111827] text-sm font-black uppercase tracking-wider mr-8">
          VIRLA Credits
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="gap-6">
          
          <View>
            <Text className="text-zinc-900 text-2xl font-black tracking-tight leading-tight">Select Credits Pack</Text>
            <Text className="text-zinc-500 text-xs font-semibold mt-1 leading-relaxed">
              Book sessions instantly across any training experience.
            </Text>
          </View>

          {/* Plan cards */}
          <View className="gap-4">
            {plans.map((plan) => (
              <TouchableOpacity
                key={plan.id}
                activeOpacity={0.9}
                onPress={() => openPlanDetails(plan)}
                className={`bg-white border p-5 rounded-[28px] shadow-sm flex-row justify-between items-center relative ${
                  plan.popular ? 'border-[#4F46E5]' : 'border-[#E5E7EB]'
                }`}
              >
                {plan.popular && (
                  <View className="absolute top-0 right-6 -translate-y-1/2 bg-[#4F46E5] px-3 py-1 rounded-full">
                    <Text className="text-white text-[8px] font-black uppercase tracking-widest">Most Popular</Text>
                  </View>
                )}

                <View className="flex-1 pr-4 gap-1">
                  <Text className="text-zinc-400 text-[8px] font-black uppercase tracking-wider">{plan.savings}</Text>
                  <Text className="text-zinc-950 text-base font-black mt-0.5">{plan.name}</Text>
                  <Text className="text-zinc-500 text-[10px] font-semibold">{plan.credits} Booking Credits Included</Text>
                </View>

                <View className="items-end gap-2">
                  <View className="items-end">
                    {plan.originalPrice && (
                      <Text className="text-zinc-400 text-[10px] line-through font-bold">{plan.originalPrice}</Text>
                    )}
                    <Text className="text-zinc-950 text-xl font-black tracking-tight">{plan.price}</Text>
                  </View>
                  <View className="bg-zinc-900 px-4 py-2 rounded-xl">
                    <Text className="text-white text-[8px] font-black uppercase">Buy Pack</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Premium Comparison Benefits table (Feature 8) */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4.5 mt-2">
            <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider border-b border-zinc-50 pb-3">Compare Benefits</Text>
            
            <View className="gap-3">
              {/* Row Header */}
              <View className="flex-row justify-between pb-1.5 border-b border-zinc-50">
                <Text className="w-[30%] text-zinc-400 text-[8px] font-black uppercase">Benefits</Text>
                <Text className="w-[17%] text-zinc-900 text-[8px] font-black uppercase text-center">Single</Text>
                <Text className="w-[17%] text-zinc-900 text-[8px] font-black uppercase text-center">Starter</Text>
                <Text className="w-[17%] text-[#4F46E5] text-[8px] font-black uppercase text-center">Premium</Text>
                <Text className="w-[17%] text-zinc-900 text-[8px] font-black uppercase text-center">Elite</Text>
              </View>

              {/* Rows */}
              <View className="flex-row justify-between items-center py-1">
                <Text className="w-[30%] text-zinc-500 text-[9px] font-semibold">Trainee Price</Text>
                <Text className="w-[17%] text-zinc-800 text-[9px] font-bold text-center">₹999</Text>
                <Text className="w-[17%] text-zinc-800 text-[9px] font-bold text-center">₹875</Text>
                <Text className="w-[17%] text-zinc-800 text-[9px] font-black text-center bg-indigo-50/50 py-0.5 rounded">₹833</Text>
                <Text className="w-[17%] text-zinc-800 text-[9px] font-bold text-center">₹799</Text>
              </View>

              <View className="flex-row justify-between items-center py-1">
                <Text className="w-[30%] text-zinc-500 text-[9px] font-semibold">Trainer Tier</Text>
                <Text className="w-[17%] text-zinc-800 text-[9px] font-bold text-center">Assoc.</Text>
                <Text className="w-[17%] text-zinc-800 text-[9px] font-bold text-center">Certified</Text>
                <Text className="w-[17%] text-zinc-800 text-[9px] font-black text-center bg-indigo-50/50 py-0.5 rounded">Certified</Text>
                <Text className="w-[17%] text-zinc-800 text-[9px] font-bold text-center">Elite</Text>
              </View>

              <View className="flex-row justify-between items-center py-1">
                <Text className="w-[30%] text-zinc-500 text-[9px] font-semibold">Pause Days</Text>
                <Text className="w-[17%] text-zinc-800 text-[9px] font-bold text-center">None</Text>
                <Text className="w-[17%] text-zinc-800 text-[9px] font-bold text-center">5 Days</Text>
                <Text className="w-[17%] text-zinc-800 text-[9px] font-black text-center bg-indigo-50/50 py-0.5 rounded">15 Days</Text>
                <Text className="w-[17%] text-zinc-800 text-[9px] font-bold text-center">30 Days</Text>
              </View>

              <View className="flex-row justify-between items-center py-1">
                <Text className="w-[30%] text-zinc-500 text-[9px] font-semibold">Priority Match</Text>
                <Text className="w-[17%] text-zinc-800 text-[9px] font-bold text-center">Std</Text>
                <Text className="w-[17%] text-zinc-800 text-[9px] font-bold text-center">Std</Text>
                <Text className="w-[17%] text-zinc-800 text-[9px] font-black text-center bg-indigo-50/50 py-0.5 rounded">High</Text>
                <Text className="w-[17%] text-zinc-800 text-[9px] font-bold text-center">Top</Text>
              </View>
            </View>
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
                {!checkoutActive ? (
                  // Plan details list (Feature 2)
                  <View className="gap-5">
                    <View className="flex-row justify-between items-start border-b border-zinc-100 pb-4">
                      <View className="gap-1 flex-1 pr-3">
                        <Text className="text-zinc-400 text-[8px] font-black uppercase">Plan Selected</Text>
                        <Text className="text-zinc-950 text-xl font-black mt-0.5">{selectedPlan.name}</Text>
                        <Text className="text-[#4F46E5] text-[10px] font-bold mt-1">🏷️ GST Tax Note: {selectedPlan.gstText}</Text>
                      </View>
                      <TouchableOpacity onPress={closeDetails} className="w-8 h-8 rounded-full bg-zinc-100 items-center justify-center">
                        <Feather name="x" size={14} color="#111827" />
                      </TouchableOpacity>
                    </View>

                    <View className="gap-2">
                      <Text className="text-[#111827] text-xs font-black uppercase">Plan overview</Text>
                      <Text className="text-zinc-500 text-xs font-semibold leading-relaxed pl-0.5">
                        {selectedPlan.idealFor}
                      </Text>
                    </View>

                    <View className="gap-3">
                      <Text className="text-[#111827] text-xs font-black uppercase">What's included</Text>
                      {[
                        'Book Any workout (Strength, Flow, Cardio, Reset, Combat)',
                        'Pause anytime options (up to validity limits)',
                        'Premium verified trainers (ACE/ISSA Certified)',
                        'Priority matching support algorithms',
                        'Dedicated VIP Concierge customer support'
                      ].map((item, idx) => (
                        <View key={idx} className="flex-row gap-2.5 items-center pl-1">
                          <Feather name="check" size={12} color="#10B981" />
                          <Text className="text-zinc-600 text-xs font-semibold leading-relaxed flex-1">{item}</Text>
                        </View>
                      ))}
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={startCheckout}
                      className="bg-zinc-950 py-4.5 rounded-2xl items-center justify-center mt-3 shadow-md"
                    >
                      <Text className="text-white text-xs font-black uppercase tracking-wider">Purchase Credits Package</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  // Slide To Purchase Checkout Slider (Feature 5)
                  <View className="gap-6 py-2">
                    <View className="flex-row justify-between items-center border-b border-zinc-100 pb-4">
                      <Text className="text-zinc-950 text-base font-black uppercase tracking-wider pl-1">Apple Checkout</Text>
                      <TouchableOpacity onPress={() => setCheckoutActive(false)} className="w-8 h-8 rounded-full bg-zinc-100 items-center justify-center">
                        <Feather name="arrow-left" size={14} color="#111827" />
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

                    {/* Slide confirmation track slider (re-usable gestural Apple Pay check) */}
                    <View className="h-14 bg-zinc-950 rounded-2xl justify-center px-2.5 relative overflow-hidden mt-2">
                      <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-widest text-center">
                        Slide To Purchase
                      </Text>
                      
                      <Animated.View
                        style={{
                          transform: [{ translateX: swipeX }],
                        }}
                        onTouchMove={(e) => {
                          const touchX = Math.max(0, Math.min(220, e.nativeEvent.locationX - 25));
                          swipeX.setValue(touchX);
                        }}
                        onTouchEnd={onSwipeRelease}
                        className="absolute left-2.5 w-10 h-10 rounded-xl bg-white justify-center items-center shadow-md"
                      >
                        <Feather name="arrow-right" size={16} color="#111827" />
                      </Animated.View>
                    </View>
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
                  <Text className="text-[#10B981] text-[10px] font-black uppercase tracking-widest">Congratulations!</Text>
                  <Text className="text-zinc-900 text-xl font-black mt-1 text-center">
                    {selectedPlan.credits} Credits Added
                  </Text>
                  <Text className="text-zinc-400 text-[10px] text-center leading-relaxed max-w-[80%] mt-1">
                    Your wallet balance has updated. Ready to schedule your premium home visits!
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    closeDetails();
                    router.push('/booking');
                  }}
                  className="w-full bg-[#111827] py-4.5 rounded-2xl items-center justify-center mt-4"
                >
                  <Text className="text-white text-xs font-black uppercase">Book Your First Workout</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}
