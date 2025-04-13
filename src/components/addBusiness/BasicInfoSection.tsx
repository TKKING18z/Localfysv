import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { BusinessFormState } from '../../hooks/business/useAddBusiness';

interface BasicInfoSectionProps {
  formState: BusinessFormState;
  suggestedCategories: string[];
  showSuggestions: boolean;
  handleNameChange: (text: string) => void;
  handleDescriptionChange: (text: string) => void;
  updateCategorySuggestions: (text: string) => void;
  selectCategory: (category: string) => void;
}

const BasicInfoSection: React.FC<BasicInfoSectionProps> = ({
  formState,
  suggestedCategories,
  showSuggestions,
  handleNameChange,
  handleDescriptionChange,
  updateCategorySuggestions,
  selectCategory
}) => {
  return (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>Información Básica</Text>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Nombre del Negocio <Text style={styles.requiredMark}>*</Text></Text>
        <TextInput
          style={[
            styles.input,
            formState.validationErrors.name ? styles.inputError : null
          ]}
          value={formState.name}
          onChangeText={handleNameChange}
          placeholder="Ej: Cafetería El Aroma"
          placeholderTextColor="#8E8E93"
          maxLength={100}
        />
        {formState.validationErrors.name && (
          <Text style={styles.errorText}>{formState.validationErrors.name}</Text>
        )}
      </View>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Descripción <Text style={styles.requiredMark}>*</Text></Text>
        <TextInput
          style={[
            styles.input, 
            styles.textArea,
            formState.validationErrors.description ? styles.inputError : null
          ]}
          value={formState.description}
          onChangeText={handleDescriptionChange}
          placeholder="Describe servicios, especialidad, ventajas..."
          placeholderTextColor="#8E8E93"
          multiline={true}
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={500}
        />
        {formState.validationErrors.description && (
          <Text style={styles.errorText}>{formState.validationErrors.description}</Text>
        )}
      </View>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Categoría <Text style={styles.requiredMark}>*</Text></Text>
        <TextInput
          style={[
            styles.input, 
            formState.validationErrors.category ? styles.inputError : null,
            showSuggestions && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }
          ]}
          value={formState.category}
          onChangeText={updateCategorySuggestions}
          placeholder="Busca o escribe una categoría"
          placeholderTextColor="#8E8E93"
          maxLength={50}
        />
        {formState.validationErrors.category && (
          <Text style={styles.errorText}>{formState.validationErrors.category}</Text>
        )}
        {showSuggestions && (
          <View style={styles.suggestionsContainer}>
            <ScrollView 
              style={styles.suggestionsList}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
            >
              {suggestedCategories.map((suggestion, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.suggestionItem}
                  onPress={() => selectCategory(suggestion)}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
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
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  requiredMark: {
    color: '#FF3B30',
    fontWeight: 'bold',
  },
  suggestionsContainer: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderTopWidth: 0,
    maxHeight: 200,
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F7FF',
  },
  suggestionText: {
    fontSize: 16,
    color: '#2C3E50',
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

export default BasicInfoSection; 