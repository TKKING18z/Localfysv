import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface PaymentMethodsProps {
  methods: string[];
}

const PaymentMethods: React.FC<PaymentMethodsProps> = ({ methods }) => {
  if (!methods || methods.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.noDataText}>Métodos de pago no especificados</Text>
      </View>
    );
  }
  
  // Función para obtener el ícono adecuado para cada método de pago
  const getPaymentIcon = (method: string) => {
    const methodLower = method.toLowerCase();
    
    if (methodLower.includes('efectivo')) return 'attach-money';
    if (methodLower.includes('tarjeta') || methodLower.includes('credito') || methodLower.includes('débito')) return 'credit-card';
    if (methodLower.includes('bitcoin') || methodLower.includes('crypto')) return 'currency-bitcoin';
    if (methodLower.includes('transferencia')) return 'account-balance';
    if (methodLower.includes('paypal')) return 'payment';
    
    // Ícono por defecto
    return 'payment';
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <MaterialIcons name="payment" size={20} color="#007AFF" />
        <Text style={styles.headerText}>Métodos de Pago</Text>
      </View>
      
      <View style={styles.methodsContainer}>
        {methods.map((method, index) => (
          <View key={index} style={styles.methodItem}>
            <MaterialIcons 
              name={getPaymentIcon(method) as any} 
              size={20} 
              color="#007AFF" 
            />
            <Text style={styles.methodText}>{method}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    color: '#333333',
  },
  methodsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  methodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  methodText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#333333',
  },
  noDataText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
  }
});

export default PaymentMethods;