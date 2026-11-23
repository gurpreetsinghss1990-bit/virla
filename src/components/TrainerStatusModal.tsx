import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeSheet } from './NativeSheet';

import { softShadow } from '../utils/shadows';
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
  const bottomInset = Math.max(insets.bottom, 16);
  const isGoingOffline = targetStatus === 'offline';

  const handleDismiss = () => onClose();

  return (
    <NativeSheet visible={visible} onClose={handleDismiss}>
      <View style={[styles.container, { paddingBottom: bottomInset + 16 }]}>
        {/* Subtle Pull Indicator Bar */}
        <View style={styles.dragHandle} />

        {/* Modal Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerSubtitle}>
              TRAINER AVAILABILITY
            </Text>
            <Text style={styles.headerTitle}>
              {isGoingOffline ? 'Go Offline?' : 'Go Online?'}
            </Text>
          </View>
          <Pressable
            onPress={handleDismiss}
            style={styles.closeButton}
          >
            <Feather name="x" size={15} color="#101828" />
          </Pressable>
        </View>

        {/* Information & Impact Card */}
        <View
          style={[
            styles.noticeCard,
            {
              backgroundColor: isGoingOffline ? '#FFF1F2' : '#ECFDF5',
              borderColor: isGoingOffline ? '#FECDD3' : '#A7F3D0',
            },
          ]}
        >
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor: isGoingOffline ? '#FFE4E6' : '#D1FAE5',
                borderColor: isGoingOffline ? '#FDA4AF' : '#6EE7B7',
              },
            ]}
          >
            <Feather
              name={isGoingOffline ? 'power' : 'zap'}
              size={22}
              color={isGoingOffline ? '#E11D48' : '#059669'}
            />
          </View>

          <View style={styles.noticeTextContainer}>
            <View style={styles.noticeTitleRow}>
              <Text numberOfLines={1} style={styles.noticeTitle}>
                {isGoingOffline ? 'New Requests Paused' : 'Ready for Clients'}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: isGoingOffline ? '#FECDD3' : '#A7F3D0' },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: isGoingOffline ? '#881337' : '#064E3B' },
                  ]}
                >
                  {isGoingOffline ? 'OFFLINE' : 'ACTIVE'}
                </Text>
              </View>
            </View>

            <Text style={styles.noticeDescription}>
              {isGoingOffline
                ? "Going offline may prevent you from receiving new session requests.\n\nYour already confirmed bookings will remain scheduled."
                : "You will become visible for new incoming client workout requests within your selected coverage radius."}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {/* Primary Action Button */}
          <Pressable
            onPress={onConfirm}
            style={[
              styles.primaryButton,
              { backgroundColor: isGoingOffline ? '#E11D48' : '#059669' },
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isGoingOffline ? 'Confirm & Go Offline' : 'Confirm & Go Online'}
            </Text>
          </Pressable>

          {/* Secondary Dismiss Button */}
          <Pressable
            onPress={handleDismiss}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>
              {isGoingOffline ? 'Keep Online' : 'Stay Offline'}
            </Text>
          </Pressable>
        </View>
      </View>
    </NativeSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 16,
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E4E4E7',
    alignSelf: 'center',
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F4F4F5',
    paddingBottom: 12,
  },
  headerSubtitle: {
    color: '#E11D48',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  headerTitle: {
    color: '#09090B',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  noticeCard: {
    width: '100%',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    overflow: 'hidden',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  noticeTextContainer: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  noticeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  noticeTitle: {
    color: '#09090B',
    fontSize: 13.5,
    fontWeight: '900',
    flexShrink: 1,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 9999,
  },
  statusBadgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  noticeDescription: {
    color: '#52525B',
    fontSize: 11.5,
    fontWeight: '500',
    lineHeight: 17,
    flexShrink: 1,
  },
  actionsContainer: {
    width: '100%',
    gap: 10,
    marginTop: 2,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...softShadow({ color: '#000', opacity: 0.1, radius: 4, offsetY: 2 }),
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: 14,
    backgroundColor: '#F4F4F5',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  secondaryButtonText: {
    color: '#3F3F46',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});

export default TrainerStatusModal;
