import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';

type PaymentScreenRouteProp = RouteProp<RootStackParamList, 'Payment'>;
type PaymentScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Payment'>;

// URL de tu servidor
const API_URL = 'https://tu-backend-stripe.herokuapp.com'; // Cambia esto por tu URL real

const PaymentScreen: React.FC = () => {
  const navigation = useNavigation<PaymentScreenNavigationProp>();
  const route = useRoute<PaymentScreenRouteProp>();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { user } = useAuth();
  
  // Estados
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'oxxo'>('card');
  
  const { businessId, businessName } = route.params || {};

  const handleBack = () => {
    navigation.goBack();
  };
  
  const fetchPaymentSheetParams = async () => {
    try {
      if (!amount || parseFloat(amount) <= 0) {
        Alert.alert('Error', 'Por favor ingresa un monto válido');
        return null;
      }
      
      const amountInCents = Math.round(parseFloat(amount) * 100);
      
      const response = await fetch(`${API_URL}/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInCents,
          currency: 'mxn', // o 'usd' según tu país
          paymentMethod,
          email: user?.email || '',
          businessId,
        }),
      });
      
      const { paymentIntent, ephemeralKey, customer } = await response.json();
      
      return {
        paymentIntent,
        ephemeralKey,
        customer,
      };
    } catch (error) {
      console.error('Error al crear intent de pago:', error);
      Alert.alert('Error', 'No se pudo procesar el pago. Por favor intenta más tarde.');
      return null;
    }
  };

  const initializePaymentSheet = async () => {
    try {
      setLoading(true);
      
      const params = await fetchPaymentSheetParams();
      if (!params) {
        setLoading(false);
        return;
      }
      
      const { error } = await initPaymentSheet({
        paymentIntentClientSecret: params.paymentIntent,
        customerEphemeralKeySecret: params.ephemeralKey,
        customerId: params.customer,
        merchantDisplayName: 'Localfy',
        allowsDelayedPaymentMethods: paymentMethod === 'oxxo',
        style: 'automatic',
      });
      
      if (error) {
        console.error('Error al inicializar payment sheet:', error);
        Alert.alert('Error', error.message);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error en initializePaymentSheet:', error);
      setLoading(false);
      Alert.alert('Error', 'Hubo un problema al inicializar el pago');
    }
  };

    const openPaymentSheet = async () => {
      if (!amount || parseFloat(amount) <= 0) {
        Alert.alert('Error', 'Por favor ingresa un monto válido');
        return;
      }
      
      try {
        await initializePaymentSheet();
        
        const { error } = await presentPaymentSheet();
        
        if (error) {
          if (error.code === 'Canceled') {
            // Usuario canceló, no mostrar alerta
            return;
          }
          console.error('Error en presentPaymentSheet:', error);
          Alert.alert('Error', error.message);
        } else {
          Alert.alert(
            'Pago exitoso',
            'Tu pago se ha procesado correctamente.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        }
      } catch (error) {
        console.error('Error al abrir payment sheet:', error);
        Alert.alert('Error', 'Hubo un problema al procesar el pago');
      }
    };
    
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="black" />
          </TouchableOpacity>
          <Text style={styles.title}>Pago a {businessName}</Text>
        </View>
        
        <ScrollView style={styles.content}>
          <View style={styles.formContainer}>
            <Text style={styles.label}>Monto a pagar (MXN)</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="numeric"
            />
            
            <View style={styles.paymentSelector}>
              <Text style={styles.label}>Método de pago</Text>
              <View style={styles.paymentOptions}>
                <TouchableOpacity
                  style={[styles.paymentOption, paymentMethod === 'card' && styles.selectedOption]}
                  onPress={() => setPaymentMethod('card')}
                >
                  <Text>Tarjeta</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.paymentOption, paymentMethod === 'oxxo' && styles.selectedOption]}
                  onPress={() => setPaymentMethod('oxxo')}
                >
                  <Text>OXXO</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.payButton} 
              onPress={openPaymentSheet}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.payButtonText}>Realizar Pago</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  };
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#fff',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#eee',
    },
    backButton: {
      marginRight: 10,
    },
    title: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    content: {
      flex: 1,
    },
    formContainer: {
      padding: 16,
    },
    label: {
      fontSize: 16,
      marginBottom: 8,
      fontWeight: '500',
    },
    input: {
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      marginBottom: 20,
    },
    paymentSelector: {
      marginBottom: 24,
    },
    paymentOptions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    paymentOption: {
      flex: 1,
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      padding: 12,
      alignItems: 'center',
      marginRight: 8,
    },
    selectedOption: {
      borderColor: '#007AFF',
      backgroundColor: '#F0F8FF',
    },
    payButton: {
      backgroundColor: '#007AFF',
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
    },
    payButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
    },
  });
  
  export default PaymentScreen;
