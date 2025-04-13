import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated } from 'react-native';
import { Business } from '../../context/BusinessContext';

interface BusinessHeaderProps {
  business: Business;
  scrollY: Animated.Value;
  getBusinessImage: string | null;
  isFav: boolean;
  isOpenNow: boolean | null;
  getPlaceholderColor: string;
  headerAnimations: {
    height: Animated.AnimatedInterpolation<string | number>;
    opacity: Animated.AnimatedInterpolation<string | number>;
    nameOpacity: Animated.AnimatedInterpolation<string | number>;
  };
  favoriteScale: Animated.Value;
  handleFavoriteToggle: () => void;
  goBack: () => void;
  shareBusiness: () => void;
  distance: string | null;
}

const HEADER_HEIGHT = 350;

const BusinessHeader: React.FC<BusinessHeaderProps> = ({
  business,
  scrollY,
  getBusinessImage,
  isFav,
  isOpenNow,
  getPlaceholderColor,
  headerAnimations,
  favoriteScale,
  handleFavoriteToggle,
  goBack,
  shareBusiness,
  distance,
}) => {
  // Calcular la opacidad del botón de retroceso flotante basado en el scroll
  const backButtonOpacity = scrollY.interpolate({
    inputRange: [0, 50, 100],
    outputRange: [1, 1, 0],  // Desaparece cuando el header flotante aparece
    extrapolate: 'clamp'
  });
  
  // Animación mejorada para el nombre en la imagen
  const titleOpacity = scrollY.interpolate({
    inputRange: [0, 60, 90],
    outputRange: [1, 0.3, 0],
    extrapolate: 'clamp'
  });

  return (
    <>
      {/* Header flotante - aparece al hacer scroll */}
      <Animated.View style={[
        styles.floatingHeader,
        { 
          opacity: headerAnimations.opacity,
          transform: [{ translateY: headerAnimations.opacity.interpolate({
            inputRange: [0, 1],
            outputRange: [-50, 0]
          })}]
        }
      ]}>
        <TouchableOpacity 
          style={styles.floatingBackButton}
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Volver atrás"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="arrow-back-ios" size={22} color="#333" />
        </TouchableOpacity>
        <Text 
          numberOfLines={1} 
          style={styles.floatingHeaderTitle}
          accessibilityRole="header"
        >
          {business.name}
        </Text>
        <Animated.View style={{ transform: [{ scale: favoriteScale }] }}>
          <TouchableOpacity 
            style={styles.floatingActionButton}
            onPress={handleFavoriteToggle}
            accessibilityRole="button"
            accessibilityLabel={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons 
              name={isFav ? "favorite" : "favorite-border"} 
              size={24} 
              color={isFav ? "#FF2D55" : "#333"} 
            />
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {/* Business Image Header con animación */}
      <Animated.View style={[styles.imageContainer, { height: headerAnimations.height }]}>
        {getBusinessImage ? (
          <Image 
            source={{ uri: getBusinessImage }} 
            style={styles.businessImage}
            contentFit="cover"
            transition={500}
            cachePolicy="memory-disk"
            contentPosition="center"
            placeholder={Platform.OS === 'ios' ? null : "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="}
            accessibilityLabel={`Imagen principal de ${business.name}`}
          />
        ) : (
          <View style={[styles.placeholderImage, { backgroundColor: getPlaceholderColor }]}>
            <Text style={styles.placeholderText}>{business.name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        
        {/* Gradiente mejorado para visibilidad */}
        <LinearGradient
          colors={['rgba(0,0,0,0.7)', 'transparent', 'rgba(0,0,0,0.6)']}
          style={styles.headerGradient}
          locations={[0, 0.4, 1]}
        />
        
        {/* Solo un botón de retroceso y los botones de acción */}
        <View style={styles.headerButtons}>
          <Animated.View style={{ opacity: backButtonOpacity }}>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={goBack}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Volver atrás"
            >
              <MaterialIcons name="arrow-back-ios" size={22} color="white" />
            </TouchableOpacity>
          </Animated.View>
          
          <View style={styles.headerRightButtons}>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={shareBusiness}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Compartir negocio"
            >
              <MaterialIcons name="share" size={22} color="white" />
            </TouchableOpacity>
            
            <Animated.View style={{ 
              transform: [{ scale: favoriteScale }],
              marginLeft: 12
            }}>
              <TouchableOpacity 
                style={[
                  styles.iconButton,
                  isFav && styles.favoriteIconButton
                ]}
                onPress={handleFavoriteToggle}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
              >
                <MaterialIcons 
                  name={isFav ? "favorite" : "favorite-border"} 
                  size={22} 
                  color="white" 
                />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
        
        {/* Nombre del negocio en la imagen - con animación mejorada */}
        <Animated.View style={[
          styles.overlayBusinessNameContainer,
          { opacity: titleOpacity }
        ]}>
          <Text 
            style={styles.overlayBusinessName}
            numberOfLines={2}
            accessibilityRole="header"
          >
            {business.name}
          </Text>
          
          {/* Información de categoría y distancia */}
          <View style={styles.businessMetaInfo}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{business.category}</Text>
            </View>
            
            {distance && (
              <View style={styles.distanceBadge}>
                <MaterialIcons name="location-on" size={14} color="white" />
                <Text style={styles.distanceText}>{distance}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.ratingsRow}>
            <View style={styles.ratingContainer}>
              <MaterialIcons name="star" size={16} color="#FFCC00" />
              <Text style={styles.ratingText}>
                {(business as any).averageRating?.toFixed(1) || "Nuevo"}
              </Text>
            </View>
            
            {/* Badge de estado de apertura */}
            {isOpenNow !== null && (
              <View style={[
                styles.statusBadge,
                isOpenNow ? styles.openBadge : styles.closedBadge
              ]}>
                <View style={[
                  styles.statusDot,
                  isOpenNow ? styles.openDot : styles.closedDot
                ]} />
                <Text style={styles.statusText}>
                  {isOpenNow ? 'Abierto ahora' : 'Cerrado'}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  floatingHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.98)',
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  floatingBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(240,240,245,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(240,240,245,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingHeaderTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginHorizontal: 16,
  },
  imageContainer: {
    height: HEADER_HEIGHT,
    position: 'relative',
  },
  headerGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    zIndex: 1,
  },
  businessImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 72,
    fontWeight: 'bold',
    color: 'white',
  },
  headerButtons: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 2,
  },
  headerRightButtons: {
    flexDirection: 'row',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  favoriteIconButton: {
    backgroundColor: 'rgba(255, 45, 85, 0.8)',
  },
  overlayBusinessNameContainer: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
    zIndex: 2,
  },
  overlayBusinessName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  businessMetaInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  categoryText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    marginBottom: 6,
  },
  distanceText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  ratingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 10,
    marginBottom: 6,
  },
  ratingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginBottom: 6,
  },
  openBadge: {
    backgroundColor: 'rgba(52, 199, 89, 0.85)',
  },
  closedBadge: {
    backgroundColor: 'rgba(255, 59, 48, 0.85)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  openDot: {
    backgroundColor: '#FFFFFF',
  },
  closedDot: {
    backgroundColor: '#FFFFFF',
  },
  statusText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 13,
  },
  openStatusBadge: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 4,
    zIndex: 2,
  },
  openStatusText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default BusinessHeader; 