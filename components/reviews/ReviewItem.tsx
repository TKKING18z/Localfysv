import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Alert } from 'react-native';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Review } from '../../models/reviewTypes';
import StarRating from './StarRating';
import { toggleReviewLike } from '../../services/reviewService';
import { colors, fonts, spacing } from '../../theme';
import ImageCarousel from '../ui/ImageCarousel';

interface ReviewItemProps {
  review: Review;
  currentUserId: string;
  isOwner: boolean;
  onReply?: (reviewId: string) => void;
  onReport?: (reviewId: string) => void;
  onEditReview?: (review: Review) => void;
  onDeleteReview?: (reviewId: string) => void;
}

// Función auxiliar para formatear fechas de forma segura
const formatDate = (date: any): string => {
  try {
    // Revisamos si la fecha es un timestamp de Firestore
    if (date && typeof date === 'object' && 'toDate' in date) {
      date = date.toDate();
    }
    
    // Si es una cadena ISO, la convertimos a Date
    if (typeof date === 'string') {
      date = new Date(date);
    }
    
    // Verificamos que sea un objeto Date válido
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return 'Fecha no disponible';
    }

    // Formatear con Intl.DateTimeFormat para mejor localización
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch (error) {
    console.warn('Error al formatear fecha:', error);
    return 'Fecha no disponible';
  }
};

// Calcular tiempo relativo (hace X días, etc.)
const getRelativeTime = (date: any): string => {
  try {
    // Convertir a Date si es necesario
    if (date && typeof date === 'object' && 'toDate' in date) {
      date = date.toDate();
    }
    
    if (typeof date === 'string') {
      date = new Date(date);
    }
    
    // Verificar validez
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return '';
    }

    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInSecs = Math.floor(diffInMs / 1000);
    const diffInMins = Math.floor(diffInSecs / 60);
    const diffInHours = Math.floor(diffInMins / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    const diffInMonths = Math.floor(diffInDays / 30);
    const diffInYears = Math.floor(diffInDays / 365);

    if (diffInSecs < 60) return 'hace un momento';
    if (diffInMins < 60) return `hace ${diffInMins} ${diffInMins === 1 ? 'minuto' : 'minutos'}`;
    if (diffInHours < 24) return `hace ${diffInHours} ${diffInHours === 1 ? 'hora' : 'horas'}`;
    if (diffInDays < 30) return `hace ${diffInDays} ${diffInDays === 1 ? 'día' : 'días'}`;
    if (diffInMonths < 12) return `hace ${diffInMonths} ${diffInMonths === 1 ? 'mes' : 'meses'}`;
    return `hace ${diffInYears} ${diffInYears === 1 ? 'año' : 'años'}`;
  } catch (error) {
    console.warn('Error al calcular tiempo relativo:', error);
    return '';
  }
};

const ReviewItem: React.FC<ReviewItemProps> = ({
  review,
  currentUserId,
  isOwner,
  onReply,
  onReport,
  onEditReview,
  onDeleteReview,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  
  const hasLiked = review.reactions?.usersWhoLiked?.includes(currentUserId);
  const canModify = review.userId === currentUserId;
  const hasImages = review.images && review.images.length > 0;
  const hasLongText = review.text ? review.text.length > 150 : false;
  
  const handleToggleLike = async () => {
    if (isLiking) return;
    
    try {
      setIsLiking(true);
      
      // Animate the like button
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
      
      await toggleReviewLike(review.id, currentUserId);
    } catch (error) {
      console.error('Error toggling like:', error);
    } finally {
      setIsLiking(false);
    }
  };
  
  // Usar las funciones de formateo seguro
  const formattedDate = formatDate(review.createdAt);
  const relativeTime = getRelativeTime(review.createdAt);
  
  // Log para depuración
  console.log(`Mostrando reseña ${review.id} de ${review.userName} con foto: ${review.userPhotoURL}`);
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          {review.userPhotoURL ? (
            <Image 
              source={{ uri: review.userPhotoURL }} 
              style={styles.avatar}
              // Añadir propiedades para asegurar carga correcta
              onError={(e) => console.log('Error cargando imagen de perfil:', e.nativeEvent.error)}
            />
          ) : (
            <View style={[styles.avatar, styles.defaultAvatar]}>
              <Text style={styles.avatarText}>
                {review.userName ? review.userName[0].toUpperCase() : 'U'}
              </Text>
            </View>
          )}
          <View>
             <Text style={styles.username}>
              {review.userName || 'Anónimo'}
            </Text>
            <Text style={styles.date}>
              {relativeTime}
            </Text>
          </View>
        </View>
        <StarRating rating={review.rating} size={16} />
      </View>
      
      {/* Review content */}
      <Text 
        style={styles.reviewText}
        numberOfLines={expanded ? undefined : 3}
      >
        {review.text || ''}
      </Text>
      
      {hasLongText && (
        <TouchableOpacity 
          onPress={() => setExpanded(!expanded)}
          style={styles.expandButton}
        >
          <Text style={styles.expandButtonText}>
            {expanded ? 'Ver menos' : 'Ver más'}
          </Text>
        </TouchableOpacity>
      )}
      
      {/* Images */}
      {hasImages && (
        <View style={styles.imagesContainer}>
          <ImageCarousel 
            images={(review.images ?? []).map(img => img.url)}
            height={200}
          />
        </View>
      )}
      
      {/* Owner reply */}
      {review.ownerReply && (
        <View style={styles.replyContainer}>
          <View style={styles.replyHeader}>
            <Text style={styles.replyTitle}>Respuesta del propietario</Text>
            <Text style={styles.replyDate}>
              {formatDate(review.ownerReply.repliedAt)}
            </Text>
          </View>
          <Text style={styles.replyText}>{review.ownerReply.text || ''}</Text>
        </View>
      )}
      
      {/* Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          onPress={handleToggleLike}
          disabled={isLiking}
          style={styles.actionButton}
        >
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <MaterialIcons 
              name={hasLiked ? 'thumb-up' : 'thumb-up-off-alt'}
              size={20} 
              color={hasLiked ? colors.primary : colors.textSecondary}
            />
          </Animated.View>
          <Text style={styles.actionText}>
            {review.reactions?.likes || 0} {review.reactions?.likes === 1 ? 'Me gusta' : 'Me gusta'}
          </Text>
        </TouchableOpacity>
        
        {isOwner && !review.ownerReply && (
          <TouchableOpacity 
            onPress={() => onReply && onReply(review.id)}
            style={styles.actionButton}
          >
            <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.actionText}>Responder</Text>
          </TouchableOpacity>
        )}
        
        {canModify && (
          <>
            <TouchableOpacity 
              onPress={() => onEditReview && onEditReview(review)}
              style={styles.actionButton}
            >
              <MaterialIcons name="edit" size={20} color={colors.textSecondary} />
              <Text style={styles.actionText}>Editar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => onDeleteReview && onDeleteReview(review.id)}
              style={styles.actionButton}
            >
              <MaterialIcons name="delete-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.actionText}>Eliminar</Text>
            </TouchableOpacity>
          </>
        )}
        
        {!canModify && (
          <TouchableOpacity 
            onPress={() => onReport && onReport(review.id)}
            style={styles.actionButton}
          >
            <MaterialIcons name="flag" size={20} color={colors.textSecondary} />
            <Text style={styles.actionText}>Reportar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: spacing.borderRadius,
    padding: spacing.medium,
    marginBottom: spacing.medium,
    shadowColor: colors.grey, // changed from colors.shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.small,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: spacing.small,
  },
  defaultAvatar: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.white,
    fontFamily: fonts.medium, // Changed from fonts.bold to fonts.medium
    fontSize: 18,
  },
  username: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.textPrimary,
  },
  date: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  reviewText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
    marginVertical: spacing.small,
  },
  expandButton: {
    marginVertical: spacing.small,
  },
  expandButtonText: {
    color: colors.primary,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  imagesContainer: {
    marginVertical: spacing.medium,
  },
  replyContainer: {
    backgroundColor: colors.background,
    borderRadius: spacing.borderRadius,
    padding: spacing.medium,
    marginTop: spacing.medium,
  },
  replyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.small,
  },
  replyTitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  replyDate: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  replyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
  },
  actionsContainer: {
    flexDirection: 'row',
    marginTop: spacing.medium,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.medium * 1.5, // changed from spacing.large
  },
  actionText: {
    marginLeft: spacing.tiny,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
});

export default ReviewItem;
