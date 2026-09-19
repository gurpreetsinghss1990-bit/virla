const { withAndroidManifest } = require('@expo/config-plugins');

const UPI_PACKAGES = [
  'com.google.android.apps.nbu.paisa.user',
  'com.phonepe.app',
  'net.one97.paytm',
  'in.org.npci.upiapp',
  'in.amazon.mShop.android.shopping',
  'com.mobikwik_new',
  'com.freecharge.android',
  'club.cred',
  'com.myairtelapp',
  'com.hcl.payzapp',
  'com.icicibank.pockets',
  'com.csam.icici.bank.imobile',
  'com.sbi.upi',
  'com.axisbank.upi',
  'com.mipay.wallet.in',
  'com.navi.app',
  'com.ril.customerapp',
  'com.tatanew.app',
  'com.whatsapp',
  'com.whatsapp.w4b',
  'org.telegram.messenger',
  'com.truecaller',
];

module.exports = function withAndroidUpiAndMaps(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;

    // 1. Add QUERY_INTENT_PACKAGES permission
    if (!androidManifest['uses-permission']) {
      androidManifest['uses-permission'] = [];
    }
    const hasQueryPermission = androidManifest['uses-permission'].some(
      (perm) => perm.$?.['android:name'] === 'android.permission.QUERY_INTENT_PACKAGES'
    );
    if (!hasQueryPermission) {
      androidManifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.QUERY_INTENT_PACKAGES' },
      });
    }

    // 2. Add queries section for upi intent and specific UPI packages
    if (!androidManifest.queries) {
      androidManifest.queries = [];
    }

    let queriesObj = androidManifest.queries[0];
    if (!queriesObj) {
      queriesObj = { intent: [], package: [] };
      androidManifest.queries.push(queriesObj);
    }
    if (!queriesObj.intent) queriesObj.intent = [];
    if (!queriesObj.package) queriesObj.package = [];

    // upi scheme intent
    const hasUpiIntent = queriesObj.intent.some(
      (it) => it.data?.some((d) => d.$?.['android:scheme'] === 'upi')
    );
    if (!hasUpiIntent) {
      queriesObj.intent.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:scheme': 'upi' } }],
      });
    }

    // upi://pay intent with host
    const hasUpiPayIntent = queriesObj.intent.some(
      (it) => it.data?.some((d) => d.$?.['android:scheme'] === 'upi' && d.$?.['android:host'] === 'pay')
    );
    if (!hasUpiPayIntent) {
      queriesObj.intent.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:scheme': 'upi', 'android:host': 'pay' } }],
      });
    }

    // Add all UPI packages
    for (const pkg of UPI_PACKAGES) {
      const exists = queriesObj.package.some((p) => p.$?.['android:name'] === pkg);
      if (!exists) {
        queriesObj.package.push({
          $: { 'android:name': pkg },
        });
      }
    }

    // 3. Ensure Google Maps API key meta-data exists in application
    const app = androidManifest.application?.[0];
    if (app) {
      if (!app['meta-data']) {
        app['meta-data'] = [];
      }
      const mapsMeta = app['meta-data'].find(
        (m) => m.$?.['android:name'] === 'com.google.android.geo.API_KEY'
      );
      if (!mapsMeta) {
        app['meta-data'].push({
          $: {
            'android:name': 'com.google.android.geo.API_KEY',
            'android:value': 'AIzaSyDdj1e8_89sOmKK1qQoX_sLblKFyqkBxEA',
          },
        });
      }
    }

    return config;
  });
};
