// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ignore iCloud sync files to prevent infinite refresh loops on macOS
config.resolver.blockList = [
  /.*\.icloud$/,
  /node_modules\/.*\.node\.icloud$/,
  /\.git\/index\.lock$/
];

const mapsMockPath = path.resolve(__dirname, 'src/mocks/react-native-maps.web.js');
const payphiMockPath = path.resolve(__dirname, 'src/mocks/react-native-payphi-sdk.web.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    if (moduleName === 'react-native-maps') {
      return {
        filePath: mapsMockPath,
        type: 'sourceFile',
      };
    }
    if (moduleName === 'react-native-payphi-sdk') {
      return {
        filePath: payphiMockPath,
        type: 'sourceFile',
      };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './src/global.css' });
