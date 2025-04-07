import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native';
import { useAuth } from '../../context/AuthContext';

const BusinessOnboardingScreen = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const startOnboarding = async () => {
    setLoading(true);
    try {
      // Llamar a tu backend para crear una cuenta Connect
      const response = await fetch('https://tu-backend.com/create-connect-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.uid,
          businessId: 'ID_DEL_NEGOCIO', // Puedes obtenerlo de los parámetros o context
        }),
      });
      
      const { accountLinkUrl } = await response.json();
      
      // Abre el URL para completar el onboarding
      // En un entorno móvil, usa Linking de React Native
      Linking.openURL(accountLinkUrl);
    } catch (error) {
      console.error('Error al iniciar onboarding:', error);
      Alert.alert('Error', 'No se pudo iniciar el proceso de verificación.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Configurar pagos para tu negocio</Text>
      <Text style={styles.description}>
        Para recibir pagos a través de Localfy, necesitas conectar una cuenta bancaria
        y verificar tu identidad.
      </Text>
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={startOnboarding}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Comenzar verificación</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007BFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default BusinessOnboardingScreen;
