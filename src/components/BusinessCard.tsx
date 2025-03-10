import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import CachedImage from './CachedImage';
import { Business } from '../context/BusinessContext';

interface BusinessCardProps {
  business: Business;
  businessImage: string | null;
  isFavorite: boolean;
  distance?: string;
  onPress: () => void;
  onFavoritePress: () => void;
}

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2; // 2 columns with padding

const BusinessCard: React.FC<BusinessCardProps> = ({
  business,
  businessImage,
  isFavorite,
  distance,
  onPress,
  onFavoritePress
}) => {
  const truncateName = (name: string, maxLength: number = 20) => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength) + '...';
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Background image */}
      <View style={styles.imageContainer}>
        <CachedImage
          uri={businessImage}
          fallbackText={business.name}
          resizeWidth={400}
          style={styles.image}
          cacheKey={`business-${business.id}`}
        />
        
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
      </View>

      {/* Business information */}
      <View style={styles.infoContainer}>
        <Text style={styles.name} numberOfLines={1}>
          {truncateName(business.name)}
        </Text>
        <Text style={styles.category} numberOfLines={1}>
          {business.category}
        </Text>
        
        {/* Distance (if available) */}
        {distance && (
          <View style={styles.distanceContainer}>
            <MaterialIcons name="location-on" size={12} color="#8E8E93" />
            <Text style={styles.distance}>{distance}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: cardWidth,
    borderRadius: 16,
    backgroundColor: 'white',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  imageContainer: {
    height: cardWidth * 0.8,
    position: 'relative',
  },
  image: {
    height: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 6,
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
});

// Using memo to prevent unnecessary re-renders
export default memo(BusinessCard, (prevProps, nextProps) => {
  return prevProps.business.id === nextProps.business.id &&
         prevProps.isFavorite === nextProps.isFavorite &&
         prevProps.businessImage === nextProps.businessImage &&
         prevProps.distance === nextProps.distance;
});