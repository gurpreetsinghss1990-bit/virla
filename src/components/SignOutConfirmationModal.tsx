import React, { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

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
  const isShowingRef = useRef(false);

  useEffect(() => {
    if (visible && !isShowingRef.current) {
      isShowingRef.current = true;
      Alert.alert(
        title,
        description,
        [
          {
            text: cancelText,
            style: 'cancel',
            onPress: () => {
              isShowingRef.current = false;
              onClose();
            },
          },
          {
            text: confirmText,
            style: 'destructive',
            onPress: () => {
              isShowingRef.current = false;
              onClose();
              onConfirm();
            },
          },
        ],
        {
          cancelable: true,
          onDismiss: () => {
            isShowingRef.current = false;
            onClose();
          },
        }
      );
    } else if (!visible) {
      isShowingRef.current = false;
    }
  }, [visible, title, description, cancelText, confirmText, onClose, onConfirm]);

  return null;
};
