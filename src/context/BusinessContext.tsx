import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import { useLocationContext } from './LocationContext';
import { firebaseService } from '../services/firebaseService';
import { useBusinesses as useBusinessesHook } from '../hooks/useBusinesses';

// Business interface (update as needed)
export interface Business {
  id: string;
  name: string;
  description: string;
  category: string;
  address: string;
  phone: string;
  website?: string;
  hours?: string;
  location: any; // Can be string (JSON) or object with lat/lng
  images?: Array<{ url: string, isMain?: boolean }>;
  ownerId?: string;
  rating?: number;
  reviews?: number;
  createdAt?: any;
  updatedAt?: any;
}

// Business Context interface
interface BusinessContextType {
  businesses: Business[];
  filteredBusinesses: Business[];
  categories: string[];
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  refreshBusinesses: () => Promise<void>;
  loadMoreBusinesses: () => Promise<void>;
  toggleFavorite: (businessId: string) => void;
  isFavorite: (businessId: string) => boolean;
  favoriteBusinesses: Business[];
  loadingFavorites: boolean;
  getBusinessById: (id: string) => Promise<Business | null>;
  favorites: string[]; // Add this property to fix the error
}

// Create context with a default empty value
const BusinessContext = createContext<BusinessContextType>({} as BusinessContextType);

// The provider component
export const BusinessProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  // Use our custom hook
  const {
    businesses,
    loading,
    error,
    hasMore,
    refresh: refreshBusinesses,
    loadMore: loadMoreBusinesses,
    changeCategory,
    currentCategory: selectedCategory,
    isFavorite,
    toggleFavorite,
    favoriteBusinesses,
    loadingFavorites
  } = useBusinessesHook();
  
  // Location context for filtering by distance
  const { userLocation } = useLocationContext();
  
  // Extract unique categories from businesses
  const [categories, setCategories] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  // Update categories when businesses change
  useEffect(() => {
    if (businesses && businesses.length > 0) {
      const uniqueCategories = Array.from(
        new Set(businesses.map(business => business.category))
      ).filter(Boolean);
      
      setCategories(uniqueCategories);
    }
  }, [businesses]);
  
  // Get filtered businesses based on selected category
  const filteredBusinesses = selectedCategory
    ? businesses.filter(business => business.category === selectedCategory)
    : businesses;
  
  // Get a single business by ID
  const getBusinessById = async (id: string): Promise<Business | null> => {
    try {
      const response = await firebaseService.businesses.getById(id);
      
      if (response.success && response.data) {
        return response.data;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting business by ID:', error);
      return null;
    }
  };
  
  // The context value
  const value = {
    businesses,
    filteredBusinesses,
    categories,
    selectedCategory,
    setSelectedCategory: changeCategory,
    loading,
    error,
    hasMore,
    refreshBusinesses,
    loadMoreBusinesses,
    toggleFavorite,
    isFavorite,
    favoriteBusinesses,
    loadingFavorites,
    getBusinessById,
    favorites
  };
  
  return (
    <BusinessContext.Provider value={value}>
      {children}
    </BusinessContext.Provider>
  );
};

// Custom hook to use the business context
export const useBusinesses = () => {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error('useBusinesses must be used within a BusinessProvider');
  }
  return context;
};