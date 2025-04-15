import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, LogBox, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { BusinessProvider } from './src/context/BusinessContext';
import { LocationProvider } from './src/context/LocationContext';
import { AuthProvider } from './src/context/AuthContext'; 
import { ThemeProvider } from './src/context/ThemeContext';
import { StoreProvider } from './src/context/StoreContext';
import { CartProvider } from './src/context/CartContext';
import { OrderProvider } from './src/context/OrderContext';
import { PointsProvider } from './src/context/PointsContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firebase from './firebase.config';
import 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { StripeProvider } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';

// Clave pública de Stripe en modo PRUEBA (sandbox)
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51RAPGb4eUIEuN4bhAQUTbCD3BaeC8rUOHz4ecJvZzqyiej8P7N8mCFeRpIvpJyWwltjo9L57YDZBjqjeLBvEkkt100FpoNKP3H';

// Ignorar advertencias específicas que no podemos controlar
LogBox.ignoreLogs([
  'Setting a timer',
  'AsyncStorage has been extracted',
  'Deprecation warning: value provided is not in a recognized RFC2822',
  'NativeEventEmitter',
  'ViewPropTypes will be removed',
]);

// Prevenir que la pantalla de splash se oculte automáticamente
SplashScreen.preventAutoHideAsync().catch(() => {
  /* revert to default behavior if something goes wrong */
});

// Define custom props interface for the AppNavigator
interface AppNavigatorProps {
  showOnboarding?: boolean;
  onboardingContext?: {
    completeOnboarding: () => Promise<boolean>;
  }
}

// Type assertion for AppNavigator
const TypedAppNavigator = AppNavigator as React.ComponentType<AppNavigatorProps>;

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasHydrated, setHasHydrated] = useState(false);
  // Force onboarding to always show during testing
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  // Restaurar estado desde almacenamiento local
  const hydrateState = async () => {
    try {
      // Aquí puedes restaurar cualquier estado necesario desde AsyncStorage
      await AsyncStorage.getItem('favorites');
      
      // Check if onboarding has been completed
      const onboardingCompleted = await AsyncStorage.getItem('onboarding_completed');
      if (onboardingCompleted === 'true') {
        setHasCompletedOnboarding(true);
      }
      
      // Verificar si hay información de sesión de usuario
      const userUid = await AsyncStorage.getItem('user_uid');
      if (userUid) {
        console.log('Found existing user session in AsyncStorage:', userUid);
        
        // Solo verificar Firestore si hay un usuario autenticado
        try {
          await firebase.firestore().collection('businesses').limit(1).get();
          console.log('Firestore connection successful');
        } catch (firestoreError) {
          console.warn('Firestore connection check failed:', firestoreError);
        }
      } else {
        console.log('No session found, skipping Firestore check');
      }
    } catch (error) {
      console.error('Error durante la hidratación del estado:', error);
    } finally {
      setHasHydrated(true);
    }
  };

  useEffect(() => {
    // Simular carga y restauración de estado
    const prepareApp = async () => {
      await hydrateState();
      
      // Maintain loading screen for at least 1.5 seconds for better UX
      const timer = setTimeout(() => {
        setIsLoading(false);
        // Hide the native splash screen after our loading is done
        SplashScreen.hideAsync().catch(() => {
          /* ignore if something goes wrong */
        });
      }, 1500);
      
      return () => clearTimeout(timer);
    };

    prepareApp();
  }, []);

  // Función para completar el onboarding
  const completeOnboarding = async () => {
    try {
      // For testing purposes, we don't actually save the onboarding completion status
      // This will make the onboarding appear every time
      console.log('Onboarding completado (modo test - no guardado)');
      
      // Store in AsyncStorage that onboarding is completed
      await AsyncStorage.setItem('onboarding_completed', 'true');
      
      setHasCompletedOnboarding(true);
      return true;
    } catch (error) {
      console.error('Error al completar onboarding:', error);
      return false;
    }
  };

  const onboardingContext = {
    completeOnboarding
  };

  // Show loading indicator while app is preparing
  if (isLoading || !hasHydrated) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#F5F7FF' 
      }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ 
          marginTop: 16, 
          fontSize: 16, 
          color: '#333333',
          fontWeight: '500' 
        }}>
          Cargando Localfy...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <StoreProvider>
        <AuthProvider>
          <StripeProvider
            publishableKey={STRIPE_PUBLISHABLE_KEY}
            merchantIdentifier="merchant.com.tu.app" // Solo necesario para Apple Pay
          >
            <ThemeProvider>
              <LocationProvider>
                <BusinessProvider>
                  <CartProvider>
                    <OrderProvider>
                      <PointsProvider>
                        <TypedAppNavigator 
                          showOnboarding={!hasCompletedOnboarding} 
                          onboardingContext={onboardingContext} 
                        />
                      </PointsProvider>
                    </OrderProvider>
                  </CartProvider>
                </BusinessProvider>
              </LocationProvider>
            </ThemeProvider>
          </StripeProvider>
        </AuthProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}