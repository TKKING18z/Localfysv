import { useState, useEffect, useCallback } from 'react';
import firebase from 'firebase/compat/app'; // use compat version
import 'firebase/compat/firestore';
import { Review, ReviewsStats } from '../models/reviewTypes';
import { getBusinessReviewsStats, reviewsCollection } from '../services/reviewService';

export const useBusinessReviews = (businessId: string, limit = 10) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastVisible, setLastVisible] = useState<firebase.firestore.QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [stats, setStats] = useState<ReviewsStats | null>(null);
  const [activeFilter, setActiveFilter] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'recent' | 'rating' | 'relevant'>('recent');

  // Initial load of reviews
  useEffect(() => {
    let isMounted = true;

    const loadReviews = async () => {
      try {
        setLoading(true);
        setError(null);

        let query: firebase.firestore.Query = reviewsCollection
          .where('businessId', '==', businessId)
          .where('moderationStatus', '==', 'approved');
          
        if (activeFilter) {
          query = query.where('rating', '==', activeFilter);
        }
        
        switch (sortBy) {
          case 'recent':
            query = query.orderBy('createdAt', 'desc');
            break;
          case 'rating':
            query = query.orderBy('rating', 'desc').orderBy('createdAt', 'desc');
            break;
          case 'relevant':
            query = query.orderBy('reactions.likes', 'desc').orderBy('createdAt', 'desc');
            break;
        }
        
        query = query.limit(limit);
        
        const snapshot = await query.get();
        
        if (!isMounted) return;
        
        const reviewsData = snapshot.docs.map((doc: firebase.firestore.QueryDocumentSnapshot) => {
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
        
        setReviews(reviewsData);
        setLastVisible(snapshot.docs[snapshot.docs.length - 1] || null);
        setHasMore(reviewsData.length >= limit);
        
        // Load stats
        try {
          const reviewStats = await getBusinessReviewsStats(businessId);
          if (isMounted) {
            setStats(reviewStats);
          }
        } catch (statsError) {
          console.error('Error loading review stats:', statsError);
        }
      } catch (err) {
        console.error('Error loading reviews:', err);
        if (isMounted) {
          setError('Failed to load reviews');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadReviews();
    
    return () => {
      isMounted = false;
    };
  }, [businessId, activeFilter, sortBy, limit]);

  // Set up real-time listener for new reviews
  useEffect(() => {
    let unsubscribe: () => void;

    const setupRealtimeListener = () => {
      try {
        let query: firebase.firestore.Query = reviewsCollection
          .where('businessId', '==', businessId)
          .where('moderationStatus', '==', 'approved');
          
        if (activeFilter) {
          query = query.where('rating', '==', activeFilter);
        }
        
        switch (sortBy) {
          case 'recent':
            query = query.orderBy('createdAt', 'desc');
            break;
          case 'rating':
            query = query.orderBy('rating', 'desc').orderBy('createdAt', 'desc');
            break;
          case 'relevant':
            query = query.orderBy('reactions.likes', 'desc').orderBy('createdAt', 'desc');
            break;
        }
        
        query = query.limit(limit);
        
        unsubscribe = query.onSnapshot(
          (snapshot: firebase.firestore.QuerySnapshot) => {
            const changes = snapshot.docChanges();
            
            // Process changes
            changes.forEach((change: firebase.firestore.DocumentChange) => { // added type annotation
              const data = change.doc.data();
              const reviewData = {
                id: change.doc.id,
                ...data,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date(),
                ownerReply: data.ownerReply ? {
                  ...data.ownerReply,
                  repliedAt: data.ownerReply.repliedAt?.toDate() || new Date()
                } : undefined
              } as Review;
              
              if (change.type === 'added') {
                // Check if it's a new review or just initial load
                const isNewReview = change.newIndex === 0 && reviews.length > 0;
                
                if (isNewReview) {
                  setReviews(prevReviews => {
                    // Avoid duplicates
                    if (prevReviews.some(rev => rev.id === reviewData.id)) {
                      return prevReviews;
                    }
                    return [reviewData, ...prevReviews];
                  });
                }
              } else if (change.type === 'modified') {
                setReviews(prevReviews => 
                  prevReviews.map(review => 
                    review.id === reviewData.id ? reviewData : review
                  )
                );
              } else if (change.type === 'removed') {
                setReviews(prevReviews => 
                  prevReviews.filter(review => review.id !== reviewData.id)
                );
              }
            });
            
            // Update stats if needed
            if (changes.length > 0) {
              getBusinessReviewsStats(businessId).then(setStats).catch(console.error);
            }
          },
          (err: any) => { // added type annotation
            console.error('Reviews listener error:', err);
            setError('Error watching for review updates');
          }
        );
      } catch (error) {
        console.error('Error setting up real-time listener:', error);
        setError('Failed to set up review updates');
      }
    };

    setupRealtimeListener();
    
    // Cleanup
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [businessId, activeFilter, sortBy, limit, reviews.length]);

  // Function to load more reviews
  const loadMore = useCallback(async () => {
    if (!hasMore || loading || !lastVisible) return;
    
    try {
      setLoading(true);
      
      let query: firebase.firestore.Query = reviewsCollection
        .where('businessId', '==', businessId)
        .where('moderationStatus', '==', 'approved');
        
      if (activeFilter) {
        query = query.where('rating', '==', activeFilter);
      }
      
      switch (sortBy) {
        case 'recent':
          query = query.orderBy('createdAt', 'desc');
          break;
        case 'rating':
          query = query.orderBy('rating', 'desc').orderBy('createdAt', 'desc');
          break;
        case 'relevant':
          query = query.orderBy('reactions.likes', 'desc').orderBy('createdAt', 'desc');
          break;
      }
      
      query = query.startAfter(lastVisible).limit(limit);
      
      const snapshot = await query.get();
      const newReviews = snapshot.docs.map((doc: firebase.firestore.QueryDocumentSnapshot) => {
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
      
      // Filter out duplicates before adding to the list
      const uniqueNewReviews = newReviews.filter((newReview: Review) =>
        !reviews.some(existingReview => existingReview.id === newReview.id)
      );
      
      setReviews([...reviews, ...uniqueNewReviews]);
      setLastVisible(snapshot.docs[snapshot.docs.length - 1] || lastVisible);
      setHasMore(newReviews.length >= limit);
    } catch (err) {
      console.error('Error loading more reviews:', err);
      setError('Failed to load more reviews');
    } finally {
      setLoading(false);
    }
  }, [hasMore, loading, lastVisible, businessId, activeFilter, sortBy, limit, reviews]);

  // Filter by rating
  const filterByRating = useCallback((rating: number | null) => {
    setActiveFilter(rating);
    setLastVisible(null);
  }, []);

  // Change sort method
  const changeSortMethod = useCallback((method: 'recent' | 'rating' | 'relevant') => {
    setSortBy(method);
    setLastVisible(null);
  }, []);

  return {
    reviews,
    loading,
    error,
    hasMore,
    stats,
    loadMore,
    filterByRating,
    activeFilter,
    sortBy,
    changeSortMethod
  };
};

export const useUserReviews = (userId: string, limit = 10) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastVisible, setLastVisible] = useState<firebase.firestore.QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Initial load of user's reviews
  useEffect(() => {
    let isMounted = true;
    
    const loadUserReviews = async () => {
      try {
        setLoading(true);
        setError(null);

        const query = reviewsCollection
          .where('userId', '==', userId)
          .orderBy('createdAt', 'desc')
          .limit(limit);
          
        const snapshot = await query.get();
        
        if (!isMounted) return;
        
        const reviewsData = snapshot.docs.map((doc: firebase.firestore.QueryDocumentSnapshot) => {
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
        
        setReviews(reviewsData);
        setLastVisible(snapshot.docs[snapshot.docs.length - 1] || null);
        setHasMore(reviewsData.length >= limit);
      } catch (err) {
        console.error('Error loading user reviews:', err);
        if (isMounted) {
          setError('Failed to load your reviews');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadUserReviews();
    
    return () => {
      isMounted = false;
    };
  }, [userId, limit]);

  // Function to load more of user's reviews
  const loadMore = useCallback(async () => {
    if (!hasMore || loading || !lastVisible) return;
    
    try {
      setLoading(true);
      
      const query = reviewsCollection
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .startAfter(lastVisible)
        .limit(limit);
      
      const snapshot = await query.get();
      const newReviews = snapshot.docs.map((doc: firebase.firestore.QueryDocumentSnapshot) => {
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
      
      // Filter out duplicates
      const uniqueNewReviews = newReviews.filter((newReview: Review) =>
        !reviews.some(existingReview => existingReview.id === newReview.id)
      );
      
      setReviews([...reviews, ...uniqueNewReviews]);
      setLastVisible(snapshot.docs[snapshot.docs.length - 1] || lastVisible);
      setHasMore(newReviews.length >= limit);
    } catch (err) {
      console.error('Error loading more user reviews:', err);
      setError('Failed to load more reviews');
    } finally {
      setLoading(false);
    }
  }, [hasMore, loading, lastVisible, userId, limit, reviews]);

  return {
    reviews,
    loading,
    error,
    hasMore,
    loadMore
  };
};
