import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';  // Asegúrate de tener esta línea
import { Promotion } from '../../types/businessTypes';
import { firebaseService } from '../../services/firebaseService';

interface PromotionFormProps {
  businessId: string;
  initialValues?: Promotion;
  onSave: (promotion: any) => Promise<void>;
  onCancel: () => void;
}

const PromotionForm: React.FC<PromotionFormProps> = ({
  businessId,
  initialValues,
  onSave,
  onCancel
}) => {
  const isEditing = !!initialValues;
  
  // Form state
  const [title, setTitle] = useState(initialValues?.title || '');
  const [description, setDescription] = useState(initialValues?.description || '');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed' | 'special'>(
    initialValues?.discountType || 'percentage'
  );
  const [discountValue, setDiscountValue] = useState(
    initialValues?.discountValue ? initialValues.discountValue.toString() : ''
  );
  const [promoCode, setPromoCode] = useState(initialValues?.promoCode || '');
  const [termsAndConditions, setTermsAndConditions] = useState(initialValues?.termsAndConditions || '');
  const [startDate, setStartDate] = useState(
    initialValues?.startDate ? initialValues.startDate.toDate() : new Date()
  );
  const [endDate, setEndDate] = useState(
    initialValues?.endDate ? initialValues.endDate.toDate() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  );
  const [imageUrl, setImageUrl] = useState(initialValues?.imageUrl || '');
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  
  // Seleccionar imagen
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Se necesita permiso para acceder a la galería');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setLocalImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error seleccionando imagen:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };
  
  // Manejar cambio de fecha de inicio
  const handleStartDateChange = (_event: any, selectedDate?: Date) => {
    setShowStartDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setStartDate(selectedDate);
      
      // Si la fecha de fin es anterior a la de inicio, ajustarla
      if (selectedDate > endDate) {
        // Establecer fecha de fin a 7 días después de la fecha de inicio
        const newEndDate = new Date(selectedDate);
        newEndDate.setDate(newEndDate.getDate() + 7);
        setEndDate(newEndDate);
      }
    }
  };
  
  // Manejar cambio de fecha de fin
  const handleEndDateChange = (_event: any, selectedDate?: Date) => {
    setShowEndDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      if (selectedDate < startDate) {
        Alert.alert('Fecha inválida', 'La fecha de fin debe ser posterior a la fecha de inicio');
        return;
      }
      setEndDate(selectedDate);
    }
  };
  
  // Guardar promoción
  const handleSubmit = async () => {
    // Validar campos requeridos
    if (!title.trim()) {
      Alert.alert('Error', 'El título es obligatorio');
      return;
    }
    
    if (!description.trim()) {
      Alert.alert('Error', 'La descripción es obligatoria');
      return;
    }
    
    if (discountType !== 'special' && (!discountValue || isNaN(parseFloat(discountValue)))) {
      Alert.alert('Error', 'El valor del descuento es obligatorio');
      return;
    }
    
    setLoading(true);
    
    try {
      let finalImageUrl = imageUrl;
      
      // Si hay una imagen local, subirla
      if (localImageUri) {
        const uploadResult = await firebaseService.storage.uploadImage(
          localImageUri,
          `promotions/${businessId}/${Date.now()}.jpg`
        );
        
        if (uploadResult.success && uploadResult.data) {
          finalImageUrl = uploadResult.data;
        } else {
          throw new Error('No se pudo subir la imagen');
        }
      }
      
      // Preparar datos de la promoción
      const promotionData = {
        title,
        description,
        discountType,
        discountValue: discountType !== 'special' ? parseFloat(discountValue) : undefined,
        promoCode: promoCode.trim() || undefined,
        termsAndConditions: termsAndConditions.trim() || undefined,
        startDate: firebase.firestore.Timestamp.fromDate(startDate),
        endDate: firebase.firestore.Timestamp.fromDate(endDate),
        imageUrl: finalImageUrl || undefined,
        businessId,
        isActive: true
      };
      
      // Guardar usando la función proporcionada por el padre
      await onSave(promotionData);
      
    } catch (error) {
      console.error('Error guardando promoción:', error);
      Alert.alert('Error', 'No se pudo guardar la promoción');
    } finally {
      setLoading(false);
    }
  };
  
  // Formatear fecha para mostrar
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', {
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}>
          <MaterialIcons name="close" size={24} color="#666666" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? 'Editar Promoción' : 'Nueva Promoción'}
        </Text>
        <TouchableOpacity onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <MaterialIcons name="check" size={24} color="#007AFF" />
          )}
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.formContainer}>
        {/* Imagen */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Imagen (Opcional)</Text>
          <TouchableOpacity style={styles.imagePickerContainer} onPress={pickImage}>
            {localImageUri || imageUrl ? (
              <Image
                source={{ uri: localImageUri || imageUrl }}
                style={styles.previewImage}
                contentFit="cover"
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <MaterialIcons name="add-photo-alternate" size={40} color="#8E8E93" />
                <Text style={styles.imagePlaceholderText}>Seleccionar imagen</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        
        {/* Campos básicos */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Título *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Ej: 2x1 en hamburguesas"
            maxLength={50}
          />
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Descripción *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe los detalles de la promoción..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={200}
          />
        </View>
        
        {/* Tipo de descuento */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Tipo de descuento</Text>
          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={[
                styles.optionButton,
                discountType === 'percentage' && styles.selectedOption
              ]}
              onPress={() => setDiscountType('percentage')}
            >
              <Text style={[
                styles.optionText,
                discountType === 'percentage' && styles.selectedOptionText
              ]}>
                Porcentaje
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.optionButton,
                discountType === 'fixed' && styles.selectedOption
              ]}
              onPress={() => setDiscountType('fixed')}
            >
              <Text style={[
                styles.optionText,
                discountType === 'fixed' && styles.selectedOptionText
              ]}>
                Monto Fijo
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.optionButton,
                discountType === 'special' && styles.selectedOption
              ]}
              onPress={() => setDiscountType('special')}
            >
              <Text style={[
                styles.optionText,
                discountType === 'special' && styles.selectedOptionText
              ]}>
                Especial
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Valor del descuento */}
        {discountType !== 'special' && (
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              {discountType === 'percentage' ? 'Porcentaje de descuento *' : 'Monto de descuento *'}
            </Text>
            <View style={styles.inputWithPrefix}>
              {discountType === 'fixed' && (
                <Text style={styles.prefix}>$</Text>
              )}
              <TextInput
                style={styles.input}
                value={discountValue}
                onChangeText={setDiscountValue}
                placeholder={discountType === 'percentage' ? "Ej: 20" : "Ej: 10.50"}
                keyboardType="numeric"
                maxLength={10}
              />
              {discountType === 'percentage' && (
                <Text style={styles.suffix}>%</Text>
              )}
            </View>
          </View>
        )}
        
        {/* Código promocional */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Código promocional (Opcional)</Text>
          <TextInput
            style={styles.input}
            value={promoCode}
            onChangeText={setPromoCode}
            placeholder="Ej: VERANO2023"
            autoCapitalize="characters"
            maxLength={20}
          />
        </View>
        
        {/* Términos y condiciones */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Términos y condiciones (Opcional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={termsAndConditions}
            onChangeText={setTermsAndConditions}
            placeholder="Ej: No acumulable con otras promociones..."
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            maxLength={300}
          />
        </View>
        
        {/* Fecha de inicio */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Fecha de inicio</Text>
          <TouchableOpacity 
            style={styles.dateButton}
            onPress={() => setShowStartDatePicker(true)}
          >
            <MaterialIcons name="calendar-today" size={20} color="#007AFF" />
            <Text style={styles.dateButtonText}>{formatDate(startDate)}</Text>
          </TouchableOpacity>
          
          {showStartDatePicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display="default"
              onChange={handleStartDateChange}
              minimumDate={new Date()}
            />
          )}
        </View>
        
        {/* Fecha de fin */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Fecha de fin</Text>
          <TouchableOpacity 
            style={styles.dateButton}
            onPress={() => setShowEndDatePicker(true)}
          >
            <MaterialIcons name="calendar-today" size={20} color="#007AFF" />
            <Text style={styles.dateButtonText}>{formatDate(endDate)}</Text>
          </TouchableOpacity>
          
          {showEndDatePicker && (
            <DateTimePicker
              value={endDate}
              mode="date"
              display="default"
              onChange={handleEndDateChange}
              minimumDate={startDate}
            />
          )}
        </View>
      </ScrollView>
      
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.submitButton, loading && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialIcons name="check" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>
                {isEditing ? 'Actualizar Promoción' : 'Crear Promoción'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  formContainer: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333333',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  imagePickerContainer: {
    width: '100%',
    height: 180,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    marginTop: 8,
    fontSize: 16,
    color: '#8E8E93',
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  optionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#F0F0F5',
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  selectedOption: {
    backgroundColor: '#007AFF',
  },
  optionText: {
    fontSize: 14,
    color: '#333333',
  },
  selectedOptionText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  inputWithPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  prefix: {
    fontSize: 16,
    color: '#333333',
    marginRight: 4,
  },
  suffix: {
    fontSize: 16,
    color: '#333333',
    marginLeft: 4,
    position: 'absolute',
    right: 12,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333333',
    marginLeft: 8,
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
  },
  disabledButton: {
    backgroundColor: '#A2D1FF',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});

export default PromotionForm;
