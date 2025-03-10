import React, { useState, useCallback, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Business } from '../context/BusinessContext';
import Constants from 'expo-constants';

interface BusinessCardProps {
  business: Business;
  businessImage: string | null | undefined;
  isFavorite: boolean;
  onPress: () => void;
  onFavoritePress: () => void;
  userLocation?: { latitude: number; longitude: number } | null;
  distance?: string | null;
}

const { width } = Dimensions.get('window');

// Retrieve Firebase configuration from .env
const FIREBASE_STORAGE_BUCKET = Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'testlocalfysv25.firebasestorage.app';

const BusinessCard: React.FC<BusinessCardProps> = memo(({
  business,
  businessImage,
  isFavorite,
  onPress,
  onFavoritePress,
  distance,
}) => {
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  // Function to construct correct URL for Firebase Storage
  const constructImageUrl = useCallback((imagePath: string) => {
    if (imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    // Convert gs:// URLs
    if (imagePath.startsWith('gs://')) {
      const path = imagePath.replace(`gs://${FIREBASE_STORAGE_BUCKET}/`, '');
      return `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_STORAGE_BUCKET}/o/${encodeURIComponent(path)}?alt=media`;
    }
    
    // For simple filenames
    return `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_STORAGE_BUCKET}/o/business_images%2F${encodeURIComponent(imagePath)}?alt=media`;
  }, []);

  // Function to get a color based on business name (for placeholders)
  const getColorFromName = () => {
    const colors = [
      '#007AFF', '#34C759', '#FF9500', '#FF2D55', '#AF52DE', 
      '#5856D6', '#FF3B30', '#5AC8FA', '#FFCC00', '#4CD964'
    ];
    
    // Use name as seed to select a color
    const sum = business.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[sum % colors.length];
  };

  // Get icon based on category
  const getCategoryIcon = () => {
    const category = business.category?.toLowerCase() || '';
    
    if (category.includes('restaurante') || category.includes('café')) {
      return "restaurant";
    } else if (category.includes('tienda')) {
      return "shopping-bag";
    } else {
      return "storefront";
    }
  };

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.imageContainer}>
        {businessImage ? (
          <Image
            source={{ uri: businessImage }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.placeholderImage}>
            <MaterialIcons name="store" size={32} color="#CCCCCC" />
          </View>
        )}
        
        {/* Favorite button */}
        <TouchableOpacity 
          style={styles.favoriteButton} 
          onPress={onFavoritePress}
        >
          <MaterialIcons 
            name={isFavorite ? "favorite" : "favorite-border"} 
            size={20} 
            color={isFavorite ? "#FF3B30" : "#FFF"} 
          />
        </TouchableOpacity>
      </View>
      
      <View style={styles.infoContainer}>
        <Text style={styles.name} numberOfLines={1}>{business.name}</Text>
        <Text style={styles.category}>{business.category || "Sin categoría"}</Text>
        <View style={styles.detailsRow}>
          {business.rating > 0 && (
            <View style={styles.ratingContainer}>
              <MaterialIcons name="star" size={14} color="#FFD700" />
              <Text style={styles.rating}>{business.rating.toFixed(1)}</Text>
            </View>
          )}
          
          {distance && (
            <View style={styles.distanceContainer}>
              <MaterialIcons name="location-on" size={14} color="#8E8E93" />
              <Text style={styles.distanceText}>{distance}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 8,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    maxWidth: (width - 48) / 2,
  },
  imageContainer: {
    position: 'relative',
    height: 120,
    width: '100%',
  },
  placeholderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  infoContainer: {
    padding: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  category: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0F0F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 2,
  },
});

export default memo(BusinessCard);