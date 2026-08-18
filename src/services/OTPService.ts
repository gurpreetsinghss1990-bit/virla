import { Platform } from 'react-native';

// Safely require the mobile SDK only on native platforms
let OTPWidget: any = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    OTPWidget = require('@msg91comm/sendotp-react-native').OTPWidget;
  } catch (e) {
    console.error('[OTP Service] Failed to load @msg91comm/sendotp-react-native package:', e);
  }
}

export class OTPService {
  /**
   * Sanitizes environment variables by removing spaces and quote wrapper characters.
   */
  static sanitizeCredential(value: string | undefined): string {
    if (!value) return '';
    return value.trim().replace(/^['"]|['"]$/g, '');
  }

  /**
   * Generates safe logs/diagnostics for setup troubleshooting.
   * NEVER prints actual credentials in raw format.
   */
  static getDiagnostics() {
    const rawWidgetId = process.env.EXPO_PUBLIC_MSG91_WIDGET_ID;
    const rawTokenAuth = process.env.EXPO_PUBLIC_MSG91_TOKEN_AUTH;
    
    const widgetId = this.sanitizeCredential(rawWidgetId);
    const tokenAuth = this.sanitizeCredential(rawTokenAuth);
    
    return {
      platform: Platform.OS,
      widgetIdExists: !!widgetId,
      widgetIdLength: widgetId.length,
      widgetIdHasQuotes: rawWidgetId !== undefined && rawWidgetId !== widgetId,
      tokenAuthExists: !!tokenAuth,
      tokenAuthLength: tokenAuth.length,
      tokenAuthHasQuotes: rawTokenAuth !== undefined && rawTokenAuth !== tokenAuth
    };
  }

  /**
   * Initializes the MSG91 Widget configuration for both Web and Mobile.
   * On Web, it loads the MSG91 Javascript SDK dynamically.
   * On Mobile, it initializes the React Native SDK widget instance.
   */
  static initialize(rawWidgetId: string, rawTokenAuth: string) {
    const widgetId = this.sanitizeCredential(rawWidgetId);
    const tokenAuth = this.sanitizeCredential(rawTokenAuth);

    if (!widgetId || !tokenAuth) {
      console.warn('[OTP Service] Warning: Initializing with empty widgetId or tokenAuth.');
      return;
    }

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        // Expose configuration globally as expected by the MSG91 Web SDK script loader
        (window as any).configuration = {
          widgetId,
          tokenAuth,
          exposeMethods: true,
          success: (data: any) => {
            console.log('[MSG91 Web SDK] Success callback triggered:', data);
          },
          failure: (error: any) => {
            console.error('[MSG91 Web SDK] Failure callback triggered:', error);
          }
        };

        const scriptId = 'msg91-otp-script';
        const existingScript = document.getElementById(scriptId);

        if (!existingScript) {
          const script = document.createElement('script');
          script.id = scriptId;
          script.src = 'https://verify.msg91.com/otp-provider.js';
          script.type = 'text/javascript';
          script.async = true;
          script.onload = () => {
            console.log('[OTP Service] MSG91 Web SDK script loaded.');
            if (typeof (window as any).initSendOTP === 'function') {
              try {
                (window as any).initSendOTP((window as any).configuration);
              } catch (err) {
                console.error('[OTP Service] Error calling initSendOTP:', err);
              }
            }
          };
          script.onerror = () => {
            console.error('[OTP Service] Failed to load MSG91 Web SDK script.');
          };
          document.body.appendChild(script);
        } else {
          if (typeof (window as any).initSendOTP === 'function') {
            try {
              (window as any).initSendOTP((window as any).configuration);
            } catch (err) {
              console.error('[OTP Service] Error re-calling initSendOTP:', err);
            }
          }
        }
      }
    } else {
      if (OTPWidget) {
        try {
          OTPWidget.initializeWidget(widgetId, tokenAuth);
          console.log('[OTP Service] MSG91 Mobile SDK initialized successfully.');
        } catch (e) {
          console.error('[OTP Service] Failed to initialize mobile SDK:', e);
        }
      } else {
        console.warn('[OTP Service] Mobile SDK not available during initialization.');
      }
    }
  }

  /**
   * Helper to ensure initialization happens right before an operation.
   */
  private static ensureInitialized() {
    const widgetId = process.env.EXPO_PUBLIC_MSG91_WIDGET_ID || '';
    const tokenAuth = process.env.EXPO_PUBLIC_MSG91_TOKEN_AUTH || '';
    this.initialize(widgetId, tokenAuth);
  }

  /**
   * Normalizes any input phone number to the 91XXXXXXXXXX format.
   */
  static normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) {
      return digits;
    }
    if (digits.length === 10) {
      return '91' + digits;
    }
    return digits;
  }

  /**
   * Sends the OTP to the specified mobile phone number.
   * Returns a promise containing { success, reqId, error }.
   */
  static async sendOTP(phone: string): Promise<{ success: boolean; reqId?: string; error?: string }> {
    this.ensureInitialized();
    const normalized = this.normalizePhone(phone);
    if (normalized.length !== 12 || !normalized.startsWith('91')) {
      return { success: false, error: 'Please enter a valid 10-digit mobile number.' };
    }

    if (Platform.OS === 'web') {
      return new Promise((resolve) => {
        if (typeof (window as any).sendOtp !== 'function') {
          resolve({ success: false, error: 'MSG91 service is still initializing. Please wait.' });
          return;
        }

        try {
          (window as any).sendOtp(
            normalized,
            (response: any) => {
              const reqId = typeof response === 'string' 
                ? response 
                : (response?.message || response?.reqId || response?.data?.reqId || '');
              resolve({ success: true, reqId });
            },
            (error: any) => {
              resolve({ success: false, error: error?.message || 'We couldn\'t send the OTP. Please try again.' });
            }
          );
        } catch (err: any) {
          resolve({ success: false, error: err.message || 'Error occurred while sending OTP' });
        }
      });
    } else {
      if (!OTPWidget) {
        return { success: false, error: 'Mobile authentication module is not available.' };
      }
      try {
        const response = await OTPWidget.sendOTP({ identifier: normalized });
        if (response && response.type === 'success') {
          const reqId = response.message || response.reqId || '';
          return { success: true, reqId };
        } else {
          return { success: false, error: response?.message || 'We couldn\'t send the OTP. Please try again.' };
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'Error occurred while sending OTP' };
      }
    }
  }

  /**
   * Verifies the user-entered OTP against the verification request ID.
   * Returns a promise containing { success, token, error }.
   */
  static async verifyOTP(phone: string, otp: string, reqId: string): Promise<{ success: boolean; token?: string; error?: string }> {
    this.ensureInitialized();
    if (!otp || otp.length < 4) {
      return { success: false, error: 'Please enter the verification code.' };
    }

    if (Platform.OS === 'web') {
      return new Promise((resolve) => {
        if (typeof (window as any).verifyOtp !== 'function') {
          resolve({ success: false, error: 'MSG91 service is not loaded.' });
          return;
        }

        try {
          (window as any).verifyOtp(
            otp,
            (response: any) => {
              const token = typeof response === 'string'
                ? response
                : (response?.token || response?.['access-token'] || response?.accessToken || response?.message || '');
              resolve({ success: true, token });
            },
            (error: any) => {
              resolve({ success: false, error: error?.message || 'The OTP is incorrect. Please try again.' });
            }
          );
        } catch (err: any) {
          resolve({ success: false, error: err.message || 'Error occurred while verifying OTP' });
        }
      });
    } else {
      if (!OTPWidget) {
        return { success: false, error: 'Mobile authentication module is not available.' };
      }
      try {
        // According to official SDK specification, identifier is NOT required for verifyOTP
        const response = await OTPWidget.verifyOTP({
          reqId,
          otp
        });
        
        // SAFE STRUCTURAL LOGGING OF verifyOTP SDK RESPONSE
        console.log('[OTP Service Diagnostics] verifyOTP response keys:', response ? Object.keys(response) : 'null/undefined');
        if (response && typeof response === 'object') {
          for (const key of Object.keys(response)) {
            const val = response[key];
            if (val && typeof val === 'object') {
              console.log(`[OTP Service Diagnostics] response.${key} keys:`, Object.keys(val));
            } else {
              console.log(`[OTP Service Diagnostics] response.${key} type:`, typeof val, typeof val === 'string' ? `(len: ${val.length})` : '');
            }
          }
        }

        if (response && response.type === 'success') {
          const token = response.token || response.message || (response.data && response.data.token) || '';
          
          // SAFE STRUCTURAL LOGGING OF TOKEN
          const parts = typeof token === 'string' ? token.split('.') : [];
          console.log(`[OTP Service Diagnostics] Token resolved from response. Length: ${typeof token === 'string' ? token.length : 'N/A'}, segments count: ${parts.length}`);
          
          return { success: true, token };
        } else {
          return { success: false, error: response?.message || 'The OTP is incorrect. Please try again.' };
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'Error occurred while verifying OTP' };
      }
    }
  }

  /**
   * Retries/resends the OTP using MSG91 retryOtp logic (using default widget configuration).
   */
  static async retryOTP(phone: string, reqId: string): Promise<{ success: boolean; error?: string }> {
    this.ensureInitialized();
    if (!reqId) {
      return { success: false, error: 'Missing request ID. Please try sending OTP again.' };
    }

    if (Platform.OS === 'web') {
      return new Promise((resolve) => {
        if (typeof (window as any).retryOtp !== 'function') {
          resolve({ success: false, error: 'MSG91 service is not loaded.' });
          return;
        }

        try {
          (window as any).retryOtp(
            '11', // Default to SMS channel on Web
            (response: any) => {
              resolve({ success: true });
            },
            (error: any) => {
              resolve({ success: false, error: error?.message || 'OTP resend failure. Please try again.' });
            }
          );
        } catch (err: any) {
          resolve({ success: false, error: err.message || 'Error occurred while retrying OTP' });
        }
      });
    } else {
      if (!OTPWidget) {
        return { success: false, error: 'Mobile authentication module is not available.' };
      }
      try {
        // According to official SDK specification, do NOT force channel parameters when using default widget configuration
        const response = await OTPWidget.retryOTP({
          reqId
        });
        if (response && response.type === 'success') {
          return { success: true };
        } else {
          return { success: false, error: response?.message || 'OTP resend failure. Please try again.' };
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'Error occurred while retrying OTP' };
      }
    }
  }
}
