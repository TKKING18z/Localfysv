import React, { memo, useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Business } from '../context/BusinessContext';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { useNetwork } from '../context/NetworkContext';

interface BusinessCardProps {
  business: Business;
  isFavorite: boolean;
  distance?: string;
  onPress: () => void;
  onFavoritePress: () => void;
  showOpenStatus?: boolean;
  style?: any;
  isVisible?: boolean;
}

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2;
// We'll use platform info throughout for better styling rather than different behavior
const isIOS = Platform.OS === 'ios';

// Move this outside component to avoid recreating on every render
const getPlaceholderColor = (name: string) => {
  const colors = [
    '#007AFF', '#34C759', '#FF9500', '#FF2D55', '#AF52DE', 
    '#5856D6', '#FF3B30', '#5AC8FA', '#FFCC00', '#4CD964'
  ];
  const sum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[sum % colors.length];
};

// Add a cache for business data to prevent unnecessary re-renders
const businessDataCache = new Map<string, Business>();

const BusinessCard: React.FC<BusinessCardProps> = memo(({
  business,
  isFavorite,
  distance,
  onPress,
  onFavoritePress,
  style,
  showOpenStatus = true,
  isVisible = true
}) => {
  // Use network context for adaptive loading
  const { isSlowConnection, isConnected } = useNetwork();
  
  // Use local state for current business, but don't update too frequently
  const [currentBusiness, setCurrentBusiness] = useState<Business>(business);
  const [listenerId, setListenerId] = useState<string | null>(null);
  const lastUpdateRef = useRef(Date.now());
  
  // Track image loading state
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Track image error state
  const [imageError, setImageError] = useState(false);
  
  // Create an optimized interval for updates based on connection speed
  const updateInterval = useMemo(() => isSlowConnection ? 30000 : 10000, [isSlowConnection]);

  // Memoize business data that doesn't change often
  const placeholderColor = useMemo(() => getPlaceholderColor(business.name), [business.name]);
  const firstLetter = useMemo(() => business.name.charAt(0).toUpperCase(), [business.name]);
  
  // Use the business ID as a stable reference for cache checking
  const businessId = business.id;
  
  // Check if we have a cached version and update if needed
  useEffect(() => {
    // Only update if either the business data changed or we have new data
    const cachedBusiness = businessDataCache.get(businessId);
    const shouldUpdateFromCache = cachedBusiness && 
      cachedBusiness.updatedAt > business.updatedAt;
    
    if (shouldUpdateFromCache) {
      setCurrentBusiness(cachedBusiness);
    } else if (business.id !== currentBusiness.id || business.updatedAt > currentBusiness.updatedAt) {
      setCurrentBusiness(business);
      businessDataCache.set(businessId, business);
    }
  }, [business, businessId, currentBusiness.id, currentBusiness.updatedAt]);
  
  // Optimize listener to activate only when component is visible
  useEffect(() => {
    // Update local state when business prop changes
    if (business.id !== currentBusiness.id) {
      setCurrentBusiness(business);
      businessDataCache.set(businessId, business);
    }
    
    // Skip real-time updates if component is not visible, we don't have connectivity, 
    // or on slow connections with existing listener
    if (!isVisible || !business.id || !isConnected || (isSlowConnection && listenerId)) {
      return;
    }
    
    // Cleanup previous listener
    if (listenerId) {
      firebase.firestore().collection('businesses').doc(business.id).onSnapshot(() => {});
      setListenerId(null);
    }
    
    // Only set up new listeners on high-performance devices/connections
    if (isSlowConnection) {
      return;
    }
    
    // Set up new listener with throttling - only if visible
    const businessRef = firebase.firestore().collection('businesses').doc(business.id);
    
    const unsubscribe = businessRef.onSnapshot(
      (doc) => {
        if (doc.exists) {
          // Throttle updates to prevent excessive renders
          const now = Date.now();
          if (now - lastUpdateRef.current < updateInterval) {
            return;
          }
          
          lastUpdateRef.current = now;
          
          const updatedBusiness = {
            id: doc.id,
            ...doc.data()
          } as Business;
          
          // Only update if there are significant changes
          if (JSON.stringify(updatedBusiness) !== JSON.stringify(currentBusiness)) {
            setCurrentBusiness(updatedBusiness);
            businessDataCache.set(businessId, updatedBusiness);
          }
        }
      },
      (error) => {
        console.error('Error listening to business updates:', error);
      }
    );
    
    setListenerId(business.id);
    
    return () => {
      unsubscribe();
      setListenerId(null);
    };
  }, [business.id, business, isConnected, isSlowConnection, updateInterval, isVisible, currentBusiness.id, businessId, currentBusiness]);
  
  // Memoize business image to prevent recreating on each render
  const businessImage = useMemo(() => {
    if (currentBusiness.images && currentBusiness.images.length > 0) {
      const mainImage = currentBusiness.images.find(img => img.isMain);
      if (mainImage && mainImage.url) {
        return mainImage.url;
      }
      if (currentBusiness.images[0].url) {
        return currentBusiness.images[0].url;
      }
    }
    return null;
  }, [currentBusiness.images]);
  
  // Get appropriate image URL based on network conditions
  const imageQuality = useMemo(() => {
    // If the URL contains options for resizing, modify them based on connection
    if (businessImage && businessImage.includes('?') && isSlowConnection) {
      // Use lower quality for slow connections
      return businessImage + '&quality=60&width=300';
    } else if (businessImage && businessImage.includes('?')) {
      // Normal quality with controlled size
      return businessImage + '&width=500';
    }
    return businessImage;
  }, [businessImage, isSlowConnection]);

  // Memoize truncated name to prevent recalculation
  const truncatedName = useMemo(() => {
    const maxLength = 20;
    if (currentBusiness.name.length <= maxLength) return currentBusiness.name;
    return currentBusiness.name.substring(0, maxLength) + '...';
  }, [currentBusiness.name]);

  // Memoize isOpen calculation to avoid recalculating on every render
  const isOpen = useMemo(() => {
    // Only calculate if needed
    if (!showOpenStatus || !currentBusiness.businessHours) return false;

    const now = new Date();
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinutes;

    const dayHours = currentBusiness.businessHours[dayOfWeek];
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
  }, [currentBusiness.businessHours, showOpenStatus]);
  
  // Handle image load event
  const handleImageLoad = () => {
    setImageLoaded(true);
  };
  
  // Handle image error event
  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
    >
      {/* Background image or placeholder */}
      <View style={styles.imageContainer}>
        {businessImage && !imageError ? (
          // Use optimized image rendering
          <Image
            source={{ uri: imageQuality || businessImage }}
            style={styles.image}
            resizeMode="cover"
            onLoad={handleImageLoad}
            onError={handleImageError}
            // Improved image properties
            fadeDuration={Platform.OS === 'android' ? 300 : 0}
            progressiveRenderingEnabled={true}
          />
        ) : (
          <View style={[styles.placeholderContainer, { backgroundColor: placeholderColor }]}>
            <Text style={styles.placeholderText}>{firstLetter}</Text>
          </View>
        )}
        
        {/* Favorite button */}
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={onFavoritePress}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <MaterialIcons
            name={isFavorite ? 'favorite' : 'favorite-border'}
            size={24}
            color={isFavorite ? '#FF3B30' : '#FFFFFF'}
          />
        </TouchableOpacity>

        {/* Open/Closed Status Badge - Only render if needed */}
        {showOpenStatus && (
          <View style={[
            styles.statusBadge,
            isOpen ? styles.openBadge : styles.closedBadge
          ]}>
            <Text style={styles.statusText}>
              {isOpen ? 'Abierto' : 'Cerrado'}
            </Text>
          </View>
        )}
      </View>

      {/* Business information */}
      <View style={styles.infoContainer}>
        <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
          {truncatedName}
        </Text>
        <Text style={styles.category} numberOfLines={1} ellipsizeMode="tail">
          {currentBusiness.category || "Sin categoría"}
        </Text>
        
        {/* Only render distance if available */}
        {distance && (
          <View style={styles.distanceContainer}>
            <MaterialIcons name="location-on" size={14} color="#8E8E93" />
            <Text style={styles.distance}>{distance}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // Enhanced comparison to prevent unnecessary re-renders
  // Only re-render if important props change
  const areEqual = 
    prevProps.business.id === nextProps.business.id &&
    prevProps.isFavorite === nextProps.isFavorite &&
    prevProps.distance === nextProps.distance &&
    prevProps.showOpenStatus === nextProps.showOpenStatus &&
    prevProps.isVisible === nextProps.isVisible &&
    // Skip updating for minor changes (like rating changes within a small threshold)
    (Math.abs((prevProps.business.rating || 0) - (nextProps.business.rating || 0)) < 0.1) &&
    // Only update if business data has changed significantly
    prevProps.business.updatedAt === nextProps.business.updatedAt;
  
  return areEqual;
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 6, // Increased for better Android shadow
    overflow: 'hidden',
    // Android optimization
    ...(Platform.OS === 'android' && {
      backfaceVisibility: 'hidden',
      renderToHardwareTextureAndroid: true,
    }),
  },
  imageContainer: {
    height: 135, // Slightly higher for better proportions
    position: 'relative',
    backgroundColor: '#f0f0f0', // Fallback background color
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden', // Ensure image respects border radius on Android
  },
  image: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: '#E1E1E1',
  },
  placeholderContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  placeholderText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: 'white',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    // Android optimization
    ...(Platform.OS === 'android' && {
      backfaceVisibility: 'hidden',
      renderToHardwareTextureAndroid: true,
      elevation: 3,
    }),
  },
  infoContainer: {
    padding: 14, // Slightly more padding for better spacing
  },
  name: {
    fontSize: 16, // Larger font size for better readability
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 6,
  },
  category: {
    fontSize: 14, // Larger font size for better readability
    color: '#8E8E93',
    marginBottom: 6,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2, // Better spacing
  },
  distance: {
    fontSize: 14, // Larger font size for better readability
    color: '#8E8E93',
    marginLeft: 4,
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    // Android optimization
    ...(Platform.OS === 'android' && {
      elevation: 3,
    }),
  },
  openBadge: {
    backgroundColor: 'rgba(52, 199, 89, 0.9)', // More opaque
  },
  closedBadge: {
    backgroundColor: 'rgba(255, 59, 48, 0.9)', // More opaque
  },
  statusText: {
    color: 'white',
    fontSize: 12, // Slightly larger
    fontWeight: 'bold',
  },
});

export default BusinessCard;