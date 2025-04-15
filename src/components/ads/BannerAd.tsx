import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Constants from 'expo-constants';

// Check if we're in Expo Go or web
const isUnsupportedEnvironment = () => {
  return (
    Platform.OS === 'web' || 
    Constants.executionEnvironment === 'storeClient' || // Expo Go
    !Constants.appOwnership || 
    Constants.appOwnership === 'expo'
  );
};

// Conditionally import AdMob
let AdMobBanner: any = null;
if (!isUnsupportedEnvironment()) {
  try {
    // Only import if we're not in an unsupported environment
    const { AdMobBanner: AdMobModule } = require('expo-ads-admob');
    AdMobBanner = AdMobModule;
  } catch (error) {
    console.warn('Failed to import AdMobBanner:', error);
  }
}

interface BannerAdProps {
  adUnitID?: string;
  testID?: string;
  style?: object;
}

const BannerAd: React.FC<BannerAdProps> = ({ adUnitID, testID, style }) => {
  // Return empty view in unsupported environments
  if (isUnsupportedEnvironment() || !AdMobBanner) {
    return <View style={[styles.container, style, { height: 50 }]} />;
  }

  // ID del anuncio - usamos uno de prueba si estamos en desarrollo
  const bannerID = adUnitID || (
    __DEV__ 
      ? Platform.OS === 'ios' 
        ? 'ca-app-pub-3940256099942544/2934735716' // iOS test ID
        : 'ca-app-pub-3940256099942544/6300978111' // Android test ID
      : Platform.OS === 'ios'
        ? 'ca-app-pub-7380343766459097/3946780661' // iOS producción
        : 'ca-app-pub-7380343766459097/3946780661' // Android producción
  );

  return (
    <View style={[styles.container, style]}>
      <AdMobBanner
        adUnitID={bannerID}
        servePersonalizedAds
        testDeviceID={testID}
        onDidFailToReceiveAdWithError={(error: string) => console.warn('Banner ad failed to load:', error)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
});

export default BannerAd; 