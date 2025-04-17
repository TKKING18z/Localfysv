import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useBusinessOnboarding } from '../../../context/BusinessOnboardingContext';
import { BUSINESS_CATEGORIES } from '../../../hooks/business/useAddBusiness';
import LocationMapModal from '../../../components/addBusiness/LocationMapModal';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../../context/AuthContext';

// Validación simple para permitir datos parciales
const validateField = (field: string, value: any): string => {
  if (field === 'email' && value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Formato de correo electrónico inválido';
    }
  }
  return '';
};

const BasicInfoStep: React.FC = () => {
  // Añadir hook de navegación
  const navigation = useNavigation();
  
  const { 
    formState, 
    setField,
    markStepComplete
  } = useBusinessOnboarding();
  
  const { user } = useAuth();
  
  // Estado local para UI fluida
  const [localForm, setLocalForm] = useState({
    name: formState.name || '',
    category: formState.category || '',
    phone: formState.phone || '',
    email: formState.email || '',
    address: formState.address || '',
    location: formState.location || null
  });
  
  // Estados de UI
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestedCategories, setSuggestedCategories] = useState<string[]>([]);
  const [mapVisible, setMapVisible] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: 13.6929,
    longitude: -89.2182,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [markerLocation, setMarkerLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Sincronizar estado local con el contexto global cuando cambia el contexto
  useEffect(() => {
    console.log("Sincronizando formulario con datos del contexto:", JSON.stringify(formState));
    setLocalForm({
      name: formState.name || '',
      category: formState.category || '',
      phone: formState.phone || '',
      email: formState.email || '',
      address: formState.address || '',
      location: formState.location || null
    });
    
    if (formState.location) {
      setMarkerLocation(formState.location);
    }
  }, [formState]);

  // Actualizar campo local y en contexto global inmediatamente
  const updateField = useCallback((field: keyof typeof localForm, value: any) => {
    // Update local state for responsive UI
    setLocalForm(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Update global context state immediately
    setField(field, value);
    
    // Validación simple en tiempo real
    if (touchedFields[field as string]) {
      const error = validateField(field as string, value);
      setErrors(prev => ({
        ...prev,
        [field]: error
      }));
    }
  }, [touchedFields, setField]);

  // Marcar campo como tocado
  const markFieldAsTouched = useCallback((field: string) => {
    setTouchedFields(prev => ({
      ...prev,
      [field]: true
    }));
  }, []);
  
  // Guardado y navegación
  const saveAndContinue = useCallback(async () => {
    try {
      setIsSaving(true);
      
      // Verificar datos mínimos requeridos
      if (!localForm.name) {
        Alert.alert("Nombre requerido", "Por favor ingresa el nombre del negocio para continuar.");
        setIsSaving(false);
        return;
      }
      
      if (!localForm.category) {
        Alert.alert("Categoría requerida", "Por favor selecciona una categoría para continuar.");
        setIsSaving(false);
        return;
      }
      
      // No need to update the context again since we're already updating on each field change
      // This reduces duplicate updates and potential race conditions
      
      // Intentar guardar en AsyncStorage como respaldo
      try {
        const backupData = {
          ...localForm,
          timestamp: new Date().toISOString(),
          userId: user?.uid || 'unknown'
        };
        
        await AsyncStorage.setItem('localfy_business_draft_backup', JSON.stringify(backupData));
        console.log("Datos guardados localmente como respaldo");
      } catch (storageError) {
        console.error("Error al guardar en AsyncStorage:", storageError);
        // Continuar aunque falle el guardado local
      }
      
      // Marcar el paso como completado
      markStepComplete('basicInfo');
      
      setIsSaving(false);
    } catch (error) {
      console.error("Error durante el proceso:", error);
      
      // Incluso si hay un error, intentar marcar como completado
      markStepComplete('basicInfo');
      
      setIsSaving(false);
    }
  }, [localForm, markStepComplete, user]);

  // Handlers para campos
  const handleNameChange = (text: string) => {
    updateField('name', text);
  };
  
  const handleCategoryChange = (text: string) => {
    updateField('category', text);
    
    if (text.length > 0) {
      const filtered = BUSINESS_CATEGORIES.filter(
        cat => cat.toLowerCase().includes(text.toLowerCase())
      ).slice(0, 5);
      
      setSuggestedCategories(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setSuggestedCategories([]);
      setShowSuggestions(false);
    }
  };
  
  const selectCategory = (category: string) => {
    updateField('category', category);
    markFieldAsTouched('category');
    setSuggestedCategories([]);
    setShowSuggestions(false);
  };
  
  const handlePhoneChange = (text: string) => {
    // Limpiar caracteres no válidos
    const cleanedText = text.replace(/[^\d+\s()-]/g, '');
    updateField('phone', cleanedText);
  };
  
  const handleAddressChange = (text: string) => {
    updateField('address', text);
  };
  
  const handleEmailChange = (text: string) => {
    updateField('email', text);
  };
  
  const handleFieldBlur = (field: string, value: any) => {
    markFieldAsTouched(field);
    
    // Formateo especial para teléfono
    if (field === 'phone' && value) {
      if (!value.startsWith('+')) {
        const formattedPhone = `+503 ${value}`;
        updateField('phone', formattedPhone);
      }
    }
    
    const error = validateField(field, value);
    setErrors(prev => ({
      ...prev,
      [field]: error
    }));
  };
  
  // Funciones de ubicación
  const openLocationPicker = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permiso requerido',
          'Se requiere permiso de ubicación para esta funcionalidad.',
          [{ text: 'Entendido' }]
        );
        return;
      }
      
      try {
        const currentPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });
        
        setMapRegion({
          latitude: currentPosition.coords.latitude,
          longitude: currentPosition.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
        
        if (localForm.location) {
          setMarkerLocation(localForm.location);
        } else {
          setMarkerLocation({
            latitude: currentPosition.coords.latitude,
            longitude: currentPosition.coords.longitude
          });
        }
        
        setMapVisible(true);
      } catch (locError) {
        console.error('Error getting current location:', locError);
        setMapVisible(true);
      }
    } catch (error) {
      console.error('Error preparing map:', error);
      Alert.alert(
        'Error al inicializar mapa',
        'No se pudo inicializar el mapa. Verifica los permisos de ubicación.',
        [{ text: 'Entendido' }]
      );
    }
  }, [localForm.location]);
  
  const handleMapPress = useCallback((event: any) => {
    const { coordinate } = event.nativeEvent;
    setMarkerLocation({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude
    });
  }, []);
  
  const confirmLocationSelection = useCallback(async () => {
    if (!markerLocation) {
      Alert.alert(
        'Ubicación requerida',
        'Por favor selecciona un punto en el mapa para continuar',
        [{ text: 'Entendido' }]
      );
      return;
    }
    
    try {
      const locationCopy = {
        latitude: markerLocation.latitude,
        longitude: markerLocation.longitude
      };
      
      updateField('location', locationCopy);
      markFieldAsTouched('location');
      setErrors(prev => ({...prev, location: ''}));
      
      // Obtener dirección desde coordenadas
      try {
        const addresses = await Location.reverseGeocodeAsync({
          latitude: markerLocation.latitude,
          longitude: markerLocation.longitude
        });
        
        if (addresses.length > 0) {
          const firstAddress = addresses[0];
          const addressStr = [
            firstAddress.street && firstAddress.streetNumber ? 
              `${firstAddress.streetNumber} ${firstAddress.street}` : 
              firstAddress.street || firstAddress.name,
            firstAddress.district,
            firstAddress.city,
            firstAddress.region,
            firstAddress.country
          ].filter(Boolean).join(', ');
          
          updateField('address', addressStr);
        }
      } catch (addressError) {
        console.error('Error getting address:', addressError);
      }
      
      setMapVisible(false);
    } catch (error) {
      console.error('Error saving location:', error);
      Alert.alert(
        'Error al guardar ubicación',
        'No se pudo guardar la ubicación correctamente.',
        [{ text: 'Entendido' }]
      );
    }
  }, [markerLocation, updateField, markFieldAsTouched]);
  
  const centerMapOnCurrentLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      
      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      
      setMapRegion({
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      
      setMarkerLocation({
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude
      });
    } catch (error) {
      console.error('Error centering map:', error);
      Alert.alert(
        'Error de ubicación',
        'No se pudo obtener la ubicación actual.',
        [{ text: 'Entendido' }]
      );
    }
  }, []);
  
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{flex: 1}}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 20}
    >
      <ScrollView 
        style={styles.container} 
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
        bounces={true}
      >
        <Text style={styles.sectionTitle}>Lo básico primero</Text>
        <Text style={styles.sectionSubtitle}>
          Solo necesitamos algunos datos esenciales para empezar. Podrás completar el resto cuando lo desees.
        </Text>
        
        {/* Required Fields Note */}
        <View style={styles.fieldsInfoContainer}>
          <MaterialIcons name="info-outline" size={16} color="#007AFF" />
          <Text style={styles.fieldsInfoText}>Los campos marcados con * son obligatorios</Text>
        </View>
        
        {/* Business Name */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Nombre del negocio *</Text>
          <TextInput
            style={[
              styles.textInput,
              errors.name ? styles.inputError : {}
            ]}
            value={localForm.name}
            onChangeText={handleNameChange}
            onBlur={() => handleFieldBlur('name', localForm.name)}
            placeholder="Ej: Cafetería El Aroma"
            placeholderTextColor="#AEAEB2"
            autoCapitalize="words"
            maxLength={50}
          />
          {touchedFields.name && errors.name && (
            <Text style={styles.errorText}>{errors.name}</Text>
          )}
        </View>
        
        {/* Business Category */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Categoría principal *</Text>
          <TextInput
            style={[
              styles.textInput,
              errors.category ? styles.inputError : {}
            ]}
            value={localForm.category}
            onChangeText={handleCategoryChange}
            onBlur={() => handleFieldBlur('category', localForm.category)}
            placeholder="Ej: Restaurante, Cafetería, Tienda..."
            placeholderTextColor="#AEAEB2"
            autoCapitalize="words"
          />
          {touchedFields.category && errors.category && (
            <Text style={styles.errorText}>{errors.category}</Text>
          )}
          
          {/* Category suggestions */}
          {showSuggestions && (
            <View style={styles.suggestionsContainer}>
              {suggestedCategories.map((item, index) => (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.suggestionItem,
                    index === suggestedCategories.length - 1 ? styles.lastSuggestionItem : null
                  ]}
                  onPress={() => selectCategory(item)}
                >
                  <Text style={styles.suggestionText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        
        {/* Business Location */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Ubicación *</Text>
          <TouchableOpacity
            style={[
              styles.locationButton,
              errors.location ? styles.locationButtonError : {},
              !localForm.location && styles.locationButtonRequired
            ]}
            onPress={openLocationPicker}
          >
            <MaterialIcons 
              name="location-on" 
              size={20} 
              color={errors.location ? "#FF3B30" : "#007AFF"} 
            />
            <Text 
              style={[
                styles.locationButtonText,
                errors.location ? styles.locationButtonTextError : {}
              ]}
            >
              {localForm.address || 'Seleccionar ubicación en el mapa'}
            </Text>
            <MaterialIcons 
              name="arrow-forward-ios" 
              size={16} 
              color={errors.location ? "#FF3B30" : "#8E8E93"} 
            />
          </TouchableOpacity>
          {(touchedFields.location && errors.location) ? (
            <Text style={styles.errorText}>{errors.location}</Text>
          ) : (
            <Text style={styles.helperText}>Haz clic en el botón para seleccionar la ubicación</Text>
          )}
        </View>
        
        {/* Phone */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Teléfono de contacto *</Text>
          <TextInput
            style={[
              styles.textInput,
              errors.phone ? styles.inputError : {}
            ]}
            value={localForm.phone}
            onChangeText={handlePhoneChange}
            onBlur={() => handleFieldBlur('phone', localForm.phone)}
            placeholder="Ej: +503 2222 2222"
            placeholderTextColor="#AEAEB2"
            keyboardType="phone-pad"
          />
          {touchedFields.phone && errors.phone && (
            <Text style={styles.errorText}>{errors.phone}</Text>
          )}
          <Text style={styles.helperText}>Incluye el código de país (ej: +503)</Text>
        </View>
        
        {/* Email */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Correo electrónico del negocio</Text>
          <TextInput
            style={[
              styles.textInput,
              errors.email ? styles.inputError : {}
            ]}
            value={localForm.email}
            onChangeText={handleEmailChange}
            onBlur={() => handleFieldBlur('email', localForm.email)}
            placeholder="Ej: info@minegocio.com"
            placeholderTextColor="#AEAEB2"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {touchedFields.email && errors.email && (
            <Text style={styles.errorText}>{errors.email}</Text>
          )}
        </View>
        
        {/* Extra padding at the bottom for better scrolling */}
        <View style={{ height: 80 }} />
      </ScrollView>
      
      {/* Location Map Modal */}
      <LocationMapModal 
        visible={mapVisible}
        mapRegion={mapRegion}
        markerLocation={markerLocation}
        handleMapPress={handleMapPress}
        confirmLocationSelection={confirmLocationSelection}
        centerMapOnCurrentLocation={centerMapOnCurrentLocation}
        closeModal={() => setMapVisible(false)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingBottom: 120, // Increase padding at the bottom for better scrolling
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0A2463',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#5E6A81',
    marginBottom: 16,
    lineHeight: 22,
  },
  fieldsInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
    padding: 10,
    borderRadius: 8,
  },
  fieldsInfoText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 8,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'white',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2C3E50',
    borderWidth: 1,
    borderColor: '#E1E8F0',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 4,
  },
  helperText: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 4,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 80, // Below the input
    left: 0,
    right: 0,
    zIndex: 1,
    backgroundColor: 'white',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#E1E8F0',
  },
  suggestionItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8F0',
  },
  lastSuggestionItem: {
    borderBottomWidth: 0,
  },
  suggestionText: {
    fontSize: 16,
    color: '#2C3E50',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E1E8F0',
  },
  locationButtonError: {
    borderColor: '#FF3B30',
  },
  locationButtonRequired: {
    borderColor: '#007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
  },
  locationButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#2C3E50',
    marginLeft: 10,
  },
  locationButtonTextError: {
    color: '#FF3B30',
  },
});

export default BasicInfoStep;