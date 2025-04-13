import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BusinessFormState } from '../../hooks/business/useAddBusiness';

interface AdvancedSettingsSectionProps {
  formState: BusinessFormState;
  navigateToBusinessHours: () => void;
  navigateToPaymentMethods: () => void;
  navigateToSocialLinks: () => void;
  navigateToMenuEditor: () => void;
}

const AdvancedSettingsSection: React.FC<AdvancedSettingsSectionProps> = ({
  formState,
  navigateToBusinessHours,
  navigateToPaymentMethods,
  navigateToSocialLinks,
  navigateToMenuEditor
}) => {
  return (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>Configuración Avanzada</Text>
      
      <TouchableOpacity 
        style={styles.advancedButton}
        onPress={navigateToBusinessHours}
      >
        <View style={styles.advancedIconContainer}>
          <MaterialIcons name="access-time" size={24} color="#007aff" />
        </View>
        <Text style={styles.advancedButtonText}>Horarios de Atención</Text>
        <MaterialIcons 
          name="check-circle" 
          size={24} 
          color={formState.businessHours ? "#34C759" : "#E5E5EA"} 
        />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.advancedButton}
        onPress={navigateToPaymentMethods}
      >
        <View style={styles.advancedIconContainer}>
          <MaterialIcons name="payment" size={24} color="#007aff" />
        </View>
        <Text style={styles.advancedButtonText}>Métodos de Pago</Text>
        <MaterialIcons 
          name="check-circle" 
          size={24} 
          color={formState.paymentMethods && formState.paymentMethods.length > 0 ? "#34C759" : "#E5E5EA"} 
        />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.advancedButton}
        onPress={navigateToSocialLinks}
      >
        <View style={styles.advancedIconContainer}>
          <MaterialIcons name="link" size={24} color="#007aff" />
        </View>
        <Text style={styles.advancedButtonText}>Redes Sociales</Text>
        <MaterialIcons 
          name="check-circle" 
          size={24} 
          color={formState.socialLinks && Object.keys(formState.socialLinks).length > 0 ? "#34C759" : "#E5E5EA"} 
        />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.advancedButton}
        onPress={navigateToMenuEditor}
      >
        <View style={styles.advancedIconContainer}>
          <MaterialIcons name="restaurant-menu" size={24} color="#007aff" />
        </View>
        <Text style={styles.advancedButtonText}>Menú</Text>
        <MaterialIcons 
          name="check-circle" 
          size={24} 
          color={(formState.menu && formState.menu.length > 0 || formState.menuUrl) ? "#34C759" : "#E5E5EA"} 
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderLeftWidth: 3,
    borderLeftColor: '#007aff',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007aff',
    marginBottom: 20,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,122,255,0.1)',
  },
  advancedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F8FC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    shadowColor: '#8395A7',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  advancedIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(0,122,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  advancedButtonText: {
    fontSize: 16,
    color: '#2C3E50',
    marginLeft: 14,
    flex: 1,
    fontWeight: '500',
  },
});

export default AdvancedSettingsSection; 