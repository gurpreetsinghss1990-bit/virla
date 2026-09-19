const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAndroidUpiAndMaps(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;

    // Ensure Google Maps API key meta-data exists in application
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

