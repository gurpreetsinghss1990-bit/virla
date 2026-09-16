import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-black/60 justify-end"
      >
        {/* Backdrop tap to dismiss */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          className="flex-1"
        />

        {/* Modal Bottom Sheet Content */}
        <View
          style={{ paddingBottom: safeBottomPadding }}
          className="bg-white rounded-t-[36px] px-6 pt-3 gap-5 shadow-2xl border-t border-rose-100"
        >
          {/* Subtle Pull Indicator Bar */}
          <View className="w-12 h-1.5 rounded-full bg-zinc-200 self-center mb-1" />

          {/* Modal Header */}
          <View className="flex-row justify-between items-center pb-3 border-b border-zinc-100">
            <View>
              <Text className="text-[#E11D48] text-[10px] font-black uppercase tracking-widest">
                Communication Hub
              </Text>
              <Text className="text-zinc-950 text-xl font-black mt-0.5">
                Notifications & Messages
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              className="w-8 h-8 rounded-full bg-zinc-100 items-center justify-center border border-zinc-200"
            >
              <Feather name="x" size={15} color="#101828" />
            </TouchableOpacity>
          </View>

          {/* Options Destination List */}
          <View className="gap-3">
            {/* Notifications Center Option */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={onSelectNotifications}
              className="flex-row items-center p-4 bg-zinc-50 border border-zinc-200 rounded-2xl active:bg-rose-50/50"
            >
              <View className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 items-center justify-center">
                <Feather name="bell" size={22} color="#E11D48" />
              </View>

              <View className="flex-1 ml-3.5 mr-2">
                <View className="flex-row items-center gap-2">
                  <Text className="text-zinc-950 text-sm font-black">
                    Notifications Center
                  </Text>
                  {unreadCount > 0 ? (
                    <View className="bg-[#E11D48] px-2 py-0.5 rounded-full">
                      <Text className="text-white text-[9px] font-black tracking-wider uppercase">
                        {unreadCount} New
                      </Text>
                    </View>
                  ) : (
                    <View className="bg-zinc-200 px-2 py-0.5 rounded-full">
                      <Text className="text-zinc-600 text-[8px] font-extrabold tracking-wider uppercase">
                        All Caught Up
                      </Text>
                    </View>
                  )}
                </View>
                <Text className="text-zinc-500 text-xs font-medium mt-0.5" numberOfLines={1}>
                  Session updates, schedule alerts & announcements
                </Text>
              </View>

              <Feather name="chevron-right" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Messages (Chats) Option */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={onSelectMessages}
              className="flex-row items-center p-4 bg-zinc-50 border border-zinc-200 rounded-2xl active:bg-sky-50/50"
            >
              <View className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 items-center justify-center">
                <Feather name="message-square" size={20} color="#0284C7" />
              </View>

              <View className="flex-1 ml-3.5 mr-2">
                <View className="flex-row items-center gap-2">
                  <Text className="text-zinc-950 text-sm font-black">
                    Messages (Chats)
                  </Text>
                  <View className="bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">
                    <Text className="text-sky-700 text-[8px] font-extrabold tracking-wider uppercase">
                      Direct Chat
                    </Text>
                  </View>
                </View>
                <Text className="text-zinc-500 text-xs font-medium mt-0.5" numberOfLines={1}>
                  Direct line with your coaches & VIRLA concierge
                </Text>
              </View>

              <Feather name="chevron-right" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Dismiss Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onClose}
            className="w-full py-3.5 bg-zinc-100 rounded-2xl items-center justify-center mt-1 border border-zinc-200"
          >
            <Text className="text-zinc-700 text-xs font-black uppercase tracking-wider">
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
