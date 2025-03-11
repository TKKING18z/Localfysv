import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Interfaces para los nuevos tipos de datos
export interface BusinessHours {
  monday?: DayHours;
  tuesday?: DayHours;
  wednesday?: DayHours;
  thursday?: DayHours;
  friday?: DayHours;
  saturday?: DayHours;
  sunday?: DayHours;
}

export interface DayHours {
  open: string;   // Formato: "09:00"
  close: string;  // Formato: "18:00"
  closed?: boolean; // Indica si está cerrado ese día
}

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  tiktok?: string;
  website?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  category?: string;
}

// Define Business interface
export interface Business {
  id: string;
  name: string;
  description: string;
  category: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  location?: any; // Puede ser objeto {latitude, longitude} o string JSON
  images?: Array<{id?: string, url: string, isMain?: boolean}>;
  rating?: number;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string; // ID del usuario que creó el negocio
  businessHours?: BusinessHours;
  paymentMethods?: string[];
  socialLinks?: SocialLinks;
  videos?: Array<{id?: string, url: string, thumbnail?: string}>;
  menu?: MenuItem[];
  menuUrl?: string;  // Enlace a un menú PDF o imagen
}

// Define Business Context interface
interface BusinessContextType {
  businesses: Business[];
  filteredBusinesses: Business[];
  categories: string[];
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
  loading: boolean;
  error: string | null;
  refreshBusinesses: () => Promise<void>;
  toggleFavorite: (businessId: string) => void;
  isFavorite: (businessId: string) => boolean;
  favorites: string[];
  getFavoriteBusinesses: () => Business[];
  getBusinessById: (id: string) => Promise<Business | null>;
  updateBusiness: (id: string, data: Partial<Business>) => Promise<boolean>;
}

// Create context
const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

// Create provider component
export const BusinessProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [filteredBusinesses, setFilteredBusinesses] = useState<Business[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  
  // Load favorites from AsyncStorage
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const savedFavorites = await AsyncStorage.getItem('favorites');
        if (savedFavorites) {
          setFavorites(JSON.parse(savedFavorites));
        }
      } catch (err) {
        console.error('Error loading favorites:', err);
      }
    };
    
    loadFavorites();
  }, []);
  
  // Save favorites to AsyncStorage whenever they change
  useEffect(() => {
    const saveFavorites = async () => {
      try {
        await AsyncStorage.setItem('favorites', JSON.stringify(favorites));
      } catch (err) {
        console.error('Error saving favorites:', err);
      }
    };
    
    if (favorites.length > 0) {
      saveFavorites();
    }
  }, [favorites]);
  
  // Función para normalizar datos de negocios
  const normalizeBusinessData = (id: string, data: any): Business => {
    // Verificar si images existe y es un array; si no, inicializar como array vacío
    let normalizedImages: {id?: string, url: string, isMain?: boolean}[] = [];
    
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
    
    // Normalizar videos si existen
    let normalizedVideos: {id?: string, url: string, thumbnail?: string}[] = [];
    
    if (data.videos && Array.isArray(data.videos)) {
      normalizedVideos = data.videos
        .filter((video: any) => video && typeof video === 'object' && video.url && typeof video.url === 'string')
        .map((video: any) => ({
          id: video.id || `video-${Math.random().toString(36).substr(2, 9)}`,
          url: video.url,
          thumbnail: video.thumbnail || undefined
        }));
    }
    
    // Normalizar menú si existe
    let normalizedMenu: MenuItem[] = [];
    
    if (data.menu && Array.isArray(data.menu)) {
      normalizedMenu = data.menu
        .filter((item: any) => item && typeof item === 'object' && item.name && typeof item.price === 'number')
        .map((item: any) => ({
          id: item.id || `menu-${Math.random().toString(36).substr(2, 9)}`,
          name: item.name,
          description: item.description || undefined,
          price: item.price,
          imageUrl: item.imageUrl || undefined,
          category: item.category || undefined
        }));
    }
    
    // Crear objeto de negocio normalizado
    return {
      id,
      name: data.name || '',
      description: data.description || '',
      category: data.category || '',
      rating: typeof data.rating === 'number' ? data.rating : 0,
      address: data.address || '',
      phone: data.phone || '',
      email: data.email || '',
      website: data.website || '',
      images: normalizedImages,
      location: data.location || null,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
      createdBy: data.createdBy || null,
      businessHours: data.businessHours || undefined,
      paymentMethods: data.paymentMethods || undefined,
      socialLinks: data.socialLinks || undefined,
      videos: normalizedVideos,
      menu: normalizedMenu,
      menuUrl: data.menuUrl || undefined
    };
  };
  
  // Function to fetch businesses from Firestore
  const fetchBusinesses = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const businessesCollection = firebase.firestore().collection('businesses');
      const snapshot = await businessesCollection.get();
      
      const businessesList: Business[] = [];
      const categoriesSet = new Set<string>();
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const business = normalizeBusinessData(doc.id, data);
        
        businessesList.push(business);
        if (data.category) categoriesSet.add(data.category);
      });
      
      setBusinesses(businessesList);
      setFilteredBusinesses(selectedCategory 
        ? businessesList.filter(b => b.category === selectedCategory)
        : businessesList
      );
      setCategories(Array.from(categoriesSet));
      setLoading(false);
    } catch (err) {
      console.error('Error fetching businesses:', err);
      setError('Error al cargar los negocios. Por favor, intenta más tarde.');
      setLoading(false);
    }
  };
  
  // Function to get a single business by ID
  const getBusinessById = async (id: string): Promise<Business | null> => {
    try {
      // First check if we already have it in state
      const cachedBusiness = businesses.find(b => b.id === id);
      if (cachedBusiness) return cachedBusiness;
      
      // Otherwise fetch from Firestore
      const doc = await firebase.firestore().collection('businesses').doc(id).get();
      if (!doc.exists) return null;
      
      return normalizeBusinessData(doc.id, doc.data());
    } catch (err) {
      console.error('Error fetching business by ID:', err);
      return null;
    }
  };
  
  // Function to update business data
  const updateBusiness = async (id: string, data: Partial<Business>): Promise<boolean> => {
    try {
      // Update in Firestore
      await firebase.firestore().collection('businesses').doc(id).update({
        ...data,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Update in local state
      setBusinesses(prevBusinesses => {
        return prevBusinesses.map(business => {
          if (business.id === id) {
            return {
              ...business,
              ...data,
              updatedAt: new Date()
            };
          }
          return business;
        });
      });
      
      // Update filtered businesses if needed
      if (selectedCategory) {
        setFilteredBusinesses(prevFiltered => {
          return prevFiltered.map(business => {
            if (business.id === id) {
              return {
                ...business,
                ...data,
                updatedAt: new Date()
              };
            }
            return business;
          });
        });
      }
      
      return true;
    } catch (err) {
      console.error('Error updating business:', err);
      return false;
    }
  };
  
  // Initial data load
  useEffect(() => {
    fetchBusinesses();
  }, []);
  
  // Filter businesses when category changes
  useEffect(() => {
    setFilteredBusinesses(
      selectedCategory
        ? businesses.filter(business => business.category === selectedCategory)
        : businesses
    );
  }, [selectedCategory, businesses]);
  
  // Toggle favorite status for a business
  const toggleFavorite = (businessId: string) => {
    setFavorites(prevFavorites => {
      if (prevFavorites.includes(businessId)) {
        return prevFavorites.filter(id => id !== businessId);
      } else {
        return [...prevFavorites, businessId];
      }
    });
  };
  
  // Check if a business is in favorites
  const isFavorite = (businessId: string): boolean => {
    return favorites.includes(businessId);
  };
  
  // Get all favorite businesses
  const getFavoriteBusinesses = (): Business[] => {
    return businesses.filter(business => favorites.includes(business.id));
  };
  
  // Context value
  const value: BusinessContextType = {
    businesses,
    filteredBusinesses,
    categories,
    selectedCategory,
    setSelectedCategory,
    loading,
    error,
    refreshBusinesses: fetchBusinesses,
    toggleFavorite,
    isFavorite,
    favorites,
    getFavoriteBusinesses,
    getBusinessById,
    updateBusiness
  };
  
  return (
    <BusinessContext.Provider value={value}>
      {children}
    </BusinessContext.Provider>
  );
};

// Custom hook to use business context
export const useBusinesses = () => {
  const context = useContext(BusinessContext);
  if (context === undefined) {
    throw new Error('useBusinesses must be used within a BusinessProvider');
  }
  return context;
};