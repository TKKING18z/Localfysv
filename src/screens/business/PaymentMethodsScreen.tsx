import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  FlatList
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';

interface RouteParams {
  initialMethods?: string[];
  onSave: (methods: string[]) => void;
}

type PaymentMethodsRouteProp = RouteProp<{ params: RouteParams }, 'params'>;
type NavigationProp = StackNavigationProp<any>;

// Métodos de pago comunes
const commonPaymentMethods = [
  'Efectivo',
  'Tarjeta de Crédito',
  'Tarjeta de Débito',
  'PayPal',
  'Transferencia Bancaria',
  'Bitcoin',
  'Pago Móvil',
  'Apple Pay',
  'Google Pay'
];

const PaymentMethodsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<PaymentMethodsRouteProp>();
  const { initialMethods, onSave } = route.params;
  
  const [methods, setMethods] = useState<string[]>(initialMethods || []);
  const [newMethod, setNewMethod] = useState('');
  
  // Añadir nuevo método de pago
  const addMethod = (method: string) => {
    if (!method.trim()) return;
    
    if (methods.includes(method.trim())) {
      Alert.alert('Error', 'Este método de pago ya ha sido añadido');
      return;
    }
    
    setMethods([...methods, method.trim()]);
    setNewMethod('');
  };
  
  // Eliminar método de pago
  const removeMethod = (method: string) => {
    setMethods(methods.filter(m => m !== method));
  };
  
  // Añadir método común
  const addCommonMethod = (method: string) => {
    addMethod(method);
  };
  
  // Guardar cambios
  const handleSave = () => {
    onSave(methods);
    navigation.goBack();
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Métodos de Pago</Text>
        <TouchableOpacity 
          style={styles.saveButton}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>Guardar</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.scrollContent}>
        <View style={styles.infoBox}>
          <MaterialIcons name="info-outline" size={20} color="#007AFF" />
          <Text style={styles.infoText}>
            Añade los métodos de pago que aceptas en tu negocio para que tus clientes estén informados.
          </Text>
        </View>
        
        {/* Lista de métodos actuales */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Métodos Actuales</Text>
          
          {methods.length === 0 ? (
            <Text style={styles.emptyText}>No has añadido ningún método de pago.</Text>
          ) : (
            <View style={styles.methodsContainer}>
              {methods.map((method, index) => (
                <View key={index} style={styles.methodItem}>
                  <Text style={styles.methodText}>{method}</Text>
                  <TouchableOpacity 
                    style={styles.removeButton}
                    onPress={() => removeMethod(method)}
                  >
                    <MaterialIcons name="close" size={18} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
        
        {/* Añadir nuevo método */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Añadir Método</Text>
          
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={newMethod}
              onChangeText={setNewMethod}
              placeholder="Escribir método de pago..."
              placeholderTextColor="#8E8E93"
            />
            <TouchableOpacity 
              style={[
                styles.addButton,
                !newMethod.trim() ? styles.addButtonDisabled : {}
              ]}
              onPress={() => addMethod(newMethod)}
              disabled={!newMethod.trim()}
            >
              <MaterialIcons 
                name="add" 
                size={24} 
                color={newMethod.trim() ? "#FFFFFF" : "#AAAAAA"} 
              />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Métodos comunes */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Métodos Populares</Text>
          
          <View style={styles.commonMethodsContainer}>
            {commonPaymentMethods.map((method, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.commonMethodButton,
                  methods.includes(method) ? styles.commonMethodDisabled : {}
                ]}
                onPress={() => addCommonMethod(method)}
                disabled={methods.includes(method)}
              >
                <Text 
                  style={[
                    styles.commonMethodText,
                    methods.includes(method) ? styles.commonMethodTextDisabled : {}
                  ]}
                >
                  {method}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  scrollContent: {
    flex: 1,
    padding: 16,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E1F5FE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#0277BD',
  },
  sectionContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  methodsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  methodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F5',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  methodText: {
    fontSize: 14,
    color: '#333333',
  },
  removeButton: {
    marginLeft: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#F0F0F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333333',
    marginRight: 8,
  },
  addButton: {
    backgroundColor: '#007AFF',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#D1D1D6',
  },
  commonMethodsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  commonMethodButton: {
    backgroundColor: '#F0F0F5',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    margin: 4,
  },
  commonMethodDisabled: {
    backgroundColor: '#E5E5EA',
  },
  commonMethodText: {
    fontSize: 14,
    color: '#007AFF',
  },
  commonMethodTextDisabled: {
    color: '#8E8E93',
  },
});

export default PaymentMethodsScreen;