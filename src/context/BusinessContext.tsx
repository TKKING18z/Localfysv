import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { collection, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

// Types
export interface BusinessImage {
  id: string;
  url: string;
  isMain: boolean;
}

export interface Business {
  id: string;
  name: string;
  description: string;
  category: string;
  rating: number;
  images: BusinessImage[]; // Ahora siempre será un array, incluso vacío
  isOpen: boolean;
  isNew: boolean;
  location: string;
  phone?: string;
  email?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface BusinessContextType {
  businesses: Business[];
  filteredBusinesses: Business[];
  categories: string[];
  selectedCategory: string | null;
  loading: boolean;
  favorites: string[];
  
  setSelectedCategory: (category: string | null) => void;
  refreshBusinesses: () => Promise<void>;
  toggleFavorite: (businessId: string) => void;
  isFavorite: (businessId: string) => boolean;
  getBusinessById: (id: string) => Promise<Business | null>;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export const BusinessProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [filteredBusinesses, setFilteredBusinesses] = useState<Business[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [favorites, setFavorites] = useState<string[]>([]);
  
  // Función para normalizar datos de negocios
  const normalizeBusinessData = (id: string, data: any): Business => {
    // Verificar si images existe y es un array; si no, inicializar como array vacío
    let normalizedImages: BusinessImage[] = [];
    
    if (data.images && Array.isArray(data.images)) {
      // Filtrar solo imágenes válidas con URL
      normalizedImages = data.images
        .filter((img: any) => img && typeof img === 'object' && img.url && typeof img.url === 'string')
        .map((img: any) => ({
          id: img.id || `img-${Math.random().toString(36).substr(2, 9)}`,
          url: img.url,
          isMain: !!img.isMain
        }));
    }
    
    // Si no hay imágenes válidas, crear una imagen predeterminada basada en el ID del negocio
    if (normalizedImages.length === 0) {
      normalizedImages = [{
        id: `default-${id}`,
        url: `business_${id}.jpg`,
        isMain: true
      }];
    }
    
    // Crear objeto de negocio normalizado
    return {
      id,
      name: data.name || '',
      description: data.description || '',
      category: data.category || '',
      rating: typeof data.rating === 'number' ? data.rating : 0,
      images: normalizedImages,
      isOpen: !!data.isOpen,
      isNew: !!data.isNew,
      location: data.location || '',
      phone: data.phone || '',
      email: data.email || '',
      address: data.address || '',
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  };
  
  // Fetch businesses from Firestore
  const fetchBusinesses = async () => {
    setLoading(true);
    try {
      const businessesCollection = collection(db, 'businesses');
      const businessesSnapshot = await getDocs(businessesCollection);
      const businessesList: Business[] = [];
      const categoriesSet = new Set<string>();

      businessesSnapshot.forEach(doc => {
        const data = doc.data();
        const business = normalizeBusinessData(doc.id, data);
        
        businessesList.push(business);
        if (data.category) categoriesSet.add(data.category);
      });

      setBusinesses(businessesList);
      setFilteredBusinesses(businessesList);
      setCategories(Array.from(categoriesSet));
    } catch (error) {
      console.error('Error fetching businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  // Add getBusinessById function
  const getBusinessById = async (id: string): Promise<Business | null> => {
    try {
      const businessDoc = doc(db, 'businesses', id);
      const businessSnapshot = await getDoc(businessDoc);
      
      if (businessSnapshot.exists()) {
        const data = businessSnapshot.data();
        return normalizeBusinessData(businessSnapshot.id, data);
      }
      return null;
    } catch (error) {
      console.error('Error fetching business:', error);
      return null;
    }
  };

  // Set up real-time listener for businesses
  useEffect(() => {
    setLoading(true);
    
    const businessesRef = collection(db, 'businesses');
    const unsubscribe = onSnapshot(
      businessesRef,
      (snapshot) => {
        const businessList: Business[] = [];
        const categoriesSet = new Set<string>();
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          const business = normalizeBusinessData(doc.id, data);
          
          businessList.push(business);
          if (data.category) categoriesSet.add(data.category);
        });
        
        setBusinesses(businessList);
        setCategories(Array.from(categoriesSet));
        setLoading(false);
      },
      (error) => {
        console.error("Error in business listener:", error);
        setLoading(false);
      }
    );
    
    // Load favorites from async storage or similar
    // For now just initialize as empty array
    
    return () => unsubscribe();
  }, []);
  
  // Filter businesses when category changes
  useEffect(() => {
    if (selectedCategory) {
      setFilteredBusinesses(
        businesses.filter(business => business.category === selectedCategory)
      );
    } else {
      setFilteredBusinesses(businesses);
    }
  }, [selectedCategory, businesses]);
  
  // Refresh businesses manually
  const refreshBusinesses = async () => {
    return fetchBusinesses();
  };
  
  // Toggle favorite status
  const toggleFavorite = (businessId: string) => {
    setFavorites(prevFavorites => {
      if (prevFavorites.includes(businessId)) {
        return prevFavorites.filter(id => id !== businessId);
      } else {
        return [...prevFavorites, businessId];
      }
    });
  };
  
  // Check if a business is favorited
  const isFavorite = (businessId: string) => {
    return favorites.includes(businessId);
  };
  
  const value = {
    businesses,
    filteredBusinesses,
    categories,
    selectedCategory,
    loading,
    favorites,
    setSelectedCategory,
    refreshBusinesses,
    toggleFavorite,
    isFavorite,
    getBusinessById
  };
  
  return (
    <BusinessContext.Provider value={value}>
      {children}
    </BusinessContext.Provider>
  );
};

export const useBusinesses = () => {
  const context = useContext(BusinessContext);
  if (context === undefined) {
    throw new Error('useBusinesses must be used within a BusinessProvider');
  }
  return context;
};