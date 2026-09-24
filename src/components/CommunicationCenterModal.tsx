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
  const safeBottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 56 : 24) + 20;

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
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
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
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

        {/* Modal Bottom Sheet Content */}
        <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
          <View
            style={{ paddingBottom: safeBottomPadding }}
            className="bg-white rounded-t-[32px] px-6 pt-3.5 gap-4 shadow-2xl"
          >
            {/* Subtle Pull Indicator Bar */}
            <View className="w-10 h-1.5 rounded-full bg-zinc-200 self-center mb-1" />

            {/* Modal Header */}
            <View className="flex-row items-center pb-3 border-b border-zinc-100">
              <View className="w-8" />
              <Text className="flex-1 text-zinc-900 text-lg font-bold tracking-tight text-center">
                Notifications & Messages
              </Text>
              <TouchableOpacity
                onPress={handleDismiss}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                className="w-8 h-8 rounded-full bg-zinc-100 items-center justify-center"
              >
                <Feather name="x" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

          {/* Options Destination List */}
          <View className="gap-1">
            {/* Notifications Center Option */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onSelectNotifications}
              className="flex-row items-center py-3.5 px-3 rounded-2xl active:bg-zinc-100/70"
            >
              <View className="w-10 h-10 items-center justify-center">
                <Feather name="bell" size={22} color="#E11D48" />
              </View>

              <View className="flex-1 ml-3 mr-2">
                <View className="flex-row items-center gap-2 flex-wrap">
                  <Text className="text-zinc-900 text-sm font-semibold">
                    Notifications Center
                  </Text>
                  {unreadCount > 0 ? (
                    <View className="bg-[#E11D48] px-2 py-0.5 rounded-full">
                      <Text numberOfLines={1} className="text-white text-[9px] font-bold uppercase tracking-wide">
                        {unreadCount > 99 ? '99+' : unreadCount} New
                      </Text>
                    </View>
                  ) : (
                    <View className="bg-zinc-200 px-2 py-0.5 rounded-full">
                      <Text className="text-zinc-600 text-[9px] font-bold uppercase tracking-wide">
                        All Caught Up
                      </Text>
                    </View>
                  )}
                </View>
                <Text className="text-zinc-500 text-xs font-normal mt-1 leading-4">
                  Session updates, schedule alerts & announcements
                </Text>
              </View>

              <Feather name="chevron-right" size={20} color="#CBD5E1" />
            </TouchableOpacity>

            <View className="h-[1px] bg-zinc-100 mx-2 my-0.5" />

            {/* Messages (Chats) Option */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onSelectMessages}
              className="flex-row items-center py-3.5 px-3 rounded-2xl active:bg-zinc-100/70"
            >
              <View className="w-10 h-10 items-center justify-center">
                <Feather name="message-square" size={21} color="#0284C7" />
              </View>

              <View className="flex-1 ml-3 mr-2">
                <View className="flex-row items-center gap-2 flex-wrap">
                  <Text className="text-zinc-900 text-sm font-semibold">
                    Messages (Chats)
                  </Text>
                  <View className="bg-sky-100 px-2 py-0.5 rounded-full">
                    <Text className="text-sky-800 text-[9px] font-bold uppercase tracking-wide">
                      Direct Chat
                    </Text>
                  </View>
                </View>
                <Text className="text-zinc-500 text-xs font-normal mt-1 leading-4">
                  Direct line with your coaches & VIRLA concierge
                </Text>
              </View>

              <Feather name="chevron-right" size={20} color="#CBD5E1" />
            </TouchableOpacity>
          </View>

          {/* Dismiss Button */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleDismiss}
            className="w-full py-4 px-4 bg-zinc-100 rounded-2xl items-center justify-center mt-3 mb-1 active:bg-zinc-200"
          >
            <Text className="text-zinc-800 text-sm font-semibold text-center">
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>
  );
};
