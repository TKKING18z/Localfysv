import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Business } from '../context/BusinessContext';

interface BusinessCardProps {
  business: Business;
  isFavorite: boolean;
  distance?: string;
  onPress: () => void;
  onFavoritePress: () => void;
  showOpenStatus?: boolean; // Added property
  style?: any; // Added style property
}

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2; // 2 columns with padding

const BusinessCard: React.FC<BusinessCardProps> = ({
  business,
  isFavorite,
  distance,
  onPress,
  onFavoritePress,
  style, // Use the style prop
  showOpenStatus = true  // Enable by default
}) => {
  // Determinar la imagen a mostrar
  const getBusinessImage = () => {
    if (business.images && business.images.length > 0) {
      // Primero busca la imagen marcada como principal
      const mainImage = business.images.find(img => img.isMain);
      if (mainImage && mainImage.url) {
        return mainImage.url;
      }
      // Si no hay imagen principal, usa la primera
      if (business.images[0].url) {
        return business.images[0].url;
      }
    }
    return null;
  };
  
  // Obtener imagen o null si no hay
  const businessImage = getBusinessImage();
  
  // Generar un color basado en el nombre del negocio para el placeholder
  const getPlaceholderColor = () => {
    const colors = [
      '#007AFF', '#34C759', '#FF9500', '#FF2D55', '#AF52DE', 
      '#5856D6', '#FF3B30', '#5AC8FA', '#FFCC00', '#4CD964'
    ];
    const sum = business.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[sum % colors.length];
  };
  
  // Obtener la primera letra del nombre del negocio
  const getFirstLetter = () => {
    return business.name.charAt(0).toUpperCase();
  };

  // Truncar nombre si es muy largo
  const truncateName = (name: string, maxLength: number = 20) => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength) + '...';
  };

  // Función para determinar si el negocio está abierto o cerrado
  const isBusinessOpen = () => {
    if (!business.businessHours) return false;

    const now = new Date();
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinutes; // Convertir a minutos

    // Acceder de forma segura a las horas del día actual
    const dayHours = business.businessHours[dayOfWeek];
    if (!dayHours || dayHours.closed) return false;

    // Analizar horarios de apertura y cierre (formato como "9:00" o "21:30")
    try {
      const openTimeParts = dayHours.open?.split(':').map(Number) || [0, 0];
      const closeTimeParts = dayHours.close?.split(':').map(Number) || [0, 0];

      const openTimeMinutes = openTimeParts[0] * 60 + (openTimeParts[1] || 0);
      const closeTimeMinutes = closeTimeParts[0] * 60 + (closeTimeParts[1] || 0);

      return currentTime >= openTimeMinutes && currentTime <= closeTimeMinutes;
    } catch (error) {
      return false;
    }
  };

  // Determinar si el negocio está abierto
  const isOpen = isBusinessOpen();

  return (
    <TouchableOpacity
      style={[styles.container, style]} // Apply external style
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Background image or placeholder */}
      <View style={styles.imageContainer}>
        {businessImage ? (
          <Image
            source={{ uri: businessImage }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
            placeholder={{ color: getPlaceholderColor() }}
            transition={200}
          />
        ) : (
          <View style={[styles.placeholderContainer, { backgroundColor: getPlaceholderColor() }]}>
            <Text style={styles.placeholderText}>{getFirstLetter()}</Text>
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

        {/* Open/Closed Status Badge */}
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
        <Text style={styles.name} numberOfLines={1}>
          {truncateName(business.name)}
        </Text>
        <Text style={styles.category} numberOfLines={1}>
          {business.category || "Sin categoría"}
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
    flex: 1, // Take up all available space in parent container
    borderRadius: 16,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  imageContainer: {
    height: 120, // Fixed height for image container
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
  // Estilos para el badge de estado (abierto/cerrado)
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
    backgroundColor: 'rgba(52, 199, 89, 0.8)', // Verde semi-transparente
  },
  closedBadge: {
    backgroundColor: 'rgba(255, 59, 48, 0.8)', // Rojo semi-transparente
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

// Using memo to prevent unnecessary re-renders
export default memo(BusinessCard);