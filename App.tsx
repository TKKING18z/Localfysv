import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { BusinessProvider } from './src/context/BusinessContext';
import { LocationProvider } from './src/context/LocationContext';
import { AuthProvider } from './src/context/AuthContext'; 
import { ThemeProvider } from './src/context/ThemeContext';
import { StoreProvider } from './src/context/StoreContext'; // Importar el nuevo context
import AsyncStorage from '@react-native-async-storage/async-storage';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC2S36sPSd2XEJmxxkqJ-lQUJc7ySL5Uvw",
  authDomain: "testlocalfysv25.firebaseapp.com",
  projectId: "testlocalfysv25",
  storageBucket: "testlocalfysv25.firebasestorage.app",
  messagingSenderId: "281205862532",
  appId: "1:281205862532:web:aa25ca39606dda5db6d2d1",
  measurementId: "G-Z7V3LK64ZL"
};

// Ignorar advertencias específicas que no podemos controlar
LogBox.ignoreLogs([
  'Setting a timer',
  'AsyncStorage has been extracted',
  'Deprecation warning: value provided is not in a recognized RFC2822',
  'NativeEventEmitter',
  'ViewPropTypes will be removed'
]);

// Inicializar Firebase si no está ya inicializado
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

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
      await AsyncStorage.getItem('favorites'); // Solo verificamos que podemos acceder
      
      // Comprobar si la base de datos de Firebase está accesible
      await firebase.firestore().collection('test').doc('test').get();
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
        SplashScreen.hideAsync().catch(() => {
          /* ignore if something goes wrong */
        });
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
          <ThemeProvider>
            <LocationProvider>
              <BusinessProvider>
                <AppNavigator />
              </BusinessProvider>
            </LocationProvider>
          </ThemeProvider>
        </AuthProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}