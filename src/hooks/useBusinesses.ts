import { useState, useCallback, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import { firebaseService } from '../services/firebaseService';
import { Business } from '../context/BusinessContext';

interface UseBusinessesOptions {
  initialCategory?: string | null;
  limit?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  userId?: string | null;
  onlyFavorites?: boolean;
}

interface UseBusinessesReturn {
  businesses: Business[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  changeCategory: (category: string | null) => void;
  currentCategory: string | null;
  isFavorite: (businessId: string) => boolean;
  toggleFavorite: (businessId: string) => Promise<void>;
  favoriteBusinesses: Business[];
  loadingFavorites: boolean;
}

export const useBusinesses = (options: UseBusinessesOptions = {}): UseBusinessesReturn => {
  const {
    initialCategory = null,
    limit = 10,
    sortBy = 'createdAt',
    sortDirection = 'desc',
    userId = firebase.auth().currentUser?.uid || null,
    onlyFavorites = false
  } = options;

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [favoriteBusinesses, setFavoriteBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDoc, setLastDoc] = useState<firebase.firestore.DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentCategory, setCurrentCategory] = useState<string | null>(initialCategory);
  const [favorites, setFavorites] = useState<string[]>([]);

  // Load user's favorites
  const loadFavorites = useCallback(async () => {
    if (!userId) return;

    try {
      const userDoc = await firebase.firestore().collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        setFavorites(userData?.favorites || []);
      }
    } catch (err) {
      console.error('Error loading favorites:', err);
    }
  }, [userId]);

  // Initialize favorites on component mount
  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  // Load favorite businesses
  const loadFavoriteBusinesses = useCallback(async () => {
    if (!userId || favorites.length === 0) {
      setFavoriteBusinesses([]);
      return;
    }

    setLoadingFavorites(true);
    
    try {
      const response = await firebaseService.businesses.getFavorites(userId);
      
      if (response.success) {
        setFavoriteBusinesses(response.data || []);
      } else {
        console.error('Error loading favorite businesses:', response.error);
      }
    } catch (err) {
      console.error('Error in loadFavoriteBusinesses:', err);
    } finally {
      setLoadingFavorites(false);
    }
  }, [userId, favorites]);

  // Load favorite businesses when favorites change
  useEffect(() => {
    if (onlyFavorites) {
      loadFavoriteBusinesses();
    }
  }, [loadFavoriteBusinesses, onlyFavorites]);

  // Load businesses with pagination
  const loadBusinesses = useCallback(async (reset = false) => {
    // Don't fetch regular businesses in favorites-only mode
    if (onlyFavorites) {
      setLoading(false);
      return;
    }

    if (!reset && loading) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await firebaseService.businesses.getAll({
        limit,
        lastDoc: reset ? null : lastDoc,
        category: currentCategory,
        sortBy,
        sortDirection,
      });
      
      if (response.success && response.data) {
        setBusinesses(prev => reset ? response.data! : [...prev, ...response.data!]);
        setLastDoc(response.lastDoc || null);
        setHasMore(!!response.hasMore);
      } else if (response.error) {
        setError(response.error.message);
      }
    } catch (err) {
      console.error('Error loading businesses:', err);
      setError('Error cargando negocios. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [currentCategory, lastDoc, limit, loading, onlyFavorites, sortBy, sortDirection]);

  // Load initial data when component mounts or category changes
  useEffect(() => {
    loadBusinesses(true);
  }, [currentCategory, loadBusinesses]);

  // Check if a business is in favorites
  const isFavorite = useCallback((businessId: string): boolean => {
    return favorites.includes(businessId);
  }, [favorites]);

  // Toggle favorite status
  const toggleFavorite = useCallback(async (businessId: string): Promise<void> => {
    if (!userId) return;
    
    try {
      const response = await firebaseService.users.toggleFavorite(userId, businessId);
      
      if (response.success) {
        // Update local favorites array
        setFavorites(prev => {
          if (prev.includes(businessId)) {
            return prev.filter(id => id !== businessId);
          } else {
            return [...prev, businessId];
          }
        });
        
        // Refresh favorite businesses list if in favorites-only mode
        if (onlyFavorites) {
          loadFavoriteBusinesses();
        }
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  }, [userId, loadFavoriteBusinesses, onlyFavorites]);

  // Change category filter
  const changeCategory = useCallback((category: string | null) => {
    setCurrentCategory(category);
  }, []);

  // Refresh data
  const refresh = useCallback(async (): Promise<void> => {
    if (onlyFavorites) {
      await loadFavorites();
      await loadFavoriteBusinesses();
    } else {
      await loadBusinesses(true);
    }
  }, [loadBusinesses, loadFavorites, loadFavoriteBusinesses, onlyFavorites]);

  // Load more data
  const loadMore = useCallback(async (): Promise<void> => {
    if (hasMore && !loading) {
      await loadBusinesses(false);
    }
  }, [hasMore, loadBusinesses, loading]);

  // Return object with all needed values and functions
  return {
    businesses: onlyFavorites ? favoriteBusinesses : businesses,
    loading: onlyFavorites ? loadingFavorites : loading,
    error,
    hasMore,
    refresh,
    loadMore,
    changeCategory,
    currentCategory,
    isFavorite,
    toggleFavorite,
    favoriteBusinesses,
    loadingFavorites
  };
};
