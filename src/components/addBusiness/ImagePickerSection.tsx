import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BusinessFormState } from '../../hooks/business/useAddBusiness';

interface ImagePickerSectionProps {
  formState: BusinessFormState;
  pickImage: () => Promise<void>;
}

const ImagePickerSection: React.FC<ImagePickerSectionProps> = ({
  formState,
  pickImage
}) => {
  return (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>Imagen Principal <Text style={styles.requiredMark}>*</Text></Text>
      <TouchableOpacity 
        style={[
          styles.imagePicker,
          formState.validationErrors.image ? styles.imagePickerError : null
        ]} 
        onPress={pickImage}
      >
        {formState.image ? (
          <Image 
            source={{ uri: formState.image }} 
            style={styles.selectedImage} 
            resizeMode="cover" 
          />
        ) : (
          <View style={styles.placeholderContainer}>
            <MaterialIcons name="add-photo-alternate" size={40} color="#007aff" />
            <Text style={styles.placeholderText}>Toca para seleccionar imagen</Text>
          </View>
        )}
      </TouchableOpacity>
      {formState.validationErrors.image && (
        <Text style={styles.errorText}>{formState.validationErrors.image}</Text>
      )}
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
  requiredMark: {
    color: '#FF3B30',
    fontWeight: 'bold',
  },
  imagePicker: {
    height: 220,
    backgroundColor: '#F6F8FC',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    borderStyle: 'dashed',
  },
  imagePickerError: {
    borderWidth: 1,
    borderColor: '#FF3B30',
    backgroundColor: '#FFF5F5',
  },
  selectedImage: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 12,
    fontSize: 16,
    color: '#007aff',
    fontWeight: '500',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 13,
    marginTop: 6,
    marginLeft: 4,
    fontWeight: '500',
  },
});

export default ImagePickerSection; 