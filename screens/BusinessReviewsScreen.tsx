import React from 'react';
import { View, StyleSheet, Text, Alert, ScrollView } from 'react-native';
import ReviewItem from '../components/reviews/ReviewItem';
import { useBusinessReviews } from '../hooks/useReviews';
import { BusinessReviewsScreenProps, Review as AppReview } from '../src/types';
import { Review as ModelReview } from '../models/reviewTypes';

// Helper function to ensure date objects are proper Dates
const ensureDates = (review: AppReview): ModelReview => {
  return {
    ...review,
    createdAt: review.createdAt instanceof Date ? 
      review.createdAt : new Date(review.createdAt),
    updatedAt: review.updatedAt instanceof Date ?
      review.updatedAt : new Date(review.updatedAt)
  } as ModelReview;
};

// Add type imports from useReviews
type ReviewFilterOption = 'all' | '1' | '2' | '3' | '4' | '5';
type ReviewSortOption = 'recent' | 'highest' | 'lowest';

const BusinessReviewsScreen: React.FC<BusinessReviewsScreenProps> = ({ businessId, currentUserId, isOwner }) => {
  const { 
    reviews, loading, error, hasMore, loadMore, 
    stats, filterByRating, activeFilter, sortBy, changeSortMethod 
  } = useBusinessReviews(businessId);

  // Event handlers
  const handleReply = (reviewId: string) => {
    Alert.alert('Reply', `Replying to review ${reviewId}`);
  };

  const handleReport = (reviewId: string) => {
    Alert.alert('Report', `Reporting review ${reviewId}`);
  };

  const handleEditReview = (reviewId: string) => {
    Alert.alert('Edit', `Editing review ${reviewId}`);
  };

  const handleDeleteReview = (reviewId: string) => {
    Alert.alert('Delete', `Deleting review ${reviewId}`);
  };

  // Helper to safely access stats properties - avoids TypeScript errors
  const getReviewCount = () => {
    if (!stats) return 0;
    // Try different property names that might exist on the stats object
    return (stats as any).totalReviews || 
           (stats as any).total || 
           (stats as any).count || 
           (stats as any).reviewCount || 
           0;
  };

  // Header component
  const HeaderComponent = () => (
    <View style={styles.header}>
      {loading && <Text>Loading reviews...</Text>}
      {error && <Text>Error loading reviews: {error}</Text>}
      
      <Text style={styles.title}>Reseñas</Text>
      
      {/* Stats section */}
      {stats && (
        <View style={styles.statsContainer}>
          <Text>Average rating: {stats.averageRating}</Text>
          <Text>Total reviews: {getReviewCount()}</Text>
        </View>
      )}
      
      {/* Filter controls - FIX: Convert numbers to strings for type safety */}
      <View style={styles.filterContainer}>
        <Text>Filter: {activeFilter || 'All'}</Text>
        {[5, 4, 3, 2, 1].map(rating => (
          <Text key={rating} onPress={() => filterByRating(rating.toString() as ReviewFilterOption)}>
            {rating} stars
          </Text>
        ))}
      </View>
      
      {/* Sort controls - FIX: Use correct sort options */}
      <View style={styles.sortContainer}>
        <Text>Sort by: {sortBy}</Text>
        <Text onPress={() => changeSortMethod('recent')}>Most Recent</Text>
        <Text onPress={() => changeSortMethod('highest')}>Highest Rating</Text>
        <Text onPress={() => changeSortMethod('lowest')}>Lowest Rating</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Use regular ScrollView instead of FlatList to avoid nesting issues */}
      <ScrollView>
        <HeaderComponent />
        
        {reviews.map((item) => (
          <ReviewItem
            key={item.id}
            review={ensureDates(item as AppReview)}
            currentUserId={currentUserId}
            isOwner={isOwner}
            onReply={() => handleReply(item.id)}
            onReport={() => handleReport(item.id)}
            onEditReview={() => handleEditReview(item.id)}
            onDeleteReview={() => handleDeleteReview(item.id)}
          />
        ))}
        
        {hasMore && (
          <View style={styles.loadMoreContainer}>
            <Text 
              style={styles.loadMoreText}
              onPress={loadMore}
            >
              Cargar más reseñas
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },
  header: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsContainer: {
    marginVertical: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  sortContainer: {
    marginVertical: 8,
  },
  loadMoreContainer: {
    padding: 16,
    alignItems: 'center',
  },
  loadMoreText: {
    color: '#007BFF',
    fontWeight: 'bold',
  }
});

export default BusinessReviewsScreen;
