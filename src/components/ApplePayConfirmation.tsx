import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface ApplePayConfirmationProps {
  onConfirm: () => void;
  priceText?: string;
  creditsText?: string;
}

export function ApplePayConfirmation({ onConfirm, priceText = '₹1,200', creditsText = '1 Credit' }: ApplePayConfirmationProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scaleAnim] = useState(() => new Animated.Value(1));

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 100,
      friction: 6,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1.0,
      useNativeDriver: true,
      tension: 100,
      friction: 6,
    }).start();
  };

  const handleConfirm = () => {
    if (confirmed || loading) return;
    setLoading(true);
    // Add a tiny delay to simulate payment auth
    setTimeout(() => {
      setLoading(false);
      setConfirmed(true);
      onConfirm();
    }, 800);
  };

  return (
    <View 
      className="bg-zinc-950 p-5 rounded-[28px] border border-zinc-800 shadow-xl overflow-hidden"
    >
      {/* Top billing preview */}
      <View className="flex-row justify-between items-center mb-5 px-1">
        <View className="flex-row items-center gap-2">
          <View className="w-6 h-6 rounded-full bg-amber-500/10 items-center justify-center">
            <Feather name="credit-card" size={12} color="#F5B942" />
          </View>
          <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">Payment Method</Text>
        </View>
        <View className="items-end">
          <Text className="text-white text-sm font-black tracking-tight">{creditsText}</Text>
          <Text className="text-zinc-500 text-[9px] font-bold">Equivalent to {priceText}</Text>
        </View>
      </View>

      {/* Tap to Confirm Button */}
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }} className="w-full">
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleConfirm}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={confirmed || loading}
          className={`w-full h-14 rounded-2xl justify-center items-center flex-row ${
            confirmed ? 'bg-emerald-500' : 'bg-[#F5B942]'
          }`}
          style={{
            shadowColor: confirmed ? '#10B981' : '#F5B942',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#09090B" size="small" />
          ) : confirmed ? (
            <View className="flex-row items-center justify-center gap-2">
              <Feather name="check" size={18} color="white" />
              <Text className="text-white text-xs font-black uppercase tracking-widest">
                Confirmed
              </Text>
            </View>
          ) : (
            <View className="flex-row items-center justify-center gap-2">
              <Text className="text-[#09090B] text-xs font-black uppercase tracking-widest">
                Confirm Booking
              </Text>
              <Feather name="arrow-right" size={14} color="#09090B" />
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

      <Text className="text-center text-[9px] text-zinc-500 font-bold uppercase tracking-wider mt-3.5">
        🔒 Encrypted • Touch ID / Face ID Authenticated
      </Text>
    </View>
  );
}
export default ApplePayConfirmation;
