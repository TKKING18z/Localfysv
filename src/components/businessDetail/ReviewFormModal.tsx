import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
  ScrollView,
  FlatList
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { firebaseService } from '../../services/firebaseService';
import { useNetwork } from '../../context/NetworkContext';
import { usePoints } from '../../context/PointsContext';
import { throttle } from '../../utils/performanceUtils';
import * as ImagePicker from 'expo-image-picker';

// Interfaces
interface ReviewFormModalProps {
  showReviewForm: boolean;
  businessId: string;
  businessName: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface StarRatingProps {
  rating: number;
  onRatingChange: (rating: number) => void;
  size?: number;
  color?: string;
}

// Maximum number of images
const MAX_IMAGES = 5;

// Componente de estrellas memoizado para prevenir re-renders
const StarRating = React.memo(({
  rating,
  onRatingChange,
  size = 36,
  color = "#FFCC00"
}: StarRatingProps) => {
  
  // Para evitar creaciones de función en cada render
  const handlePress = useCallback((selectedRating: number) => {
    onRatingChange(selectedRating);
  }, [onRatingChange]);
  
  return (
    <View style={styles.starsContainer}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={`star-${star}`}
          onPress={() => handlePress(star)}
          activeOpacity={0.7}
          style={styles.starButton}
          accessibilityLabel={`Calificar ${star} estrellas`}
          accessibilityRole="button"
          accessibilityState={{ selected: star <= rating }}
        >
          <MaterialIcons
            name={star <= rating ? "star" : "star-border"}
            size={size}
            color={color}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
});

// Componente principal optimizado
const ReviewFormModal: React.FC<ReviewFormModalProps> = ({
  showReviewForm,
  businessId,
  businessName,
  userId,
  userName,
  userPhotoURL,
  onClose,
  onSuccess
}) => {
  // Estados
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSavedDraft, setLastSavedDraft] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [pointsAwarded, setPointsAwarded] = useState(false);

  // Network context para manejar conexiones lentas
  const { isConnected, isSlowConnection } = useNetwork();
  
  // Añadir el contexto de puntos
  const { awardPointsForReview, totalPoints } = usePoints();

  // Pedir permisos para la cámara y galería al montar el componente
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
        const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
          console.log('Camera and/or media library permissions denied');
        }
      }
    })();
  }, []);

  // Limpiar el formulario cuando se cierra
  useEffect(() => {
    if (!showReviewForm) {
      // No resetear inmediatamente para permitir que la animación
      // de cierre termine sin saltos visuales
      const timeout = setTimeout(() => {
        setRating(5);
        setComment('');
        setLastSavedDraft('');
        setSelectedImages([]);
      }, 300);
      
      return () => clearTimeout(timeout);
    }
  }, [showReviewForm]);

  // Auto-guardar borrador localmente
  useEffect(() => {
    if (comment && comment !== lastSavedDraft && showReviewForm) {
      const timeout = setTimeout(() => {
        setLastSavedDraft(comment);
      }, 3000);
      
      return () => clearTimeout(timeout);
    }
  }, [comment, lastSavedDraft, showReviewForm]);

  // Validar entrada antes de enviar
  const isValid = useMemo(() => {
    return rating > 0 && comment.trim().length > 0;
  }, [rating, comment]);

  // Seleccionar imágenes de la galería
  const pickImages = useCallback(async () => {
    if (selectedImages.length >= MAX_IMAGES) {
      Alert.alert('Límite alcanzado', `Solo puedes añadir un máximo de ${MAX_IMAGES} imágenes.`);
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8, // Reduced quality for faster uploads
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES - selectedImages.length,
      });

      if (!result.canceled && result.assets.length > 0) {
        const newImages = result.assets.map(asset => asset.uri);
        
        // Make sure we don't exceed the maximum number of images
        const availableSlots = MAX_IMAGES - selectedImages.length;
        const imagesToAdd = newImages.slice(0, availableSlots);
        
        setSelectedImages(prev => [...prev, ...imagesToAdd]);
      }
    } catch (error) {
      console.error('Error selecting images:', error);
      Alert.alert('Error', 'No se pudieron cargar las imágenes. Inténtalo de nuevo.');
    }
  }, [selectedImages]);

  // Tomar una foto con la cámara
  const takePhoto = useCallback(async () => {
    if (selectedImages.length >= MAX_IMAGES) {
      Alert.alert('Límite alcanzado', `Solo puedes añadir un máximo de ${MAX_IMAGES} imágenes.`);
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8, // Reduced quality for faster uploads
      });

      if (!result.canceled && result.assets.length > 0) {
        setSelectedImages(prev => [...prev, result.assets[0].uri]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'No se pudo tomar la foto. Inténtalo de nuevo.');
    }
  }, [selectedImages]);

  // Quitar una imagen
  const removeImage = useCallback((index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Manejar envío de reseña con throttle para evitar múltiples envíos
  const handleSubmit = useCallback(throttle(async () => {
    if (!isValid || !isConnected) {
      return;
    }

    try {
      setIsSubmitting(true);
      
      const reviewData = {
        businessId,
        rating,
        comment: comment.trim(),
        userId,
        userName,
        userPhotoURL,
        createdAt: new Date()
      };
      
      // Mostrar mensaje de conexión lenta si es necesario
      if (isSlowConnection) {
        Alert.alert(
          "Conexión lenta detectada",
          "Tu reseña se enviará, pero podría tardar un poco más de lo normal.",
          [{ text: "Entendido" }]
        );
      }
      
      // Crear la reseña primero
      const result = await firebaseService.reviews.create(reviewData);
      
      if (result.success && result.data) {
        const reviewId = result.data.id;
        
        // Si hay imágenes seleccionadas, subirlas
        if (selectedImages.length > 0) {
          try {
            // Mostrar mensaje si hay muchas imágenes
            if (selectedImages.length > 2 && isSlowConnection) {
              Alert.alert(
                "Subiendo imágenes",
                "Estamos subiendo tus imágenes. Esto puede tardar un poco.",
                [{ text: "OK" }]
              );
            }
            
            await firebaseService.reviews.uploadReviewImages(reviewId, selectedImages);
          } catch (imageError) {
            console.error('Error uploading images:', imageError);
            // Continuamos aunque la subida de imágenes falle
          }
        }
        
        // Otorgar puntos por la reseña
        try {
          await awardPointsForReview(reviewId, businessId, businessName);
          setPointsAwarded(true);
          
          // Mostrar mensaje de puntos otorgados
          Alert.alert(
            "¡Puntos ganados!",
            `¡Has ganado 3 puntos por tu reseña! Tus puntos se han añadido a tu cuenta. Puedes verlos en la sección de Puntos.`,
            [
              { 
                text: "OK", 
                onPress: () => {
                  onSuccess();
                  onClose();
                }
              }
            ]
          );
        } catch (pointsError) {
          console.error('Error al otorgar puntos:', pointsError);
          // Si hay error al otorgar puntos, igual continuamos con el flujo normal
          onSuccess();
          onClose();
        }
      } else {
        Alert.alert('Error', 'No se pudo guardar la reseña. Inténtalo de nuevo.');
      }
    } catch (error) {
      console.error('Error al enviar reseña:', error);
      Alert.alert('Error', 'Ocurrió un error al enviar tu reseña. Verifica tu conexión.');
    } finally {
      setIsSubmitting(false);
    }
  }, 1000), [businessId, rating, comment, selectedImages, userId, userName, userPhotoURL, onSuccess, onClose, isValid, isConnected, isSlowConnection, awardPointsForReview, totalPoints]);

  // Renderizado de cada imagen seleccionada
  const renderImageItem = useCallback(({ item, index }: { item: string, index: number }) => (
    <View style={styles.imagePreviewContainer}>
      <Image source={{ uri: item }} style={styles.imagePreview} />
      <TouchableOpacity 
        style={styles.removeImageButton}
        onPress={() => removeImage(index)}
        disabled={isSubmitting}
      >
        <MaterialIcons name="close" size={18} color="white" />
      </TouchableOpacity>
    </View>
  ), [removeImage, isSubmitting]);

  return (
    <Modal
      visible={showReviewForm}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.formContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Reseña para {businessName}</Text>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={onClose}
              disabled={isSubmitting}
            >
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={styles.ratingLabel}>Tu calificación</Text>
            <StarRating rating={rating} onRatingChange={setRating} />
            
            <Text style={styles.commentLabel}>Tu comentario</Text>
            <TextInput
              style={styles.commentInput}
              placeholder="Comparte tu experiencia..."
              placeholderTextColor="#999"
              multiline={true}
              value={comment}
              onChangeText={setComment}
              maxLength={500}
              autoCapitalize="sentences"
              editable={!isSubmitting}
            />
            
            <Text style={styles.charCount}>
              {comment.length}/500 caracteres
            </Text>
            
            {/* Sección de imágenes */}
            <View style={styles.imageSection}>
              <Text style={styles.imagesLabel}>
                Añadir fotos <Text style={styles.optional}>(opcional)</Text>
              </Text>
              
              <View style={styles.imageButtons}>
                <TouchableOpacity 
                  style={styles.imageButton}
                  onPress={pickImages}
                  disabled={isSubmitting || selectedImages.length >= MAX_IMAGES}
                >
                  <MaterialIcons name="photo-library" size={22} color="#007AFF" />
                  <Text style={styles.imageButtonText}>Galería</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.imageButton}
                  onPress={takePhoto}
                  disabled={isSubmitting || selectedImages.length >= MAX_IMAGES}
                >
                  <MaterialIcons name="photo-camera" size={22} color="#007AFF" />
                  <Text style={styles.imageButtonText}>Cámara</Text>
                </TouchableOpacity>
              </View>
              
              <Text style={styles.imageCountText}>
                {selectedImages.length}/{MAX_IMAGES} imágenes añadidas
              </Text>
              
              {/* Previsualización de imágenes */}
              {selectedImages.length > 0 && (
                <FlatList
                  data={selectedImages}
                  renderItem={renderImageItem}
                  keyExtractor={(item, index) => `image-${index}`}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.imageList}
                  contentContainerStyle={styles.imageListContent}
                />
              )}
            </View>
          
            {!isConnected && (
              <View style={styles.offlineWarning}>
                <MaterialIcons name="signal-wifi-off" size={20} color="#FF3B30" />
                <Text style={styles.offlineWarningText}>
                  Sin conexión. No podrás enviar tu reseña hasta que recuperes la conexión.
                </Text>
              </View>
            )}
          </ScrollView>
          
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!isValid || !isConnected) && styles.disabledButton
            ]}
            onPress={handleSubmit}
            disabled={!isValid || isSubmitting || !isConnected}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <MaterialIcons name="send" size={20} color="white" />
                <Text style={styles.submitButtonText}>Enviar reseña</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  formContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: '90%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    justifyContent: 'center',
  },
  starButton: {
    padding: 5,
  },
  commentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    minHeight: 120,
    textAlignVertical: 'top',
    fontSize: 16,
    color: '#333',
  },
  charCount: {
    alignSelf: 'flex-end',
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 5,
  },
  imageSection: {
    marginTop: 20,
  },
  imagesLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  optional: {
    fontWeight: 'normal',
    fontSize: 14,
    color: '#8E8E93',
  },
  imageButtons: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: 10,
    borderRadius: 8,
    marginRight: 10,
  },
  imageButtonText: {
    color: '#007AFF',
    marginLeft: 5,
    fontWeight: '500',
  },
  imageCountText: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 10,
  },
  imageList: {
    marginBottom: 10,
  },
  imageListContent: {
    paddingVertical: 10,
  },
  imagePreviewContainer: {
    width: 100,
    height: 100,
    marginRight: 10,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  offlineWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEEEE',
    padding: 12,
    borderRadius: 8,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#FFCCCC',
  },
  offlineWarningText: {
    fontSize: 14,
    color: '#CC0000',
    marginLeft: 8,
    flex: 1,
  },
});

export default React.memo(ReviewFormModal); 