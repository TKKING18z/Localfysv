import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useRef } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, InteractionManager } from 'react-native';

// Interfaces para los nuevos tipos de datos
export interface BusinessHours {
  monday?: DayHours;
  tuesday?: DayHours;
  wednesday?: DayHours;
  thursday?: DayHours;
  friday?: DayHours;
  saturday?: DayHours;
  sunday?: DayHours;
  [key: string]: DayHours | undefined; // Add this index signature
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
  acceptsReservations: boolean;
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
  services?: {
    delivery?: boolean;
    pickup?: boolean;
    onlineOrders?: boolean;
    reservations?: boolean;
    wifi?: boolean;
    parking?: boolean;
    [key: string]: boolean | undefined;
  };
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
  loadMoreBusinesses: () => Promise<boolean>;
  hasMoreBusinesses: boolean;
  resetPagination: () => void;
  observeBusinesses: (businessIds: string[]) => () => void;
  dataReady: boolean;
  isCacheValid: () => boolean;
  lastCacheUpdate: number;
}

// Create context
const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

// Add an interface for the cached data structure
interface CachedBusinessData {
  businesses: Business[];
  categories: string[];
  lastUpdated: number;
}

// Create provider component
export const BusinessProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [filteredBusinesses, setFilteredBusinesses] = useState<Business[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  
  // Add data ready state to prevent premature rendering
  const [dataReady, setDataReady] = useState<boolean>(false);
  
  // Añadir estado para paginación
  const [lastVisible, setLastVisible] = useState<firebase.firestore.QueryDocumentSnapshot | null>(null);
  const [hasMoreBusinesses, setHasMoreBusinesses] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  
  // Estado para almacenar los observadores activos
  const [activeListeners, setActiveListeners] = useState<{[id: string]: () => void}>({});
  
  // Tamaño de página para paginación
  const PAGE_SIZE = 20;
  
  // Add caching mechanism with timestamp
  const [lastCacheUpdate, setLastCacheUpdate] = useState<number>(0);
  const CACHE_VALIDITY_PERIOD = 5 * 60 * 1000; // 5 minutes
  
  // Flag to track if we're currently loading from cache
  const isLoadingFromCacheRef = useRef<boolean>(false);
  
  // Optimize loading from AsyncStorage
  const loadFromCache = useCallback(async (): Promise<boolean> => {
    if (isLoadingFromCacheRef.current) return false;
    
    isLoadingFromCacheRef.current = true;
    try {
      const cachedData = await AsyncStorage.getItem('businessCache');
      if (cachedData) {
        const parsedData = JSON.parse(cachedData) as CachedBusinessData;
        
        // Validate and normalize cache data
        if (parsedData && 
            parsedData.businesses && 
            Array.isArray(parsedData.businesses) && 
            parsedData.lastUpdated) {
              
          // Check if cache is still valid
          const now = Date.now();
          const cacheAge = now - parsedData.lastUpdated;
          
          // Set last cache update
          setLastCacheUpdate(parsedData.lastUpdated);
          
          // If cache is fresh enough, use it
          if (cacheAge < CACHE_VALIDITY_PERIOD) {
            console.log(`Using cached business data (${Math.round(cacheAge/1000)}s old)`);
            
            // Process in a non-blocking way
            await safeStateUpdate(() => {
              setBusinesses(parsedData.businesses);
              setFilteredBusinesses(
                selectedCategory 
                ? parsedData.businesses.filter(b => b.category === selectedCategory)
                : parsedData.businesses
              );
              setCategories(parsedData.categories || []);
              setDataReady(true);
              setLoading(false);
            }, 200);
            
            return true;
          } else {
            console.log(`Cache expired (${Math.round(cacheAge/60000)}min old), fetching fresh data`);
          }
        }
      }
      return false;
    } catch (error) {
      console.error('Error loading from cache:', error);
      return false;
    } finally {
      isLoadingFromCacheRef.current = false;
    }
  }, [selectedCategory, CACHE_VALIDITY_PERIOD]);
  
  // Save current data to cache
  const saveToCache = useCallback(async (data: Business[], cats: string[]) => {
    try {
      const now = Date.now();
      const cacheData: CachedBusinessData = {
        businesses: data,
        categories: cats,
        lastUpdated: now
      };
      
      // Update state
      setLastCacheUpdate(now);
      
      // Save to AsyncStorage in background
      InteractionManager.runAfterInteractions(async () => {
        try {
          await AsyncStorage.setItem('businessCache', JSON.stringify(cacheData));
          console.log('Business data cached successfully');
        } catch (err) {
          console.error('Error saving to cache:', err);
        }
      });
    } catch (err) {
      console.error('Error preparing cache data:', err);
    }
  }, []);
  
  // Check if cache is still valid
  const isCacheValid = useCallback(() => {
    if (lastCacheUpdate === 0) return false;
    
    const now = Date.now();
    const cacheAge = now - lastCacheUpdate;
    return cacheAge < CACHE_VALIDITY_PERIOD;
  }, [lastCacheUpdate, CACHE_VALIDITY_PERIOD]);
  
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
      menuUrl: data.menuUrl || undefined,
      acceptsReservations: data.acceptsReservations === undefined ? false : data.acceptsReservations,
      services: data.services || undefined
    };
  };
  
  // Safe state update function to prevent bubblingEventTypes errors
  const safeStateUpdate = (updateFn: () => void, delay = 100) => {
    // En iOS, usar tiempos de espera más largos
    const actualDelay = Platform.OS === 'ios' ? delay * 2 : delay;
    
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        try {
          updateFn();
          resolve();
        } catch (err) {
          console.error('Error in state update:', err);
          resolve();
        }
      }, actualDelay);
    });
  };
  
  // Modify fetchBusinesses to use cache when available
  const fetchBusinesses = async () => {
    // First check if we have valid cached data and use that first
    if (businesses.length > 0 && isCacheValid()) {
      console.log('Using in-memory business data (already loaded)');
      // Just make sure data is marked as ready
      if (!dataReady) {
        await safeStateUpdate(() => {
          setDataReady(true);
          setLoading(false);
        });
      }
      return;
    }
    
    // Try loading from persistent cache if no valid memory cache
    if (businesses.length === 0) {
      const loadedFromCache = await loadFromCache();
      if (loadedFromCache) {
        return;
      }
    }
    
    // If we're here, we need to fetch fresh data
    await safeStateUpdate(() => {
      setLoading(true);
      setError(null);
      setDataReady(false); // Ensure data is marked as not ready during fetch
    });
    
    try {
      // Verificar si el usuario está autenticado
      const currentUser = firebase.auth().currentUser;
      console.log('Current user in fetchBusinesses:', currentUser?.uid);
      
      // Asegurarnos que Firebase esté correctamente inicializado
      if (firebase.apps.length === 0) {
        console.error('Firebase no está inicializado correctamente');
        await safeStateUpdate(() => {
          setError('Error en la inicialización de la aplicación. Por favor, reinicia la app.');
          setLoading(false);
        });
        return;
      }
      
      // Resetear el estado de paginación
      await safeStateUpdate(() => {
        setLastVisible(null);
        setHasMoreBusinesses(true);
      });
      
      // Intentar acceder a la colección de negocios con paginación
      const businessesCollection = firebase.firestore().collection('businesses')
        .orderBy('createdAt', 'desc')
        .limit(PAGE_SIZE);
      
      const snapshot = await businessesCollection.get();
      
      if (snapshot.empty) {
        await safeStateUpdate(() => {
          setBusinesses([]);
          setFilteredBusinesses([]);
          setCategories([]);
          setHasMoreBusinesses(false);
          setLoading(false);
          setDataReady(true); // Mark data as ready even when empty
        }, 200);
        return;
      }
      
      const businessesList: Business[] = [];
      const categoriesSet = new Set<string>();
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const business = normalizeBusinessData(doc.id, data);
        
        businessesList.push(business);
        if (data.category) categoriesSet.add(data.category);
      });
      
      // Guardar el último documento para paginación
      await safeStateUpdate(() => {
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        setHasMoreBusinesses(snapshot.docs.length === PAGE_SIZE);
      });
      
      console.log(`Negocios cargados: ${businessesList.length}`);
      
      // First update non-UI-affecting state
      await safeStateUpdate(() => {
        setBusinesses(businessesList);
        setFilteredBusinesses(selectedCategory 
          ? businessesList.filter(b => b.category === selectedCategory)
          : businessesList
        );
        setCategories(Array.from(categoriesSet));
      }, 200);
      
      // Cache the data in the background
      saveToCache(businessesList, Array.from(categoriesSet));
      
      // Then update UI-affecting state with additional delay
      await safeStateUpdate(() => {
        setLoading(false);
        setDataReady(true); // Mark data as ready for rendering
      }, 300);
    } catch (err) {
      console.error('Error fetching businesses:', err);
      await safeStateUpdate(() => {
        setError('Error al cargar los negocios. Por favor, intenta más tarde.');
        setLoading(false);
        setDataReady(true); // Mark data as ready even on error
      }, 200);
    }
  };
  
  // Función para cargar más negocios (paginación)
  const loadMoreBusinesses = async (): Promise<boolean> => {
    if (isLoadingMore || !hasMoreBusinesses || !lastVisible) {
      return false;
    }
    
    await safeStateUpdate(() => {
      setIsLoadingMore(true);
    });
    
    try {
      let query = firebase.firestore().collection('businesses')
        .orderBy('createdAt', 'desc')
        .startAfter(lastVisible)
        .limit(PAGE_SIZE);
      
      if (selectedCategory) {
        query = firebase.firestore().collection('businesses')
          .where('category', '==', selectedCategory)
          .orderBy('createdAt', 'desc')
          .startAfter(lastVisible)
          .limit(PAGE_SIZE);
      }
      
      const snapshot = await query.get();
      
      if (snapshot.empty) {
        await safeStateUpdate(() => {
          setHasMoreBusinesses(false);
          setIsLoadingMore(false);
        });
        return false;
      }
      
      const newBusinesses: Business[] = [];
      const categoriesSet = new Set<string>(categories);
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const business = normalizeBusinessData(doc.id, data);
        
        newBusinesses.push(business);
        if (data.category) categoriesSet.add(data.category);
      });
      
      // Update pagination state
      await safeStateUpdate(() => {
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        setHasMoreBusinesses(snapshot.docs.length === PAGE_SIZE);
      });
      
      // Update data state
      await safeStateUpdate(() => {
        setBusinesses(prev => [...prev, ...newBusinesses]);
        
        if (selectedCategory) {
          const filteredNew = newBusinesses.filter(b => b.category === selectedCategory);
          setFilteredBusinesses(prev => [...prev, ...filteredNew]);
        } else {
          setFilteredBusinesses(prev => [...prev, ...newBusinesses]);
        }
        
        setCategories(Array.from(categoriesSet));
      }, 200);
      
      // Finally update loading state
      await safeStateUpdate(() => {
        setIsLoadingMore(false);
      }, 200);
      
      return true;
    } catch (err) {
      console.error('Error loading more businesses:', err);
      await safeStateUpdate(() => {
        setIsLoadingMore(false);
      }, 200);
      return false;
    }
  };
  
  // Función para reiniciar la paginación
  const resetPagination = () => {
    safeStateUpdate(() => {
      setLastVisible(null);
      setHasMoreBusinesses(true);
    });
  };
  
  // Función optimizada para observar solo negocios específicos
  const observeBusinesses = useCallback((businessIds: string[]) => {
    // Limpiar listeners anteriores que ya no necesitamos
    Object.entries(activeListeners).forEach(([id, unsubscribe]) => {
      if (!businessIds.includes(id)) {
        unsubscribe();
        safeStateUpdate(() => {
          setActiveListeners(prev => {
            const newListeners = {...prev};
            delete newListeners[id];
            return newListeners;
          });
        });
      }
    });
    
    // Añadir nuevos listeners solo para los IDs que no están siendo observados
    const newListenersMap: {[id: string]: () => void} = {};
    
    businessIds.forEach(id => {
      // Skip if already listening
      if (activeListeners[id]) return;
      
      const unsubscribe = firebase.firestore()
        .collection('businesses')
        .doc(id)
        .onSnapshot(
          (doc) => {
            if (doc.exists) {
              const updatedBusiness = normalizeBusinessData(doc.id, doc.data());
              
              // Use safeStateUpdate to update businesses data
              safeStateUpdate(() => {
                setBusinesses(prev => 
                  prev.map(b => b.id === id ? updatedBusiness : b)
                );
              }, 200);
              
              safeStateUpdate(() => {
                setFilteredBusinesses(prev => 
                  prev.map(b => b.id === id ? updatedBusiness : b)
                );
              }, 200);
            }
          },
          (error) => {
            console.error(`Error observing business ${id}:`, error);
          }
        );
      
      newListenersMap[id] = unsubscribe;
    });
    
    // Actualizar el mapa de listeners activos
    if (Object.keys(newListenersMap).length > 0) {
      safeStateUpdate(() => {
        setActiveListeners(prev => ({...prev, ...newListenersMap}));
      }, 100);
    }
    
    // Devolver función para limpiar todos los listeners
    return () => {
      Object.values(newListenersMap).forEach(unsubscribe => unsubscribe());
    };
  }, [activeListeners]);
  
  // Limpiar todos los listeners al desmontar
  useEffect(() => {
    return () => {
      Object.values(activeListeners).forEach(unsubscribe => unsubscribe());
    };
  }, [activeListeners]);
  
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
  
  // Initial data load with cache optimization
  useEffect(() => {
    console.log('Initial data load in BusinessContext');
    
    // Try to load from cache first, then fetch fresh data if needed
    const initializeData = async () => {
      const loadedFromCache = await loadFromCache();
      
      // If cache loading failed or data is old, fetch from server
      if (!loadedFromCache) {
        // En iOS, esperar un poco más antes de cargar datos iniciales
        // para asegurar que todos los componentes nativos estén inicializados
        const initialLoadDelay = Platform.OS === 'ios' ? 500 : 0;
        
        const timer = setTimeout(() => {
          fetchBusinesses();
        }, initialLoadDelay);
        
        return () => clearTimeout(timer);
      }
    };
    
    initializeData();
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
    safeStateUpdate(() => {
      setFavorites(prevFavorites => {
        if (prevFavorites.includes(businessId)) {
          return prevFavorites.filter(id => id !== businessId);
        } else {
          return [...prevFavorites, businessId];
        }
      });
    }, 100);
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
    updateBusiness,
    loadMoreBusinesses,
    hasMoreBusinesses,
    resetPagination,
    observeBusinesses,
    dataReady,
    isCacheValid,
    lastCacheUpdate
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