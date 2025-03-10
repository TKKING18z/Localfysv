import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { BusinessProvider } from './src/context/BusinessContext'; // Asegúrate de que esta importación es correcta
import { LocationProvider } from './src/context/LocationContext';
import firebase from 'firebase/compat/app';
import { firebaseConfig } from './src/config/firebase';

// Ignore specific warnings
LogBox.ignoreLogs([
  'Setting a timer',
  'AsyncStorage has been extracted',
  'Deprecation warning: value provided is not in a recognized RFC2822',
]);

// Initialize Firebase if not already initialized
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading resources
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FF' }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#333333' }}>Cargando Localfy...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <LocationProvider>
        <BusinessProvider>
          <StatusBar style="dark" />
          <AppNavigator />
        </BusinessProvider>
      </LocationProvider>
    </SafeAreaProvider>
  );
}