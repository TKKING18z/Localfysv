import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Animated } from 'react-native';

interface BusinessActionButtonsProps {
  business: any;
  hasPhone: boolean;
  hasCreator: boolean;
  userIsCreator: boolean;
  isLoading: boolean;
  cartItemsCount: number;
  acceptsReservations: boolean;
  actionButtonsY: Animated.Value;
  onCallBusiness: () => void;
  onStartChat: () => void;
  onGoToReservations: () => void;
  onGoToCart: () => void;
}

// Colores profesionales más sobrios, similares a los que usan aplicaciones modernas
const BUTTON_COLORS = {
  call: '#2563EB',    // Azul profesional
  chat: '#6366F1',    // Violeta suave
  reservation: '#10B981', // Verde sobrio
  cart: '#F59E0B'     // Naranja/ámbar
};

const BusinessActionButtons: React.FC<BusinessActionButtonsProps> = ({
  business,
  hasPhone,
  hasCreator,
  userIsCreator,
  isLoading,
  cartItemsCount,
  acceptsReservations,
  actionButtonsY,
  onCallBusiness,
  onStartChat,
  onGoToReservations,
  onGoToCart,
}) => {
  const { width } = useWindowDimensions();
  
  // Calcular cuántos botones son visibles
  const visibleButtonsCount = useMemo(() => {
    let count = 0;
    if (hasPhone) count++;
    if (hasCreator && !userIsCreator) count++;
    if (acceptsReservations) count++;
    if (cartItemsCount > 0) count++;
    return count;
  }, [hasPhone, hasCreator, userIsCreator, acceptsReservations, cartItemsCount]);
  
  // Calcular el ancho de los botones en función de cuántos son visibles
  const buttonWidth = useMemo(() => {
    // Margen total horizontal (20px) y espacio entre botones (12px por botón)
    const totalMargin = 20;
    const spacing = (visibleButtonsCount - 1) * 12;
    
    // Para pantallas pequeñas y muchos botones, reducir más el tamaño
    if (visibleButtonsCount >= 4) {
      // Usa una proporción del ancho de pantalla para cada botón
      return Math.min(90, (width - totalMargin - spacing) / visibleButtonsCount);
    }
    
    // Para 3 botones, un poco más grandes
    if (visibleButtonsCount === 3) {
      return Math.min(100, (width - totalMargin - spacing) / visibleButtonsCount);
    }
    
    // Para 1-2 botones, usar el tamaño predeterminado
    return 100;
  }, [visibleButtonsCount, width]);
  
  // Si no hay nada que mostrar, no renderizamos este componente
  if (!hasPhone && (!hasCreator || userIsCreator) && !acceptsReservations && cartItemsCount === 0) {
    return null;
  }

  return (
    <Animated.View style={[
      styles.actionButtonsContainer,
      { transform: [{ translateY: actionButtonsY }] }
    ]}>
      <View style={styles.divider} />
      
      <View style={styles.actionButtonsWrapper}>
        {hasPhone && (
          <TouchableOpacity 
            style={[styles.actionButton, { width: buttonWidth }]}
            onPress={onCallBusiness}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Llamar al negocio"
          >
            <View style={[styles.buttonContent, { backgroundColor: BUTTON_COLORS.call }]}>
              <MaterialIcons name="phone" size={22} color="white" />
              <Text style={styles.actionButtonText}>Llamar</Text>
            </View>
          </TouchableOpacity>
        )}
        
        {/* Botón de chat */}
        {hasCreator && !userIsCreator && (
          <TouchableOpacity 
            style={[styles.actionButton, { width: buttonWidth }]}
            onPress={onStartChat}
            activeOpacity={0.7}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Chatear con el negocio"
          >
            <View style={[styles.buttonContent, { backgroundColor: BUTTON_COLORS.chat }]}>
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="white" />
                  <Text style={styles.actionButtonText}>Conectando...</Text>
                </View>
              ) : (
                <>
                  <MaterialIcons name="chat" size={22} color="white" />
                  <Text style={styles.actionButtonText}>Chatear</Text>
                </>
              )}
            </View>
          </TouchableOpacity>
        )}
        
        {/* Botón de reservas */}
        {acceptsReservations && (
          <TouchableOpacity 
            style={[styles.actionButton, { width: buttonWidth }]}
            onPress={onGoToReservations}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Hacer reservación"
          >
            <View style={[styles.buttonContent, { backgroundColor: BUTTON_COLORS.reservation }]}>
              <MaterialIcons name="event-available" size={22} color="white" />
              <Text style={styles.actionButtonText}>Reservar</Text>
            </View>
          </TouchableOpacity>
        )}
        
        {/* Botón de carrito */}
        {cartItemsCount > 0 && (
          <TouchableOpacity 
            style={[styles.actionButton, { width: buttonWidth }]}
            onPress={onGoToCart}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Ver carrito"
          >
            <View style={[styles.buttonContent, { backgroundColor: BUTTON_COLORS.cart }]}>
              <View style={styles.badgeContainer}>
                <MaterialIcons name="shopping-cart" size={22} color="white" />
                {cartItemsCount > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{cartItemsCount > 9 ? '9+' : cartItemsCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.actionButtonText}>Carrito</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  actionButtonsContainer: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 8,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    paddingHorizontal: 10,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    zIndex: 10,
  },
  divider: {
    width: 36,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  actionButtonsWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    flexWrap: 'nowrap',
  },
  actionButton: {
    height: 64,
    marginHorizontal: 6,
  },
  buttonContent: {
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
    paddingHorizontal: 4, 
    paddingVertical: 6,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  badgeContainer: {
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -8,
    right: -10,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: 'white',
  },
  cartBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default BusinessActionButtons; 