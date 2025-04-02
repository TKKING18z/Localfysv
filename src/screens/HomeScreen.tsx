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
  Alert
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
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

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

  // Update displayed businesses whenever filtered businesses or search results change
  useEffect(() => {
    let currentBusinesses = showSearch ? searchResults : filteredBusinesses;

    // Sort by distance if option is enabled and user location is available
    if (sortByDistance && userLocation) {
      currentBusinesses = [...currentBusinesses].sort((a, b) => {
        const distanceA = getDistanceToBusinessInKm(a);
        const distanceB = getDistanceToBusinessInKm(b);
        
        if (distanceA === undefined) return 1;
        if (distanceB === undefined) return -1;
        
        return distanceA - distanceB;
      });
    }

    setDisplayedBusinesses(currentBusinesses);
  }, [showSearch, searchResults, filteredBusinesses, sortByDistance, userLocation]);

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

  // Handle logout
  const handleLogout = async () => {
    try {
      await firebase.auth().signOut();
      // No need to navigate to Login, Auth Navigator will handle this automatically
    } catch (error) {
      console.error('Error logging out:', error);
      Alert.alert('Error', 'No se pudo cerrar sesión. Intente de nuevo.');
    }
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
      <BusinessCard
        business={item}
        isFavorite={isFavorite(item.id)}
        onPress={() => navigateToBusinessDetail(item)}
        onFavoritePress={() => toggleFavorite(item.id)}
        distance={distance}
      />
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
          
          <TouchableOpacity style={styles.iconButton} onPress={handleLogout}>
            <MaterialIcons name="logout" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
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
          contentContainerStyle={[
            styles.listContent,
            displayedBusinesses.length === 0 ? { flex: 1 } : {}
          ]}
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
      
      {/* Bottom Navigation */}
      <View style={styles.bottomNavigation}>
        <TouchableOpacity style={styles.navItem}>
          <MaterialIcons name="home" size={24} color="#007AFF" />
          <Text style={styles.navItemTextActive}>Inicio</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => navigation.navigate('Conversations')}
        >
          <View>
            <MaterialIcons name="chat" size={24} color="#8E8E93" />
            {unreadTotal > 0 && (
              <View style={styles.chatBadge}>
                <Text style={styles.chatBadgeText}>
                  {unreadTotal > 99 ? '99+' : unreadTotal}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.navItemText}>Mensajes</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItemCenter}
          onPress={() => navigation.navigate('AddBusiness')}
        >
          <View style={styles.navItemCenterButton}>
            <MaterialIcons name="add" size={28} color="white" />
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => navigation.navigate('Favorites')}
        >
          <MaterialIcons name="favorite-border" size={24} color="#8E8E93" />
          <Text style={styles.navItemText}>Favoritos</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => navigation.navigate('Profile')}
        >
          <MaterialIcons name="person-outline" size={24} color="#8E8E93" />
          <Text style={styles.navItemText}>Perfil</Text>
        </TouchableOpacity>
      </View>
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
  searchBar: {
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
    paddingHorizontal: 16,
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  businessRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  listContent: {
    paddingBottom: 80,
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
  bottomNavigation: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    flexDirection: 'row',
    height: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  navItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navItemCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navItemCenterButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  navItemText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  navItemTextActive: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 4,
    fontWeight: '600',
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
  // Add styles for chat badge
  chatBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  chatBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
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
});

export default HomeScreen;