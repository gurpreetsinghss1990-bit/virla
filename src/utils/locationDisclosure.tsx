import React from 'react';
import * as Location from 'expo-location';
import { create } from 'zustand';
import { NativeAlertDialog } from '../components/NativeAlertDialog';

interface ForegroundDisclosureState {
  visible: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  resolver: ((accepted: boolean) => void) | null;
  open: (opts: { title?: string; message: string; confirmText?: string; cancelText?: string }, resolver: (accepted: boolean) => void) => void;
  accept: () => void;
  decline: () => void;
}

const DEFAULT_REASON = [
  '• What is collected: Your device location while you are using the app.',
  '',
  '• Purpose: To detect your training address, match nearby trainers, and share live travel updates during active sessions.',
  '',
  '• Duration: Only while you use location-based features in the app. We never collect location for advertising.',
].join('\n');

export const useForegroundLocationDisclosureStore = create<ForegroundDisclosureState>((set, get) => ({
  visible: false,
  title: 'Location Access',
  message: DEFAULT_REASON,
  confirmText: 'Continue',
  cancelText: 'Not Now',
  resolver: null,
  open: (opts, resolver) =>
    set({
      visible: true,
      title: opts.title ?? 'Location Access',
      message: opts.message,
      confirmText: opts.confirmText ?? 'Continue',
      cancelText: opts.cancelText,
      resolver,
    }),
  accept: () => {
    const res = get().resolver;
    set({ visible: false, resolver: null });
    res?.(true);
  },
  decline: () => {
    const res = get().resolver;
    set({ visible: false, resolver: null });
    res?.(false);
  },
}));

/**
 * Global native AlertDialog (matching SignOutConfirmationModal) for foreground location disclosure.
 */
export const ForegroundLocationDisclosureDialog: React.FC = () => {
  const visible = useForegroundLocationDisclosureStore((s) => s.visible);
  const title = useForegroundLocationDisclosureStore((s) => s.title);
  const message = useForegroundLocationDisclosureStore((s) => s.message);
  const confirmText = useForegroundLocationDisclosureStore((s) => s.confirmText);
  const cancelText = useForegroundLocationDisclosureStore((s) => s.cancelText);
  const accept = useForegroundLocationDisclosureStore((s) => s.accept);
  const decline = useForegroundLocationDisclosureStore((s) => s.decline);

  return (
    <NativeAlertDialog
      visible={visible}
      title={title}
      message={message}
      confirmText={confirmText}
      cancelText={cancelText}
      onConfirm={accept}
      onDismiss={decline}
    />
  );
};

export function showNativeAlert(title: string, message: string, confirmText = 'OK'): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    useForegroundLocationDisclosureStore.getState().open(
      { title, message, confirmText, cancelText: undefined },
      resolve
    );
  });
}

/**
 * Google Play Prominent Disclosure helper for foreground location permission.
 * Checks if permission is already granted; if not, shows the native AlertDialog disclosure
 * explaining why location is collected before triggering the OS runtime prompt.
 */
export async function requestForegroundLocationWithDisclosure(
  reason?: string
): Promise<Location.PermissionResponse> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === 'granted') {
    return current;
  }

  const agreed = await new Promise<boolean>((resolve) => {
    useForegroundLocationDisclosureStore.getState().open(
      {
        title: 'Location Access',
        message: reason || DEFAULT_REASON,
        confirmText: 'Continue',
        cancelText: 'Not Now',
      },
      resolve
    );
  });

  if (!agreed) {
    return {
      status: Location.PermissionStatus.DENIED,
      granted: false,
      canAskAgain: current.canAskAgain ?? true,
      expires: 'never',
    };
  }

  // If user previously tapped "Don't ask again" in OS dialog, canAskAgain is false.
  // In that case, requestForegroundPermissionsAsync() won't show anything.
  if (current.canAskAgain === false) {
    return current;
  }

  return Location.requestForegroundPermissionsAsync();
}
