import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useBusinessOnboarding } from '../../../context/BusinessOnboardingContext';
import { Linking } from 'react-native';

const VisualProfileStep: React.FC = () => {
  const { formState, setField, markStepComplete } = useBusinessOnboarding();
  
  // Local state for UI handling
  const [isPickingMain, setIsPickingMain] = useState(false);
  const [isPickingGallery, setIsPickingGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  
  // Effect to mark step complete when main image is selected
  useEffect(() => {
    if (formState.image) {
      markStepComplete('visualProfile');
    }
  }, [formState.image]);
  
  // Effect to initialize gallery images from form state
  useEffect(() => {
    if (formState.galleryImages && formState.galleryImages.length > 0) {
      setGalleryImages(formState.galleryImages);
    }
  }, [formState.galleryImages]);
  
  // Main image picker
  const pickMainImage = async () => {
    try {
      // Request permission
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permiso denegado', 
            'Necesitamos permiso para acceder a tus fotos. Por favor habilita el permiso en configuración.',
            [
              { text: 'Cancelar' },
              { 
                text: 'Abrir Configuración', 
                onPress: () => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('app-settings:');
                  } else {
                    Linking.openSettings();
                  }
                }
              }
            ]
          );
          return;
        }
      }
      
      setIsPickingMain(true);
      
      // Launch image library
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      
      setIsPickingMain(false);
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedUri = result.assets[0].uri;
        
        // Check image size (optional: limit to 5MB)
        try {
          const fileInfo = await fetch(selectedUri).then(r => {
            const contentLength = r.headers.get('Content-Length');
            return contentLength ? parseInt(contentLength, 10) : 0;
          });
          
          if (fileInfo > 5 * 1024 * 1024) {
            Alert.alert(
              'Imagen demasiado grande', 
              'Por favor selecciona una imagen más pequeña (máximo 5MB)'
            );
            return;
          }
        } catch (sizeError) {
          console.warn('No se pudo verificar el tamaño de la imagen:', sizeError);
          // Continue anyway
        }
        
        setField('image', selectedUri);
      }
    } catch (error) {
      setIsPickingMain(false);
      console.error('Error al seleccionar imagen:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen. Intente nuevamente.');
    }
  };
  
  // Gallery image picker
  const pickGalleryImage = async () => {
    try {
      // Request permission
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permiso denegado', 
            'Necesitamos permiso para acceder a tus fotos. Por favor habilita el permiso en configuración.',
            [
              { text: 'Cancelar' },
              { 
                text: 'Abrir Configuración', 
                onPress: () => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('app-settings:');
                  } else {
                    Linking.openSettings();
                  }
                }
              }
            ]
          );
          return;
        }
      }
      
      setIsPickingGallery(true);
      
      // Launch image library with explicit multi-selection enabled
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Disable editing to allow multiple selection
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: 10 - galleryImages.length, // Dynamically limit based on current count
      });
      
      setIsPickingGallery(false);
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newImages = result.assets.map(asset => asset.uri);
        const updatedGallery = [...galleryImages, ...newImages];
        
        // Check if we're at or over the limit
        if (updatedGallery.length > 10) {
          Alert.alert('Máximo alcanzado', 'Solo puedes tener hasta 10 imágenes en la galería.');
          setGalleryImages(updatedGallery.slice(0, 10));
          setField('galleryImages', updatedGallery.slice(0, 10));
        } else {
          setGalleryImages(updatedGallery);
          setField('galleryImages', updatedGallery);
        }
      }
    } catch (error) {
      setIsPickingGallery(false);
      console.error('Error al seleccionar imágenes:', error);
      Alert.alert('Error', 'No se pudieron seleccionar las imágenes. Intente nuevamente.');
    }
  };
  
  // Remove gallery image
  const removeGalleryImage = (index: number) => {
    const updatedGallery = [...galleryImages];
    updatedGallery.splice(index, 1);
    setGalleryImages(updatedGallery);
    setField('galleryImages', updatedGallery);
  };
  
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 20}
    >
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={true}
        bounces={true}
      >
        <View style={styles.container}>
          <Text style={styles.sectionTitle}>Dale identidad a tu negocio</Text>
          <Text style={styles.sectionSubtitle}>
            Las empresas con imágenes de calidad reciben 2.5 veces más interacciones.
          </Text>
          
          {/* Imagen Principal/Portada */}
          <View style={styles.imageSection}>
            <Text style={styles.sectionLabel}>Imagen principal *</Text>
            <Text style={styles.imageHint}>
              Elige cuál será tu principal foto, la que verán primero los usuarios
            </Text>
            
            <TouchableOpacity 
              style={[
                styles.coverImageContainer,
                formState.validationErrors.image ? styles.errorBorder : {}
              ]}
              onPress={pickMainImage}
              disabled={isPickingMain}
            >
              {isPickingMain ? (
                <ActivityIndicator size="large" color="#007AFF" />
              ) : formState.image ? (
                <Image 
                  source={{ uri: formState.image }} 
                  style={styles.coverImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.coverPlaceholder}>
                  <MaterialIcons name="panorama" size={36} color="#007AFF" />
                  <Text style={styles.imagePlaceholderText}>Toca para agregar tu imagen principal</Text>
                </View>
              )}
            </TouchableOpacity>
            
            {formState.validationErrors.image && (
              <Text style={styles.errorText}>{formState.validationErrors.image}</Text>
            )}
          </View>
          
          {/* Gallery */}
          <View style={styles.imageSection}>
            <Text style={styles.sectionLabel}>Galería de imágenes</Text>
            <Text style={styles.imageHint}>
              Mínimo 3 imágenes recomendadas para mostrar tu negocio
            </Text>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.galleryContainer}
              contentContainerStyle={styles.galleryContent}
            >
              {/* Add button always shown */}
              <TouchableOpacity 
                style={styles.galleryAddButton}
                onPress={pickGalleryImage}
                disabled={isPickingGallery}
              >
                {isPickingGallery ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  <>
                    <MaterialIcons name="add" size={24} color="#007AFF" />
                    <Text style={styles.galleryAddText}>Seleccionar varias fotos</Text>
                  </>
                )}
              </TouchableOpacity>
              
              {/* Gallery images */}
              {galleryImages.map((image, index) => (
                <View key={index} style={styles.galleryImageContainer}>
                  <Image 
                    source={{ uri: image }} 
                    style={styles.galleryImage}
                    resizeMode="cover"
                  />
                  <TouchableOpacity 
                    style={styles.removeImageButton}
                    onPress={() => removeGalleryImage(index)}
                  >
                    <MaterialIcons name="close" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
          
          {/* Pro Tip */}
          <View style={styles.tipContainer}>
            <MaterialIcons name="lightbulb" size={24} color="#007AFF" />
            <Text style={styles.tipText}>
              Consejo Pro: Incluye fotos de tus productos/servicios, el espacio físico y tu equipo para generar confianza.
            </Text>
          </View>
          
          {/* Add extra padding at the bottom for better scrolling */}
          <View style={styles.bottomPadding} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 120, // Extra padding at the bottom
  },
  container: {
    paddingVertical: 16,
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
    marginBottom: 24,
    lineHeight: 22,
  },
  imageSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 6,
  },
  imageHint: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
  },
  errorBorder: {
    borderColor: '#FF3B30',
    borderWidth: 2,
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  coverImageContainer: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#F5F7FA',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E1E8F0',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  galleryContent: {
    paddingRight: 16,
  },
  galleryAddButton: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: 'rgba(0,122,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#007AFF',
  },
  galleryAddText: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 4,
    textAlign: 'center',
  },
  galleryImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'rgba(0,122,255,0.1)',
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'flex-start',
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#2C3E50',
    marginLeft: 12,
    lineHeight: 20,
  },
  bottomPadding: {
    height: 100, // Extra space at the bottom
  }
});

export default VisualProfileStep; 