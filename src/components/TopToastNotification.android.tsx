import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Host, Snackbar, SnackbarHost, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import { router } from 'expo-router';
import { useToastStore } from '../store/toastStore';

const CONTAINER = '#111827';
const CONTENT = '#FFFFFF';
const ACTION = '#FB7185';

export function TopToastNotification() {
  const currentToast = useToastStore((s) => s.currentToast);
  const hideToast = useToastStore((s) => s.hideToast);
  const hostRef = useRef<SnackbarHostRef>(null);
  const lastShown = useRef<string | null>(null);

  useEffect(() => {
    if (!currentToast || lastShown.current === currentToast.id) return;
    lastShown.current = currentToast.id;

    const { title, message, deepLink, duration } = currentToast;
    const text = title ? `${title}\n${message}` : message;
    const host = hostRef.current;
    if (!host) return;

    hideToast();

    host
      .showSnackbar({
        message: text,
        actionLabel: deepLink ? 'View' : undefined,
        duration: (duration ?? 4000) > 3000 ? 'long' : 'short',
      })
      .then((result) => {
        if (result === 'actionPerformed' && deepLink) router.push(deepLink as never);
      })
      .catch(() => {});
  }, [currentToast, hideToast]);

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <Host style={styles.host}>
        <SnackbarHost ref={hostRef}>
          <Snackbar containerColor={CONTAINER} contentColor={CONTENT} actionContentColor={ACTION} />
        </SnackbarHost>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingBottom: 24 },
  host: { width: '100%' },
});
