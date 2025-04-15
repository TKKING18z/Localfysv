import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { AdMobInterstitial } from 'expo-ads-admob';
import adMobConfig from '../../utils/adMobConfig';

interface UseInterstitialAdOptions {
  onAdOpened?: () => void;
  onAdClosed?: () => void;
  onAdFailedToLoad?: (error: string) => void;
}

export function useInterstitialAd(options?: UseInterstitialAdOptions) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Configurar el anuncio intersticial
  const setupInterstitial = async () => {
    try {
      // Imprimir el valor de adMobConfig para diagnosticar el problema
      console.log('AdMob Config:', JSON.stringify(adMobConfig, null, 2));
      
      // Verificar si adMobConfig e interstitial existen
      if (!adMobConfig) {
        throw new Error('adMobConfig no está definido');
      }
      
      // Usar un ID de prueba de AdMob si interstitial no está definido
      const adUnitID = adMobConfig.interstitial || 'ca-app-pub-3940256099942544/1033173712';
      console.log('Usando ID para anuncio intersticial:', adUnitID);
      
      // Configurar el anuncio con el ID
      await AdMobInterstitial.setAdUnitID(adUnitID);
      
      // Configurar los event listeners con nombres de eventos correctos
      try {
        // Limpiar todos los listeners para evitar duplicados
        AdMobInterstitial.removeAllListeners();
        
        // Añadir evento de carga exitosa
        AdMobInterstitial.addEventListener('interstitialDidLoad', () => {
          console.log('Anuncio intersticial cargado correctamente');
          setIsLoaded(true);
          setIsLoading(false);
          setError(null);
        });
        
        // Añadir evento de fallo en carga
        AdMobInterstitial.addEventListener('interstitialDidFailToLoad', (err: any) => {
          console.log('Anuncio intersticial falló al cargar:', err);
          setIsLoaded(false);
          setIsLoading(false);
          const errorMessage = err?.message || 'Error al cargar el anuncio';
          setError(errorMessage);
          options?.onAdFailedToLoad?.(errorMessage);
        });
        
        // Intentamos registrar el evento de apertura
        try {
          AdMobInterstitial.addEventListener('interstitialDidOpen', () => {
            console.log('Anuncio intersticial abierto');
            options?.onAdOpened?.();
          });
        } catch (e) {
          console.log('Error al configurar evento interstitialDidOpen, probando alternativa');
          // Si falla, podríamos intentar con un nombre alternativo en versiones futuras
        }
        
        // Intentamos registrar el evento de cierre
        try {
          AdMobInterstitial.addEventListener('interstitialDidClose', () => {
            console.log('Anuncio intersticial cerrado');
            setIsLoaded(false);
            options?.onAdClosed?.();
          });
        } catch (e) {
          console.log('Error al configurar evento interstitialDidClose');
          // Si falla, podríamos intentar con un nombre alternativo en versiones futuras
        }
      } catch (eventError) {
        console.error('Error configurando los eventos del anuncio:', eventError);
      }

    } catch (err: any) {
      const errorMessage = typeof err === 'string' ? err : err?.message || 'Error desconocido';
      console.error('Error configurando anuncio intersticial:', errorMessage);
      setError('Error configurando el anuncio: ' + errorMessage);
    }
  };

  // Cargar el anuncio
  const loadAd = async () => {
    if (isLoading || isLoaded) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      await AdMobInterstitial.requestAdAsync();
    } catch (err: any) {
      const errorMessage = typeof err === 'string' ? err : err?.message || 'Error desconocido';
      setError('Error solicitando el anuncio: ' + errorMessage);
      setIsLoading(false);
    }
  };

  // Mostrar el anuncio
  const showAd = async () => {
    if (!isLoaded) {
      return false;
    }

    try {
      await AdMobInterstitial.showAdAsync();
      return true;
    } catch (err: any) {
      const errorMessage = typeof err === 'string' ? err : err?.message || 'Error desconocido';
      setError('Error mostrando el anuncio: ' + errorMessage);
      return false;
    }
  };

  // Configurar el anuncio al montar el componente
  useEffect(() => {
    setupInterstitial();
    
    // Limpiar los listeners al desmontar
    return () => {
      AdMobInterstitial.removeAllListeners();
    };
  }, []);

  return {
    isLoaded,
    isLoading,
    error,
    loadAd,
    showAd
  };
} 