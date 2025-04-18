import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { BusinessProvider } from './src/context/BusinessContext';
import { LocationProvider } from './src/context/LocationContext';
import { AuthProvider } from './src/context/AuthContext'; 
import { ThemeProvider } from './src/context/ThemeContext';
import { StoreProvider } from './src/context/StoreContext';
import { CartProvider } from './src/context/CartContext';
import { OrderProvider } from './src/context/OrderContext';
import { ChatProvider } from './src/context/ChatContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firebase from './firebase.config';
import 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { StripeProvider } from '@stripe/stripe-react-native';

// Clave pública de Stripe en modo PRUEBA (sandbox)
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51RAPGb4eUIEuN4bhAQUTbCD3BaeC8rUOHz4ecJvZzqyiej8P7N8mCFeRpIvpJyWwltjo9L57YDZBjqjeLBvEkkt100FpoNKP3H';

// Ignorar advertencias específicas que no podemos controlar
LogBox.ignoreLogs([
  'Setting a timer',
  'AsyncStorage has been extracted',
  'Deprecation warning: value provided is not in a recognized RFC2822',
  'NativeEventEmitter',
  'ViewPropTypes will be removed',
  // Añadir otras advertencias específicas de Expo SDK 52 que podamos necesitar ignorar
  'Linking API error:',
  'expo-constants is now autolinking',
  'expo-location requires',
  'react-native-safe-area-context changes'
]);

// Prevenir que la pantalla de splash se oculte automáticamente
SplashScreen.preventAutoHideAsync().catch((error) => {
  console.warn('Error preventing splash screen auto hide:', error);
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
      
      // Mantener pantalla de carga por al menos 1.5 segundos para mejor UX
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 1500);
      
      return () => clearTimeout(timer);
    };

    prepareApp();
  }, []);

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
                      <ChatProvider>
                        <AppNavigator />
                      </ChatProvider>
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