import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Image,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Review } from '../../models/reviewTypes';
import StarRating from './StarRating';
import ImageUploader from './ImageUploader';
import { LinearGradient } from 'expo-linear-gradient';

interface ReviewFormProps {
  businessId: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  existingReview?: Review;
  onSuccess: (reviewId: string) => void;
  onCancel: () => void;
  // Nuevas propiedades para mostrar información del negocio
  businessName: string;
  businessImageUrl?: string;
  businessCategory?: string;
}

const MAX_TEXT_LENGTH = 1000;
const MAX_IMAGES = 5;
const { width } = Dimensions.get('window');

const ReviewForm: React.FC<ReviewFormProps> = ({
  businessId,
  userId,
  userName,
  userPhotoURL,
  existingReview,
  onSuccess,
  onCancel,
  businessName,
  businessImageUrl,
  businessCategory,
}) => {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [reviewText, setReviewText] = useState(existingReview?.text || '');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>(
    existingReview?.images?.map(img => img.url) || []
  );
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ rating?: string; text?: string }>({});
  const isEditing = !!existingReview;
  
  // Animaciones
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true
      })
    ]).start();
  }, []);
  
  const validate = useCallback(() => {
    const newErrors: { rating?: string; text?: string } = {};
    
    if (rating === 0) {
      newErrors.rating = 'Debes seleccionar una calificación';
    }
    
    if (!reviewText || reviewText.trim().length === 0) {
      newErrors.text = 'Debes escribir una reseña';
    } else if (reviewText.trim().length < 5) {
      newErrors.text = 'Tu reseña debe tener al menos 5 caracteres';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [rating, reviewText]);
  
  // Clear errors when user changes inputs
  useEffect(() => {
    if (rating > 0 && errors.rating) {
      setErrors(prev => ({ ...prev, rating: undefined }));
    }
  }, [rating, errors.rating]);

  useEffect(() => {
    if (reviewText && reviewText.trim().length > 0 && errors.text) {
      setErrors(prev => ({ ...prev, text: undefined }));
    }
  }, [reviewText, errors.text]);
  
  const handleSubmit = async () => {
    if (!validate()) {
      // Mostrar animación de error
      const shakeAnimation = Animated.sequence([
        Animated.timing(slideAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 50, useNativeDriver: true })
      ]);
      
      shakeAnimation.start();
      return;
    }
    
    try {
      setLoading(true);
      
      if (isEditing && existingReview) {
        // Update existing review
        await updateReview(existingReview.id, {
          rating,
          text: reviewText.trim(),
        });
        
        // Handle images if needed
        if (selectedImages.length > 0) {
          try {
            await uploadReviewImages(existingReview.id, selectedImages);
          } catch (imageError) {
            console.error('Image upload error:', imageError);
            // Continue even if images fail - the review was already updated
            Alert.alert(
              'Advertencia', 
              'Tu reseña fue actualizada, pero las imágenes no pudieron subirse.'
            );
          }
        }
        
        onSuccess(existingReview.id);
      } else {
        // Create new review
        const reviewData = {
          businessId,
          userId,
          userName,
          userPhotoURL,
          rating,
          text: reviewText.trim(),
          createdAt: new Date()
        };
        
        const reviewId = await addReview(reviewData);
        
        // Upload images if any
        if (selectedImages.length > 0) {
          try {
            await uploadReviewImages(reviewId, selectedImages);
          } catch (imageError) {
            console.error('Image upload error:', imageError);
            // Continue even if images fail - the review was already created
            Alert.alert(
              'Advertencia', 
              'Tu reseña fue publicada, pero las imágenes no pudieron subirse.'
            );
          }
        }
        
        onSuccess(reviewId);
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      Alert.alert(
        'Error',
        isEditing
          ? 'No se pudo actualizar la reseña. Inténtalo de nuevo.'
          : 'No se pudo publicar la reseña. Inténtalo de nuevo.'
      );
    } finally {
      setLoading(false);
    }
  };
  
  const handleImageSelection = useCallback((uris: string[]) => {
    const totalImages = existingImages.length + selectedImages.length;
    if (totalImages + uris.length > MAX_IMAGES) {
      Alert.alert(
        'Límite de imágenes',
        `Solo puedes subir un máximo de ${MAX_IMAGES} imágenes por reseña.`
      );
      return;
    }
    
    setSelectedImages(prev => [...prev, ...uris]);
  }, [existingImages.length, selectedImages.length]);
  
  const removeSelectedImage = useCallback((index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  }, []);
  
  // Función para generar color de placeholder si no hay imagen del negocio
  const getPlaceholderColor = () => {
    const colors = [
      '#007AFF', '#34C759', '#FF9500', '#FF2D55', '#AF52DE', 
      '#5856D6', '#FF3B30', '#5AC8FA', '#FFCC00', '#4CD964'
    ];
    
    const sum = businessName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[sum % colors.length];
  };
  
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera del negocio */}
        <Animated.View 
          style={[
            styles.businessHeader,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {businessImageUrl ? (
            <Image 
              source={{ uri: businessImageUrl }} 
              style={styles.businessImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[
              styles.businessImagePlaceholder,
              { backgroundColor: getPlaceholderColor() }
            ]}>
              <Text style={styles.businessImagePlaceholderText}>
                {businessName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          
          <View style={styles.businessInfo}>
            <Text style={styles.businessName} numberOfLines={1}>
              {businessName}
            </Text>
            {businessCategory && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>
                  {businessCategory}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>
        
        <Animated.View style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }}>
          {/* Sección de calificación */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>¿Cómo calificarías este negocio?</Text>
            <View style={styles.ratingContainer}>
              <StarRating
                rating={rating}
                size={42}
                editable
                onRatingChange={newRating => {
                  console.log('Rating changed to:', newRating);
                  setRating(newRating);
                }}
              />
              <Text style={styles.ratingText}>
                {rating > 0 
                  ? `${rating} ${rating === 1 ? 'estrella' : 'estrellas'}`
                  : 'Toca para calificar'
                }
              </Text>
            </View>
            {errors.rating && (
              <Text style={styles.errorText}>{errors.rating}</Text>
            )}
          </View>
          
          {/* Sección de texto de reseña */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Escribe tu experiencia</Text>
            <Text style={styles.sectionSubtitle}>
              Cuéntanos lo que te gustó y lo que se podría mejorar
            </Text>
            
            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                value={reviewText}
                onChangeText={setReviewText}
                placeholder="Comparte tu experiencia con este negocio..."
                placeholderTextColor="#8E8E93"
                multiline
                maxLength={MAX_TEXT_LENGTH}
                textAlignVertical="top"
              />
              <View style={styles.textCountContainer}>
                <Text style={[
                  styles.textCount, 
                  reviewText.length > MAX_TEXT_LENGTH * 0.9 ? styles.textCountWarning : {}
                ]}>
                  {reviewText.length}/{MAX_TEXT_LENGTH}
                </Text>
              </View>
            </View>
            
            {errors.text && (
              <Text style={styles.errorText}>{errors.text}</Text>
            )}
          </View>
          
          {/* Sección de imágenes */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Añade fotos (opcional)</Text>
            <Text style={styles.sectionSubtitle}>
              Las imágenes pueden ayudar a otros usuarios
            </Text>
            
            <ImageUploader
              onImagesSelected={handleImageSelection}
              selectedImages={selectedImages}
              existingImages={existingImages}
              onRemoveSelected={removeSelectedImage}
              maxImages={MAX_IMAGES}
            />
            
            <View style={styles.imageCountContainer}>
              <MaterialIcons name="photo-library" size={16} color="#8E8E93" />
              <Text style={styles.imageCountText}>
                {selectedImages.length + existingImages.length} de {MAX_IMAGES} imágenes
              </Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
      
      {/* Botones de acción fijos en la parte inferior */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleSubmit}
          disabled={loading}
        >
          <LinearGradient
            colors={loading ? ['#A0A0A0', '#C0C0C0'] : ['#007AFF', '#00C2FF']}
            style={styles.submitButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>
                  {isEditing ? 'Actualizar reseña' : 'Publicar reseña'}
                </Text>
                <MaterialIcons name="send" size={20} color="#FFFFFF" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FF', // Un fondo más claro y moderno
  },
  scrollContainer: {
    paddingBottom: 100, // Espacio para los botones de acción
  },
  businessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    margin: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  businessImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
  },
  businessImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  businessImagePlaceholderText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  businessInfo: {
    flex: 1,
    marginLeft: 16,
  },
  businessName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  categoryBadge: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
  },
  ratingContainer: {
    alignItems: 'center',
    marginVertical: 16,
    zIndex: 5, // Asegurar que las estrellas estén por encima de otros elementos
  },
  ratingText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 8,
  },
  textInputContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  textInput: {
    height: 150,
    padding: 16,
    fontSize: 16,
    color: '#333333',
    textAlignVertical: 'top',
  },
  textCountContainer: {
    padding: 8,
    alignItems: 'flex-end',
    backgroundColor: '#F9F9F9',
  },
  textCount: {
    fontSize: 12,
    color: '#666666',
  },
  textCountWarning: {
    color: '#FF9500',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 8,
    marginLeft: 4,
  },
  imageCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  imageCountText: {
    fontSize: 12,
    color: '#666666',
    marginLeft: 4,
  },
  actionButtonsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  cancelButton: {
    flex: 1,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '500',
  },
  submitButton: {
    flex: 2,
    height: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginLeft: 8,
    paddingHorizontal: 16,
  },
  submitButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginRight: 8,
  },
});

export default ReviewForm;

// Importaciones de funciones que deben estar definidas en sus respectivos servicios
function addReview(reviewData: any): Promise<string> {
  // Implementación real en tu servicio
  return Promise.resolve('review-id');
}

function updateReview(id: string, data: any): Promise<void> {
  // Implementación real en tu servicio
  return Promise.resolve();
}

function uploadReviewImages(reviewId: string, images: string[]): Promise<void> {
  // Implementación real en tu servicio
  return Promise.resolve();
}