# Android Emulator Setup, Runbook & Troubleshooting Guide

This document captures the complete end-to-end workflow for running **Virla** on an Android emulator (macOS Apple Silicon / ARM64), including build troubleshooting, log streaming, and development test accounts.

---

## 1. Quick Start Commands

### A. Start Emulator
```bash
$ANDROID_HOME/emulator/emulator -avd Pixel_8 &
```
*Verify it is running with:*
```bash
adb devices
# Expected: emulator-5554   device
```

### B. Reverse Metro Port
Ensure the emulator can communicate with the local bundler on port 8081:
```bash
adb reverse tcp:8081 tcp:8081
```

### C. Start Metro Bundler (Live Logs)
```bash
npx expo start
```
*Press `a` in the terminal to open the app on Android if not already opened.*

### D. Alternative: Stream Device Logs via ADB
```bash
# JS and React Native logs only
adb logcat -s ReactNativeJS:V

# Including native Android crashes
adb logcat -s ReactNativeJS:V AndroidRuntime:E
```

---

## 2. Test Credentials & Bypasses

### A. Pre-configured Mobile & OTP Accounts
When logging in via the **Mobile Number** flow, MSG91 SMS dispatch is automatically bypassed for these configured test numbers:

| Account Type | Mobile Number | Fixed OTP | Access Token / Target User |
| :--- | :--- | :--- | :--- |
| **Mayur (Verified User)** | `9920827270` | `123456` | `mock-access-token-u-ej8bes2xq` |
| **App Review (Customer)** | `9967720006` | `123456` | `mock-access-token-u-lo7leg48d` |
| **Demo Trainer** | `9123456789` | `123456` *(or `VirlaTrainer@123`)* | `mock-access-token-demo.trainer` |
| **Test Admin** | `1234567891` | `123456` *(or `123123`)* | `mock-access-token-u-testadmin` |

### B. 1-Click Dev OAuth Login (No OTP Needed)
In development mode (`__DEV__`):
1. On the login screen, tap **Continue with Google** or **Continue with Apple**.
2. Select **Test Customer**, **Test Trainer**, or **Test Admin** from the dialog to log in instantly.

---

## 3. Key Issues Resolved & Configuration Safeguards

### Issue 1: `checkDebugAarMetadata` Build Failure (API 37 Conflict)
- **Symptom:** Gradle reported `Dependency 'androidx.lifecycle:lifecycle-viewmodel-compose-android:2.11.0' requires Android APIs 37 or later. :app is currently compiled against android-36.`
- **Cause:** Jetpack Compose plugins and version catalog (`libs.versions.toml`) had been inadvertently added to `android/build.gradle` and `android/app/build.gradle`.
- **Fix:** Removed unused Compose dependencies and restored standard React Native / Expo Gradle configuration.

### Issue 2: `Cannot find module '../lightningcss.darwin-arm64.node'`
- **Symptom:** Metro bundler crashed on start with missing binary for `darwin-arm64`.
- **Cause:** Project had `lightningcss-darwin-x64` (Intel) installed instead of Apple Silicon ARM64.
- **Fix:** Installed `lightningcss-darwin-arm64@1.27.0`.

### Issue 3: `IllegalStateException: You need to use a Theme.AppCompat theme`
- **Symptom:** App crashed immediately on launch during `SplashScreenManager.registerOnActivity(this)`.
- **Cause:** `android:theme` on `MainActivity` in `AndroidManifest.xml` had been set to `@style/Theme.Virla` (Material theme instead of AppCompat).
- **Fix:** Restored `android:theme="@style/Theme.App.SplashScreen"` which properly inherits from `Theme.AppCompat.DayNight.NoActionBar`.

### Issue 4: `› Skipping dev server` (Logs Not Showing in Terminal)
- **Symptom:** Running `npx expo run:android` exited immediately with code 0 without showing logs.
- **Cause:** An existing background process was already occupying port `8081`. Expo detected the active server, completed the APK install, and terminated.
- **Fix:** Terminated the background port holder. Use `npx expo start` in the foreground to stream logs live.

### Issue 5: Tab Bar Colliding with Android 3-Button System Navigation
- **Symptom:** On Android devices and emulators configured with 3-button navigation (Back, Home, Recents), the floating bottom tab bar overlapped directly on top of the navigation bar.
- **Cause:** `BottomNavigation.tsx` hardcoded `bottom-6` (24dp) rather than incorporating `useSafeAreaInsets().bottom` (which is ~48dp on 3-button navigation).
- **Fix:** Added `useSafeAreaInsets` hook to [`src/components/BottomNavigation.tsx`](file:///Users/Developer/Downloads/Virla/src/components/BottomNavigation.tsx) and calculated dynamic bottom clearance: `bottom: Math.max(insets.bottom + 8, 24)`.

### Issue 6: Tab Bar Transparency & Active Pill Covering Icons on Android
- **Symptom:** On tab switch, the active pill indicator was rendering over the tab icon (hiding it) due to Android elevation rendering order, and underlying page contents (e.g. Schedule/Visits buttons) were bleeding through the semi-transparent tab bar background.
- **Cause:** `activePill` style had `elevation: 1` which forced it above the tab items on Android, with a fixed 42px height that misaligned with the icon/label. Additionally, the tab bar had semi-transparent background (`rgba(255, 255, 255, 0.95)`).
- **Fix:**
  1. Updated [`src/components/BottomNavigation.tsx`](file:///Users/Developer/Downloads/Virla/src/components/BottomNavigation.tsx) with a solid `#FFFFFF` card background and crisp drop shadow to eliminate bleed-through.
  2. Restructured `activePill` with `top: 6, bottom: 6, zIndex: 0` (no elevation) and added `zIndex: 10` to tab buttons, ensuring the icon and label are centered and in front of the pill.
  3. Increased `paddingBottom` to `180` in [`src/app/(tabs)/bookings.tsx`](file:///Users/Developer/Downloads/Virla/src/app/(tabs)/bookings.tsx) so scrolled content clears the floating bar comfortably.

### Issue 7: Bell Icon System Alert & Cancel Button Collision with Android Navigation
- **Symptom:** Tapping the bell icon on the Home tab opened a React Native system `Alert.alert` dialog. When replaced with an initial bottom sheet, the Cancel button sat directly underneath the Android 3-button navigation bar (Back, Home, Overview).
- **Cause:** Home tab used native `Alert.alert('Communication Center', ...)` which clashed with app luxury styling. In the bottom sheet, Android modal with `statusBarTranslucent` extends behind the system navigation bar (~48-56dp) without dynamic bottom insets.
- **Fix:**
  1. Created [`src/components/CommunicationCenterModal.tsx`](file:///Users/Developer/Downloads/Virla/src/components/CommunicationCenterModal.tsx) with app theme styling, destination routing (Notifications vs. Messages), and unread badge pill.
  2. Set `animationType="slide"` so the modal smoothly slides up from the bottom edge.
  3. Added `useSafeAreaInsets` and dynamic bottom clearance: `paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 56 : 24) + 20` to prevent collision with Android 3-button navigation.

### Issue 8: Trainer Online/Offline Toggle Showing System Alert Dialog
- **Symptom:** In trainer mode on the Home screen, clicking the `ONLINE` status pill popped up a native Android system alert box (`Go Offline?`).
- **Cause:** `toggleOnlineStatus` in `src/app/(tabs)/index.tsx` invoked standard React Native `Alert.alert`.
- **Fix:**
  1. Created [`src/components/TrainerStatusModal.tsx`](file:///Users/Developer/Downloads/Virla/src/components/TrainerStatusModal.tsx) featuring a branded bottom sheet sliding up from the bottom (`animationType="slide"`).
  2. Displays clear impact warning ("New Requests Paused"), status badge, and themed action buttons ("Confirm & Go Offline" and "Keep Online").
  3. Integrated safe area bottom cushion to ensure full clearance above the Android 3-button navigation bar.

### Issue 9: `fb-dotslash/bin/macos/dotslash ENOENT` During React Native DevTools Launch
- **Symptom:** Metro startup or DevTools installation reported: `ERROR An unknown error occurred while installing React Native DevTools. Details: spawn /Users/Developer/Downloads/Virla/node_modules/fb-dotslash/bin/macos/dotslash ENOENT`.
- **Cause:** The prebuilt native executable for macOS (`dotslash`) inside `node_modules/fb-dotslash/bin/macos/` was missing or empty.
- **Fix:** Extracted the prebuilt `dotslash` binary from the `fb-dotslash@0.5.8` package directly into `node_modules/fb-dotslash/bin/macos/dotslash` and ensured executable permissions (`chmod +x`).




