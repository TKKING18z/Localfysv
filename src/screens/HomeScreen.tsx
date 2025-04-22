import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  RefreshControl,
  StatusBar,
  Alert,
  Modal,
  ScrollView,
  Switch,
  Platform,
  InteractionManager
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useBusinesses, Business } from '../context/BusinessContext';
import { useChat } from '../context/ChatContext';
import BusinessCard from '../components/BusinessCard';
import SkeletonBusinessCard from '../components/SkeletonBusinessCard';
import { useLocation } from '../hooks/useLocation';
import BasicAdInterstitial from '../components/ads/BasicAdInterstitial';
import { useNetwork } from '../context/NetworkContext';
import OfflineBanner from '../components/common/OfflineBanner';

// Define navigation type using RootStackParamList directly
type NavigationProps = StackNavigationProp<RootStackParamList>;

// Constants to improve performance
const MAX_ITEMS_SLOW_CONNECTION = 8;
const MAX_ITEMS_NORMAL = 20;
const LOCATION_REFRESH_INTERVAL = 60000; // 1 minute
const DEBOUNCE_SEARCH_DELAY = 300; // ms

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const {
    businesses,
    filteredBusinesses,
    categories,
    loading,
    selectedCategory,
    setSelectedCategory,
    refreshBusinesses,
    toggleFavorite,
    isFavorite,
    loadMoreBusinesses,
    hasMoreBusinesses,
    resetPagination,
    observeBusinesses,
    dataReady
  } = useBusinesses();
  
  // Add NetworkContext to adapt UI based on connection quality
  const { isSlowConnection, isConnected } = useNetwork();
  
  // Add ChatContext to get unread messages count
  const { unreadTotal, refreshConversations } = useChat();
  
  const { userLocation, refreshLocation, getFormattedDistance } = useLocation();

  // State variables
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Business[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [displayedBusinesses, setDisplayedBusinesses] = useState<Business[]>([]);
  const [sortByDistance, setSortByDistance] = useState(false);
  
  // Filter states
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterByOpenNow, setFilterByOpenNow] = useState(false);
  const [filterByRating, setFilterByRating] = useState(false);
  const [maxDistance, setMaxDistance] = useState<number | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [tempFilters, setTempFilters] = useState({
    openNow: false,
    rating: null as number | null,
    maxDistance: null as number | null,
    sortBy: 'default' as 'default' | 'distance' | 'rating'
  });
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  // Refs for performance optimization
  const isRefreshingRef = useRef(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocationRefreshRef = useRef(Date.now());
  
  // Memoize the maximum number of items to display based on connection speed
  const maxItemsToDisplay = useMemo(() => {
    // Use same limits for both platforms for visual consistency
    return isSlowConnection ? MAX_ITEMS_SLOW_CONNECTION : MAX_ITEMS_NORMAL;
  }, [isSlowConnection]);

  // Añadir estado para controlar negocios visibles 
  const [visibleBusinessIds, setVisibleBusinessIds] = useState<string[]>([]);
  
  // Ref para tracking de llamadas de paginación
  const isLoadingMoreRef = useRef(false);

  // Add a cache reference to track when data was last loaded
  const lastDataLoadTimeRef = useRef<number>(Date.now());
  const isInitialLoadRef = useRef<boolean>(true);
  
  // Define cache validity period (5 minutes)
  const CACHE_VALIDITY_PERIOD = 5 * 60 * 1000;
  
  // Check if data needs refresh
  const isDataStale = useCallback(() => {
    const now = Date.now();
    return now - lastDataLoadTimeRef.current > CACHE_VALIDITY_PERIOD;
  }, []);

  // Calculate distance between user and business in km (optimized)
  const getDistanceToBusinessInKm = useCallback((business: Business): number | undefined => {
    if (!userLocation || !business.location) {
      return undefined;
    }
    
    let businessLocation;
    try {
      businessLocation = typeof business.location === 'string' 
        ? JSON.parse(business.location)
        : business.location;
        
      if (!businessLocation.latitude || !businessLocation.longitude) {
        return undefined;
      }
      
      // Calculate distance using the Haversine formula
      const R = 6371; // Radius of the earth in km
      const dLat = deg2rad(businessLocation.latitude - userLocation.latitude);
      const dLon = deg2rad(businessLocation.longitude - userLocation.longitude);
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(userLocation.latitude)) * Math.cos(deg2rad(businessLocation.latitude)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    } catch (error) {
      return undefined;
    }
  }, [userLocation]);
  
  // Helper function to convert degrees to radians
  const deg2rad = (deg: number) => {
    return deg * (Math.PI/180);
  };

  // Versión mejorada y optimizada de handleSearch
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    
    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (query.trim() === '') {
      setShowSearch(false);
      setSearchResults([]);
      return;
    }

    // Debounce search for better performance
    searchTimeoutRef.current = setTimeout(() => {
      setShowSearch(true);
      
      // Mover la búsqueda a un worker en segundo plano
      const workerSearch = () => {
        return new Promise<Business[]>(resolve => {
          // Usar setTimeout para sacar la operación del hilo principal
          setTimeout(() => {
            // Use a more efficient search with lower-cased strings
            const lowerQuery = query.toLowerCase();
            const filtered = businesses.filter(
              business => 
                business.name.toLowerCase().includes(lowerQuery) ||
                (business.category && business.category.toLowerCase().includes(lowerQuery))
            );
            
            // Limit results based on connection quality
            resolve(filtered.slice(0, maxItemsToDisplay));
          }, 0);
        });
      };
      
      // Ejecutar búsqueda en segundo plano
      workerSearch().then(results => {
        setSearchResults(results);
      });
    }, DEBOUNCE_SEARCH_DELAY);
  }, [businesses, maxItemsToDisplay]);

  // Mover operaciones de filtrado fuera del hilo principal
  const applyFiltersAsync = useCallback(async () => {
    return new Promise<Business[]>(resolve => {
      // Defer heavy filtering to a background task
      InteractionManager.runAfterInteractions(() => {
        setTimeout(() => {
          let currentBusinesses = showSearch ? searchResults : filteredBusinesses;
          
          // Apply filters conditionally for better performance on slow devices
          // Filter by open now
          if (filterByOpenNow) {
            currentBusinesses = currentBusinesses.filter(business => {
              if (!business.businessHours) return false;
              
              const now = new Date();
              const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
              const currentHour = now.getHours();
              const currentMinutes = now.getMinutes();
              const currentTime = currentHour * 60 + currentMinutes;
              
              const dayHours = business.businessHours[dayOfWeek];
              if (!dayHours || dayHours.closed) return false;
              
              try {
                const openTimeParts = dayHours.open?.split(':').map(Number) || [0, 0];
                const closeTimeParts = dayHours.close?.split(':').map(Number) || [0, 0];
                
                const openTimeMinutes = openTimeParts[0] * 60 + (openTimeParts[1] || 0);
                const closeTimeMinutes = closeTimeParts[0] * 60 + (closeTimeParts[1] || 0);
                
                return currentTime >= openTimeMinutes && currentTime <= closeTimeMinutes;
              } catch (error) {
                return false;
              }
            });
          }
          
          // Filter by maximum distance
          if (maxDistance !== null && userLocation) {
            currentBusinesses = currentBusinesses.filter(business => {
              const distance = getDistanceToBusinessInKm(business);
              return distance !== undefined && distance <= maxDistance;
            });
          }
          
          // Filter by minimum rating
          if (selectedRating !== null) {
            currentBusinesses = currentBusinesses.filter(business => {
              return business.rating && business.rating >= selectedRating;
            });
          }
          
          // Optimize sort performance for slow devices
          if (sortByDistance && userLocation) {
            // Pre-calculate distances for sorting to avoid repetitive calculations
            const businessesWithDistances = currentBusinesses.map(business => {
              const distance = getDistanceToBusinessInKm(business) || Infinity;
              return { business, distance };
            });
            
            businessesWithDistances.sort((a, b) => a.distance - b.distance);
            currentBusinesses = businessesWithDistances.map(item => item.business);
          } else if (filterByRating) {
            currentBusinesses = [...currentBusinesses].sort((a, b) => {
              const ratingA = a.rating || 0;
              const ratingB = b.rating || 0;
              return ratingB - ratingA;
            });
          }
          
          // Limit displayed items for slow connections/devices
          const limitedBusinesses = currentBusinesses.slice(0, maxItemsToDisplay);
          resolve(limitedBusinesses);
        }, 0);
      });
    });
  }, [
    showSearch, 
    searchResults, 
    filteredBusinesses, 
    sortByDistance, 
    userLocation, 
    filterByOpenNow, 
    maxDistance, 
    selectedRating,
    filterByRating,
    maxItemsToDisplay,
    getDistanceToBusinessInKm
  ]);

  // Actualizar el efecto para usar applyFiltersAsync
  useEffect(() => {
    let isMounted = true;
    
    applyFiltersAsync().then(filteredResults => {
      if (isMounted) {
        setDisplayedBusinesses(filteredResults);
        
        // Count active filters
        let count = 0;
        if (filterByOpenNow) count++;
        if (maxDistance !== null) count++;
        if (selectedRating !== null) count++;
        if (sortByDistance || filterByRating) count++;
        if (selectedCategory) count++;
        setActiveFiltersCount(count);
      }
    });
    
    return () => {
      isMounted = false;
    };
  }, [
    showSearch, 
    searchResults, 
    filteredBusinesses, 
    sortByDistance, 
    userLocation, 
    filterByOpenNow, 
    maxDistance, 
    selectedRating,
    filterByRating,
    maxItemsToDisplay,
    applyFiltersAsync
  ]);
  
  // Función para manejar cambios en elementos visibles
  const onViewableItemsChanged = useCallback(({viewableItems}: {
    viewableItems: Array<{
      item: Business;
      isViewable: boolean;
      key: string;
      index: number | null;
    }>;
  }) => {
    const visibleIds = viewableItems
      .filter(item => item.isViewable)
      .map(item => item.item.id);
    
    if (visibleIds.length > 0) {
      setVisibleBusinessIds(visibleIds);
    }
  }, []);
  
  // Configuración de viewability
  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 50
  }), []);
  
  // Ref para el viewability tracking
  const viewabilityConfigCallbackPairs = useRef([
    { viewabilityConfig, onViewableItemsChanged }
  ]);
  
  // Observar solo negocios visibles (optimización para Firebase listeners)
  useEffect(() => {
    // Solo observar cuando hay IDs y estamos en pantalla visible
    if (visibleBusinessIds.length > 0) {
      const unsubscribe = observeBusinesses(visibleBusinessIds);
      return unsubscribe;
    }
  }, [visibleBusinessIds, observeBusinesses]);
  
  // Función para cargar más negocios
  const onEndReached = useCallback(() => {
    if (isLoadingMoreRef.current || refreshing || !hasMoreBusinesses || showSearch) {
      return;
    }
    
    isLoadingMoreRef.current = true;
    
    // Añadir intervalo para evitar múltiples llamadas
    setTimeout(async () => {
      try {
        await loadMoreBusinesses();
      } catch (error) {
        console.error('Error loading more businesses:', error);
      } finally {
        isLoadingMoreRef.current = false;
      }
    }, 400);
  }, [refreshing, hasMoreBusinesses, loadMoreBusinesses, showSearch]);

  // Apply selected filters
  const applyFilters = useCallback(() => {
    setFilterByOpenNow(tempFilters.openNow);
    setSelectedRating(tempFilters.rating);
    setMaxDistance(tempFilters.maxDistance);
    
    if (tempFilters.sortBy === 'distance') {
      setSortByDistance(true);
      setFilterByRating(false);
    } else if (tempFilters.sortBy === 'rating') {
      setFilterByRating(true);
      setSortByDistance(false);
    } else {
      setSortByDistance(false);
      setFilterByRating(false);
    }
    
    setShowFilterModal(false);
  }, [tempFilters]);

  // Reset all filters
  const resetFilters = useCallback(() => {
    setTempFilters({
      openNow: false,
      rating: null,
      maxDistance: null,
      sortBy: 'default'
    });
  }, []);

  // Initialize temp filters when opening modal
  const openFilterModal = useCallback(() => {
    setTempFilters({
      openNow: filterByOpenNow,
      rating: selectedRating,
      maxDistance: maxDistance,
      sortBy: sortByDistance ? 'distance' : filterByRating ? 'rating' : 'default'
    });
    setShowFilterModal(true);
  }, [filterByOpenNow, selectedRating, maxDistance, sortByDistance, filterByRating]);

  // Render distance filter options
  const renderDistanceOptions = () => {
    const options = [1, 3, 5, 10, 20];
    return (
      <View style={styles.filterOptionsRow}>
        {options.map(distance => (
          <TouchableOpacity
            key={`distance-${distance}`}
            style={[
              styles.filterChip,
              tempFilters.maxDistance === distance && styles.filterChipActive
            ]}
            onPress={() => setTempFilters({
              ...tempFilters,
              maxDistance: tempFilters.maxDistance === distance ? null : distance
            })}
          >
            <Text 
              style={[
                styles.filterChipText,
                tempFilters.maxDistance === distance && styles.filterChipTextActive
              ]}
            >
              {distance} km
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Render rating filter options
  const renderRatingOptions = () => {
    return (
      <View style={styles.filterOptionsRow}>
        {[3, 4, 4.5].map(rating => (
          <TouchableOpacity
            key={`rating-${rating}`}
            style={[
              styles.filterChip,
              tempFilters.rating === rating && styles.filterChipActive
            ]}
            onPress={() => setTempFilters({
              ...tempFilters,
              rating: tempFilters.rating === rating ? null : rating
            })}
          >
            <Text 
              style={[
                styles.filterChipText,
                tempFilters.rating === rating && styles.filterChipTextActive
              ]}
            >
              {rating}+ <MaterialIcons name="star" size={16} color={tempFilters.rating === rating ? "#FFFFFF" : "#FFC107"} />
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Optimize the refresh handler to respect network conditions
  const onRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return;
    
    setRefreshing(true);
    isRefreshingRef.current = true;
    
    try {
      // Reset pagination first
      resetPagination();
      
      // Only refresh location if enough time has passed or we have none
      const now = Date.now();
      const shouldRefreshLocation = 
        !userLocation || 
        (now - lastLocationRefreshRef.current > LOCATION_REFRESH_INTERVAL);
      
      const tasks = [refreshBusinesses()];
      
      if (shouldRefreshLocation) {
        tasks.push(refreshLocation());
        lastLocationRefreshRef.current = now;
      }
      
      // Use Promise.all for parallel execution
      await Promise.all(tasks);
      
      // Only refresh conversations when connected
      if (isConnected) {
        await refreshConversations();
      }
      
      // Update the last data load time
      lastDataLoadTimeRef.current = Date.now();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
      
      // Allow future refreshes after a delay
      setTimeout(() => {
        isRefreshingRef.current = false;
      }, 500);
    }
  }, [refreshBusinesses, refreshLocation, refreshConversations, userLocation, isConnected, resetPagination]);

  // Toggle distance sorting with network condition check
  const toggleDistanceSort = useCallback(() => {
    if (!userLocation && !sortByDistance) {
      Alert.alert(
        "Ubicación no disponible",
        "Para ordenar por distancia, necesitamos acceso a tu ubicación. Activa la ubicación en la configuración de tu dispositivo.",
        [{ text: "OK" }]
      );
      return;
    }
    
    // Limit sorting on slow connections
    if (isSlowConnection && !sortByDistance) {
      Alert.alert(
        "Conexión lenta detectada",
        "Ordenar por distancia puede ser lento en tu conexión actual. ¿Deseas continuar?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Continuar", onPress: () => setSortByDistance(true) }
        ]
      );
    } else {
      setSortByDistance(!sortByDistance);
    }
  }, [userLocation, sortByDistance, isSlowConnection]);

  // Navigate to map view - memoized
  const navigateToMapView = useCallback(() => {
    navigation.navigate('Map', { selectingDeliveryLocation: false });
  }, [navigation]);

  // Navigate to business detail - memoized
  const navigateToBusinessDetail = useCallback((business: Business) => {
    navigation.navigate('BusinessDetail', { businessId: business.id });
  }, [navigation]);

  // Render category item - memoized
  const renderCategoryItem = useCallback(({ item }: { item: string | null }) => (
    <TouchableOpacity
      style={[
        styles.categoryItem,
        selectedCategory === item ? styles.categoryItemActive : {}
      ]}
      onPress={() => setSelectedCategory(selectedCategory === item ? null : item)}
    >
      <Text
        style={[
          styles.categoryText,
          selectedCategory === item ? styles.categoryTextActive : {}
        ]}
      >
        {item === null ? 'Todos' : item}
      </Text>
    </TouchableOpacity>
  ), [selectedCategory, setSelectedCategory]);

  // Render business item with memoized callback
  const renderBusinessItem = useCallback(({ item }: { item: Business }) => {
    // Get distance if available
    const distance = getFormattedDistance(item);
    
    return (
      <View style={styles.gridItemContainer}>
        <BusinessCard
          business={item}
          isFavorite={isFavorite(item.id)}
          onPress={() => navigateToBusinessDetail(item)}
          onFavoritePress={() => toggleFavorite(item.id)}
          distance={distance}
          showOpenStatus={!isSlowConnection}
          isVisible={true}
        />
      </View>
    );
  }, [
    isFavorite, 
    navigateToBusinessDetail, 
    toggleFavorite, 
    getFormattedDistance,
    isSlowConnection
  ]);

  // Render skeleton loaders - memoized to avoid recreating components
  const renderSkeletons = useCallback(() => (
    <View style={styles.businessGrid}>
      {Array.from({ length: isSlowConnection ? 4 : 6 }).map((_, index) => (
        <SkeletonBusinessCard key={index} />
      ))}
    </View>
  ), [isSlowConnection]);

  // Render empty state - memoized
  const renderEmptyState = useCallback(() => (
    <View style={styles.noResultsContainer}>
      {showSearch ? (
        <>
          <MaterialIcons name="search-off" size={64} color="#C7C7CC" />
          <Text style={styles.noResultsText}>
            No se encontraron resultados para "{searchQuery}"
          </Text>
        </>
      ) : (
        <>
          <MaterialIcons name="store-mall-directory" size={64} color="#C7C7CC" />
          <Text style={styles.noResultsText}>
            {isConnected 
              ? "No hay negocios disponibles en esta categoría"
              : "No se pueden cargar negocios sin conexión"}
          </Text>
        </>
      )}
    </View>
  ), [showSearch, searchQuery, isConnected]);

  // Update data when screen gains focus - optimized to avoid unnecessary loads
  useFocusEffect(
    useCallback(() => {
      // Skip if already refreshing
      if (isRefreshingRef.current) return;
      
      console.log('HomeScreen gained focus - checking if update needed');
      
      // Check if this is initial load or if data is stale
      const shouldRefresh = isInitialLoadRef.current || isDataStale();
      
      if (!shouldRefresh) {
        console.log('Data is still fresh, skipping reload');
        return;
      }
      
      // Mark that we're refreshing and no longer initial load
      isRefreshingRef.current = true;
      isInitialLoadRef.current = false;
      
      // Use InteractionManager to defer non-UI work
      InteractionManager.runAfterInteractions(async () => {
        try {
          // Only refresh if we have connectivity and data is not loading
          if (isConnected && !loading) {
            console.log('Refreshing businesses data');
            
            // Don't show loading state if we already have data
            const shouldUpdateLoadingState = businesses.length === 0;
            
            if (shouldUpdateLoadingState) {
              // No podemos usar setLoading directamente aquí
              // Necesitamos usar la función refreshBusinesses que ya maneja el estado de carga
              // Sin intentar establecer el estado de carga manualmente
            }
            
            await refreshBusinesses();
            
            // Update the last data load time
            lastDataLoadTimeRef.current = Date.now();
            
            // Only refresh conversations when connected and not on slow connection
            if (!isSlowConnection) {
              await refreshConversations();
            }
            
            // No necesitamos resetear el estado de carga manualmente
            // refreshBusinesses ya se encarga de eso
          }
        } catch (error) {
          console.error('Error updating data:', error);
        } finally {
          // Allow future updates after a delay
          setTimeout(() => {
            isRefreshingRef.current = false;
          }, 1000);
        }
      });
      
      // No cleanup needed
      return () => {};
    }, [refreshBusinesses, refreshConversations, isConnected, isSlowConnection, loading, businesses.length, isDataStale])
  );

  // Memoize the FlatList key extractor for better performance
  const keyExtractor = useCallback((item: Business) => item.id, []);
  
  // Optimize column wrapper style for FlatList
  const columnWrapperStyle = useMemo(() => styles.businessRow, []);
  
  // Renderizar el componente de carga para la paginación
  const renderFooter = useCallback(() => {
    if (!hasMoreBusinesses) return null;
    
    return (
      <View style={styles.loadingMore}>
        <SkeletonBusinessCard />
        <SkeletonBusinessCard />
      </View>
    );
  }, [hasMoreBusinesses]);
  
  // Replace FlashList specific props with standardized FlatList props
  const flatListProps = useMemo(() => ({
    data: displayedBusinesses,
    renderItem: renderBusinessItem,
    keyExtractor: (item: Business) => item.id,
    numColumns: 2,
    onEndReached: onEndReached,
    onEndReachedThreshold: 0.5,
    refreshControl: (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        colors={['#007AFF']}
        tintColor="#007AFF"
      />
    ),
    ListFooterComponent: renderFooter,
    columnWrapperStyle: styles.businessRow,
    contentContainerStyle: styles.listContent,
    ListEmptyComponent: !loading ? renderEmptyState : null,
    removeClippedSubviews: true,
    maxToRenderPerBatch: 6,
    windowSize: 5,
    initialNumToRender: 6,
  }), [
    displayedBusinesses, 
    renderBusinessItem, 
    onEndReached,
    refreshing,
    onRefresh,
    renderFooter,
    loading,
    renderEmptyState
  ]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FF" />
      
      {/* Offline Banner */}
      <OfflineBanner />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
          />
          <Text style={styles.title}>Localfy</Text>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={() => navigation.navigate('Notifications')}
          >
            <View>
              <MaterialIcons name="notifications-none" size={24} color="#007AFF" />
              {unreadTotal > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {unreadTotal > 9 ? '9+' : unreadTotal}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Search Bar with Filter Button */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBarContainer}>
          <View style={styles.searchBar}>
            <MaterialIcons name="search" size={24} color="#8E8E93" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar negocios locales..."
              placeholderTextColor="#8E8E93"
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => handleSearch('')}>
                <MaterialIcons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={navigateToMapView} style={styles.mapButton}>
                <MaterialIcons name="map" size={24} color="#007AFF" />
              </TouchableOpacity>
            )}
          </View>
          
          <TouchableOpacity 
            style={[
              styles.filterButton,
              activeFiltersCount > 0 && styles.filterButtonActive
            ]}
            onPress={openFilterModal}
          >
            <MaterialIcons 
              name="tune" 
              size={24} 
              color={activeFiltersCount > 0 ? "#FFFFFF" : "#007AFF"} 
            />
            {activeFiltersCount > 0 && (
              <View style={styles.filterCountBadge}>
                <Text style={styles.filterCountText}>{activeFiltersCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        
        {/* Active filters chips */}
        {activeFiltersCount > 0 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeFiltersContainer}
          >
            {selectedCategory && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterText}>
                  {selectedCategory}
                </Text>
                <TouchableOpacity onPress={() => setSelectedCategory(null)}>
                  <MaterialIcons name="close" size={16} color="#007AFF" />
                </TouchableOpacity>
              </View>
            )}
            
            {filterByOpenNow && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterText}>
                  Abierto ahora
                </Text>
                <TouchableOpacity onPress={() => setFilterByOpenNow(false)}>
                  <MaterialIcons name="close" size={16} color="#007AFF" />
                </TouchableOpacity>
              </View>
            )}
            
            {maxDistance !== null && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterText}>
                  ≤ {maxDistance} km
                </Text>
                <TouchableOpacity onPress={() => setMaxDistance(null)}>
                  <MaterialIcons name="close" size={16} color="#007AFF" />
                </TouchableOpacity>
              </View>
            )}
            
            {selectedRating !== null && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterText}>
                  {selectedRating}+ <MaterialIcons name="star" size={14} color="#007AFF" />
                </Text>
                <TouchableOpacity onPress={() => setSelectedRating(null)}>
                  <MaterialIcons name="close" size={16} color="#007AFF" />
                </TouchableOpacity>
              </View>
            )}
            
            {sortByDistance && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterText}>
                  Por distancia
                </Text>
                <TouchableOpacity onPress={() => setSortByDistance(false)}>
                  <MaterialIcons name="close" size={16} color="#007AFF" />
                </TouchableOpacity>
              </View>
            )}
            
            {filterByRating && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterText}>
                  Por calificación
                </Text>
                <TouchableOpacity onPress={() => setFilterByRating(false)}>
                  <MaterialIcons name="close" size={16} color="#007AFF" />
                </TouchableOpacity>
              </View>
            )}
            
            {activeFiltersCount > 1 && (
              <TouchableOpacity 
                style={styles.clearFiltersButton}
                onPress={() => {
                  setSelectedCategory(null);
                  setFilterByOpenNow(false);
                  setMaxDistance(null);
                  setSelectedRating(null);
                  setSortByDistance(false);
                  setFilterByRating(false);
                }}
              >
                <Text style={styles.clearFiltersText}>Limpiar todos</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
      </View>
      
      {/* Content */}
      {loading && !refreshing ? (
        renderSkeletons()
      ) : (
        <>
          {/* Categorías */}
          <View style={styles.categoriesContainer}>
            <Text style={styles.sectionTitle}>Categorías</Text>
            <FlatList
              horizontal
              data={['Todos', ...categories]}
              renderItem={({ item, index }) => renderCategoryItem({ 
                item: index === 0 ? null : item
              })}
              keyExtractor={(item, index) => index === 0 ? 'all' : item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesList}
              initialNumToRender={4}
              maxToRenderPerBatch={4}
              windowSize={3}
              removeClippedSubviews={true}
            />
          </View>
          
          {/* Businesses Header with Sorting Options */}
          <View style={styles.businessesHeader}>
            <Text style={styles.sectionTitle}>
              {selectedCategory ? selectedCategory : 'Negocios populares'}
            </Text>
            <View style={styles.sortOptions}>
              {showSearch && (
                <Text style={styles.resultsText}>
                  {searchResults.length} resultados
                </Text>
              )}
              <TouchableOpacity 
                style={[styles.sortButton, sortByDistance && styles.sortButtonActive]} 
                onPress={toggleDistanceSort}
              >
                <MaterialIcons 
                  name="near-me" 
                  size={16} 
                  color={sortByDistance ? "#FFFFFF" : "#007AFF"} 
                />
                <Text style={[styles.sortButtonText, sortByDistance && styles.sortButtonTextActive]}>
                  Cercanos
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Use standard FlatList for all platforms */}
          {dataReady && displayedBusinesses && displayedBusinesses.length > 0 ? (
            <FlatList
              {...flatListProps}
            />
          ) : !loading ? (
            renderEmptyState()
          ) : null}
        </>
      )}
      
      {/* Render Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtros de búsqueda</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowFilterModal(false)}
              >
                <MaterialIcons name="close" size={24} color="#333333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              {/* Filter by category */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Categorías</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  removeClippedSubviews={Platform.OS === 'android'}
                >
                  <View style={styles.categoriesWrapper}>
                    {['Todos', ...categories].map((cat, index) => (
                      <TouchableOpacity
                        key={`category-${index}`}
                        style={[
                          styles.categoryItem,
                          (index === 0 && !selectedCategory) || selectedCategory === (index === 0 ? null : cat) 
                            ? styles.categoryItemActive 
                            : {}
                        ]}
                        onPress={() => setSelectedCategory(index === 0 ? null : cat)}
                      >
                        <Text 
                          style={[
                            styles.categoryText,
                            (index === 0 && !selectedCategory) || selectedCategory === (index === 0 ? null : cat) 
                              ? styles.categoryTextActive 
                              : {}
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
              
              {/* Filter by distance */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Distancia máxima</Text>
                {renderDistanceOptions()}
              </View>
              
              {/* Filter by rating */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Calificación mínima</Text>
                {renderRatingOptions()}
              </View>
              
              {/* Filter by open now */}
              <View style={styles.filterSection}>
                <View style={styles.filterToggleRow}>
                  <Text style={styles.filterSectionTitle}>Abierto ahora</Text>
                  <Switch 
                    value={tempFilters.openNow}
                    onValueChange={(value) => setTempFilters({...tempFilters, openNow: value})}
                    trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
                    thumbColor={'#FFFFFF'}
                  />
                </View>
              </View>
              
              {/* Sort options */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Ordenar por</Text>
                <View style={styles.filterOptionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      tempFilters.sortBy === 'default' && styles.filterChipActive
                    ]}
                    onPress={() => setTempFilters({...tempFilters, sortBy: 'default'})}
                  >
                    <Text 
                      style={[
                        styles.filterChipText,
                        tempFilters.sortBy === 'default' && styles.filterChipTextActive
                      ]}
                    >
                      Relevancia
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      tempFilters.sortBy === 'distance' && styles.filterChipActive
                    ]}
                    onPress={() => setTempFilters({...tempFilters, sortBy: 'distance'})}
                  >
                    <Text 
                      style={[
                        styles.filterChipText,
                        tempFilters.sortBy === 'distance' && styles.filterChipTextActive
                      ]}
                    >
                      Distancia
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      tempFilters.sortBy === 'rating' && styles.filterChipActive
                    ]}
                    onPress={() => setTempFilters({...tempFilters, sortBy: 'rating'})}
                  >
                    <Text 
                      style={[
                        styles.filterChipText,
                        tempFilters.sortBy === 'rating' && styles.filterChipTextActive
                      ]}
                    >
                      Calificación
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.resetButton}
                onPress={resetFilters}
              >
                <Text style={styles.resetButtonText}>Restablecer</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.applyButton}
                onPress={applyFilters}
              >
                <Text style={styles.applyButtonText}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// Updated styles with improved Android support
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4, // Increased elevation for better Android shadow
    zIndex: 1,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
    marginRight: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  headerActions: {
    flexDirection: 'row',
  },
  iconButton: {
    padding: 8,
    marginLeft: 8,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4, // Increased for better shadow on Android
    zIndex: 0,
    marginBottom: 8,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
    color: '#333333',
    paddingVertical: 8,
  },
  categoriesContainer: {
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  categoriesList: {
    paddingLeft: 16,
    paddingRight: 8,
  },
  categoryItem: {
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3, // Better elevation for Android
  },
  categoryItemActive: {
    backgroundColor: '#007AFF',
  },
  categoryText: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
  },
  categoryTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  businessesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
  },
  resultsText: {
    fontSize: 14,
    color: '#666666',
  },
  businessGrid: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  businessRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 120,
    paddingTop: 16,
  },
  gridItemContainer: {
    width: '48%',
    marginBottom: 16, // Increased for better spacing
    elevation: 2, // Added for Android
  },
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  noResultsText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginTop: 16,
  },
  mapButton: {
    padding: 4,
  },
  sortOptions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 8,
  },
  sortButtonActive: {
    backgroundColor: '#007AFF',
  },
  sortButtonText: {
    fontSize: 12,
    color: '#007AFF',
    marginLeft: 4,
    fontWeight: '500',
  },
  sortButtonTextActive: {
    color: '#FFFFFF',
  },
  notificationBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: 'bold',
  },
  filterButton: {
    backgroundColor: '#F0F0F5',
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterCountBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterCountText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  activeFiltersContainer: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  activeFilterText: {
    color: '#007AFF',
    fontSize: 13,
    marginRight: 6,
  },
  clearFiltersButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.2)',
  },
  clearFiltersText: {
    color: '#007AFF',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: '50%',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  closeButton: {
    padding: 8, // Increased touch target
  },
  modalBody: {
    padding: 16,
    maxHeight: '70%',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F5',
  },
  resetButton: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F5',
    borderRadius: 12,
    marginRight: 8,
    elevation: 1, // Added for Android
  },
  resetButtonText: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  applyButton: {
    flex: 2,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    marginLeft: 8,
    elevation: 1, // Added for Android
  },
  applyButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  filterSection: {
    marginBottom: 20,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  filterToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterChip: {
    backgroundColor: '#F0F0F5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    elevation: 1, // Added for Android
  },
  filterChipActive: {
    backgroundColor: '#007AFF',
  },
  filterChipText: {
    fontSize: 14,
    color: '#333333',
  },
  filterChipTextActive: {
    color: 'white',
  },
  categoriesWrapper: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  loadingMore: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  }
});

export default React.memo(HomeScreen);