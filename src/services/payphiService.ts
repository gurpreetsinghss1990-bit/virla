import PayphiSdk from 'react-native-payphi-sdk';
import { useWalletStore } from '../store/walletStore';

// 1. --- Configuration Dictionary matching ICICI Sample App ---
const MERCHANT_CONFIGS = {
  SAPPHIRE: {
    name: 'Sapphire Test',
    merchantId: '100000000007164',
    appId: '80bc18249511f868',
    merchantName: 'Test Merchant',
    defaultAmount: '20',
    secretKey: 'db06cca0-838b-4e01-8b20-6ac446ffb6bd',
    currencyCode: '356',
    aggregatorId: 'A100000000007164',
    startingEnv: 'INT',
  },
};

const activeConfig = MERCHANT_CONFIGS.SAPPHIRE;

let isInitialized = false;
let currentPendingPlan: { name: string; credits: number; priceText: string; totalText: string; gstText: string } | null = null;

export const PayPhiService = {
  initSDK: async (): Promise<{ success: boolean; code?: string; message?: string }> => {
    try {
      const aggId = activeConfig.aggregatorId;
      const merchantId = activeConfig.merchantId;
      const mId = aggId ? aggId : merchantId;
      const environment = activeConfig.startingEnv;
      const appId = activeConfig.appId;
      const merchantName = activeConfig.merchantName;

      console.log(`[SDK Init] Calling setAppInfo for ${environment}...`);
      console.log(`[SDK Init] Parameters -> mId: ${mId}, appId: ${appId}, merchantName: ${merchantName}`);

      const result = await PayphiSdk.setAppInfo(
        environment,
        mId,
        appId,
        merchantName
      );

      console.log(`[PayPhiService] Native setAppInfo Returned Raw Result:`, JSON.stringify(result));

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
      console.error(`[PayPhiService] setAppInfo Native Exception Catch:`);
      console.error(`  - Error Code:`, errCode);
      console.error(`  - Error Message:`, errMsg);
      console.error(`  - Full Error Object:`, JSON.stringify(error, Object.getOwnPropertyNames(error)));
      return { success: false, code: errCode, message: errMsg };
    }
  },

  registerResponseListener: (onSuccess: () => void, onFailure: (msg: string) => void) => {
    console.log('[PayPhiService] Registering Payment Response Listener...');
    const subscription = PayphiSdk.addPaymentResponseListener((response: any) => {
      console.log('[PayPhiService] Response Received:', response);

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

        if (isSuccessStatus) {
          if (currentPendingPlan) {
            useWalletStore.getState().purchasePlan(
              currentPendingPlan.name,
              currentPendingPlan.credits,
              currentPendingPlan.priceText,
              currentPendingPlan.totalText,
              currentPendingPlan.gstText
            );
            currentPendingPlan = null;
          }
          onSuccess();
        } else {
          currentPendingPlan = null;
          onFailure(message || 'Payment was cancelled or failed.');
        }
      } catch (e: any) {
        console.error('[PayPhiService] Parse Error:', e);
        currentPendingPlan = null;
        onFailure('Malformed payment response received.');
      }
    });

    return () => {
      subscription.remove();
    };
  },

  startPayment: async (
    plan: { name: string; credits: number; priceText: string; totalText: string; gstText: string; rawAmount: string },
    userEmail?: string
  ): Promise<{ success: boolean; error?: string }> => {
    // 1. Always attempt SDK Initialization first
    const initResult = await PayPhiService.initSDK();

    // 2. Strict Check: STOP if initialization fails
    if (!initResult.success) {
      console.error(`[PayPhiService] STOPPING: SDK Initialization Failed. Code: ${initResult.code}, Message: ${initResult.message}`);
      return {
        success: false,
        error: `PayPhi SDK Initialization Failed (${initResult.code}): ${initResult.message}`
      };
    }

    const txnNo = `TXN_${Date.now()}`;
    currentPendingPlan = plan;

    console.log(`[PayPhiService] SDK Initialized. Triggering makePayment for ${txnNo}...`);
    PayphiSdk.makePayment({
      amount: plan.rawAmount,
      merchantId: activeConfig.merchantId,
      merchantTxnNo: txnNo,
      currencyCode: activeConfig.currencyCode,
      customerEmailID: userEmail || 'test@example.com',
      secretKey: activeConfig.secretKey,
      aggregatorID: activeConfig.aggregatorId,
      apiVersion: '4',
    });

    return { success: true };
  }
};
