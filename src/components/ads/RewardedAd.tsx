import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
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
let AdMobRewarded: any = null;
if (!isUnsupportedEnvironment()) {
  try {
    // Only import if we're not in an unsupported environment
    const { AdMobRewarded: AdMobModule } = require('expo-ads-admob');
    AdMobRewarded = AdMobModule;
  } catch (error) {
    console.warn('Failed to import AdMobRewarded:', error);
  }
}

interface RewardedAdProps {
  title?: string;
  onRewarded?: (type: string, amount: number) => void;
  onAdClosed?: () => void;
}

const RewardedAd: React.FC<RewardedAdProps> = ({
  title = 'Ver video para recompensa',
  onRewarded,
  onAdClosed
}) => {
  const [isLoading, setIsLoading] = useState(false);

  // Early return with simulated ad for unsupported environments
  if (isUnsupportedEnvironment() || !AdMobRewarded) {
    // Simple component for unsupported environments that just calls callbacks
    const handleSimulatedReward = () => {
      console.log('Simulating rewarded ad in unsupported environment');
      // Short timeout to simulate ad viewing
      setTimeout(() => {
        if (onRewarded) onRewarded('coins', 10);
        if (onAdClosed) onAdClosed();
      }, 500);
    };

    return (
      <TouchableOpacity
        style={[styles.button, styles.buttonReady]}
        onPress={handleSimulatedReward}
      >
        <Text style={styles.buttonText}>{title}</Text>
      </TouchableOpacity>
    );
  }

  // Función para mostrar anuncio con recompensa
  const showRewardedAd = async () => {
    setIsLoading(true);

    try {
      // ID del anuncio - usamos uno de prueba si estamos en desarrollo
      const adUnitID = __DEV__ 
        ? Platform.OS === 'ios' 
          ? 'ca-app-pub-3940256099942544/1712485313' // iOS test ID
          : 'ca-app-pub-3940256099942544/5224354917' // Android test ID
        : Platform.OS === 'ios'
          ? 'ca-app-pub-7380343766459097/4919204049' // iOS producción
          : 'ca-app-pub-7380343766459097/4919204049'; // Android producción
      
      // Configurar eventos
      AdMobRewarded.addEventListener('rewardedVideoDidRewardUser', (reward: {type?: string, amount?: number}) => {
        console.log('El usuario recibió una recompensa:', reward);
        if (onRewarded) {
          onRewarded(reward.type || 'coins', reward.amount || 10);
        }
      });
      
      AdMobRewarded.addEventListener('rewardedVideoDidClose', () => {
        console.log('El anuncio con recompensa se cerró');
        if (onAdClosed) onAdClosed();
        setIsLoading(false);
        // Limpiar listeners
        AdMobRewarded.removeAllListeners();
      });
      
      // Configurar y mostrar anuncio
      await AdMobRewarded.setAdUnitID(adUnitID);
      await AdMobRewarded.requestAdAsync();
      await AdMobRewarded.showAdAsync();
    } catch (error) {
      console.error('Error mostrando anuncio con recompensa:', error);
      setIsLoading(false);
      
      // En caso de error, simular recompensa si estamos en desarrollo
      if (__DEV__) {
        console.log('Simulando recompensa en entorno de desarrollo');
        if (onRewarded) onRewarded('coins', 10);
        if (onAdClosed) onAdClosed();
      }
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, styles.buttonReady]}
      onPress={showRewardedAd}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Text style={styles.buttonText}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  buttonReady: {
    backgroundColor: '#4A55A2',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RewardedAd; 