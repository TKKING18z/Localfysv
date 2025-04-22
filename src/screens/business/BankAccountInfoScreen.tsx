import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useBusinessOnboarding } from '../../context/BusinessOnboardingContext';

// Define BankAccount type
interface BankAccount {
  bankName: string;
  accountHolder: string;
  accountType: string;
  accountNumber: string;
  duiNumber: string;
}

const BankAccountInfoScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { formState, setField } = useBusinessOnboarding();
  
  // State to control bank and account type selection modals
  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [accountTypeModalVisible, setAccountTypeModalVisible] = useState(false);
  
  // Initialize state with values from context if they exist
  const [bankInfo, setBankInfo] = useState<BankAccount>({
    bankName: '',
    accountHolder: '',
    accountType: 'Ahorro',
    accountNumber: '',
    duiNumber: '',
  });
  
  // Load data from context on mount if available
  useEffect(() => {
    try {
      // Use type assertion for the entire formState
      const extendedFormState = formState as any;
      if (extendedFormState.bankAccount) {
        setBankInfo({
          bankName: extendedFormState.bankAccount.bankName || '',
          accountHolder: extendedFormState.bankAccount.accountHolder || '',
          accountType: extendedFormState.bankAccount.accountType || 'Ahorro',
          accountNumber: extendedFormState.bankAccount.accountNumber || '',
          duiNumber: extendedFormState.bankAccount.duiNumber || '',
        });
      }
    } catch (error) {
      console.log('No existing bank account info found');
    }
  }, [formState]);
  
  // Available banks in El Salvador
  const banks = [
    'Seleccionar banco',
    'Banco Agrícola',
    'Banco Cuscatlán',
    'Banco Davivienda',
    'Banco de América Central (BAC)',
    'Banco Atlántida',
    'Banco Hipotecario',
    'Banco Azul',
    'Banco G&T Continental',
    'Banco Promerica',
    'Banco Industrial',
    'Otro'
  ];
  
  // Account types
  const accountTypes = [
    'Ahorro',
    'Corriente'
  ];
  
  const handleInputChange = (field: keyof BankAccount, value: string) => {
    setBankInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Handler for bank selection
  const handleBankSelect = (bank: string) => {
    handleInputChange('bankName', bank);
    setBankModalVisible(false);
  };
  
  // Handler for account type selection
  const handleAccountTypeSelect = (type: string) => {
    handleInputChange('accountType', type);
    setAccountTypeModalVisible(false);
  };
  
  const validateForm = () => {
    if (bankInfo.bankName === '' || bankInfo.bankName === 'Seleccionar banco') {
      Alert.alert('Error', 'Por favor selecciona un banco');
      return false;
    }
    
    if (bankInfo.accountHolder.trim() === '') {
      Alert.alert('Error', 'Por favor ingresa el nombre del titular de la cuenta');
      return false;
    }
    
    if (bankInfo.accountNumber.trim() === '') {
      Alert.alert('Error', 'Por favor ingresa el número de cuenta');
      return false;
    }
    
    if (bankInfo.duiNumber.trim() === '') {
      Alert.alert('Error', 'Por favor ingresa el número de DUI');
      return false;
    } else if (!/^\d{8}-\d$/.test(bankInfo.duiNumber)) {
      Alert.alert('Error', 'Por favor ingresa un DUI válido en formato XXXXXXXX-X');
      return false;
    }
    
    return true;
  };
  
  const handleSave = () => {
    if (validateForm()) {
      // Save to context using any type to bypass TypeScript checks
      // since bankAccount is not part of the original BusinessFormState
      (setField as any)('bankAccount', bankInfo);
      
      // Show success message
      Alert.alert(
        'Información guardada',
        'Tu información bancaria ha sido guardada correctamente.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    }
  };
  
  const formatDUI = (text: string) => {
    // Remove any non-digits
    const cleaned = text.replace(/\D/g, '');
    
    // Add the dash if we have 8 digits or more
    if (cleaned.length >= 9) {
      return `${cleaned.substring(0, 8)}-${cleaned.substring(8, 9)}`;
    }
    
    return cleaned;
  };
  
  const handleDUIChange = (text: string) => {
    const formatted = formatDUI(text);
    handleInputChange('duiNumber', formatted);
  };

  // Bank selection modal component
  const BankSelectionModal = () => {
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={bankModalVisible}
        onRequestClose={() => setBankModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecciona un banco</Text>
              <TouchableOpacity onPress={() => setBankModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#2D3748" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={banks.filter(bank => bank !== 'Seleccionar banco')}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.bankItem}
                  onPress={() => handleBankSelect(item)}
                >
                  <Text style={styles.bankItemText}>{item}</Text>
                  {bankInfo.bankName === item && (
                    <MaterialIcons name="check" size={22} color="#007AFF" />
                  )}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        </View>
      </Modal>
    );
  };
  
  // Account type selection modal component
  const AccountTypeSelectionModal = () => {
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={accountTypeModalVisible}
        onRequestClose={() => setAccountTypeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tipo de cuenta</Text>
              <TouchableOpacity onPress={() => setAccountTypeModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#2D3748" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={accountTypes}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.bankItem}
                  onPress={() => handleAccountTypeSelect(item)}
                >
                  <Text style={styles.bankItemText}>{item}</Text>
                  {bankInfo.accountType === item && (
                    <MaterialIcons name="check" size={22} color="#007AFF" />
                  )}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Información Bancaria</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView style={styles.scrollContainer}>
          <View style={styles.contentContainer}>
            <Text style={styles.title}>Ingresa tu información bancaria</Text>
            <Text style={styles.subtitle}>
              Esta información es necesaria para realizar los pagos semanales a tu negocio.
            </Text>
            
            <View style={styles.formContainer}>
              {/* Bank Selection - Custom Implementation */}
              <Text style={styles.inputLabel}>Banco</Text>
              <TouchableOpacity 
                style={styles.bankSelector}
                onPress={() => setBankModalVisible(true)}
              >
                <Text style={[
                  styles.bankSelectorText,
                  !bankInfo.bankName || bankInfo.bankName === 'Seleccionar banco' 
                    ? styles.placeholderText 
                    : {}
                ]}>
                  {!bankInfo.bankName || bankInfo.bankName === 'Seleccionar banco' 
                    ? 'Seleccionar banco' 
                    : bankInfo.bankName}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={24} color="#A0AEC0" />
              </TouchableOpacity>
              
              {/* Account Holder */}
              <Text style={styles.inputLabel}>Nombre del titular de la cuenta</Text>
              <TextInput
                style={styles.input}
                value={bankInfo.accountHolder}
                onChangeText={(text) => handleInputChange('accountHolder', text)}
                placeholder="Nombre como aparece en el banco"
                placeholderTextColor="#A0AEC0"
              />
              
              {/* Account Type - Custom Implementation */}
              <Text style={styles.inputLabel}>Tipo de cuenta</Text>
              <TouchableOpacity 
                style={styles.bankSelector}
                onPress={() => setAccountTypeModalVisible(true)}
              >
                <Text style={styles.bankSelectorText}>
                  {bankInfo.accountType}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={24} color="#A0AEC0" />
              </TouchableOpacity>
              
              {/* Account Number */}
              <Text style={styles.inputLabel}>Número de cuenta</Text>
              <TextInput
                style={styles.input}
                value={bankInfo.accountNumber}
                onChangeText={(text) => handleInputChange('accountNumber', text)}
                placeholder="Ingresa el número de cuenta completo"
                placeholderTextColor="#A0AEC0"
                keyboardType="numeric"
              />
              
              {/* DUI Number */}
              <Text style={styles.inputLabel}>Número de DUI (Documento Único de Identidad)</Text>
              <TextInput
                style={styles.input}
                value={bankInfo.duiNumber}
                onChangeText={handleDUIChange}
                placeholder="XXXXXXXX-X"
                placeholderTextColor="#A0AEC0"
                keyboardType="numeric"
                maxLength={10}
              />
              
              {/* Info Box */}
              <View style={styles.infoContainer}>
                <MaterialIcons name="info-outline" size={24} color="#007AFF" />
                <Text style={styles.infoText}>
                  Tu información bancaria es confidencial y solo será utilizada para realizar los pagos semanales por las ventas en Localfy.
                </Text>
              </View>
            </View>
            
            {/* Save Button */}
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>Guardar información</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        
        {/* Bank Selection Modal */}
        <BankSelectionModal />
        
        {/* Account Type Selection Modal */}
        <AccountTypeSelectionModal />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0A2463',
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0A2463',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#5E6A81',
    marginBottom: 24,
    lineHeight: 22,
  },
  formContainer: {
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#F7FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#2D3748',
  },
  pickerContainer: {
    backgroundColor: '#F7FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginBottom: 8,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  infoContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,122,255,0.1)',
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#2C3E50',
    marginLeft: 12,
    lineHeight: 20,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // New styles for bank selector
  bankSelector: {
    backgroundColor: '#F7FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bankSelectorText: {
    fontSize: 16,
    color: '#2D3748',
  },
  placeholderText: {
    color: '#A0AEC0',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0A2463',
  },
  bankItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  bankItemText: {
    fontSize: 16,
    color: '#2D3748',
  },
  separator: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginLeft: 16,
    marginRight: 16,
  }
});

export default BankAccountInfoScreen; 