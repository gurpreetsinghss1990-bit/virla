const {
  withAndroidManifest,
  withAppBuildGradle,
  withProjectBuildGradle,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PAYPHI_PROGUARD_RULES = `
# PayPhi SDK Rules
-dontwarn org.bouncycastle.jsse.BCSSLParameters 
-dontwarn org.bouncycastle.jsse.BCSSLSocket 
-dontwarn org.bouncycastle.jsse.provider.BouncyCastleJsseProvider 
-dontwarn org.conscrypt.Conscrypt$Version 
-dontwarn org.conscrypt.Conscrypt 
-dontwarn org.conscrypt.ConscryptHostnameVerifier 
-dontwarn org.openjsse.javax.net.ssl.SSLParameters 
-dontwarn org.openjsse.javax.net.ssl.SSLSocket 
-dontwarn org.openjsse.net.ssl.OpenJSSE 
-dontwarn kotlinx.parcelize.Parcelize 

-keep,allowoptimization,allowshrinking,allowobfuscation class kotlin.coroutines.Continuation 
-keep,allowoptimization,allowshrinking,allowobfuscation class retrofit2.Response 
-keep class com.payphi.** { *; }
`;

module.exports = function withAndroidUpiAndMaps(config) {
  // 1. AndroidManifest modifications
  config = withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;
    if (!androidManifest.$) {
      androidManifest.$ = {};
    }
    if (!androidManifest.$['xmlns:tools']) {
      androidManifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    const app = androidManifest.application?.[0];
    if (app) {
      if (!app.$) app.$ = {};
      app.$['android:usesCleartextTraffic'] = 'true';
      app.$['tools:replace'] = 'android:allowBackup,android:usesCleartextTraffic';

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

  // 2. app/build.gradle: enable viewBinding & dataBinding
  config = withAppBuildGradle(config, async (config) => {
    let contents = config.modResults.contents;
    if (!contents.includes('buildFeatures {')) {
      contents = contents.replace(
        /android\s*\{/,
        `android {\n    buildFeatures {\n        viewBinding true\n        dataBinding true\n    }`
      );
    } else if (!contents.includes('viewBinding')) {
      contents = contents.replace(
        /buildFeatures\s*\{/,
        `buildFeatures {\n        viewBinding true\n        dataBinding true`
      );
    }
    config.modResults.contents = contents;
    return config;
  });

  // 3. android/build.gradle: add kotlinVersion & flatDir
  config = withProjectBuildGradle(config, async (config) => {
    let contents = config.modResults.contents;
    if (!contents.includes('kotlinVersion')) {
      if (contents.includes('buildscript {')) {
        contents = contents.replace(
          /buildscript\s*\{/,
          `buildscript {\n  ext {\n    kotlinVersion = "2.2.0"\n  }`
        );
      }
    }
    if (!contents.includes('react-native-payphi-sdk/android/libs')) {
      const flatDirSnippet = `    flatDir {\n      dirs "$rootDir/../node_modules/react-native-payphi-sdk/android/libs"\n    }\n`;
      if (contents.includes('repositories {')) {
        contents = contents.replace(
          /allprojects\s*\{\s*repositories\s*\{/,
          `allprojects {\n  repositories {\n${flatDirSnippet}`
        );
      }
    }
    config.modResults.contents = contents;
    return config;
  });

  // 4. proguard-rules.pro: ensure PayPhi keep rules
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const proguardPath = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'proguard-rules.pro'
      );
      if (fs.existsSync(proguardPath)) {
        let proguardContent = fs.readFileSync(proguardPath, 'utf8');
        if (!proguardContent.includes('com.payphi.**')) {
          proguardContent += `\n${PAYPHI_PROGUARD_RULES}\n`;
          fs.writeFileSync(proguardPath, proguardContent, 'utf8');
        }
      }
      return config;
    },
  ]);

  return config;
};
