import React, { useState, useCallback, useEffect } from 'react';
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
  Switch
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

// Extended navigation params type to include all screens used in this component
type ExtendedStackParamList = RootStackParamList & {
  Map: undefined;
  AddBusiness: undefined;
  Favorites: undefined;
  Profile: undefined;
  Conversations: undefined;
  Notifications: undefined;
};

type NavigationProps = StackNavigationProp<ExtendedStackParamList>;

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
    isFavorite
  } = useBusinesses();
  
  // Add ChatContext to get unread messages count
  const { unreadTotal, refreshConversations } = useChat();
  
  const { userLocation, refreshLocation, getFormattedDistance } = useLocation();

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Business[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [displayedBusinesses, setDisplayedBusinesses] = useState<Business[]>([]);
  const [sortByDistance, setSortByDistance] = useState(false);
  
  // Nuevos estados para los filtros
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

  // Update displayed businesses with all filters applied
  useEffect(() => {
    let currentBusinesses = showSearch ? searchResults : filteredBusinesses;
    
    // Filter by open now if selected
    if (filterByOpenNow) {
      currentBusinesses = currentBusinesses.filter(business => {
        // Assuming business has businessHours property with day of week keys
        // This is a simplified implementation - you may need to adapt to your data structure
        if (!business.businessHours) return false;
        
        const now = new Date();
        const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
        const currentHour = now.getHours();
        const currentMinutes = now.getMinutes();
        const currentTime = currentHour * 60 + currentMinutes; // convert to minutes
        
        // Safely access business hours
        const dayHours = business.businessHours[dayOfWeek];
        if (!dayHours || dayHours.closed) return false;
        
        // Parse open and close times (assuming format like "9:00" or "21:30")
        const openTimeParts = dayHours.open?.split(':').map(Number) || [0, 0];
        const closeTimeParts = dayHours.close?.split(':').map(Number) || [0, 0];
        
        const openTimeMinutes = openTimeParts[0] * 60 + (openTimeParts[1] || 0);
        const closeTimeMinutes = closeTimeParts[0] * 60 + (closeTimeParts[1] || 0);
        
        return currentTime >= openTimeMinutes && currentTime <= closeTimeMinutes;
      });
    }
    
    // Filter by maximum distance if set
    if (maxDistance !== null && userLocation) {
      currentBusinesses = currentBusinesses.filter(business => {
        const distance = getDistanceToBusinessInKm(business);
        return distance !== undefined && distance <= maxDistance;
      });
    }
    
    // Filter by minimum rating if set
    if (selectedRating !== null) {
      currentBusinesses = currentBusinesses.filter(business => {
        // Assuming business has rating property
        return business.rating && business.rating >= selectedRating;
      });
    }
    
    // Sort businesses based on selected sort method
    if (sortByDistance && userLocation) {
      currentBusinesses = [...currentBusinesses].sort((a, b) => {
        const distanceA = getDistanceToBusinessInKm(a);
        const distanceB = getDistanceToBusinessInKm(b);
        
        if (distanceA === undefined) return 1;
        if (distanceB === undefined) return -1;
        
        return distanceA - distanceB;
      });
    }
    
    if (filterByRating) {
      currentBusinesses = [...currentBusinesses].sort((a, b) => {
        const ratingA = a.rating || 0;
        const ratingB = b.rating || 0;
        return ratingB - ratingA; // Sort by descending rating
      });
    }

    setDisplayedBusinesses(currentBusinesses);
    
    // Count active filters
    let count = 0;
    if (filterByOpenNow) count++;
    if (maxDistance !== null) count++;
    if (selectedRating !== null) count++;
    if (sortByDistance || filterByRating) count++;
    if (selectedCategory) count++;
    setActiveFiltersCount(count);
    
  }, [
    showSearch, 
    searchResults, 
    filteredBusinesses, 
    sortByDistance, 
    userLocation, 
    filterByOpenNow, 
    maxDistance, 
    selectedRating,
    filterByRating
  ]);

  // Apply selected filters
  const applyFilters = () => {
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
  };

  // Reset all filters
  const resetFilters = () => {
    setTempFilters({
      openNow: false,
      rating: null,
      maxDistance: null,
      sortBy: 'default'
    });
  };

  // Initialize temp filters when opening modal
  const openFilterModal = () => {
    setTempFilters({
      openNow: filterByOpenNow,
      rating: selectedRating,
      maxDistance: maxDistance,
      sortBy: sortByDistance ? 'distance' : filterByRating ? 'rating' : 'default'
    });
    setShowFilterModal(true);
  };

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

  // Calculate distance between user and business in km (for sorting)
  const getDistanceToBusinessInKm = useCallback((business: Business): number | undefined => {
    if (!userLocation || !business.location) {
      return undefined;
    }
    
    // Handle location whether it's an object or needs to be parsed
    let businessLocation;
    try {
      businessLocation = typeof business.location === 'string' 
        ? JSON.parse(business.location)
        : business.location;
        
      if (!businessLocation.latitude || !businessLocation.longitude) {
        return undefined;
      }
      
      // Calculate distance using the Haversine formula (rough approximation)
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

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    
    if (query.trim() === '') {
      setShowSearch(false);
      return;
    }

    setShowSearch(true);
    const filtered = businesses.filter(
      business => business.name.toLowerCase().includes(query.toLowerCase()) ||
                 business.category.toLowerCase().includes(query.toLowerCase())
    );
    setSearchResults(filtered);
  };

  // Handle refresh with location update
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refreshBusinesses(),
      refreshLocation()
    ]);
    setRefreshing(false);
  }, [refreshBusinesses, refreshLocation]);

  // Toggle distance sorting
  const toggleDistanceSort = () => {
    if (!userLocation && !sortByDistance) {
      Alert.alert(
        "Ubicación no disponible",
        "Para ordenar por distancia, necesitamos acceso a tu ubicación. Activa la ubicación en la configuración de tu dispositivo.",
        [
          { text: "OK" }
        ]
      );
      return;
    }
    setSortByDistance(!sortByDistance);
  };

  // Navigate to map view
  const navigateToMapView = () => {
    navigation.navigate('Map');
  };

  // Navigate to business detail
  const navigateToBusinessDetail = (business: Business) => {
    navigation.navigate('BusinessDetail', { businessId: business.id });
  };

  // Render category item
  const renderCategoryItem = ({ item }: { item: string | null }) => (
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
  );

  // Render business item
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
        />
      </View>
    );
  }, [isFavorite, navigateToBusinessDetail, toggleFavorite, getFormattedDistance]);

  // Render skeleton loaders
  const renderSkeletons = () => (
    <View style={styles.businessGrid}>
      {Array.from({ length: 6 }).map((_, index) => (
        <SkeletonBusinessCard key={index} />
      ))}
    </View>
  );

  // Render empty state
  const renderEmptyState = () => (
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
            No hay negocios disponibles en esta categoría
          </Text>
        </>
      )}
    </View>
  );

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('HomeScreen focused - refreshing data');
      
      // Refresh chat data when returning from Conversations screen
      refreshConversations().catch(err => {
        console.error('Error refreshing conversations:', err);
      });
      
      return () => {
        // Cleanup if needed
      };
    }, [refreshConversations])
  );

  // Render the filter modal
  const renderFilterModal = () => {
    return (
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
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FF" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/Icon.png')}
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
        <FlatList
          data={displayedBusinesses}
          keyExtractor={(item) => item.id}
          renderItem={renderBusinessItem}
          numColumns={2}
          columnWrapperStyle={styles.businessRow}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              {/* Welcome Message */}
              <View style={styles.welcomeSection}>
                <Text style={styles.welcomeTitle}>
                  Descubre negocios locales
                </Text>
                <Text style={styles.welcomeSubtitle}>
                  Apoya a los comercios de El Salvador
                </Text>
              </View>
              
              {/* Categories */}
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
            </>
          }
          ListEmptyComponent={!loading ? renderEmptyState : null}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#007AFF']}
              tintColor="#007AFF"
            />
          }
        />
      )}
      
      {/* Render Filter Modal */}
      {renderFilterModal()}
    </SafeAreaView>
  );
};

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
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
  welcomeSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#666666',
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
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
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
    paddingHorizontal: 16, // Add padding to the grid
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between', // Ensure cards are spaced horizontally
  },
  businessRow: {
    justifyContent: 'space-between', // Ensure cards are spaced horizontally
    paddingHorizontal: 16, // Add horizontal padding
    marginBottom: 16, // Add vertical spacing between rows
  },
  listContent: {
    paddingBottom: 80,
    paddingTop: 16, // Add padding at the top
  },
  gridItemContainer: {
    width: '48%', // Ensure two cards fit in a row with spacing
    marginBottom: 8, // Reduced vertical spacing between cards
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
  // Styles for notification badge on the bell icon
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
  // New styles for filter functionality
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
    padding: 4,
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
});

export default HomeScreen;