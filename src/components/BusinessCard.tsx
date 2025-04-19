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
const isIOS = Platform.OS === 'ios'; // Define outside component to avoid recreation

// Move this outside component to avoid recreating on every render
const getPlaceholderColor = (name: string) => {
  const colors = [
    '#007AFF', '#34C759', '#FF9500', '#FF2D55', '#AF52DE', 
    '#5856D6', '#FF3B30', '#5AC8FA', '#FFCC00', '#4CD964'
  ];
  const sum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[sum % colors.length];
};

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
  
  // Añadir estado para tracking de carga de imágenes
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Estado para el manejo de errores de imagen
  const [imageError, setImageError] = useState(false);
  
  // Create an optimized interval for updates based on connection speed
  const updateInterval = useMemo(() => isSlowConnection ? 10000 : 5000, [isSlowConnection]);

  // Memoize business data that doesn't change often
  const placeholderColor = useMemo(() => getPlaceholderColor(business.name), [business.name]);
  const firstLetter = useMemo(() => business.name.charAt(0).toUpperCase(), [business.name]);
  
  // Optimizar el listener para que solo se active cuando el componente es visible
  useEffect(() => {
    // Update local state when business prop changes
    if (business.id !== currentBusiness.id) {
      setCurrentBusiness(business);
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
    
    // Set up new listener with throttling - sólo si es visible
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
  }, [business.id, business, isConnected, isSlowConnection, updateInterval, isVisible, currentBusiness.id]);
  
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
  
  // Determine cache policy based on network
  const cachePolicy = useMemo(() => 
    isSlowConnection ? "disk" : "memory-disk", 
  [isSlowConnection]);
  
  // Determine image size based on connection (lower quality for slow connection)
  const imageQuality = useMemo(() => {
    // If the URL contains options for resizing, modify them based on connection
    if (businessImage && businessImage.includes('?') && isSlowConnection) {
      // Reducir aún más la calidad para conexiones lentas y muchos negocios
      return businessImage + '&quality=low&width=300';
    } else if (businessImage && businessImage.includes('?')) {
      // Calidad normal pero con tamaño controlado
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
    // Solo calcular si es necesario mostrar el estado
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
  
  // Agregar función para manejar carga de imágenes
  const handleImageLoad = () => {
    setImageLoaded(true);
  };
  
  // Agregar función para manejar errores de imágenes
  const handleImageError = () => {
    setImageError(true);
    console.error(`Error loading image for business: ${business.name}`);
  };

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={onPress}
      activeOpacity={0.9}
      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
    >
      {/* Background image or placeholder */}
      <View style={styles.imageContainer}>
        {businessImage && !imageError ? (
          // Usar el componente Image nativo de React Native para máxima compatibilidad
          <Image
            source={{ uri: businessImage }}
            style={styles.image}
            resizeMode="cover"
            onLoad={handleImageLoad}
            onError={handleImageError}
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
            size={20}
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
            <MaterialIcons name="location-on" size={12} color="#8E8E93" />
            <Text style={styles.distance}>{distance}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  const areEqual = 
    prevProps.business.id === nextProps.business.id &&
    prevProps.isFavorite === nextProps.isFavorite &&
    prevProps.distance === nextProps.distance &&
    prevProps.showOpenStatus === nextProps.showOpenStatus &&
    prevProps.isVisible === nextProps.isVisible;
  
  return areEqual;
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Platform.OS === 'ios' ? 0.1 : 0.05,
    shadowRadius: Platform.OS === 'ios' ? 4 : 2,
    elevation: 2,
    overflow: 'hidden',
    // Add hardware acceleration hint for Android
    ...(Platform.OS === 'android' && {
      backfaceVisibility: 'hidden',
      renderToHardwareTextureAndroid: true,
    }),
  },
  imageContainer: {
    height: 120,
    position: 'relative',
  },
  image: {
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
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 6,
    // Add hardware acceleration hint
    ...(Platform.OS === 'android' && {
      backfaceVisibility: 'hidden',
      renderToHardwareTextureAndroid: true,
    }),
  },
  infoContainer: {
    padding: 12,
  },
  name: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  category: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 6,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distance: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 2,
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  openBadge: {
    backgroundColor: 'rgba(52, 199, 89, 0.8)',
  },
  closedBadge: {
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default BusinessCard;