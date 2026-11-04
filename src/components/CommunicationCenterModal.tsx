import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CommunicationCenterModalProps {
  visible: boolean;
  onClose: () => void;
  unreadCount?: number;
  onSelectNotifications: () => void;
  onSelectMessages: () => void;
}

export const CommunicationCenterModal: React.FC<CommunicationCenterModalProps> = ({
  visible,
  onClose,
  unreadCount = 0,
  onSelectNotifications,
  onSelectMessages,
}) => {
  const insets = useSafeAreaInsets();
  // Ensure ample clearance above Android 3-button navigation bar (~48-56dp) or iOS indicator bar (~34dp)
  const safeBottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 68 : 28) + 24;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(260)).current;

  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      slideAnim.setValue(260);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 260,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Animated Fade Backdrop */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              opacity: fadeAnim,
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleDismiss}
            style={{ flex: 1 }}
          />
        </Animated.View>

        {/* Modal Bottom Sheet Content with Smooth Slide-Up */}
        <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
          <Animated.View
            style={{
              transform: [{ translateY: slideAnim }],
            }}
          >
            <View
              style={{ paddingBottom: safeBottomPadding }}
              className="bg-white rounded-t-[28px] px-5 pt-3 gap-3 shadow-xl"
            >
            {/* Minimal Pull Indicator Bar */}
            <View className="w-8 h-1 rounded-full bg-zinc-200 self-center mb-1" />

            {/* Modal Header */}
            <View className="flex-row items-center justify-between pb-1 px-1">
              <Text className="text-zinc-900 text-base font-bold tracking-tight">
                Activity
              </Text>
              <TouchableOpacity
                onPress={handleDismiss}
                activeOpacity={0.6}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                className="w-9 h-9 items-center justify-center"
              >
                <Feather name="x" size={20} color="#18181B" />
              </TouchableOpacity>
            </View>

            {/* Options Destination List - Clean, borderless & seamless */}
            <View className="gap-1">
              {/* Notifications Center Option */}
              <TouchableOpacity
                activeOpacity={0.6}
                onPress={onSelectNotifications}
                className="flex-row items-center py-3 px-2 rounded-xl active:bg-zinc-50"
              >
                <View className="w-8 h-8 items-center justify-center">
                  <Feather name="bell" size={18} color="#18181B" />
                </View>

                <View className="flex-1 ml-2.5">
                  <Text className="text-zinc-900 text-[14px] font-semibold">
                    Notifications
                  </Text>
                </View>

                {unreadCount > 0 && (
                  <View className="bg-[#E11D48] px-2 py-0.5 rounded-full mr-2">
                    <Text numberOfLines={1} className="text-white text-[10px] font-bold">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}

                <Feather name="chevron-right" size={16} color="#94A3B8" />
              </TouchableOpacity>

              {/* Messages (Chats) Option */}
              <TouchableOpacity
                activeOpacity={0.6}
                onPress={onSelectMessages}
                className="flex-row items-center py-3 px-2 rounded-xl active:bg-zinc-50"
              >
                <View className="w-8 h-8 items-center justify-center">
                  <Feather name="message-square" size={18} color="#18181B" />
                </View>

                <View className="flex-1 ml-2.5">
                  <Text className="text-zinc-900 text-[14px] font-semibold">
                    Messages
                  </Text>
                </View>

                <Feather name="chevron-right" size={16} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  </Modal>
  );
};
