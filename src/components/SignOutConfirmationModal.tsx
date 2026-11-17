import React, { useEffect, useRef } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

export interface SignOutConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
}

let JetpackCompose: any = null;
if (Platform.OS === 'android') {
  try {
    JetpackCompose = require('@expo/ui/jetpack-compose');
  } catch {}
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
    // If running on Android and JetpackCompose AlertDialog is available, do not fire Alert.alert
    if (Platform.OS === 'android' && JetpackCompose?.AlertDialog) {
      return;
    }

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

  if (Platform.OS === 'android' && JetpackCompose?.AlertDialog) {
    if (!visible) return null;
    const { Host, AlertDialog, TextButton, Text } = JetpackCompose;

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Host style={StyleSheet.absoluteFill} matchContents={false}>
          <AlertDialog 
            onDismissRequest={onClose}
          >
            <AlertDialog.Title>
              <Text 
                fontWeight="bold" 
                color="#09090B"
                style={{ fontSize: 20 }}
              >
                {title}
              </Text>
            </AlertDialog.Title>
            <AlertDialog.Text>
              <Text 
                fontWeight="bold" 
                color="#27272A"
                style={{ fontSize: 15 }}
              >
                {description}
              </Text>
            </AlertDialog.Text>
            <AlertDialog.ConfirmButton>
              <TextButton
                onClick={() => {
                  onClose();
                  onConfirm();
                }}
                colors={{ contentColor: '#E11D48' }}
              >
                <Text fontWeight="bold" color="#E11D48">{confirmText}</Text>
              </TextButton>
            </AlertDialog.ConfirmButton>
            <AlertDialog.DismissButton>
              <TextButton 
                onClick={onClose}
                colors={{ contentColor: '#71717A' }}
              >
                <Text fontWeight="medium" color="#71717A">{cancelText}</Text>
              </TextButton>
            </AlertDialog.DismissButton>
          </AlertDialog>
        </Host>
      </View>
    );
  }

  return null;
};
