import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface PaymentMethodsViewProps {
  methods: string[];
}

const PaymentMethodsView: React.FC<PaymentMethodsViewProps> = ({ methods }) => {
  // Return message if no payment methods available
  if (!methods || methods.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <MaterialIcons name="payment" size={20} color="#007AFF" />
          <Text style={styles.headerText}>Métodos de Pago</Text>
        </View>
        <Text style={styles.noDataText}>No hay información sobre métodos de pago</Text>
      </View>
    );
  }

  // Helper to get icon for payment method
  const getMethodIcon = (method: string): string => {
    const methodLower = method.toLowerCase();
    
    if (methodLower.includes('efectivo')) return 'attach-money';
    if (methodLower.includes('tarjeta') || methodLower.includes('crédito') || methodLower.includes('credito') || methodLower.includes('débito') || methodLower.includes('debito')) return 'credit-card';
    if (methodLower.includes('paypal')) return 'account-balance-wallet';
    if (methodLower.includes('bitcoin') || methodLower.includes('crypto')) return 'currency-bitcoin';
    if (methodLower.includes('transferencia')) return 'compare-arrows';
    if (methodLower.includes('apple')) return 'phone-iphone';
    if (methodLower.includes('google')) return 'android';
    
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
            <MaterialIcons name={getMethodIcon(method) as any} size={16} color="#007AFF" />
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
    marginHorizontal: -4,
  },
  methodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    margin: 4,
  },
  methodText: {
    fontSize: 14,
    color: '#333333',
    marginLeft: 6,
  },
  noDataText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
  }
});

export default PaymentMethodsView;