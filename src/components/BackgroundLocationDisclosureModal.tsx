import React from 'react';
import { useLocationDisclosureStore } from '../store/locationDisclosureStore';
import { NativeAlertDialog } from './NativeAlertDialog';

const BACKGROUND_DISCLOSURE_MESSAGE = [
  'VIRLA collects location data to enable live trainer travel tracking and client ETA updates, even when the app is closed or not in use.',
  '',
  '• What is collected: Your precise device location data in the background, even when the app is closed, minimized, or not in use.',
  '',
  '• Why (Purpose): To share your live travel route and estimated arrival time (ETA) with your client while you are travelling to their venue.',
  '',
  '• When & Duration: Tracking starts only after you tap "Start Travel" on a confirmed session and stops automatically when you tap "Reached Location" or start the session. We never track you outside an active travel window or for advertising.',
].join('\n');

export const BackgroundLocationDisclosureModal: React.FC = () => {
  const visible = useLocationDisclosureStore((s) => s.visible);
  const accept = useLocationDisclosureStore((s) => s.accept);
  const decline = useLocationDisclosureStore((s) => s.decline);

  return (
    <NativeAlertDialog
      visible={visible}
      title="Background Location Permission"
      message={BACKGROUND_DISCLOSURE_MESSAGE}
      confirmText="Continue"
      cancelText="Not Now"
      onConfirm={accept}
      onDismiss={decline}
    />
  );
};
