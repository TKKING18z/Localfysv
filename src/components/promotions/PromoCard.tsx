import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Promotion } from '../../types/businessTypes';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

interface PromoCardProps {
  promotion: Promotion;
  onPress?: (promotion: Promotion) => void;
  compact?: boolean;
}

const PromoCard: React.FC<PromoCardProps> = ({ promotion, onPress, compact = false }) => {
  // Formato de fechas - versión corregida y segura
  const formatDate = (timestamp: firebase.firestore.Timestamp | undefined) => {
    if (!timestamp || !timestamp.toDate) {
      return 'N/A';
    }
    
    try {
      // Usar el método toDate() de Timestamp para convertir a Date
      const date = timestamp.toDate();
      return date.toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (error) {
      console.error('Error al formatear fecha:', error);
      return 'N/A';
    }
  };
  
  // Formatear el valor del descuento
  const formatDiscount = () => {
    if (!promotion.discountValue && promotion.discountType !== 'special') return '';
    
    switch (promotion.discountType) {
      case 'percentage':
        return `${promotion.discountValue}% OFF`;
      case 'fixed':
        return `$${promotion.discountValue} OFF`;
      case 'special':
        return 'OFERTA ESPECIAL';
      default:
        return '';
    }
  };
  
  // Verificar si la promo aún está activa
  const isActive = () => {
    try {
      if (!promotion.endDate || !promotion.endDate.toDate) {
        return false;
      }
      
      const now = new Date();
      const endDate = promotion.endDate.toDate();
      return now <= endDate;
    } catch (error) {
      console.error('Error verificando estado de promoción:', error);
      return false;
    }
  };
  
  // Calcular tiempo restante
  const getTimeRemaining = () => {
    try {
      if (!promotion.endDate || !promotion.endDate.toDate) {
        return 'N/A';
      }
      
      const now = new Date();
      const endDate = promotion.endDate.toDate();
      
      if (endDate <= now) return 'Expirado';
      
      const diffTime = Math.abs(endDate.getTime() - now.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 1) return `${diffDays} días restantes`;
      
      const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
      return `${diffHours} horas restantes`;
    } catch (error) {
      console.error('Error calculando tiempo restante:', error);
      return 'N/A';
    }
  };
  
  // Versión compacta
  if (compact) {
    return (
      <TouchableOpacity 
        style={styles.compactContainer}
        onPress={() => onPress && onPress(promotion)}
        disabled={!onPress}
      >
        <LinearGradient
          colors={['#007AFF', '#00C2FF']} 
          style={styles.compactGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.compactContent}>
            <Text style={styles.compactTitle} numberOfLines={1}>{promotion.title}</Text>
            {promotion.discountValue && (
              <Text style={styles.compactDiscount}>{formatDiscount()}</Text>
            )}
            <View style={styles.compactFooter}>
              <Text style={styles.compactDate}>Válido hasta {formatDate(promotion.endDate)}</Text>
              {promotion.promoCode && (
                <View style={styles.compactPromoCode}>
                  <Text style={styles.compactPromoCodeText}>{promotion.promoCode}</Text>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }
  
  // Versión completa
  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={() => onPress && onPress(promotion)}
      disabled={!onPress}
    >
      <LinearGradient
        colors={isActive() ? ['#007AFF', '#00C2FF'] : ['#8E8E93', '#AEAEB2']} 
        style={styles.gradientBackground}
      >
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>{promotion.title}</Text>
          <View style={styles.badgeContainer}>
            {!isActive() && (
              <View style={[styles.badge, styles.expiredBadge]}>
                <Text style={styles.badgeText}>EXPIRADO</Text>
              </View>
            )}
            {promotion.discountType && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{formatDiscount()}</Text>
              </View>
            )}
          </View>
        </View>
        
        {promotion.imageUrl && (
          <Image 
            source={{ uri: promotion.imageUrl }} 
            style={styles.image}
            contentFit="cover" 
          />
        )}
        
        <View style={styles.content}>
          <Text style={styles.description} numberOfLines={2}>
            {promotion.description}
          </Text>
          
          <View style={styles.infoRow}>
            <View style={styles.dateContainer}>
              <MaterialIcons name="event" size={14} color="rgba(255,255,255,0.8)" />
              <Text style={styles.dateText}>
                {formatDate(promotion.startDate)} - {formatDate(promotion.endDate)}
              </Text>
            </View>
            
            {isActive() && (
              <View style={styles.timeRemainingContainer}>
                <MaterialIcons name="timer" size={14} color="rgba(255,255,255,0.8)" />
                <Text style={styles.timeRemainingText}>{getTimeRemaining()}</Text>
              </View>
            )}
          </View>
          
          {promotion.promoCode && (
            <View style={styles.promoCodeContainer}>
              <Text style={styles.promoCodeLabel}>CÓDIGO DE PROMO:</Text>
              <View style={styles.promoCode}>
                <Text style={styles.promoCodeText}>{promotion.promoCode}</Text>
              </View>
            </View>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  gradientBackground: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
    marginRight: 8,
  },
  badgeContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  expiredBadge: {
    backgroundColor: 'rgba(255, 59, 48, 0.7)',
  },
  badgeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  image: {
    width: '100%',
    height: 150,
  },
  content: {
    padding: 16,
  },
  description: {
    fontSize: 14,
    color: 'white',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginLeft: 4,
  },
  timeRemainingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeRemainingText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginLeft: 4,
  },
  promoCodeContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  promoCodeLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    marginBottom: 4,
  },
  promoCode: {
    backgroundColor: 'white',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  promoCodeText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },
  // Estilos para versión compacta
  compactContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 8,
    marginBottom: 8,
    width: 160,
    height: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  compactGradient: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  compactContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  compactDiscount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  compactFooter: {
    alignItems: 'flex-start',
  },
  compactDate: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  compactPromoCode: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    marginTop: 4,
  },
  compactPromoCodeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default PromoCard;