declare module 'react-native-payphi-sdk' {
  const PayphiSdk: {
    setAppInfo: (
      environment: string,
      merchantId: string,
      appId: string,
      merchantName: string
    ) => Promise<string>;
    addPaymentResponseListener: (
      callback: (response: any) => void
    ) => { remove: () => void };
    makePayment: (params: {
      amount: string;
      merchantId: string;
      merchantTxnNo: string;
      currencyCode: string;
      customerEmailID: string;
      secretKey: string;
      aggregatorID?: string;
      apiVersion?: string;
      allowVpa?: boolean;
    }) => void;
  };
  export default PayphiSdk;
}
