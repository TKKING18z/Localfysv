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
import { NetworkProvider } from './context/NetworkContext';
import { NotificationProvider } from './context/NotificationContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firebase from '../firebase.config';
import 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { StripeProvider } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';
import { enableScreens } from 'react-native-screens';
import { initializeApp, finishInitialization } from './services/AppInitService';

// Enable native screens implementation for better performance
enableScreens();

// Clave pública de Stripe en modo PRODUCCIÓN
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51RAPGWGP8yeC8Eoa0Q9uCljqPWu0XoN13tpQB9QM63v7vSE1BlT7SBHKKDgWAh7j3OQJRargIcP9rmfmZzqAvyBf004K3lFFMs';

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

// Enhanced hydration logic to include business cache status
async function hydrateStore() {
  try {
    // Check if we have cached business data
    const hasBusinessCache = await AsyncStorage.getItem('businessCache') !== null;
    
    // App state rehydration logic here
    return true;
  } catch (error) {
    console.warn('Error during store hydration:', error);
    return true; // Continue app startup despite error
  }
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasHydrated, setHasHydrated] = useState(false);

  // Initialize app with optimized caching
  useEffect(() => {
    async function prepare() {
      try {
        // Initialize the app
        await initializeApp({
          prefetchImages: true,
          processPendingUploads: true,
          clearCache: false, // Set to false to preserve our caches
          cacheExpirationDays: 7
        });
        
        // Hydrate store in parallel
        const storeHydrated = await hydrateStore();
        setHasHydrated(storeHydrated);
        
        // When everything is ready, mark loading as complete
        setIsLoading(false);
        
        // Short delay to hide splash screen for smooth transition
        setTimeout(async () => {
          await finishInitialization();
        }, 200);
      } catch (e) {
        console.warn('Error initializing app:', e);
        setIsLoading(false);
        await finishInitialization();
      }
    }

    prepare();
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
      <NetworkProvider>
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
                              <NotificationProvider>
                                <AppNavigator />
                              </NotificationProvider>
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
      </NetworkProvider>
    </SafeAreaProvider>
  );
} 