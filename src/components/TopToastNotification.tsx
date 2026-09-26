import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useToastStore, ToastData } from '../store/toastStore';

export function TopToastNotification() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentToast, hideToast } = useToastStore();

  const [activeToast, setActiveToast] = useState<ToastData | null>(null);
  const translateY = useRef(new Animated.Value(-160)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getTheme = (type?: string) => {
    switch (type) {
      case 'success':
        return {
          icon: 'check-circle' as const,
          iconColor: '#10B981',
          iconBg: 'rgba(16, 185, 129, 0.15)',
          tagText: 'SUCCESS',
          tagColor: '#34D399',
        };
      case 'warning':
        return {
          icon: 'alert-triangle' as const,
          iconColor: '#F59E0B',
          iconBg: 'rgba(245, 158, 11, 0.15)',
          tagText: 'ALERT',
          tagColor: '#FBBF24',
        };
      case 'error':
        return {
          icon: 'alert-circle' as const,
          iconColor: '#EF4444',
          iconBg: 'rgba(239, 68, 68, 0.15)',
          tagText: 'FAILED',
          tagColor: '#F87171',
        };
      case 'booking':
        return {
          icon: 'calendar' as const,
          iconColor: '#E11D48',
          iconBg: 'rgba(225, 29, 72, 0.15)',
          tagText: 'VIRLA BOOKING',
          tagColor: '#FB7185',
        };
      default:
        return {
          icon: 'bell' as const,
          iconColor: '#E11D48',
          iconBg: 'rgba(225, 29, 72, 0.15)',
          tagText: 'VIRLA ALERT',
          tagColor: '#FB7185',
        };
    }
  };

  const handleDismiss = () => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    Animated.timing(translateY, {
      toValue: -180,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      hideToast();
      setActiveToast(null);
    });
  };

  const handlePress = () => {
    if (activeToast?.deepLink) {
      const link = activeToast.deepLink;
      handleDismiss();
      try {
        router.push(link as any);
      } catch (err) {
        console.warn('[TOAST] Failed to navigate to deepLink:', link, err);
      }
    } else {
      handleDismiss();
    }
  };

  // Pan responder for swipe up to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 5,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy < 0) {
          translateY.setValue(Math.max(-180, insets.top + 8 + gesture.dy));
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < -20 || gesture.vy < -0.4) {
          handleDismiss();
        } else {
          // Snap back down
          Animated.spring(translateY, {
            toValue: insets.top + 8,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (currentToast) {
      setActiveToast(currentToast);
      progressAnim.setValue(1);

      // Slide down entrance
      translateY.setValue(-160);
      Animated.spring(translateY, {
        toValue: insets.top + 8,
        useNativeDriver: true,
        bounciness: 7,
        speed: 14,
      }).start();

      // Progress bar animation
      const duration = currentToast.duration || 4000;
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: duration,
        useNativeDriver: false,
      }).start();

      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }

      dismissTimerRef.current = setTimeout(() => {
        handleDismiss();
      }, duration);
    }

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, [currentToast?.id]);

  if (!activeToast) {
    return null;
  }

  const theme = getTheme(activeToast.type);
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 16,
        right: 16,
        zIndex: 99999,
        transform: [{ translateY }],
      }}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={handlePress}
        className="overflow-hidden rounded-[24px] bg-[#111319] border border-white/10"
        style={{
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.45,
          shadowRadius: 20,
          elevation: 12,
        }}
      >
        <View className="p-4 flex-row items-center gap-3.5">
          {/* Accent icon badge */}
          <View
            className="w-11 h-11 rounded-2xl items-center justify-center"
            style={{ backgroundColor: theme.iconBg }}
          >
            <Feather name={theme.icon} size={20} color={theme.iconColor} />
          </View>

          {/* Text Content */}
          <View className="flex-1 justify-center pr-1">
            <View className="flex-row items-center justify-between">
              <Text
                style={{ color: theme.tagColor }}
                className="text-[10px] font-black uppercase tracking-wider"
              >
                {theme.tagText}
              </Text>
              {activeToast.deepLink && (
                <View className="flex-row items-center gap-0.5">
                  <Text className="text-zinc-500 text-[10px] font-semibold">View</Text>
                  <Feather name="chevron-right" size={11} color="#71717A" />
                </View>
              )}
            </View>

            <Text
              className="text-white text-sm font-bold mt-0.5"
              numberOfLines={1}
            >
              {activeToast.title}
            </Text>

            {activeToast.message ? (
              <Text
                className="text-zinc-400 text-xs font-medium leading-relaxed mt-0.5"
                numberOfLines={2}
              >
                {activeToast.message}
              </Text>
            ) : null}
          </View>

          {/* Close button */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            className="w-7 h-7 rounded-full bg-white/5 items-center justify-center border border-white/10"
          >
            <Ionicons name="close" size={14} color="#A1A1AA" />
          </TouchableOpacity>
        </View>

        {/* Animated Progress Bar at Bottom */}
        <View className="h-[2.5px] w-full bg-white/5">
          <Animated.View
            style={{
              height: '100%',
              width: progressWidth,
              backgroundColor: theme.iconColor,
            }}
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
