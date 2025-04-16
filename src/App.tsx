import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, LogBox, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './navigation/AppNavigator';
import { BusinessProvider } from './context/BusinessContext';
import { LocationProvider } from './context/LocationContext';
import { AuthProvider } from './context/AuthContext'; 
import { ThemeProvider } from './context/ThemeContext';
import { StoreProvider } from './context/StoreContext';
import { CartProvider } from './context/CartContext';
import { OrderProvider } from './context/OrderContext';
import { PointsProvider } from './context/PointsContext';
import { OnboardingProvider } from './context/OnboardingContext';
import { BusinessOnboardingProvider } from './context/BusinessOnboardingContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firebase from '../firebase.config';
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

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasHydrated, setHasHydrated] = useState(false);

  // Restaurar estado desde almacenamiento local
  const hydrateState = async () => {
    try {
      // Aquí puedes restaurar cualquier estado necesario desde AsyncStorage
      await AsyncStorage.getItem('favorites');
      
      // Always enable the new business onboarding flow
      // This will ensure all users get the new experience
      await AsyncStorage.setItem('use_new_onboarding_flow', 'true');
      
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
          <OnboardingProvider>
            <BusinessOnboardingProvider>
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
                            <AppNavigator />
                          </PointsProvider>
                        </OrderProvider>
                      </CartProvider>
                    </BusinessProvider>
                  </LocationProvider>
                </ThemeProvider>
              </StripeProvider>
            </BusinessOnboardingProvider>
          </OnboardingProvider>
        </AuthProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
} 