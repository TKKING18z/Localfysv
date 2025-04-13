import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BusinessFormState } from '../../hooks/business/useAddBusiness';
import { BusinessLocation } from '../../types/businessTypes';

interface ContactInfoSectionProps {
  formState: BusinessFormState;
  handlePhoneChange: (text: string) => void;
  openLocationPicker: () => Promise<void>;
  setAddress: (text: string) => void;
}

const ContactInfoSection: React.FC<ContactInfoSectionProps> = ({
  formState,
  handlePhoneChange,
  openLocationPicker,
  setAddress
}) => {
  return (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>Información de Contacto</Text>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Dirección</Text>
        <View style={styles.locationInputContainer}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={formState.address}
            onChangeText={(text) => setAddress(text)}
            placeholder="Calle, número, colonia..."
            placeholderTextColor="#8E8E93"
          />
          <TouchableOpacity 
            style={styles.locationButton}
            onPress={openLocationPicker}
          >
            <MaterialIcons name="map" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        {formState.location && (
          <Text style={styles.locationConfirmed}>
            <MaterialIcons name="check-circle" size={14} color="#34C759" /> Ubicación seleccionada correctamente
          </Text>
        )}
      </View>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Teléfono</Text>
        <TextInput
          style={[
            styles.input,
            formState.validationErrors.phone ? styles.inputError : null
          ]}
          value={formState.phone}
          onChangeText={handlePhoneChange}
          placeholder="+503 XXXX XXXX"
          placeholderTextColor="#8E8E93"
          keyboardType="phone-pad"
        />
        {formState.validationErrors.phone && (
          <Text style={styles.errorText}>{formState.validationErrors.phone}</Text>
        )}
      </View>
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
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: '#F6F8FC',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: '#2C3E50',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    shadowColor: '#8395A7',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  locationInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationButton: {
    marginLeft: 10,
    padding: 15,
    backgroundColor: '#007aff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  locationConfirmed: {
    fontSize: 13,
    color: '#34C759',
    marginTop: 8,
    fontWeight: '500',
  },
  inputError: {
    borderWidth: 1,
    borderColor: '#FF3B30',
    backgroundColor: '#FFF5F5',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 13,
    marginTop: 6,
    marginLeft: 4,
    fontWeight: '500',
  },
});

export default ContactInfoSection; 