import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, SafeAreaView, ActivityIndicator, StatusBar, Platform, TextInput, FlatList } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MapView, { Marker, PROVIDER_GOOGLE, Region, Callout } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocationContext } from '../context/LocationContext';
import { useBusinesses, Business } from '../context/BusinessContext';
import { formatDistance, calculateDistance } from '../services/LocationService';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Geocoder from 'react-native-geocoding';

// Define type for Geocoder's response
interface GeocoderResponse {
  results: Array<{
    formatted_address: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      }
    }
  }>;
  status: string;
}

// Define location interface
interface Location {
  latitude: number;
  longitude: number;
}

// Extended navigation params type to include all screens used in this component
type ExtendedStackParamList = RootStackParamList & {
  BusinessDetail: { businessId: string };
  Cart: { selectedLocation?: Location; locationAddress?: string };
};

type NavigationProps = StackNavigationProp<ExtendedStackParamList>;
const { width, height } = Dimensions.get('window');

// Define route params types for typecasting
type MapRouteParams = {
  selectingDeliveryLocation?: boolean;
  currentAddress?: string;
};

// Initialize the Geocoder
// For a real app, use your own Google API key from Google Cloud Console
Geocoder.init("AIzaSyAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"); // Replace with actual key in production

const MapScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute();
  const routeParams = route.params as MapRouteParams | undefined;
  const { userLocation, isLoading } = useLocationContext();
  const { filteredBusinesses } = useBusinesses();
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();

  // Check if we're in location selection mode
  const isSelectingLocation = routeParams?.selectingDeliveryLocation || false;
  const currentAddress = routeParams?.currentAddress || '';
  
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [mapReady, setMapReady] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Business[]>([]);
  const [isSearchActive, setIsSearchActive] = useState<boolean>(false);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [region, setRegion] = useState<Region>({
    latitude: 13.6929, // Default to El Salvador
    longitude: -89.2182,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  // For location selection mode
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [locationAddress, setLocationAddress] = useState<string>(currentAddress);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState<boolean>(false);

  // Calculate search container height based on device
  const searchContainerHeight = 60;
  // Calculate appropriate top padding for search bar
  const dynamicTopPadding = Platform.OS === 'ios' ? 5 : 10;
  
  // Set initial region based on user location
  useEffect(() => {
    if (userLocation) {
      setRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    }
  }, [userLocation]);

  // Filter businesses based on search term
  useEffect(() => {
    // Skip this in location selection mode
    if (isSelectingLocation) return;

    if (searchTerm.trim() === '') {
      setSearchResults([]);
      setIsSearchActive(false);
      setShowSuggestions(false);
      return;
    }
    
    setIsSearchActive(true);
    setShowSuggestions(true);
    const term = searchTerm.toLowerCase().trim();
    
    // Filter by name and category only
    const results = filteredBusinesses.filter(business => 
      business.name?.toLowerCase().includes(term) || 
      business.category?.toLowerCase().includes(term)
    );
    
    setSearchResults(results);
  }, [searchTerm, filteredBusinesses, isSelectingLocation]);

  // Handle map press in location selection mode
  const handleMapPress = (event: any) => {
    if (!isSelectingLocation) return;
    
    const { coordinate } = event.nativeEvent;
    setSelectedLocation(coordinate);
    
    // Get address from coordinates using geocoding
    setIsGeocodingAddress(true);
    Geocoder.from(coordinate.latitude, coordinate.longitude)
      .then((response: GeocoderResponse) => {
        const address = response.results[0].formatted_address;
        setLocationAddress(address);
        setIsGeocodingAddress(false);
      })
      .catch((error: Error) => {
        console.warn('Geocoding error:', error);
        setLocationAddress('Ubicación seleccionada');
        setIsGeocodingAddress(false);
      });
  };

  // Function to focus on user location
  const focusOnUserLocation = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });

      // If in location selection mode, also set as selected location
      if (isSelectingLocation) {
        setSelectedLocation(userLocation);
        
        // Get address from coordinates using geocoding
        setIsGeocodingAddress(true);
        Geocoder.from(userLocation.latitude, userLocation.longitude)
          .then((response: GeocoderResponse) => {
            const address = response.results[0].formatted_address;
            setLocationAddress(address);
            setIsGeocodingAddress(false);
          })
          .catch((error: Error) => {
            console.warn('Geocoding error:', error);
            setLocationAddress('Tu ubicación actual');
            setIsGeocodingAddress(false);
          });
      }
    }
  };

  // Function to handle marker press
  const handleMarkerPress = (business: Business) => {
    setSelectedBusiness(business);
    setShowSuggestions(false);
  };

  // Function to confirm selected location and return to CartScreen
  const confirmSelectedLocation = () => {
    if (!selectedLocation) {
      alert('Por favor selecciona una ubicación en el mapa');
      return;
    }

    navigation.navigate('Cart', {
      selectedLocation,
      locationAddress
    });
  };

  // Function to handle suggestion item press
  const handleSuggestionPress = (business: Business) => {
    // Always set the new business as selected
    setSelectedBusiness(business);
    
    // Hide suggestions
    setShowSuggestions(false);
    
    // Clear search to keep UI clean
    setSearchTerm('');
    setIsSearchActive(false);
    
    // Focus map on selected business
    if (business.location && mapRef.current) {
      const businessLocation = typeof business.location === 'string' 
        ? JSON.parse(business.location) as Location
        : business.location as Location;
        
      if (businessLocation.latitude && businessLocation.longitude) {
        mapRef.current.animateToRegion({
          latitude: businessLocation.latitude,
          longitude: businessLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    }
  };

  // Calculate distance to selected business
  const getDistanceToSelectedBusiness = (): string | undefined => {
    if (!userLocation || !selectedBusiness?.location) {
      return undefined;
    }
    
    // Handle location whether it's an object or needs to be parsed
    const businessLocation = typeof selectedBusiness.location === 'string' 
      ? JSON.parse(selectedBusiness.location) as Location
      : selectedBusiness.location as Location;
      
    if (!businessLocation.latitude || !businessLocation.longitude) {
      return undefined;
    }
    
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      businessLocation.latitude,
      businessLocation.longitude
    );
    
    return formatDistance(distance);
  };

  // Calculate distance to any business (for suggestions list)
  const getDistanceToBusiness = (business: Business): string | undefined => {
    if (!userLocation || !business?.location) {
      return undefined;
    }
    
    // Handle location whether it's an object or needs to be parsed
    const businessLocation = typeof business.location === 'string' 
      ? JSON.parse(business.location) as Location
      : business.location as Location;
      
    if (!businessLocation.latitude || !businessLocation.longitude) {
      return undefined;
    }
    
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      businessLocation.latitude,
      businessLocation.longitude
    );
    
    return formatDistance(distance);
  };

  // Navigate to business detail
  const navigateToBusinessDetail = () => {
    if (selectedBusiness) {
      navigation.navigate('BusinessDetail', { businessId: selectedBusiness.id });
    }
  };

  // Go back to home screen
  const goBack = () => {
    navigation.goBack();
  };

  // Clear search input
  const clearSearch = () => {
    setSearchTerm('');
    setIsSearchActive(false);
    setShowSuggestions(false);
    // Don't clear selected business when clearing search
  };

  // Get marker color based on category
  const getMarkerColor = (category: string): string => {
    const lowerCategory = category.toLowerCase();
    if (lowerCategory.includes('restaurante') || lowerCategory.includes('café')) {
      return '#FF9500'; // Orange for restaurants
    } else if (lowerCategory.includes('tienda')) {
      return '#5AC8FA'; // Blue for stores
    } else if (lowerCategory.includes('servicio')) {
      return '#4CD964'; // Green for services
    }
    return '#007AFF'; // Default blue
  };

  // Add a handler for when the map is ready
  const handleMapReady = () => {
    setMapReady(true);
    // Focus on user location if available
    if (userLocation) {
      setTimeout(() => {
        focusOnUserLocation();
      }, 500);
    }
  };

  // Handle search input focus
  const handleSearchFocus = () => {
    if (searchTerm.trim() !== '') {
      setShowSuggestions(true);
    }
    // Keep the selected business - don't clear it on search focus
  };

  // Handle touch on map to dismiss suggestion list but keep selected business
  const handleMapTouch = () => {
    setShowSuggestions(false);
    // Don't clear search when touching map - just hide suggestions
  };

  // Determine which businesses to display on the map
  const businessesToDisplay = isSearchActive ? searchResults : filteredBusinesses;

  // Determine if we should show the map
  const shouldShowMap = !isLoading || Platform.OS === 'ios';

  // Render item for suggestion list
  const renderSuggestionItem = ({ item }: { item: Business }) => (
    <TouchableOpacity 
      style={styles.suggestionItem} 
      onPress={() => handleSuggestionPress(item)}
    >
      <View style={styles.suggestionContent}>
        <View style={[styles.categoryIndicator, { backgroundColor: getMarkerColor(item.category || '') }]} />
        <View style={styles.suggestionTextContainer}>
          <Text style={styles.suggestionTitle}>{item.name}</Text>
          <Text style={styles.suggestionCategory}>{item.category}</Text>
        </View>
        {getDistanceToBusiness(item) && (
          <Text style={styles.suggestionDistance}>{getDistanceToBusiness(item)}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Map */}
      {shouldShowMap && (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            provider={Platform.OS === 'ios' ? undefined : PROVIDER_GOOGLE}
            style={styles.map}
            region={region}
            onRegionChangeComplete={setRegion}
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass={true}
            showsScale={true}
            onMapReady={handleMapReady}
            toolbarEnabled={false}
            onTouchStart={handleMapTouch}
            onPress={isSelectingLocation ? handleMapPress : undefined}
          >
            {/* Only show business markers when not in location selection mode */}
            {mapReady && !isSelectingLocation && businessesToDisplay.map((business) => {
              if (!business.location) return null;
              
              // Handle location whether it's an object or needs to be parsed
              const businessLocation = typeof business.location === 'string' 
                ? JSON.parse(business.location) as Location
                : business.location as Location;
                
              if (!businessLocation.latitude || !businessLocation.longitude) return null;
              
              return (
                <Marker
                  key={business.id}
                  coordinate={{
                    latitude: businessLocation.latitude,
                    longitude: businessLocation.longitude,
                  }}
                  onPress={() => handleMarkerPress(business)}
                  pinColor={getMarkerColor(business.category || '')}
                >
                  <Callout tooltip>
                    <View style={styles.calloutContainer}>
                      <Text style={styles.calloutTitle}>{business.name}</Text>
                      <Text style={styles.calloutCategory}>{business.category}</Text>
                    </View>
                  </Callout>
                </Marker>
              );
            })}
            
            {/* Show selected location marker when in location selection mode */}
            {isSelectingLocation && selectedLocation && (
              <Marker
                coordinate={{
                  latitude: selectedLocation.latitude,
                  longitude: selectedLocation.longitude,
                }}
                pinColor="#FF2D55"
              />
            )}
          </MapView>
        </View>
      )}
      
      {/* Loading indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Obteniendo ubicación...</Text>
        </View>
      )}
      
      {/* Search Bar - positioned with safe area insets */}
      <View style={[
        styles.searchContainer, 
        { 
          top: insets.top + dynamicTopPadding,  // Position just below Dynamic Island
          paddingLeft: Math.max(16, insets.left),
          paddingRight: Math.max(16, insets.right),
          width: '92%', // Use percentage for width for better responsiveness
          alignSelf: 'center' // Center horizontally
        }
      ]}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        
        {isSelectingLocation ? (
          // Title for location selection mode
          <Text style={styles.locationSelectionTitle}>
            Selecciona ubicación de entrega
          </Text>
        ) : (
          // Normal search input for business mode
          <View style={styles.searchInputContainer}>
            <MaterialIcons name="search" size={20} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar negocios..."
              placeholderTextColor="#999"
              value={searchTerm}
              onChangeText={setSearchTerm}
              returnKeyType="search"
              autoCapitalize="none"
              onFocus={handleSearchFocus}
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                <MaterialIcons name="close" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Suggestions List - positioned relative to search bar */}
      {!isSelectingLocation && showSuggestions && searchResults.length > 0 && (
        <View style={[
          styles.suggestionsContainer, 
          { 
            top: insets.top + searchContainerHeight + dynamicTopPadding,
            paddingLeft: Math.max(0, insets.left),
            paddingRight: Math.max(0, insets.right),
            width: '92%', // Match search container width
            alignSelf: 'center' // Center horizontally
          }
        ]}>
          <FlatList
            data={searchResults}
            renderItem={renderSuggestionItem}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            maxToRenderPerBatch={10}
            initialNumToRender={10}
            showsVerticalScrollIndicator={true}
            style={styles.suggestionsList}
            contentContainerStyle={styles.suggestionsContent}
          />
        </View>
      )}

      {/* No Results Message */}
      {!isSelectingLocation && showSuggestions && searchTerm.trim() !== '' && searchResults.length === 0 && (
        <View style={[
          styles.noResultsContainer, 
          { 
            top: insets.top + searchContainerHeight + dynamicTopPadding,
            paddingLeft: Math.max(16, insets.left),
            paddingRight: Math.max(16, insets.right),
            width: '92%', // Match search container width
            alignSelf: 'center' // Center horizontally
          }
        ]}>
          <Text style={styles.noResultsText}>No se encontraron negocios</Text>
        </View>
      )}
      
      {/* My location button - positioned with safe area insets */}
      <TouchableOpacity 
        style={[
          styles.myLocationButton,
          {
            bottom: isSelectingLocation ? 160 + insets.bottom : 160 + insets.bottom,
            right: Math.max(16, insets.right)
          }
        ]} 
        onPress={focusOnUserLocation}
        disabled={!mapReady}
      >
        <MaterialIcons name="my-location" size={24} color={mapReady ? "#007AFF" : "#AAAAAA"} />
      </TouchableOpacity>

      {/* Business info panel - positioned with safe area insets */}
      {!isSelectingLocation && selectedBusiness && (
        <View style={[
          styles.businessInfoPanel,
          {
            bottom: 24 + insets.bottom,
            left: Math.max(16, insets.left),
            right: Math.max(16, insets.right)
          }
        ]}>
          <View style={styles.businessContent}>
            <View style={styles.businessTextInfo}>
              <Text style={styles.businessName}>{selectedBusiness.name}</Text>
              <Text style={styles.businessCategory}>{selectedBusiness.category}</Text>
              {getDistanceToSelectedBusiness() && (
                <View style={styles.distanceContainer}>
                  <MaterialIcons name="location-on" size={16} color="#666" />
                  <Text style={styles.distanceText}>{getDistanceToSelectedBusiness()}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity 
              style={styles.detailsButton} 
              onPress={navigateToBusinessDetail}
            >
              <Text style={styles.detailsButtonText}>Ver detalles</Text>
              <MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Location selection panel */}
      {isSelectingLocation && (
        <View style={[
          styles.locationSelectionPanel,
          {
            bottom: 24 + insets.bottom,
            left: Math.max(16, insets.left),
            right: Math.max(16, insets.right)
          }
        ]}>
          <View style={styles.locationContent}>
            <View style={styles.locationTextInfo}>
              <Text style={styles.locationTitle}>
                {isGeocodingAddress ? 'Obteniendo dirección...' : 'Dirección de entrega'}
              </Text>
              <Text style={styles.locationAddress} numberOfLines={2}>{locationAddress || 'Selecciona un punto en el mapa'}</Text>
              {isGeocodingAddress && (
                <ActivityIndicator size="small" color="#007AFF" style={{ marginTop: 8 }} />
              )}
            </View>
            <TouchableOpacity 
              style={[
                styles.confirmButton,
                !selectedLocation && styles.disabledButton
              ]} 
              onPress={confirmSelectedLocation}
              disabled={!selectedLocation}
            >
              <Text style={styles.confirmButtonText}>Confirmar</Text>
              <MaterialIcons name="check" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {selectedLocation && (
            <Text style={styles.locationHelpText}>
              Coordenadas: {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#333',
  },
  searchContainer: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    zIndex: 5,
    borderRadius: 12, // Increased border radius for modern look
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 6,
    height: Platform.OS === 'ios' ? 56 : 60, // Adjusted height for iOS vs Android
  },
  locationSelectionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginRight: 40, // Balance with back button width
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    marginLeft: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  suggestionsContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    maxHeight: height * 0.4,
    backgroundColor: '#FFFFFF',
    zIndex: 4,
    marginHorizontal: 10,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 4,
  },
  suggestionsList: {
    maxHeight: height * 0.4,
  },
  suggestionsContent: {
    paddingBottom: 8,
  },
  suggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  suggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  suggestionCategory: {
    fontSize: 14,
    color: '#666',
  },
  suggestionDistance: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  noResultsContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    zIndex: 4,
    padding: 16,
    marginHorizontal: 10,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 4,
  },
  noResultsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: 'white',
    borderRadius: 24,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  myLocationButton: {
    position: 'absolute',
    backgroundColor: 'white',
    borderRadius: 24,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  calloutContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  calloutTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  calloutCategory: {
    fontSize: 12,
    color: '#666',
  },
  businessInfoPanel: {
    position: 'absolute',
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    padding: 16,
    zIndex: 3,
  },
  businessContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  businessTextInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  businessCategory: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  detailsButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsButtonText: {
    color: 'white',
    fontWeight: '600',
    marginRight: 4,
  },
  // Location selection panel styles
  locationSelectionPanel: {
    position: 'absolute',
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    padding: 16,
    zIndex: 3,
  },
  locationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationTextInfo: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  confirmButton: {
    backgroundColor: '#4CD964', // Green for confirm
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  disabledButton: {
    backgroundColor: '#C7C7CC',
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: '600',
    marginRight: 4,
  },
  locationHelpText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default MapScreen;