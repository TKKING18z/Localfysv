import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, SafeAreaView, ActivityIndicator, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MapView, { Marker, PROVIDER_GOOGLE, Region, Callout } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocationContext } from '../context/LocationContext';
import { useBusinesses, Business } from '../context/BusinessContext';
import { formatDistance, calculateDistance } from '../services/LocationService';
import { RootStackParamList } from '../navigation/AppNavigator';

// Define location interface
interface Location {
  latitude: number;
  longitude: number;
}

// Extended navigation params type to include all screens used in this component
type ExtendedStackParamList = RootStackParamList & {
  BusinessDetail: { businessId: string };
};

type NavigationProps = StackNavigationProp<ExtendedStackParamList>;
const { width, height } = Dimensions.get('window');

const MapScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const { userLocation, isLoading } = useLocationContext();
  const { filteredBusinesses } = useBusinesses();
  const mapRef = useRef<MapView>(null);
  
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [region, setRegion] = useState<Region>({
    latitude: 13.6929, // Default to El Salvador
    longitude: -89.2182,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

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

  // Function to focus on user location
  const focusOnUserLocation = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  // Function to handle marker press
  const handleMarkerPress = (business: Business) => {
    setSelectedBusiness(business);
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Loading indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Obteniendo ubicación...</Text>
        </View>
      )}

      {/* Map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
      >
        {/* Business markers */}
        {filteredBusinesses.map((business) => {
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
      </MapView>

      {/* Back button */}
      <TouchableOpacity style={styles.backButton} onPress={goBack}>
        <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
      </TouchableOpacity>
      
      {/* My location button */}
      <TouchableOpacity style={styles.myLocationButton} onPress={focusOnUserLocation}>
        <MaterialIcons name="my-location" size={24} color="#007AFF" />
      </TouchableOpacity>

      {/* Business info panel */}
      {selectedBusiness && (
        <View style={styles.businessInfoPanel}>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  map: {
    width: width,
    height: height,
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
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
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
  myLocationButton: {
    position: 'absolute',
    bottom: 160,
    right: 16,
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
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    padding: 16,
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
});

export default MapScreen;