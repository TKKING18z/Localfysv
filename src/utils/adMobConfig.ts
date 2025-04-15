import { Platform } from 'react-native';

// Determine if we're in development/testing mode
const isDevelopment = __DEV__;

// Test IDs from Google AdMob documentation
// https://developers.google.com/admob/android/test-ads
// https://developers.google.com/admob/ios/test-ads
const testIds = {
  // Test app IDs
  appId: {
    ios: 'ca-app-pub-3940256099942544~1458002511',
    android: 'ca-app-pub-3940256099942544~3347511713',
  },
  // Test banner ad units
  banner: {
    ios: 'ca-app-pub-3940256099942544/2934735716',
    android: 'ca-app-pub-3940256099942544/6300978111',
  },
  // Test interstitial ad units
  interstitial: {
    ios: 'ca-app-pub-3940256099942544/4411468910',
    android: 'ca-app-pub-3940256099942544/1033173712',
  },
  // Test rewarded ad units
  rewarded: {
    ios: 'ca-app-pub-3940256099942544/1712485313',
    android: 'ca-app-pub-3940256099942544/5224354917',
  },
};

// Production IDs - Replace these with your actual IDs from the AdMob console
const prodIds = {
  appId: {
    ios: 'ca-app-pub-7380343766459097~4423545874', // ID de aplicación proporcionado
    android: 'ca-app-pub-7380343766459097~4423545874', // ID de aplicación proporcionado
  },
  banner: {
    ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY', // Reemplazar con tu ID real
    android: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY', // Reemplazar con tu ID real
  },
  interstitial: {
    ios: 'ca-app-pub-7380343766459097/4919204049', // ID intersticial proporcionado
    android: 'ca-app-pub-7380343766459097/4919204049', // ID intersticial proporcionado
  },
  rewarded: {
    ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY', // Reemplazar con tu ID real
    android: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY', // Reemplazar con tu ID real
  },
};

// Choose which set of IDs to use
const adMobIds = isDevelopment ? testIds : prodIds;

// Export the IDs for the current platform
export default {
  appId: Platform.OS === 'ios' ? adMobIds.appId.ios : adMobIds.appId.android,
  banner: Platform.OS === 'ios' ? adMobIds.banner.ios : adMobIds.banner.android,
  interstitial: Platform.OS === 'ios' ? adMobIds.interstitial.ios : adMobIds.interstitial.android,
  rewarded: Platform.OS === 'ios' ? adMobIds.rewarded.ios : adMobIds.rewarded.android,
}; 