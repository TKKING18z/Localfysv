// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Include all js/jsx/ts/tsx files and exclude node_modules
config.resolver.sourceExts = ['js', 'jsx', 'ts', 'tsx', 'json'];
config.resolver.assetExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'mp4', 'mp3', 'wav', 'ttf'];

// Increase max workers to improve bundling performance
config.maxWorkers = 4;

// Add the path to the node_modules folder to the watchFolders
config.watchFolders = [__dirname, `${__dirname}/node_modules`];

// Exclude all files from functions directory
config.resolver.blockList = [/functions_backup\/.*/];

// Fix for idb issue with Firebase
config.resolver.extraNodeModules = {
  'idb': path.resolve(__dirname, 'polyfills/idb.js')
};

// Add resolver to handle .cjs files and missing Firebase modules
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Specific fix for idb module referenced in Firebase
  if (moduleName === 'idb' || (moduleName.endsWith('index.cjs') && moduleName.includes('idb'))) {
    return {
      filePath: path.resolve(__dirname, 'polyfills/idb.js'),
      type: 'sourceFile',
    };
  }

  // Fix for missing postinstall.mjs in @firebase/util
  if (moduleName === './postinstall.mjs' && context.originModulePath.includes('@firebase/util')) {
    return {
      filePath: path.resolve(__dirname, 'polyfills/postinstall.mjs'),
      type: 'sourceFile',
    };
  }

  // Let Metro handle everything else
  return context.resolveRequest(context, moduleName, platform);
};

// Enable symlinks to work properly (helps with npm link and workspaces)
config.resolver.resolveSymlinksRelativeToRoot = true;

module.exports = config;