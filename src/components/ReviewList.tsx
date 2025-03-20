import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import ReviewItem from '../../components/reviews/ReviewItem';
import { Review, ReviewSortMethod } from '../../src/types';
import { Review as ModelReview } from '../../models/reviewTypes';
import { colors, spacing } from '../../theme';
import StarRating from '../../components/reviews/StarRating';
// Change the import to use Business from context instead of types/businessTypes
import { Business } from '../context/BusinessContext';

interface ReviewListProps {
  // Core props
  businessId: string;
  isBusinessOwner: boolean;
  
  // Optional props
  business?: Business; // Now using Business from context
  reviews?: any[];
  currentUserId?: string;
  loading?: boolean;
  loadMore?: () => void;
  hasMore?: boolean;
  stats?: any;
  onAddReview?: () => void;
  onReply?: (reviewId: string) => void;
  onReport?: (reviewId: string) => void;
  onEditReview?: (review: any) => void;
  onDeleteReview?: (reviewId: string) => void;
  onFilterChange?: (rating: number | null) => void;
  activeFilter?: number | null;
  sortBy?: ReviewSortMethod;
  onSortChange?: (sort: ReviewSortMethod) => void;
  useScrollableContainer?: boolean;
}

// Helper function to ensure date objects are proper Dates
const ensureDates = (review: Review): ModelReview => {
  return {
    ...review,
    createdAt: review.createdAt instanceof Date ? 
      review.createdAt : new Date(review.createdAt),
    updatedAt: review.updatedAt instanceof Date ?
      review.updatedAt : new Date(review.updatedAt)
  } as ModelReview;
};

const ReviewList: React.FC<ReviewListProps> = ({
  businessId,
  isBusinessOwner,
  business,
  reviews = [],
  currentUserId = '',
  loading = false,
  loadMore,
  hasMore = false,
  stats,
  onAddReview = () => {},
  onReply = () => {},
  onReport = () => {},
  onEditReview = () => {},
  onDeleteReview = () => {},
  onFilterChange = () => {},
  activeFilter = null,
  sortBy = 'recent' as ReviewSortMethod,
  onSortChange = () => {},
  useScrollableContainer = false
}) => {
  // Helper to safely access stats properties
  const getReviewCount = () => {
    if (!stats) return 0;
    return (stats as any).totalReviews || 
           (stats as any).total || 
           (stats as any).count || 
           (stats as any).reviewCount || 
           0;
  };

  // Header component for reviews
  const ReviewsHeader = () => (
    <View style={styles.header}>
      {/* Stats section */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.ratingSummary}>
            <Text style={styles.averageRating}>{stats.averageRating.toFixed(1)}</Text>
            <StarRating rating={stats.averageRating} size={20} />
            <Text style={styles.totalReviews}>({getReviewCount()} reseñas)</Text>
          </View>
        </View>
      )}
      
      {/* Filter controls */}
      <View style={styles.filterContainer}>
        <Text style={styles.sectionTitle}>Filtrar por:</Text>
        <View style={styles.filterOptions}>
          <TouchableOpacity
            style={[styles.filterOption, activeFilter === null && styles.activeFilterOption]}
            onPress={() => onFilterChange(null)}
          >
            <Text style={[styles.filterText, activeFilter === null && styles.activeFilterText]}>
              Todas
            </Text>
          </TouchableOpacity>
          
          {[5, 4, 3, 2, 1].map(rating => (
            <TouchableOpacity
              key={rating}
              style={[styles.filterOption, activeFilter === rating && styles.activeFilterOption]}
              onPress={() => onFilterChange(rating)}
            >
              <Text style={[styles.filterText, activeFilter === rating && styles.activeFilterText]}>
                {rating}★
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      {/* Sort controls */}
      <View style={styles.sortContainer}>
        <Text style={styles.sectionTitle}>Ordenar por:</Text>
        <View style={styles.sortOptions}>
          {[
            { value: 'recent' as ReviewSortMethod, label: 'Más recientes' },
            { value: 'rating' as ReviewSortMethod, label: 'Calificación' },
            { value: 'relevant' as ReviewSortMethod, label: 'Relevancia' }
          ].map(option => (
            <TouchableOpacity
              key={option.value}
              style={[styles.sortOption, sortBy === option.value && styles.activeSortOption]}
              onPress={() => onSortChange(option.value)}
            >
              <Text style={[styles.sortText, sortBy === option.value && styles.activeSortText]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  // Reviews list content - using direct rendering instead of FlatList
  const ReviewsContent = () => (
    <>
      {reviews.length === 0 && !loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No hay reseñas disponibles</Text>
        </View>
      ) : (
        reviews.map(review => (
          <ReviewItem
            key={review.id}
            review={ensureDates(review)}
            currentUserId={currentUserId}
            isOwner={isBusinessOwner}
            onReply={() => onReply(review.id)}
            onReport={() => onReport(review.id)}
            onEditReview={() => onEditReview(review)}
            onDeleteReview={() => onDeleteReview(review.id)}
          />
        ))
      )}
      
      {hasMore && (
        <TouchableOpacity 
          style={styles.loadMoreButton}
          onPress={loadMore}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.loadMoreText}>Cargar más reseñas</Text>
          )}
        </TouchableOpacity>
      )}
    </>
  );

  return (
    <View style={styles.container}>
      <ReviewsHeader />
      {loading && reviews.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando reseñas...</Text>
        </View>
      ) : (
        <ReviewsContent />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: 16,
  },
  statsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  ratingSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  averageRating: {
    fontSize: 28,
    fontWeight: 'bold',
    marginRight: 8,
    color: '#000000',
  },
  totalReviews: {
    marginLeft: 8,
    color: '#666666',
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#000000',
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterOption: {
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  activeFilterOption: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    color: '#666666',
  },
  activeFilterText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  sortContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sortOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sortOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeSortOption: {
    borderBottomColor: colors.primary,
  },
  sortText: {
    color: '#666666',
  },
  activeSortText: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666666',
    fontSize: 16,
    fontStyle: 'italic',
  },
  loadMoreButton: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 16,
  },
  loadMoreText: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    color: '#666666',
    marginTop: 8,
  },
});

export default ReviewList;