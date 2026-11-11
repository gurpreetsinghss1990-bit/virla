import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCustomAlertStore, CustomAlertData, AlertButton } from '../store/customAlertStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function CustomAlertTopNotification() {
  const insets = useSafeAreaInsets();
  const { currentAlert, hideAlert } = useCustomAlertStore();
  const [activeAlert, setActiveAlert] = useState<CustomAlertData | null>(null);

  const translateY = useRef(new Animated.Value(-250)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const isAnimatingRef = useRef(false);

  useEffect(() => {
    if (currentAlert) {
      setActiveAlert(currentAlert);
      isAnimatingRef.current = true;
      translateY.setValue(-250);
      backdropOpacity.setValue(0);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 80,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        isAnimatingRef.current = false;
      });
    }
  }, [currentAlert?.id]);

  const dismiss = (callback?: () => void) => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -280,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      isAnimatingRef.current = false;
      hideAlert();
      setActiveAlert(null);
      if (callback) {
        callback();
      }
    });
  };

  if (!activeAlert) {
    return null;
  }

  // Fallback buttons if none provided (standard iOS/Android behavior)
  const buttons: AlertButton[] =
    activeAlert.buttons && activeAlert.buttons.length > 0
      ? activeAlert.buttons
      : [{ text: 'OK', style: 'default' }];

  return (
    <Modal
      transparent
      visible={!!activeAlert}
      animationType="none"
      onRequestClose={() => {
        if (activeAlert.cancelable) {
          dismiss();
        }
      }}
    >
      <View style={StyleSheet.absoluteFill}>
        {/* Subtle ultra-light backdrop overlay */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: 'rgba(0, 0, 0, 0.12)',
              opacity: backdropOpacity,
            },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (activeAlert.cancelable) {
                dismiss();
              }
            }}
          />
        </Animated.View>

        {/* Top Pop Notification Card */}
        <Animated.View
          style={{
            position: 'absolute',
            top: Math.max(insets.top + 8, 16),
            left: 14,
            right: 14,
            transform: [{ translateY }],
            zIndex: 9999,
          }}
        >
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 22,
              paddingVertical: 18,
              paddingHorizontal: 20,
              borderWidth: 1,
              borderColor: 'rgba(0, 0, 0, 0.08)',
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.08,
              shadowRadius: 20,
              elevation: 6,
            }}
          >
            {/* Title */}
            {activeAlert.title ? (
              <Text
                style={{
                  color: '#111827',
                  fontSize: 16,
                  fontWeight: '700',
                  letterSpacing: -0.3,
                  textAlign: 'left',
                }}
              >
                {activeAlert.title}
              </Text>
            ) : null}

            {/* Message */}
            {activeAlert.message ? (
              <Text
                style={{
                  color: '#4B5563',
                  fontSize: 13.5,
                  fontWeight: '400',
                  lineHeight: 19,
                  marginTop: activeAlert.title ? 6 : 0,
                  textAlign: 'left',
                }}
              >
                {activeAlert.message}
              </Text>
            ) : null}

            {/* Action Buttons row (clean subtle borders, no bloated colors) */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 8,
                marginTop: 16,
              }}
            >
              {buttons.map((btn, index) => {
                const isDestructive = btn.style === 'destructive';
                const isCancel = btn.style === 'cancel';
                const isPrimary = !isCancel && !isDestructive && (buttons.length === 1 || index === buttons.length - 1);

                return (
                  <TouchableOpacity
                    key={`alert-btn-${index}`}
                    activeOpacity={0.7}
                    onPress={() => {
                      dismiss(btn.onPress);
                    }}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 14,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: isDestructive
                        ? '#FCA5A5'
                        : isPrimary
                        ? '#18181B'
                        : 'rgba(0, 0, 0, 0.12)',
                      backgroundColor: isPrimary ? '#18181B' : '#FFFFFF',
                      minWidth: 64,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: isDestructive
                          ? '#EF4444'
                          : isPrimary
                          ? '#FFFFFF'
                          : '#374151',
                      }}
                    >
                      {btn.text || 'OK'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

