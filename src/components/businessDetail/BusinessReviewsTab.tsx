import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
  ScrollView,
  Alert,
  Modal
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Business } from '../../context/BusinessContext';
import { useNetwork } from '../../context/NetworkContext';
import FastImageView from '../common/FastImageView';
import { throttle } from '../../utils/performanceUtils';
import ReviewList from '../ReviewList';

const { height } = Dimensions.get('window');

// Extended Business type with the fields we're using
interface BusinessWithRating extends Business {
  averageRating?: number;
}

// Review type
interface Review {
  id: string;
  userId: string;
  userName?: string;
  userPhotoURL?: string;
  rating: number;
  comment: string | { text?: string, content?: string } | null | undefined;
  createdAt: any; // Firebase timestamp or Date
  images?: string[] | null;
  imageUrls?: string[] | null;
  reviewImages?: string[] | null;
  photoUrls?: string[] | null;
  photos?: Array<{url: string}> | string[] | null;
}

// Add this helper function after the Review interface
// Helper function to safely extract comment text
const getReviewComment = (review: Review): string => {
  if (!review) return 'Sin comentario';
  
  // Try different possible formats
  if (typeof review.comment === 'string') {
    return review.comment.trim() || 'Sin comentario';
  }
  
  if (typeof review.comment === 'object' && review.comment !== null) {
    // Try accessing common fields in comment objects
    const text = review.comment.text || review.comment.content;
    if (typeof text === 'string') {
      return text.trim() || 'Sin comentario';
    }
    
    // If we have an object but couldn't find text, try to stringify it for debugging
    try {
      return JSON.stringify(review.comment) || 'Sin comentario';
    } catch (e) {
      console.warn('Could not stringify review comment', e);
      return 'Sin comentario';
    }
  }
  
  return 'Sin comentario';
};

interface BusinessReviewsTabProps {
  businessId: string;
  business: BusinessWithRating;
  reviews: Review[];
  isBusinessOwner: boolean;
  currentUserId: string;
  loadingReviews: boolean;
  reviewActiveFilter: number | null;
  reviewSortBy: 'recent' | 'rating' | 'relevant';
  onShowReviewForm: () => void;
  onReplyReview: (reviewId: string) => void;
  onReportReview: (reviewId: string) => void;
  onEditReview: (review: Review) => void;
  onDeleteReview: (reviewId: string) => void;
  onFilterChange: (filter: number | null) => void;
  onSortChange: (sort: 'recent' | 'rating' | 'relevant') => void;
}

// Props for ReviewItem component
interface ReviewItemProps {
  review: Review;
  currentUserId: string;
  isBusinessOwner: boolean;
  onReplyReview: (reviewId: string) => void;
  onReportReview: (reviewId: string) => void;
  onEditReview: (review: Review) => void;
  onDeleteReview: (reviewId: string) => void;
}

// Componente memoizado para una sola reseña
const ReviewItem = React.memo(({ 
  review, 
  currentUserId, 
  isBusinessOwner,
  onReplyReview,
  onReportReview,
  onEditReview,
  onDeleteReview
}: ReviewItemProps) => {
  const canModify = currentUserId === review.userId;
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  const handleReply = useCallback(() => {
    onReplyReview(review.id);
  }, [review.id, onReplyReview]);

  const handleReport = useCallback(() => {
    onReportReview(review.id);
  }, [review.id, onReportReview]);

  const handleEdit = useCallback(() => {
    onEditReview(review);
  }, [review, onEditReview]);

  const handleDelete = useCallback(() => {
    onDeleteReview(review.id);
  }, [review.id, onDeleteReview]);

  // Get review images from different possible fields
  const getReviewImages = (): string[] => {
    if (review.images && Array.isArray(review.images)) {
      // If images is array of objects with url property
      if (review.images.length > 0 && typeof review.images[0] === 'object' && review.images[0] !== null) {
        return review.images.map((img: any) => img.url || '').filter(Boolean);
      }
      // If images is array of strings
      else if (review.images.length > 0 && typeof review.images[0] === 'string') {
        return review.images;
      }
    }
    
    if (review.imageUrls && Array.isArray(review.imageUrls) && review.imageUrls.length > 0) {
      return review.imageUrls;
    }
    
    if (review.reviewImages && Array.isArray(review.reviewImages) && review.reviewImages.length > 0) {
      return review.reviewImages;
    }
    
    if (review.photoUrls && Array.isArray(review.photoUrls) && review.photoUrls.length > 0) {
      return review.photoUrls;
    }
    
    if (review.photos) {
      if (Array.isArray(review.photos)) {
        if (review.photos.length > 0) {
          // Check if the photos array contains string URLs
          if (typeof review.photos[0] === 'string') {
            return review.photos as string[];
          }
          // Check if the photos array contains objects with url property
          if (typeof review.photos[0] === 'object' && review.photos[0] !== null) {
            const firstPhoto = review.photos[0] as any;
            if (firstPhoto.url) {
              return review.photos.map((photo: any) => photo.url);
            }
          }
        }
      }
    }
    
    return [];
  };

  // Log the review data for debugging
  console.log('Review data:', {
    id: review.id,
    userName: review.userName,
    commentType: typeof review.comment,
    comment: review.comment,
    extractedComment: getReviewComment(review),
    hasImages: getReviewImages().length > 0,
    imageCount: getReviewImages().length,
    images: getReviewImages()
  });
  
  // Get the comment text using our helper
  const commentText = getReviewComment(review);
  
  // Get review images
  const reviewImages = getReviewImages();
  
  // Handle image press to open in full-screen modal
  const handleImagePress = useCallback((index: number) => {
    setSelectedImageIndex(index);
    setShowImageModal(true);
  }, []);

  // Close the image modal
  const closeImageModal = useCallback(() => {
    setShowImageModal(false);
    setSelectedImageIndex(null);
  }, []);

  return (
    <View style={styles.reviewItem}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewerInfo}>
          {review.userPhotoURL ? (
            <View style={styles.reviewerAvatar}>
              <FastImageView
                source={{ uri: review.userPhotoURL }}
                style={{ width: '100%', height: '100%', borderRadius: 20 }}
                resizeMode="cover"
                placeholderColor="#E1E1E1"
              />
            </View>
          ) : (
            <View style={[styles.reviewerAvatar, styles.defaultAvatar]}>
              <Text style={styles.defaultAvatarText}>
                {review.userName?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
          )}
          <View>
            <Text style={styles.reviewerName}>{review.userName || 'Usuario'}</Text>
            <Text style={styles.reviewDate}>
              {new Date(review.createdAt?.toDate?.() || review.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View style={styles.ratingBadge}>
          <MaterialIcons name="star" size={14} color="#FFFFFF" />
          <Text style={styles.ratingText}>{review.rating.toFixed(1)}</Text>
        </View>
      </View>

      {/* Comment Text - Using our improved helper function */}
      <View style={styles.commentContainer}>
        <Text style={styles.reviewText}>
          {commentText}
        </Text>
      </View>

      {/* Review Images - Enhanced with gallery and image viewer */}
      {reviewImages.length > 0 && (
        <View style={styles.reviewImagesContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.imageScrollContainer}
          >
            {reviewImages.map((imageUrl, index) => (
              <TouchableOpacity
                key={`${review.id}-image-${index}`}
                style={styles.reviewImageContainer}
                onPress={() => handleImagePress(index)}
                activeOpacity={0.9}
              >
                <FastImageView
                  source={{ uri: imageUrl }}
                  style={styles.reviewImage}
                  resizeMode="cover"
                  placeholderColor="#E1E1E1"
                  showLoadingIndicator={true}
                />
                {index === 0 && reviewImages.length > 1 && (
                  <View style={styles.imageCountBadge}>
                    <MaterialIcons name="photo-library" size={12} color="#FFFFFF" />
                    <Text style={styles.imageCountText}>+{reviewImages.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Image Viewer Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImageModal}
      >
        <View style={styles.imageViewerContainer}>
          <TouchableOpacity
            style={styles.closeImageViewerButton}
            onPress={closeImageModal}
          >
            <MaterialIcons name="close" size={28} color="white" />
          </TouchableOpacity>
          
          {selectedImageIndex !== null && reviewImages[selectedImageIndex] && (
            <View style={styles.fullImageContainer}>
              <FastImageView
                source={{ uri: reviewImages[selectedImageIndex] }}
                style={styles.fullImage}
                resizeMode="contain"
                placeholderColor="#000"
                showLoadingIndicator={true}
              />
              
              <View style={styles.imageCounter}>
                <Text style={styles.imageCounterText}>
                  {selectedImageIndex + 1} / {reviewImages.length}
                </Text>
              </View>
            </View>
          )}
          
          {/* Navigation buttons */}
          <View style={styles.imageNavigation}>
            {selectedImageIndex !== null && selectedImageIndex > 0 && (
              <TouchableOpacity
                style={styles.imageNavigationButton}
                onPress={() => setSelectedImageIndex(selectedImageIndex - 1)}
              >
                <MaterialIcons name="arrow-back-ios" size={24} color="white" />
              </TouchableOpacity>
            )}
            
            {selectedImageIndex !== null && selectedImageIndex < reviewImages.length - 1 && (
              <TouchableOpacity
                style={[styles.imageNavigationButton, styles.imageNavigationButtonRight]}
                onPress={() => setSelectedImageIndex(selectedImageIndex + 1)}
              >
                <MaterialIcons name="arrow-forward-ios" size={24} color="white" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      <View style={styles.reviewActions}>
        {isBusinessOwner && !canModify && (
          <TouchableOpacity style={styles.reviewAction} onPress={handleReply}>
            <MaterialIcons name="reply" size={16} color="#007AFF" />
            <Text style={styles.reviewActionText}>Responder</Text>
          </TouchableOpacity>
        )}

        {canModify ? (
          <>
            <TouchableOpacity style={styles.reviewAction} onPress={handleEdit}>
              <MaterialIcons name="edit" size={16} color="#007AFF" />
              <Text style={styles.reviewActionText}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.reviewAction} onPress={handleDelete}>
              <MaterialIcons name="delete" size={16} color="#FF3B30" />
              <Text style={styles.reviewActionText}>Eliminar</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.reviewAction} onPress={handleReport}>
            <MaterialIcons name="flag" size={16} color="#FF9500" />
            <Text style={styles.reviewActionText}>Reportar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

// Renderizado optimizado de filtros usando arrays para múltiples elementos idénticos
const RatingFilters = React.memo(({ 
  activeFilter, 
  onFilterChange 
}: { 
  activeFilter: number | null, 
  onFilterChange: (rating: number | null) => void 
}) => {
  // Array de elementos de filtro para evitar código repetitivo
  const filters = useMemo(() => [5, 4, 3, 2, 1], []);
  
  const handleFilterPress = useCallback((rating: number | null) => {
    onFilterChange(activeFilter === rating ? null : rating);
  }, [activeFilter, onFilterChange]);
  
  return (
    <View style={styles.filterContainer}>
      <Text style={styles.filterHeading}>Filtrar por:</Text>
      <View style={styles.filterOptions}>
        {filters.map(rating => (
          <TouchableOpacity
            key={`filter-${rating}`}
            style={[
              styles.filterChip,
              activeFilter === rating && styles.activeFilterChip
            ]}
            onPress={() => handleFilterPress(rating)}
          >
            <MaterialIcons
              name="star"
              size={14}
              color={activeFilter === rating ? "#FFFFFF" : "#FFCC00"}
            />
            <Text style={[
              styles.filterChipText,
              activeFilter === rating && styles.activeFilterChipText
            ]}>
              {rating}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

// Definiendo tipos para las opciones de ordenación
type SortOption = {
  id: 'recent' | 'rating' | 'relevant';
  label: string;
  icon: string;
};

// Componente optimizado de opciones de ordenación
const SortOptions = React.memo(({
  sortBy,
  onSortChange
}: {
  sortBy: 'recent' | 'rating' | 'relevant',
  onSortChange: (sort: 'recent' | 'rating' | 'relevant') => void
}) => {
  const sortOptions = useMemo(() => [
    { id: 'recent' as const, label: 'Más recientes', icon: 'access-time' },
    { id: 'rating' as const, label: 'Mayor valoración', icon: 'trending-up' },
    { id: 'relevant' as const, label: 'Más relevantes', icon: 'trending-up' }
  ], []);
  
  return (
    <View style={styles.sortContainer}>
      <Text style={styles.filterHeading}>Ordenar por:</Text>
      <View style={styles.sortOptions}>
        {sortOptions.map(option => (
          <TouchableOpacity
            key={`sort-${option.id}`}
            style={[
              styles.sortButton,
              sortBy === option.id && styles.activeSortButton
            ]}
            onPress={() => onSortChange(option.id)}
          >
            <MaterialIcons
              name={option.icon as any}
              size={14}
              color={sortBy === option.id ? "#007AFF" : "#8E8E93"}
            />
            <Text style={[
              styles.sortButtonText,
              sortBy === option.id && styles.activeSortButtonText
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

// Header component for the reviews section
const ReviewsHeader = React.memo(({
  business,
  reviews,
  isConnected,
  loadingReviews,
  isSlowConnection,
  reviewActiveFilter,
  reviewSortBy,
  handleWriteReview,
  onFilterChange,
  onSortChange
}: {
  business: BusinessWithRating;
  reviews: Review[];
  isConnected: boolean;
  loadingReviews: boolean;
  isSlowConnection: boolean;
  reviewActiveFilter: number | null;
  reviewSortBy: 'recent' | 'rating' | 'relevant';
  handleWriteReview: () => void;
  onFilterChange: (filter: number | null) => void;
  onSortChange: (sort: 'recent' | 'rating' | 'relevant') => void;
}) => {
  return (
    <>
      {/* Cabecera con estadísticas y llamado a la acción */}
      <View style={styles.header}>
        <View style={styles.ratingOverview}>
          <Text style={styles.averageRating}>
            {business.averageRating?.toFixed(1) || '0.0'}
          </Text>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <MaterialIcons
                key={`star-${star}`}
                name="star"
                size={16}
                color={star <= Math.round(business.averageRating || 0) ? "#FFCC00" : "#E0E0E0"}
              />
            ))}
          </View>
          <Text style={styles.reviewCount}>
            {reviews.length} {reviews.length === 1 ? 'reseña' : 'reseñas'}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.writeReviewButton}
          onPress={handleWriteReview}
          disabled={!isConnected}
        >
          <MaterialIcons name="create" size={20} color="#FFFFFF" />
          <Text style={styles.writeReviewButtonText}>Escribir reseña</Text>
        </TouchableOpacity>
      </View>
      
      {/* Componentes de filtro y ordenación - solo mostrar si hay reseñas */}
      {reviews.length > 0 && (
        <>
          <RatingFilters
            activeFilter={reviewActiveFilter}
            onFilterChange={onFilterChange}
          />
          
          <SortOptions
            sortBy={reviewSortBy}
            onSortChange={onSortChange}
          />
        </>
      )}
      
      {/* Advertencia de conexión lenta */}
      {isSlowConnection && !loadingReviews && (
        <View style={styles.offlineWarning}>
          <MaterialIcons name="signal-wifi-off" size={18} color="#FF9500" />
          <Text style={styles.offlineWarningText}>
            Conexión limitada. Algunas reseñas podrían no cargarse.
          </Text>
        </View>
      )}
    </>
  );
});

// Empty state component
const EmptyReviews = React.memo(({
  loadingReviews,
  business,
  reviewActiveFilter,
  handleWriteReview
}: {
  loadingReviews: boolean;
  business: BusinessWithRating;
  reviewActiveFilter: number | null;
  handleWriteReview: () => void;
}) => (
  <View style={styles.emptyContainer}>
    {loadingReviews ? (
      <ActivityIndicator size="large" color="#007AFF" />
    ) : (
      <>
        <MaterialIcons name="rate-review" size={64} color="#CCCCCC" />
        <Text style={styles.emptyText}>
          {reviewActiveFilter !== null 
            ? 'No hay reseñas con este filtro'
            : `${business.name} aún no tiene reseñas`}
        </Text>
        <Text style={styles.emptySubtext}>
          ¡Sé el primero en compartir tu experiencia!
        </Text>
        <TouchableOpacity 
          style={styles.writeReviewButton}
          onPress={handleWriteReview}
        >
          <MaterialIcons name="create" size={20} color="#FFFFFF" />
          <Text style={styles.writeReviewButtonText}>Escribir reseña</Text>
        </TouchableOpacity>
      </>
    )}
  </View>
));

// Componente principal optimizado - usando ScrollView en lugar de FlatList para solucionar el error de anidación
const BusinessReviewsTab = React.memo((props: BusinessReviewsTabProps) => {
  const {
    businessId,
    business,
    reviews,
    isBusinessOwner,
    currentUserId,
    loadingReviews,
    reviewActiveFilter,
    reviewSortBy,
    onShowReviewForm,
    onReplyReview,
    onReportReview,
    onEditReview,
    onDeleteReview,
    onFilterChange,
    onSortChange
  } = props;

  const { isConnected, isSlowConnection } = useNetwork();
  
  // Aplicar filtros a las reseñas - memoizado para rendimiento
  const filteredReviews = useMemo(() => {
    let result = [...reviews];
    
    // Filtrar por rating si hay un filtro activo
    if (reviewActiveFilter !== null) {
      result = result.filter(review => Math.round(review.rating) === reviewActiveFilter);
    }
    
    // Ordenar según la selección
    if (reviewSortBy === 'recent') {
      result.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || a.createdAt;
        const dateB = b.createdAt?.toDate?.() || b.createdAt;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
    } else if (reviewSortBy === 'rating') {
      result.sort((a, b) => b.rating - a.rating);
    } else {
      // 'relevant' - podría ser una combinación de reciente + alta valoración
      result.sort((a, b) => {
        // Prioriza reseñas más recientes pero da bonus a las de mayor rating
        const dateA = new Date(a.createdAt?.toDate?.() || a.createdAt).getTime();
        const dateB = new Date(b.createdAt?.toDate?.() || b.createdAt).getTime();
        const recencyScore = (dateB - dateA) / (1000 * 60 * 60 * 24); // Diferencia en días
        const ratingDiff = b.rating - a.rating;
        
        return (recencyScore * 0.7) + (ratingDiff * 3); // Ponderación: 70% reciente, 30% rating
      });
    }
    
    return result;
  }, [reviews, reviewActiveFilter, reviewSortBy]);
  
  // Manejar botón escribir reseña - optimizado con throttle
  const handleWriteReview = useCallback(throttle(() => {
    onShowReviewForm();
  }, 500), [onShowReviewForm]);

  // Usar ScrollView en lugar de FlatList para evitar el error de VirtualizedLists anidados
  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.reviewsList}
        showsVerticalScrollIndicator={false}
      >
        {/* Header con estadísticas y filtros */}
        <ReviewsHeader 
          business={business}
          reviews={reviews}
          isConnected={isConnected}
          loadingReviews={loadingReviews}
          isSlowConnection={isSlowConnection}
          reviewActiveFilter={reviewActiveFilter}
          reviewSortBy={reviewSortBy}
          handleWriteReview={handleWriteReview}
          onFilterChange={onFilterChange}
          onSortChange={onSortChange}
        />
        
        {/* Lista de reseñas */}
        {filteredReviews.length > 0 ? (
          <View style={styles.reviewsContainer}>
            {filteredReviews.map(review => (
              <ReviewItem
                key={review.id}
                review={review}
                currentUserId={currentUserId}
                isBusinessOwner={isBusinessOwner}
                onReplyReview={onReplyReview}
                onReportReview={onReportReview}
                onEditReview={onEditReview}
                onDeleteReview={onDeleteReview}
              />
            ))}
          </View>
        ) : (
          <EmptyReviews
            loadingReviews={loadingReviews}
            business={business}
            reviewActiveFilter={reviewActiveFilter}
            handleWriteReview={handleWriteReview}
          />
        )}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  reviewsList: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  reviewsContainer: {
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingOverview: {
    alignItems: 'flex-start',
  },
  averageRating: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333333',
  },
  starsContainer: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  reviewCount: {
    fontSize: 14,
    color: '#666666',
  },
  writeReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  writeReviewButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 6,
  },
  filterContainer: {
    marginBottom: 12,
  },
  sortContainer: {
    marginBottom: 16,
  },
  filterHeading: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  activeFilterChip: {
    backgroundColor: '#007AFF',
  },
  filterChipText: {
    color: '#333333',
    marginLeft: 4,
    fontWeight: '500',
  },
  activeFilterChipText: {
    color: '#FFFFFF',
  },
  sortOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  activeSortButton: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  sortButtonText: {
    color: '#8E8E93',
    marginLeft: 4,
    fontWeight: '500',
  },
  activeSortButtonText: {
    color: '#007AFF',
  },
  reviewItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    overflow: 'hidden',
  },
  defaultAvatar: {
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultAvatarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  reviewerName: {
    fontWeight: '600',
    fontSize: 16,
    color: '#333333',
  },
  reviewDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFCC00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 2,
    fontSize: 12,
  },
  commentContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
    minHeight: 60,
  },
  reviewText: {
    fontSize: 15,
    color: '#333333',
    lineHeight: 22,
    letterSpacing: 0.2,
    fontWeight: '400',
  },
  reviewActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  reviewAction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  reviewActionText: {
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: 4,
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
    marginBottom: 24,
    textAlign: 'center',
  },
  offlineWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9EB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFCC00',
  },
  offlineWarningText: {
    fontSize: 13,
    color: '#996600',
    marginLeft: 8,
    flex: 1,
  },
  imageScrollContainer: {
    marginBottom: 10,
    marginTop: 5,
  },
  reviewImageContainer: {
    width: 120,
    height: 90,
    borderRadius: 8,
    marginRight: 10,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    position: 'relative',
  },
  reviewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  imageCountBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeImageViewerButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    zIndex: 10,
  },
  fullImageContainer: {
    width: '100%',
    height: '80%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  imageCounter: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  imageCounterText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  imageNavigation: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  imageNavigationButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageNavigationButtonRight: {
    alignItems: 'flex-end',
    paddingRight: 10,
  },
  reviewImagesContainer: {
    marginBottom: 15,
  },
});

export default BusinessReviewsTab; 