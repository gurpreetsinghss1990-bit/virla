import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

export interface ConfirmationDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  iconName?: React.ComponentProps<typeof Feather>['name'];
  isLoading?: boolean;
  loadingText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Lean v1 Cross-Platform Confirmation Dialog
 * Implements Android Material 3 Expressive (28dp surface) & iOS HIG guidelines.
 */
export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  iconName,
  isLoading = false,
  loadingText = 'Processing...',
  onConfirm,
  onCancel,
}) => {
  const defaultIcon = iconName || (isDestructive ? 'alert-triangle' : 'help-circle');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!isLoading) onCancel();
      }}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => {
          if (!isLoading) onCancel();
        }}
        className="flex-1 bg-black/60 items-center justify-center px-6"
      >
        <TouchableWithoutFeedback>
          <View className="w-full max-w-sm bg-[#FAF9F5] rounded-[28px] p-6 shadow-2xl border border-[#E8E4DC]">
            {/* Leading Icon Badge */}
            <View
              className={`w-14 h-14 rounded-2xl items-center justify-center self-center mb-4 ${
                isDestructive
                  ? 'bg-red-50 border border-red-100'
                  : 'bg-[#CC785C]/12 border border-[#CC785C]/20'
              }`}
            >
              <Feather
                name={defaultIcon}
                size={24}
                color={isDestructive ? '#DC2626' : '#CC785C'}
              />
            </View>

            {/* Title & Body */}
            <View className="items-center mb-6">
              <Text className="text-[#1F1E1D] text-[19px] font-bold tracking-tight text-center">
                {title}
              </Text>
              <Text className="text-[#615E58] text-[13.5px] leading-relaxed text-center mt-2 px-1">
                {message}
              </Text>
            </View>

            {/* Actions (48dp min touch targets) */}
            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={isLoading}
                onPress={onCancel}
                className="flex-1 min-h-[48px] rounded-2xl bg-[#F0ECE1] items-center justify-center border border-[#E5E0D4] active:bg-[#E5E0D5]"
                accessibilityRole="button"
                accessibilityLabel={cancelText}
              >
                <Text className="text-[#5C5954] text-xs font-bold uppercase tracking-wider">
                  {cancelText}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                disabled={isLoading}
                onPress={onConfirm}
                className={`flex-1 min-h-[48px] rounded-2xl items-center justify-center shadow-xs ${
                  isDestructive
                    ? 'bg-red-600 active:bg-red-700'
                    : 'bg-[#CC785C] active:bg-[#B6664C]'
                }`}
                accessibilityRole="button"
                accessibilityLabel={confirmText}
              >
                {isLoading ? (
                  <View className="flex-row items-center gap-1.5">
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text className="text-white text-xs font-bold uppercase tracking-wider">
                      {loadingText}
                    </Text>
                  </View>
                ) : (
                  <Text className="text-white text-xs font-bold uppercase tracking-wider">
                    {confirmText}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
};
