import PayphiSdk from 'react-native-payphi-sdk';
import { supabase } from '../database/supabaseClient';
import { useWalletStore } from '../store/walletStore';
import { useUserStore } from '../store/userStore';
import { useMembershipStore } from '../store/membershipStore';
import { Database } from '../database/Database';

let isInitialized = false;
let currentPendingOrder: {
  merchantTxnNo: string;
  plan: {
    id: string;
    name: string;
    credits: number;
    amountVal: string;
    gstVal: string;
    totalPrice: string;
  };
} | null = null;

export const PayPhiService = {
  /**
   * Initializes the native PayPhi SDK with merchant & app credentials
   */
  initSDK: async (env = 'INT', merchantId = '100000000007164', appId = '80bc18249511f868', merchantName = 'Sapphire Test'): Promise<{ success: boolean; code?: string; message?: string }> => {
    try {
      console.log(`[PayPhiService] Initializing SDK: env=${env}, mId=${merchantId}, appId=${appId}, merchantName=${merchantName}`);
      const result = await PayphiSdk.setAppInfo(
        env,
        merchantId,
        appId,
        merchantName
      );

      console.log(`[PayPhiService] setAppInfo returned:`, JSON.stringify(result));

      if (result === '0000') {
        isInitialized = true;
        return { success: true, code: '0000', message: 'SDK Initialized Successfully' };
      } else {
        isInitialized = false;
        return { success: false, code: String(result), message: `Initialization failed with status code: ${result}` };
      }
    } catch (error: any) {
      isInitialized = false;
      const errCode = error?.code || 'INIT_ERROR';
      const errMsg = error?.message || String(error);
      console.error(`[PayPhiService] setAppInfo Error: Code=${errCode}, Message=${errMsg}`);
      return { success: false, code: errCode, message: `${errMsg} (${errCode})` };
    }
  },

  /**
   * Registers native payment event stream listener.
   * On completion, delegates authoritative verification & fulfillment to Supabase backend webhook/verification endpoint.
   */
  registerResponseListener: (onSuccess: () => void, onFailure: (msg: string) => void) => {
    console.log('[PayPhiService] Registering Payment Response Listener...');
    const subscription = PayphiSdk.addPaymentResponseListener(async (response: any) => {
      console.log('[PayPhiService] Native Response Received:', response);

      try {
        const responseMap = typeof response === 'string' ? JSON.parse(response) : response;

        const extract = (keys: string[], fallback: string) => {
          for (let key of keys) {
            if (responseMap[key] !== undefined && responseMap[key] !== null) {
              return String(responseMap[key]).trim();
            }
          }
          return fallback;
        };

        const status = extract(
          ['responseCode', 'txnResponseCode', 'txnStatus', 'resultCode', 'status'],
          'unknown'
        ).toLowerCase();

        const message = extract(
          ['respDescription', 'txnRespDescription', 'ResultMessage', 'message', 'statusMessage'],
          'No additional information provided.'
        );

        const resultType = extract(
          ['ResultType', 'resultType', 'paymentStatus'],
          'UNKNOWN'
        ).toUpperCase();

        const isSuccessStatus =
          ['0000', '000', 'success'].includes(status) ||
          resultType === 'SUCCESS' ||
          resultType === 'COMPLETED' ||
          message.toLowerCase().includes('success');

        const txnNo = currentPendingOrder?.merchantTxnNo || responseMap.merchantTxnNo || responseMap.MerchantTxnNo;

        if (isSuccessStatus && txnNo) {
          console.log(`[PayPhiService] Gateway completed. Calling authoritative verify-order for ${txnNo}...`);

          const currentUserId = Database.getCurrentUserId();

          // Actively request backend to verify order via DB / PayPhi status API
          try {
            const { data: verifyResult, error: verifyError } = await supabase.functions.invoke('verify-order', {
              body: {
                merchantTxnNo: txnNo,
              },
            });

            if (verifyError || !verifyResult?.success) {
              console.warn('[PayPhiService] verify-order response:', verifyError?.message || verifyResult?.message);
            } else {
              console.log('[PayPhiService] Order verified by backend:', verifyResult);
            }
          } catch (verifyEx) {
            console.warn('[PayPhiService] verify-order call failed:', verifyEx);
          }

          // Authoritative state sync: fetch true balance and lots from Supabase DB
          if (currentUserId) {
            await Database.refreshUserData(currentUserId);
          }
          await useWalletStore.getState().syncFromDB();
          useUserStore.getState().syncFromDB();
          useMembershipStore.getState().syncFromDB();

          currentPendingOrder = null;
          onSuccess();
        } else {
          currentPendingOrder = null;
          onFailure(message || 'Payment was cancelled or failed.');
        }
      } catch (e: any) {
        console.error('[PayPhiService] Error parsing gateway response:', e);
        currentPendingOrder = null;
        onFailure('Malformed payment response received.');
      }
    });

    return () => {
      subscription.remove();
    };
  },

  /**
   * Secure Payment Flow:
   * 1. Calls Supabase Edge Function `create-payment-order` with the planId.
   * 2. Backend generates authoritative `merchantTxnNo` and cryptographic `secureToken` with secret key.
   * 3. Initializes PayPhi native SDK with server-provided credentials.
   * 4. Triggers `PayphiSdk.makePayment` safely without exposing merchant secret keys on the client.
   */
  startPayment: async (
    planId: string,
    userEmail?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log(`[PayPhiService] Requesting backend order creation for plan: ${planId}...`);

      const { data, error } = await supabase.functions.invoke('create-payment-order', {
        body: {
          planId,
          customerEmail: userEmail || 'customer@virla.in',
        },
      });

      if (error || !data || !data.success) {
        let errorMsg = 'Failed to create payment order on backend';
        if (data?.error) {
          errorMsg = data.error;
        } else if (error) {
          errorMsg = error.message;
          // Inspect context if available
          if ((error as any)?.context?.json) {
            try {
              const bodyJson = await (error as any).context.json();
              if (bodyJson?.error) errorMsg = bodyJson.error;
            } catch (_) {}
          }
        }
        console.error('[PayPhiService] Backend order creation failed:', errorMsg);
        return { success: false, error: errorMsg };
      }

      const order = data.order;
      currentPendingOrder = {
        merchantTxnNo: order.merchantTxnNo,
        plan: order.plan,
      };

      // Ensure SDK is initialized with merchant credentials
      if (!isInitialized) {
        const initRes = await PayPhiService.initSDK(
          order.envType || 'INT',
          order.aggregatorId || order.merchantId,
          order.appId,
          order.merchantName
        );

        if (!initRes.success) {
          return {
            success: false,
            error: `PayPhi SDK Init Failed (${initRes.code}): ${initRes.message}`,
          };
        }
      }

      console.log(`[PayPhiService] Launching PayphiSdk.makePayment for order: ${order.merchantTxnNo}, Amount: ${order.amount}`);

      PayphiSdk.makePayment({
        amount: order.amount,
        merchantId: order.merchantId,
        merchantTxnNo: order.merchantTxnNo,
        currencyCode: order.currencyCode,
        customerEmailID: order.customerEmail,
        secretKey: order.secureToken, // In the native module wrapper, secureToken is accepted/passed
        aggregatorID: order.aggregatorId,
        apiVersion: '4',
      });

      return { success: true };
    } catch (err: any) {
      console.error('[PayPhiService] startPayment error:', err);
      return { success: false, error: err.message || 'Payment initiation failed' };
    }
  },

  /**
   * Self-Healing Reconciliation:
   * Called on wallet load or app resume to check if the user has any unresolved pending transactions
   * (e.g. phone died or app crashed during payment) and recovers credits automatically.
   */
  reconcileUserPendingOrders: async (userId: string): Promise<boolean> => {
    try {
      if (!userId) return false;

      // Query if user has any pending purchase transactions in last 24 hours
      const { data: pendingTxs, error } = await supabase
        .from('credit_transactions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .eq('type', 'purchase')
        .order('id', { ascending: false })
        .limit(3);

      if (error || !pendingTxs || pendingTxs.length === 0) {
        return false;
      }

      console.log(`[PayPhiService] Found ${pendingTxs.length} pending orders for user. Running self-healing check...`);
      let recoveredAny = false;

      for (const tx of pendingTxs) {
        const { data: verifyResult } = await supabase.functions.invoke('verify-order', {
          body: {
            merchantTxnNo: tx.id,
          },
        });

        if (verifyResult?.status === 'paid' && verifyResult?.success) {
          console.log(`[PayPhiService] Successfully recovered orphan order ${tx.id} (+${verifyResult.credits} credits)!`);
          recoveredAny = true;
        }
      }

      if (recoveredAny) {
        await Database.refreshUserData(userId);
        await useWalletStore.getState().syncFromDB();
        useUserStore.getState().syncFromDB();
        useMembershipStore.getState().syncFromDB();
      }

      return recoveredAny;
    } catch (e) {
      console.warn('[PayPhiService] reconcileUserPendingOrders notice:', e);
      return false;
    }
  },
};
