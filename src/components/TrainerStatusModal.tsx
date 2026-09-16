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

interface TrainerStatusModalProps {
  visible: boolean;
  targetStatus: 'online' | 'offline';
  onClose: () => void;
  onConfirm: () => void;
}

export const TrainerStatusModal: React.FC<TrainerStatusModalProps> = ({
  visible,
  targetStatus,
  onClose,
  onConfirm,
}) => {
  const insets = useSafeAreaInsets();
  // Safe clearance above Android 3-button navigation bar (~48-56dp) or iOS gesture bar (~34dp)
  const safeBottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 56 : 24) + 20;
  const isGoingOffline = targetStatus === 'offline';

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
                Trainer Availability
              </Text>
              <Text className="text-zinc-950 text-xl font-black mt-0.5">
                {isGoingOffline ? 'Go Offline?' : 'Go Online?'}
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

          {/* Information & Impact Card */}
          <View
            className={`p-4 rounded-2xl border ${
              isGoingOffline
                ? 'bg-rose-50/60 border-rose-200'
                : 'bg-emerald-50/60 border-emerald-200'
            } flex-row items-start gap-3.5`}
          >
            <View
              className={`w-11 h-11 rounded-2xl items-center justify-center border ${
                isGoingOffline
                  ? 'bg-rose-100/80 border-rose-300'
                  : 'bg-emerald-100/80 border-emerald-300'
              }`}
            >
              <Feather
                name={isGoingOffline ? 'power' : 'zap'}
                size={22}
                color={isGoingOffline ? '#E11D48' : '#059669'}
              />
            </View>

            <View className="flex-1">
              <View className="flex-row items-center gap-2 mb-1">
                <Text className="text-zinc-950 text-sm font-black">
                  {isGoingOffline
                    ? 'New Requests Paused'
                    : 'Ready for Clients'}
                </Text>
                <View
                  className={`px-2 py-0.5 rounded-full ${
                    isGoingOffline ? 'bg-rose-200' : 'bg-emerald-200'
                  }`}
                >
                  <Text
                    className={`text-[9px] font-black uppercase tracking-wider ${
                      isGoingOffline ? 'text-rose-900' : 'text-emerald-900'
                    }`}
                  >
                    {isGoingOffline ? 'OFFLINE' : 'ACTIVE'}
                  </Text>
                </View>
              </View>

              <Text className="text-zinc-600 text-xs font-medium leading-relaxed">
                {isGoingOffline
                  ? 'Going offline may prevent you from receiving new session requests.\n\nYour already confirmed bookings will remain subject to VIRLA\'s existing booking rules.'
                  : 'You will become visible for new incoming client workout requests within your selected coverage radius.'}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="gap-2.5 mt-1">
            {/* Primary Action */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onConfirm}
              className={`w-full py-4 rounded-2xl items-center justify-center shadow-sm ${
                isGoingOffline ? 'bg-[#E11D48]' : 'bg-emerald-600'
              }`}
            >
              <Text className="text-white text-xs font-black uppercase tracking-wider">
                {isGoingOffline ? 'Confirm & Go Offline' : 'Confirm & Go Online'}
              </Text>
            </TouchableOpacity>

            {/* Cancel / Dismiss Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onClose}
              className="w-full py-3.5 bg-zinc-100 rounded-2xl items-center justify-center border border-zinc-200"
            >
              <Text className="text-zinc-700 text-xs font-black uppercase tracking-wider">
                {isGoingOffline ? 'Keep Online' : 'Stay Offline'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
