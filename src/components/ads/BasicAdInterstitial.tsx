import React from 'react';
import { Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Constants from 'expo-constants';

interface BasicAdInterstitialProps {
  title?: string;
  style?: object;
  onClose?: () => void;
}

// Componente simple que simula un botón de anuncio cuando AdMob no está disponible
const BasicAdInterstitial: React.FC<BasicAdInterstitialProps> = ({
  title = 'Ver anuncio',
  style,
  onClose
}) => {
  // Determinar si estamos en un entorno donde AdMob no funciona
  const isUnsupportedEnvironment = () => {
    return (
      Platform.OS === 'web' || 
      Constants.executionEnvironment === 'storeClient' || // Expo Go
      !Constants.appOwnership || 
      Constants.appOwnership === 'expo'
    );
  };

  // Función simplificada para mostrar el anuncio (o simular)
  const showAd = () => {
    // Simplemente llamamos a onClose para simular que el anuncio se ha visto
    console.log('Simulating ad view in unsupported environment');
    if (onClose) {
      onClose();
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, styles.activeButton, style]}
      onPress={showAd}
    >
      <Text style={styles.buttonText}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeButton: {
    backgroundColor: '#4A55A2',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BasicAdInterstitial; 