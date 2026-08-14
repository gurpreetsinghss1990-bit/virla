// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ignore iCloud sync files to prevent infinite refresh loops on macOS
config.resolver.blockList = [
  /.*\.icloud$/,
  /node_modules\/.*\.node\.icloud$/,
  /\.git\/index\.lock$/
];

module.exports = withNativeWind(config, { input: './src/global.css' });


