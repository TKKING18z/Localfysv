import React from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Business } from '../../context/BusinessContext';
import ReviewList from '../ReviewList';

const { height } = Dimensions.get('window');

interface BusinessReviewsTabProps {
  businessId: string;
  business: Business;
  reviews: any[];
  isBusinessOwner: boolean;
  currentUserId: string;
  loadingReviews: boolean;
  reviewActiveFilter: number | null;
  reviewSortBy: 'recent' | 'rating' | 'relevant';
  onShowReviewForm: () => void;
  onReplyReview: (reviewId: string) => void;
  onReportReview: (reviewId: string) => void;
  onEditReview: (review: any) => void;
  onDeleteReview: (reviewId: string) => void;
  onFilterChange: (filter: number | null) => void;
  onSortChange: (sort: 'recent' | 'rating' | 'relevant') => void;
}

const BusinessReviewsTab: React.FC<BusinessReviewsTabProps> = ({
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
  onSortChange,
}) => {
  // Calculate review stats
  const totalReviews = reviews.length;
  const averageRating = calculateAverageRating(reviews);
  const ratingCounts = calculateRatingCounts(reviews);

  return (
    <View style={styles.container}>
      {/* Review summary card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <MaterialIcons name="star" size={24} color="#007aff" />
          <Text style={styles.summaryTitle}>Resumen de Reseñas</Text>
        </View>
        
        <View style={styles.ratingSummary}>
          <View style={styles.averageRatingContainer}>
            <Text style={styles.averageRating}>
              {averageRating > 0 ? averageRating.toFixed(1) : '-'}
            </Text>
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map(star => (
                <MaterialIcons 
                  key={star}
                  name="star" 
                  size={16} 
                  color={star <= Math.round(averageRating) ? "#FFCC00" : "#E1E1E1"} 
                />
              ))}
            </View>
            <Text style={styles.totalReviews}>
              {totalReviews} {totalReviews === 1 ? 'reseña' : 'reseñas'}
            </Text>
          </View>
          
          <View style={styles.ratingBarsContainer}>
            {[5, 4, 3, 2, 1].map(rating => (
              <TouchableOpacity 
                key={rating} 
                style={styles.ratingBarRow}
                onPress={() => onFilterChange(reviewActiveFilter === rating ? null : rating)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.ratingLabel, 
                  reviewActiveFilter === rating && styles.activeFilterText
                ]}>
                  {rating}
                </Text>
                <MaterialIcons 
                  name="star" 
                  size={12} 
                  color={reviewActiveFilter === rating ? "#007aff" : "#FFCC00"} 
                />
                <View style={styles.ratingBarContainer}>
                  <View 
                    style={[
                      styles.ratingBar, 
                      { width: `${(ratingCounts[rating] / Math.max(totalReviews, 1)) * 100}%` },
                      reviewActiveFilter === rating && styles.activeFilterBar
                    ]} 
                  />
                </View>
                <Text style={styles.ratingCount}>{ratingCounts[rating]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.addReviewButton}
          onPress={onShowReviewForm}
          activeOpacity={0.8}
        >
          <MaterialIcons name="rate-review" size={20} color="white" style={{marginRight: 8}} />
          <Text style={styles.addReviewButtonText}>Escribir reseña</Text>
        </TouchableOpacity>
      </View>
      
      {/* Reviews list card */}
      <View style={styles.reviewsCard}>
        <View style={styles.reviewsHeader}>
          <View style={styles.reviewsTitle}>
            <MaterialIcons name="format-list-bulleted" size={20} color="#007aff" />
            <Text style={styles.sectionTitle}>Reseñas de clientes</Text>
          </View>
          
          <View style={styles.sortContainer}>
            <Text style={styles.sortLabel}>Ordenar por:</Text>
            <TouchableOpacity 
              style={styles.sortButton}
              onPress={() => {
                const nextSort = reviewSortBy === 'recent' 
                  ? 'rating' 
                  : reviewSortBy === 'rating' ? 'relevant' : 'recent';
                onSortChange(nextSort);
              }}
            >
              <Text style={styles.sortButtonText}>
                {reviewSortBy === 'recent' 
                  ? 'Recientes' 
                  : reviewSortBy === 'rating' ? 'Calificación' : 'Relevancia'}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={18} color="#007aff" />
            </TouchableOpacity>
          </View>
        </View>
        
        {loadingReviews ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007aff" />
            <Text style={styles.loadingText}>Cargando reseñas...</Text>
          </View>
        ) : (
          <ReviewList 
            businessId={businessId}
            isBusinessOwner={isBusinessOwner}
            business={business}
            reviews={reviews}
            currentUserId={currentUserId}
            loading={loadingReviews}
            onAddReview={onShowReviewForm}
            onReply={onReplyReview}
            onReport={onReportReview}
            onEditReview={onEditReview}
            onDeleteReview={onDeleteReview}
            activeFilter={reviewActiveFilter}
            onFilterChange={onFilterChange}
            sortBy={reviewSortBy}
            onSortChange={onSortChange}
          />
        )}
        
        {!loadingReviews && reviews.length === 0 && (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="rate-review" size={40} color="#E1E1E1" />
            <Text style={styles.emptyText}>No hay reseñas todavía</Text>
            <Text style={styles.emptySubtext}>¡Sé el primero en opinar!</Text>
          </View>
        )}
      </View>
    </View>
  );
};

// Helper functions
const calculateAverageRating = (reviews: any[]): number => {
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((total, review) => total + (review.rating || 0), 0);
  return sum / reviews.length;
};

const calculateRatingCounts = (reviews: any[]): Record<number, number> => {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  
  reviews.forEach(review => {
    const rating = review.rating || 0;
    if (rating >= 1 && rating <= 5) {
      counts[rating as 1 | 2 | 3 | 4 | 5] += 1;
    }
  });
  
  return counts;
};

const styles = StyleSheet.create({
  container: {
    minHeight: height * 0.5,
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,122,255,0.1)',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 10,
  },
  ratingSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  averageRatingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '30%',
  },
  averageRating: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  totalReviews: {
    fontSize: 14,
    color: '#8E8E93',
  },
  ratingBarsContainer: {
    width: '65%',
  },
  ratingBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingLabel: {
    width: 18,
    fontSize: 14,
    fontWeight: '500',
    marginRight: 4,
    color: '#666',
  },
  ratingBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#F2F2F7',
    borderRadius: 4,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  ratingBar: {
    height: '100%',
    backgroundColor: '#FFCC00',
    borderRadius: 4,
  },
  ratingCount: {
    width: 24,
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'right',
  },
  activeFilterText: {
    color: '#007aff',
    fontWeight: 'bold',
  },
  activeFilterBar: {
    backgroundColor: '#007aff',
  },
  addReviewButton: {
    backgroundColor: '#007aff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  addReviewButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  reviewsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,122,255,0.1)',
  },
  reviewsTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 10,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginRight: 6,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,122,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sortButtonText: {
    fontSize: 14,
    color: '#007aff',
    fontWeight: '500',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 15,
    color: '#8E8E93',
  },
});

export default BusinessReviewsTab; 