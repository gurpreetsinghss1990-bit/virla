import React, { useEffect, useRef } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

export interface NativeAlertDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onDismiss?: () => void;
}

let JetpackCompose: any = null;
if (Platform.OS === 'android') {
  try {
    JetpackCompose = require('@expo/ui/jetpack-compose');
  } catch {}
}

/**
 * Native AlertDialog matching exactly SignOutConfirmationModal:
 * Clean, borderless Material 3 TextButton with Red text color.
 */
export const NativeAlertDialog: React.FC<NativeAlertDialogProps> = React.memo(({
  visible,
  title,
  message,
  confirmText = 'OK',
  cancelText,
  onConfirm,
  onDismiss,
}) => {
  const isShowingRef = useRef(false);

  const handleClose = () => {
    isShowingRef.current = false;
    if (onDismiss) {
      onDismiss();
    } else {
      onConfirm();
    }
  };

  useEffect(() => {
    if (Platform.OS === 'android' && JetpackCompose?.AlertDialog) {
      return;
    }

    if (visible && !isShowingRef.current) {
      isShowingRef.current = true;
      const buttons: any[] = [];

      if (cancelText) {
        buttons.push({
          text: cancelText,
          style: 'cancel',
          onPress: () => {
            isShowingRef.current = false;
            onDismiss?.();
          },
        });
      }

      buttons.push({
        text: confirmText,
        style: 'destructive',
        onPress: () => {
          isShowingRef.current = false;
          onConfirm();
        },
      });

      Alert.alert(
        title,
        message,
        buttons,
        {
          cancelable: true,
          onDismiss: handleClose,
        }
      );
    } else if (!visible) {
      isShowingRef.current = false;
    }
  }, [visible, title, message, confirmText, cancelText, onConfirm, onDismiss]);

  if (Platform.OS === 'android' && JetpackCompose?.AlertDialog) {
    if (!visible) return null;
    const { Host, AlertDialog, TextButton, Text } = JetpackCompose;

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Host style={StyleSheet.absoluteFill} matchContents={false}>
          <AlertDialog onDismissRequest={handleClose}>
            <AlertDialog.Title>
              <Text 
                fontWeight="bold" 
                color="#09090B"
                style={{ fontSize: 20 }}
              >
                {title}
              </Text>
            </AlertDialog.Title>

            {Boolean(message) && (
              <AlertDialog.Text>
                <Text 
                  fontWeight="normal" 
                  color="#27272A"
                  style={{ fontSize: 15 }}
                >
                  {message}
                </Text>
              </AlertDialog.Text>
            )}

            <AlertDialog.ConfirmButton>
              <TextButton
                onClick={() => {
                  onConfirm();
                }}
                colors={{ contentColor: '#E11D48' }}
              >
                <Text fontWeight="bold" color="#E11D48">
                  {confirmText}
                </Text>
              </TextButton>
            </AlertDialog.ConfirmButton>

            {Boolean(cancelText) && (
              <AlertDialog.DismissButton>
                <TextButton 
                  onClick={handleClose}
                  colors={{ contentColor: '#71717A' }}
                >
                  <Text fontWeight="medium" color="#71717A">
                    {cancelText}
                  </Text>
                </TextButton>
              </AlertDialog.DismissButton>
            )}
          </AlertDialog>
        </Host>
      </View>
    );
  }

  return null;
});

export default NativeAlertDialog;
