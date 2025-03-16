import { firestore, storage, auth } from '../config/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { Review, ReviewFilters, ReviewsStats, ReviewImage } from '../models/reviewTypes';
import { Alert } from 'react-native';

export const reviewsCollection = firestore.collection('reviews');
export const businessesCollection = firestore.collection('businesses');

// Create a new review
export const addReview = async (reviewData: any): Promise<string> => {
  try {
    // Remove any undefined values from the reviewData
    const sanitizedData = Object.entries(reviewData).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);
    
    // Now add the sanitized data to Firestore
    const reviewRef = await reviewsCollection.add({
      ...sanitizedData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      moderationStatus: 'approved', // Default status
    });
    
    return reviewRef.id;
  } catch (error) {
    console.error('Error adding review:', error);
    Alert.alert('Error', 'No se pudo publicar la reseña. Inténtalo de nuevo.');
    throw error;
  }
};

// Get reviews for a business with pagination
export const getBusinessReviews = async (businessId: string, limit = 10, lastVisible: firebase.firestore.QueryDocumentSnapshot | null = null) => {
  try {
    let query = reviewsCollection
      .where('businessId', '==', businessId)
      .where('moderationStatus', '==', 'approved')
      .orderBy('createdAt', 'desc')
      .limit(limit);
      
    if (lastVisible) {
      query = query.startAfter(lastVisible);
    }
    
    const snapshot = await query.get();
    const reviews = snapshot.docs.map((doc: firebase.firestore.QueryDocumentSnapshot) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        ownerReply: data.ownerReply ? {
          ...data.ownerReply,
          repliedAt: data.ownerReply.repliedAt?.toDate() || new Date()
        } : undefined
      } as Review;
    });
    
    const lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1] || null;
    
    return {
      reviews,
      lastVisible: lastVisibleDoc
    };
  } catch (error) {
    console.error('Error getting reviews:', error);
    Alert.alert('Error', 'No se pudieron cargar las reseñas.');
    throw error;
  }
};

// Get reviews stats for a business
export const getBusinessReviewsStats = async (businessId: string): Promise<ReviewsStats> => {
  try {
    // This could be a denormalized document in Firestore for performance
    // Or you could use a Cloud Function to keep this updated
    
    const business = await businessesCollection.doc(businessId).get();
    const businessData = business.data();
    
    if (!businessData) {
      throw new Error('Business not found');
    }
    
    // If you have denormalized statistics
    if (businessData.reviewStats) {
      return businessData.reviewStats as ReviewsStats;
    }
    
    // If not, calculate them on the fly (less efficient)
    const reviewsSnapshot = await reviewsCollection
      .where('businessId', '==', businessId)
      .where('moderationStatus', '==', 'approved')
      .get();
    
    const totalCount = reviewsSnapshot.size;
    let totalRating = 0;
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    
    reviewsSnapshot.docs.forEach((doc: firebase.firestore.QueryDocumentSnapshot) => {
      const data = doc.data();
      const rating = data.rating || 0;
      totalRating += rating;
      if (rating >= 1 && rating <= 5) {
        ratingDistribution[rating]++;
      }
    });
    
    return {
      totalCount,
      averageRating: totalCount > 0 ? totalRating / totalCount : 0,
      ratingDistribution
    };
  } catch (error) {
    console.error('Error getting review stats:', error);
    throw error;
  }
};

// Update an existing review
export const updateReview = async (reviewId: string, updates: Partial<Review>): Promise<void> => {
  try {
    const reviewRef = reviewsCollection.doc(reviewId);
    const review = await reviewRef.get();
    
    if (!review.exists) {
      throw new Error('Review not found');
    }
    
    const oldData = review.data() || {};
    await reviewRef.update({
      ...updates,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // If rating changed, update business stats
    if (updates.rating && updates.rating !== oldData.rating) {
      const ratingDiff = updates.rating - (oldData.rating || 0);
      const businessRef = businessesCollection.doc(oldData.businessId);
      await businessRef.update({
        totalRating: firebase.firestore.FieldValue.increment(ratingDiff)
      });
    }
  } catch (error) {
    console.error('Error updating review:', error);
    Alert.alert('Error', 'No se pudo actualizar la reseña.');
    throw error;
  }
};

// Delete a review
export const deleteReview = async (reviewId: string): Promise<void> => {
  try {
    const reviewRef = reviewsCollection.doc(reviewId);
    const review = await reviewRef.get();
    
    if (!review.exists) {
      throw new Error('Review not found');
    }
    
    const reviewData = review.data() || {};
    
    // Delete review document
    await reviewRef.delete();
    
    // Update business stats
    const businessRef = businessesCollection.doc(reviewData.businessId);
    await businessRef.update({
      reviewsCount: firebase.firestore.FieldValue.increment(-1),
      totalRating: firebase.firestore.FieldValue.increment(-(reviewData.rating || 0))
    });
    
    // Delete any associated images from storage
    if (reviewData.images && Array.isArray(reviewData.images) && reviewData.images.length > 0) {
      const deletePromises = reviewData.images.map(async (image: ReviewImage) => {
        if (image && image.url) {
          try {
            const imageRef = storage.refFromURL(image.url);
            return imageRef.delete();
          } catch (imageError) {
            console.error('Error deleting image:', imageError);
            return Promise.resolve(); // Continue with other deletions even if one fails
          }
        }
        return Promise.resolve();
      });
      await Promise.all(deletePromises);
    }
  } catch (error) {
    console.error('Error deleting review:', error);
    Alert.alert('Error', 'No se pudo eliminar la reseña.');
    throw error;
  }
};

// Add owner reply to a review
export const addOwnerReply = async (reviewId: string, replyText: string, ownerId: string): Promise<void> => {
  try {
    const reviewRef = reviewsCollection.doc(reviewId);
    await reviewRef.update({
      ownerReply: {
        text: replyText,
        repliedAt: firebase.firestore.FieldValue.serverTimestamp(),
        ownerId
      },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error adding reply:', error);
    Alert.alert('Error', 'No se pudo agregar la respuesta.');
    throw error;
  }
};

// Toggle like on a review
export const toggleReviewLike = async (reviewId: string, userId: string): Promise<void> => {
  try {
    const reviewRef = reviewsCollection.doc(reviewId);
    const review = await reviewRef.get();
    
    if (!review.exists) {
      throw new Error('Review not found');
    }
    
    const data = review.data() || {};
    const usersWhoLiked = data.reactions?.usersWhoLiked || [];
    
    if (usersWhoLiked.includes(userId)) {
      // User already liked, so unlike
      await reviewRef.update({
        'reactions.usersWhoLiked': firebase.firestore.FieldValue.arrayRemove(userId),
        'reactions.likes': firebase.firestore.FieldValue.increment(-1)
      });
    } else {
      // User hasn't liked yet, so add like
      await reviewRef.update({
        'reactions.usersWhoLiked': firebase.firestore.FieldValue.arrayUnion(userId),
        'reactions.likes': firebase.firestore.FieldValue.increment(1)
      });
    }
  } catch (error) {
    console.error('Error toggling like:', error);
    Alert.alert('Error', 'No se pudo procesar tu reacción.');
    throw error;
  }
};

// Upload review images - Updated to handle permissions better
export const uploadReviewImages = async (reviewId: string, imageUris: string[]): Promise<ReviewImage[]> => {
  try {
    // Ensure user is authenticated
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User must be authenticated to upload images');
    }
    
    const uploadedImages: ReviewImage[] = [];
    
    for (const uri of imageUris) {
      // Use a more permission-friendly path structure that includes user ID
      const filename = `users/${currentUser.uid}/reviews/${reviewId}/${Date.now()}`;
      const reference = storage.ref(filename);
      
      console.log(`Uploading to path: ${filename}`);
      
      try {
        // Get blob from local URI
        const response = await fetch(uri);
        const blob = await response.blob();
        
        // Upload image
        await reference.put(blob);
        
        // Get download URL
        const url = await reference.getDownloadURL();
        
        // Generate thumbnail (in real implementation, you might use a Cloud Function for this)
        // For now, we'll use the same URL
        const thumbnailUrl = url;
        
        uploadedImages.push({
          id: filename,
          url,
          thumbnailUrl,
          uploadedAt: new Date()
        });
      } catch (uploadError) {
        console.error(`Error uploading image ${uri}:`, uploadError);
        // Continue with other images even if one fails
      }
    }
    
    if (uploadedImages.length === 0) {
      throw new Error('Failed to upload any images');
    }
    
    // Add images to review
    const reviewRef = reviewsCollection.doc(reviewId);
    await reviewRef.update({
      images: firebase.firestore.FieldValue.arrayUnion(...uploadedImages),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    return uploadedImages;
  } catch (error) {
    console.error('Error uploading images:', error);
    if ((error as any)?.code === 'storage/unauthorized') {
      Alert.alert(
        'Error',
        'No tienes permisos para subir imágenes. Por favor, inicia sesión nuevamente.'
      );
    } else {
      Alert.alert('Error', 'No se pudieron subir las imágenes.');
    }
    throw error;
  }
};

// Filter and sort reviews
export const filterReviews = async (filters: ReviewFilters, limit = 10, lastVisible: firebase.firestore.QueryDocumentSnapshot | null = null) => {
  try {
    let query: firebase.firestore.Query = reviewsCollection
      .where('moderationStatus', '==', 'approved');
    
    if (filters.businessId) {
      query = query.where('businessId', '==', filters.businessId);
    }
    
    if (filters.userId) {
      query = query.where('userId', '==', filters.userId);
    }
    
    if (filters.rating) {
      query = query.where('rating', '==', filters.rating);
    }
    
    // Need to create composite indexes in Firebase for these sorts to work together
    switch (filters.sortBy) {
      case 'recent':
        query = query.orderBy('createdAt', 'desc');
        break;
      case 'rating':
        // Note: This requires a composite index in Firebase
        query = query.orderBy('rating', 'desc').orderBy('createdAt', 'desc');
        break;
      case 'relevant':
        // Note: This requires a composite index in Firebase
        query = query.orderBy('reactions.likes', 'desc').orderBy('createdAt', 'desc');
        break;
      default:
        query = query.orderBy('createdAt', 'desc');
    }
    
    query = query.limit(limit);
    
    if (lastVisible) {
      query = query.startAfter(lastVisible);
    }
    
    const snapshot = await query.get();
    const reviews = snapshot.docs.map((doc: firebase.firestore.QueryDocumentSnapshot) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        ownerReply: data.ownerReply ? {
          ...data.ownerReply,
          repliedAt: data.ownerReply.repliedAt?.toDate() || new Date()
        } : undefined
      } as Review;
    });
    
    const lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1] || null;
    
    return {
      reviews,
      lastVisible: lastVisibleDoc
    };
  } catch (error) {
    console.error('Error filtering reviews:', error);
    throw error;
  }
};
