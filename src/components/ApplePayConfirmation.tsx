import React, { useRef, useState } from 'react';
import { View, Text, Animated, PanResponder, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface ApplePayConfirmationProps {
  onConfirm: () => void;
  priceText?: string;
  creditsText?: string;
}

export function ApplePayConfirmation({ onConfirm, priceText = '₹1,200', creditsText = '1 Credit' }: ApplePayConfirmationProps) {
  const [confirmed, setConfirmed] = useState(false);
  const containerWidth = useRef(0);
  
  // Slider animations
  const panX = useRef(new Animated.Value(0)).current;
  const sliderWidth = 56; // size of the circle slider
  const padding = 4;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !confirmed,
      onMoveShouldSetPanResponder: () => !confirmed,
      onPanResponderMove: (_, gestureState) => {
        // limit dragging between 0 and max draggable width
        const maxDraggable = containerWidth.current - sliderWidth - padding * 2;
        let newX = gestureState.dx;
        if (newX < 0) newX = 0;
        if (newX > maxDraggable) newX = maxDraggable;
        panX.setValue(newX);
      },
      onPanResponderRelease: (_, gestureState) => {
        const maxDraggable = containerWidth.current - sliderWidth - padding * 2;
        // if user dragged past 80%, confirm booking
        if (gestureState.dx >= maxDraggable * 0.8) {
          Animated.timing(panX, {
            toValue: maxDraggable,
            duration: 150,
            useNativeDriver: true,
          }).start(() => {
            setConfirmed(true);
            onConfirm();
          });
        } else {
          // snap back to start
          Animated.spring(panX, {
            toValue: 0,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Interpolate opacity of helper text based on slide progress
  const maxDraggable = containerWidth.current ? containerWidth.current - sliderWidth - padding * 2 : 200;
  const textOpacity = panX.interpolate({
    inputRange: [0, Math.max(maxDraggable, 1)],
    outputRange: [1, 0.1],
  });

  return (
    <View 
      onLayout={(e) => {
        containerWidth.current = e.nativeEvent.layout.width;
      }}
      className="bg-zinc-950 p-4.5 rounded-[32px] border border-zinc-800 shadow-xl overflow-hidden"
    >
      {/* Top billing preview */}
      <View className="flex-row justify-between items-center mb-4.5 px-1.5">
        <View className="flex-row items-center gap-2">
          <View className="w-6 h-6 rounded-full bg-amber-500/10 items-center justify-center">
            <Feather name="credit-card" size={12} color="#F59E0B" />
          </View>
          <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">Payment Method</Text>
        </View>
        <View className="items-end">
          <Text className="text-white text-sm font-black tracking-tight">{creditsText}</Text>
          <Text className="text-zinc-500 text-[9px] font-bold">Equivalent to {priceText}</Text>
        </View>
      </View>

      {/* Swipe Container */}
      <View className="h-16 bg-zinc-900 border border-zinc-800 rounded-2xl relative justify-center p-1">
        {/* Animated Slide to Confirm label */}
        <Animated.View style={{ opacity: textOpacity }} className="absolute w-full items-center justify-center z-0 flex-row gap-1">
          <Text className="text-zinc-400 text-xs font-black tracking-widest uppercase">
            Slide to Confirm
          </Text>
          <Feather name="chevrons-right" size={14} color="#A1A1AA" />
        </Animated.View>

        {/* Draggable Circle Handle */}
        <Animated.View
          {...panResponder.panHandlers}
          style={{
            transform: [{ translateX: panX }],
            width: sliderWidth,
            height: sliderWidth,
          }}
          className={`rounded-xl items-center justify-center z-10 shadow-lg ${
            confirmed ? 'bg-emerald-500' : 'bg-amber-400'
          }`}
        >
          {confirmed ? (
            <Feather name="check" size={22} color="white" />
          ) : (
            <Feather name="arrow-right" size={22} color="#09090B" />
          )}
        </Animated.View>
      </View>

      <Text className="text-center text-[9px] text-zinc-500 font-bold uppercase tracking-wider mt-3">
        🔒 Encrypted • Touch ID / Face ID Authenticated
      </Text>
    </View>
  );
}
