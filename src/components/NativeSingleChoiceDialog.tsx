import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text as RNText, TouchableOpacity, View } from 'react-native';

import { softShadow } from '../utils/shadows';
export interface NativeSingleChoiceDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  options: string[];
  selectedOption?: string;
  onSelect: (option: string) => void;
  onDismiss: () => void;
}

export const NativeSingleChoiceDialog: React.FC<NativeSingleChoiceDialogProps> = React.memo(({
  visible,
  title,
  message,
  options,
  selectedOption,
  onSelect,
  onDismiss,
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable 
        style={styles.backdrop} 
        onPress={onDismiss}
      >
        <Pressable 
          style={Platform.OS === 'ios' ? styles.iosDialogBox : styles.androidDialogBox} 
          onPress={e => e.stopPropagation()}
        >
          {/* Header */}
          <RNText style={Platform.OS === 'ios' ? styles.iosTitle : styles.androidTitle}>
            {title}
          </RNText>
          
          {Boolean(message) && (
            <RNText style={Platform.OS === 'ios' ? styles.iosSubtitle : styles.androidSubtitle}>
              {message}
            </RNText>
          )}

          {Platform.OS === 'ios' && <View style={styles.iosDivider} />}

          {/* Options */}
          <View style={Platform.OS === 'ios' ? undefined : styles.androidOptionsContainer}>
            {options.map((opt, i) => {
              const isSelected = selectedOption === opt || (!selectedOption && opt === 'Any Workout');

              if (Platform.OS === 'ios') {
                return (
                  <TouchableOpacity
                    key={opt}
                    activeOpacity={0.7}
                    onPress={() => {
                      onSelect(opt);
                      onDismiss();
                    }}
                    style={[
                      styles.iosOptionRow,
                      i > 0 && styles.iosOptionBorderTop
                    ]}
                  >
                    <RNText style={[
                      styles.iosOptionText,
                      isSelected && styles.iosOptionTextSelected
                    ]}>
                      {opt}
                    </RNText>
                    {isSelected && <RNText style={styles.iosCheckmark}>✓</RNText>}
                  </TouchableOpacity>
                );
              }

              // Material 3 Dialog Option Row for Android
              return (
                <TouchableOpacity
                  key={opt}
                  activeOpacity={0.65}
                  onPress={() => {
                    onSelect(opt);
                    onDismiss();
                  }}
                  style={styles.androidOptionRow}
                >
                  <View style={[styles.androidRadioCircle, isSelected && styles.androidRadioCircleSelected]}>
                    {isSelected && <View style={styles.androidRadioInnerDot} />}
                  </View>
                  <RNText style={[styles.androidOptionText, isSelected && styles.androidOptionTextSelected]}>
                    {opt}
                  </RNText>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Action Buttons */}
          {Platform.OS === 'ios' ? (
            <>
              <View style={styles.iosDivider} />
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onDismiss}
                style={styles.iosCancelButton}
              >
                <RNText style={styles.iosCancelText}>Cancel</RNText>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.androidActionsRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onDismiss}
                style={styles.androidTextButton}
              >
                <RNText style={styles.androidCancelButtonText}>
                  CANCEL
                </RNText>
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  // Material 3 Specs for Android Dialog
  androidDialogBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingTop: 24,
    paddingBottom: 16,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 340,
    ...softShadow({ color: '#000', opacity: 0.15, radius: 12, offsetY: 4 }),
  },
  androidTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#18181B',
    marginBottom: 6,
  },
  androidSubtitle: {
    fontSize: 14,
    color: '#71717A',
    marginBottom: 12,
    lineHeight: 20,
  },
  androidOptionsContainer: {
    marginVertical: 4,
  },
  androidOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  androidRadioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#71717A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  androidRadioCircleSelected: {
    borderColor: '#E11D48',
  },
  androidRadioInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E11D48',
  },
  androidOptionText: {
    fontSize: 15,
    color: '#3F3F46',
  },
  androidOptionTextSelected: {
    color: '#18181B',
    fontWeight: '700',
  },
  androidActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  androidTextButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  androidCancelButtonText: {
    color: '#71717A',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.5,
  },

  // Apple Human Interface Guidelines for iOS Dialog
  iosDialogBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 16,
    width: '100%',
    maxWidth: 320,
    overflow: 'hidden',
  },
  iosTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    paddingTop: 18,
    paddingHorizontal: 16,
  },
  iosSubtitle: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  iosDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C6C6C8',
  },
  iosOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  iosOptionBorderTop: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  iosOptionText: {
    fontSize: 16,
    color: '#007AFF',
  },
  iosOptionTextSelected: {
    fontWeight: '600',
    color: '#E11D48',
  },
  iosCheckmark: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E11D48',
  },
  iosCancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  iosCancelText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
});

export default NativeSingleChoiceDialog;
