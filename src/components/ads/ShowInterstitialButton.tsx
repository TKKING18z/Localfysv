import React, { useEffect, useState } from 'react';
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
let AdMobInterstitial: any = null;
if (!isUnsupportedEnvironment()) {
  try {
    // Only import if we're not in an unsupported environment
    const { AdMobInterstitial: AdMobModule } = require('expo-ads-admob');
    AdMobInterstitial = AdMobModule;
  } catch (error) {
    console.warn('Failed to import AdMobInterstitial:', error);
  }
}

interface ShowInterstitialButtonProps {
  title?: string;
  onAdClosed?: () => void;
  onAdDisplayed?: () => void;
}

const ShowInterstitialButton: React.FC<ShowInterstitialButtonProps> = ({
  title = 'Ver anuncio',
  onAdClosed,
  onAdDisplayed
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Early return with simulated ad for unsupported environments
  if (isUnsupportedEnvironment() || !AdMobInterstitial) {
    // Simple component for unsupported environments that just calls onAdClosed
    const handleSimulatedAd = () => {
      console.log('Simulating ad view in unsupported environment');
      if (onAdDisplayed) onAdDisplayed();
      // Short timeout to simulate ad viewing
      setTimeout(() => {
        if (onAdClosed) onAdClosed();
      }, 500);
    };

    return (
      <TouchableOpacity
        style={[styles.button, styles.buttonReady]}
        onPress={handleSimulatedAd}
      >
        <Text style={styles.buttonText}>{title}</Text>
      </TouchableOpacity>
    );
  }

  // Prepara el anuncio
  useEffect(() => {
    // Función asíncrona para configurar el anuncio
    const prepareAd = async () => {
      try {
        // Limpiar cualquier anuncio anterior
        setIsLoading(true);
        await AdMobInterstitial.removeAllListeners();
        
        // ID del anuncio - usamos uno de prueba si estamos en desarrollo
        const adUnitID = __DEV__ 
          ? Platform.OS === 'ios' 
            ? 'ca-app-pub-3940256099942544/4411468910' // iOS test ID
            : 'ca-app-pub-3940256099942544/1033173712' // Android test ID
          : Platform.OS === 'ios'
            ? 'ca-app-pub-7380343766459097/4919204049' // iOS producción
            : 'ca-app-pub-7380343766459097/4919204049'; // Android producción
            
        console.log('Configurando anuncio intersticial con ID:', adUnitID);
            
        // Configurar el anuncio
        await AdMobInterstitial.setAdUnitID(adUnitID);
                
        // Configurar eventos
        AdMobInterstitial.addEventListener('interstitialDidLoad', () => {
          console.log('Anuncio intersticial cargado');
          setIsLoaded(true);
          setIsLoading(false);
        });
        
        AdMobInterstitial.addEventListener('interstitialDidFailToLoad', (error: Error) => {
          console.error('Error al cargar anuncio intersticial:', error);
          setIsLoaded(false);
          setIsLoading(false);
        });
        
        AdMobInterstitial.addEventListener('interstitialDidOpen', () => {
          console.log('Anuncio intersticial abierto');
          if (onAdDisplayed) onAdDisplayed();
        });
        
        AdMobInterstitial.addEventListener('interstitialDidClose', () => {
          console.log('Anuncio intersticial cerrado');
          setIsLoaded(false);
          if (onAdClosed) onAdClosed();
          // Recargar un nuevo anuncio
          loadAd();
        });
        
        // Iniciar carga del anuncio
        await AdMobInterstitial.requestAdAsync();
      } catch (error) {
        console.error('Error preparando anuncio intersticial:', error);
        setIsLoaded(false);
        setIsLoading(false);
      }
    };
    
    // Preparar el anuncio al montar el componente
    prepareAd();
    
    // Limpiar al desmontar
    return () => {
      AdMobInterstitial.removeAllListeners();
    };
  }, [onAdClosed, onAdDisplayed]);
  
  // Función para cargar un anuncio
  const loadAd = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      await AdMobInterstitial.requestAdAsync();
    } catch (error) {
      console.error('Error al solicitar anuncio intersticial:', error);
      setIsLoading(false);
    }
  };
  
  // Función para mostrar el anuncio
  const handleShowAd = async () => {
    try {
      if (isLoaded) {
        await AdMobInterstitial.showAdAsync();
      } else {
        console.log('El anuncio no está cargado todavía');
        if (!isLoading) {
          loadAd();
        }
      }
    } catch (error) {
      console.error('Error al mostrar anuncio intersticial:', error);
    }
  };
  
  return (
    <TouchableOpacity
      style={[styles.button, isLoaded ? styles.buttonReady : styles.buttonLoading]}
      onPress={handleShowAd}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Text style={styles.buttonText}>{isLoaded ? title : 'Cargando anuncio...'}</Text>
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
  buttonLoading: {
    backgroundColor: '#7F8AC2',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ShowInterstitialButton; 