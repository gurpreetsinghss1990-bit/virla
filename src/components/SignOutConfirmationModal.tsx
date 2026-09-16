import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

export interface SignOutConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
}

export const SignOutConfirmationModal: React.FC<SignOutConfirmationModalProps> = ({
  visible,
  onClose,
  onConfirm,
  title = 'Sign Out',
  description = 'Are you sure you want to sign out of your account?',
  confirmText = 'Sign Out',
  cancelText = 'Cancel',
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        className="flex-1 bg-black/60 items-center justify-center px-6"
      >
        <TouchableWithoutFeedback>
          <View className="w-full max-w-sm bg-white rounded-[28px] p-6 shadow-2xl border border-zinc-100">
            {/* Top Icon Badge */}
            <View className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 items-center justify-center self-center mb-4">
              <Feather name="log-out" size={24} color="#DC2626" style={{ marginLeft: 2 }} />
            </View>

            {/* Title & Description */}
            <View className="items-center mb-6">
              <Text className="text-zinc-900 text-lg font-black tracking-tight text-center">
                {title}
              </Text>
              <Text className="text-zinc-500 text-xs font-medium text-center mt-2 leading-relaxed px-2">
                {description}
              </Text>
            </View>

            {/* Action Buttons */}
            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onClose}
                className="flex-1 py-3.5 rounded-2xl bg-zinc-100 items-center justify-center border border-zinc-200/60"
              >
                <Text className="text-zinc-700 text-xs font-black uppercase tracking-wider">
                  {cancelText}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  onClose();
                  onConfirm();
                }}
                className="flex-1 py-3.5 rounded-2xl bg-red-600 items-center justify-center shadow-md shadow-red-200"
              >
                <Text className="text-white text-xs font-black uppercase tracking-wider">
                  {confirmText}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
};
