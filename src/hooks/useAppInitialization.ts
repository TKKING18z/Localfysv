// src/hooks/useAppInitialization.ts
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';

// Mantén la pantalla de splash visible mientras se carga la app
SplashScreen.preventAutoHideAsync();

export const useAppInitialization = () => {
  const [appIsReady, setAppIsReady] = useState(false);
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);

  useEffect(() => {
    async function prepare() {
      try {
        // Comprobar si es el primer lanzamiento
        const hasLaunched = await AsyncStorage.getItem('hasLaunched');
        setIsFirstLaunch(hasLaunched !== 'true');

        // Simular tiempo de carga para ver el splash screen
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.warn('Error durante la inicialización:', e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  const onNavigationReady = async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
    }
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem('hasLaunched', 'true');
      setIsFirstLaunch(false);
      return true;
    } catch (error) {
      console.error('Error al guardar estado de onboarding:', error);
      return false;
    }
  };

  return { appIsReady, isFirstLaunch, onNavigationReady, completeOnboarding };
};