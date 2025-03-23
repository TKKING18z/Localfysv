import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Animated,
  Share,
  useWindowDimensions,
  ScrollView,
  RefreshControl
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useBusinesses, Business } from '../context/BusinessContext';
import { useLocation } from '../hooks/useLocation';
import { useAuth } from '../context/AuthContext';
import { firebaseService } from '../services/firebaseService';
import { Promotion } from '../types/businessTypes';
// Add the import for chatService
import { chatService } from '../../services/ChatService';
// Add the import for ChatContext
import { useChat } from '../context/ChatContext';
import firebase from 'firebase/compat/app';

// Components
import BusinessHoursView from '../components/BusinessHoursView';
import PaymentMethodsView from '../components/PaymentMethodsView';
import EnhancedGallery from '../components/EnhancedGallery';
import VideoPlayer from '../components/VideoPlayer';
import SocialLinks from '../components/SocialLinks';
import MenuViewer from '../components/MenuViewer';
import ReviewForm from '../../components/reviews/ReviewForm';
import PromoCard from '../components/promotions/PromoCard';
import ReviewList from '../components/ReviewList'; // Use the component we updated

// Constants
const HEADER_HEIGHT = 350;
const GRADIENT_COLORS = {
  primary: ['#007AFF', '#00C2FF'] as readonly [string, string],
  secondary: ['#FF9500', '#FF2D55'] as readonly [string, string],
  success: ['#34C759', '#32D74B'] as readonly [string, string],
  danger: ['#FF3B30', '#FF2D55'] as readonly [string, string]
};

// Types
type BusinessDetailRouteProp = RouteProp<RootStackParamList, 'BusinessDetail'>;
type NavigationProps = StackNavigationProp<RootStackParamList>;

// Componente principal optimizado
const BusinessDetailScreen: React.FC = () => {
  const dimensions = useWindowDimensions();
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<BusinessDetailRouteProp>();
  const { businessId } = route.params;
  const { getBusinessById, toggleFavorite, isFavorite } = useBusinesses();
  const { getFormattedDistance } = useLocation();
  const { user } = useAuth();
  // Update useChat to extract refreshConversations
  const { createConversation, refreshConversations } = useChat();
  
  // Estados principales
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isFav, setIsFav] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loadingPromotions, setLoadingPromotions] = useState(false);
  const [isBusinessOwner, setIsBusinessOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Add this state for loading indicator
  
  // Valores animados
  const scrollY = useRef(new Animated.Value(0)).current;
  const favoriteScale = useRef(new Animated.Value(1)).current;
  const tabBarOpacity = useRef(new Animated.Value(0)).current;
  const actionButtonsY = useRef(new Animated.Value(100)).current;

  // Additional state for reviews
  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewActiveFilter, setReviewActiveFilter] = useState<number | null>(null);
  const [reviewSortBy, setReviewSortBy] = useState<'recent' | 'rating' | 'relevant'>('recent');

  // Comprobar si el usuario es propietario del negocio
  useEffect(() => {
    if (user && business?.createdBy) {
      setIsBusinessOwner(user.uid === business.createdBy);
    }
  }, [user, business]);
  
  // Animaciones derivadas (memoizadas)
  const headerAnimations = useMemo(() => ({
    height: scrollY.interpolate({
      inputRange: [0, HEADER_HEIGHT - 50],
      outputRange: [HEADER_HEIGHT, 80],
      extrapolate: 'clamp'
    }),
    opacity: scrollY.interpolate({
      inputRange: [0, HEADER_HEIGHT - 120, HEADER_HEIGHT - 80],
      outputRange: [0, 0, 1],
      extrapolate: 'clamp'
    }),
    nameOpacity: scrollY.interpolate({
      inputRange: [0, 80, 120],
      outputRange: [1, 0.8, 0],
      extrapolate: 'clamp'
    })
  }), [scrollY]);

  // Efecto para animaciones iniciales - optimizado con useCallback
  const startInitialAnimations = useCallback(() => {
    // Secuencia de animaciones ordenadas para mejor rendimiento
    const animations = [
      Animated.timing(tabBarOpacity, {
        toValue: 1,
        duration: 400,
        delay: 300,
        useNativeDriver: true
      }),
      Animated.spring(actionButtonsY, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true
      })
    ];
    
    // Iniciar animaciones en secuencia después de un pequeño retraso
    setTimeout(() => {
      Animated.sequence(animations).start();
    }, 100);
  }, [actionButtonsY, tabBarOpacity]);

  // Carga de datos del negocio - optimizado con useCallback
  const fetchBusiness = useCallback(async () => {
    try {
      setLoading(true);
      setLoadingError(null);
      
      const fetchedBusiness = await getBusinessById(businessId);
      if (fetchedBusiness) {
        setBusiness(fetchedBusiness);
        setIsFav(isFavorite(businessId));
      } else {
        setLoadingError('No se pudo encontrar el negocio');
      }
    } catch (error) {
      console.error('Error fetching business details:', error);
      setLoadingError('Error al cargar los detalles del negocio');
    } finally {
      setLoading(false);
    }
  }, [businessId, getBusinessById, isFavorite]);

  // Cargar promociones
  const loadPromotions = useCallback(async () => {
    try {
      setLoadingPromotions(true);
      const result = await firebaseService.promotions.getByBusinessId(businessId);
      if (result.success && result.data) {
        setPromotions(result.data);
      }
    } catch (error) {
      console.error('Error loading promotions:', error);
    } finally {
      setLoadingPromotions(false);
    }
  }, [businessId]);

  // Inicializar datos y animaciones
  useEffect(() => {
    fetchBusiness();
    loadPromotions();
  }, [fetchBusiness, loadPromotions]);

  useEffect(() => {
    if (!loading && business) {
      startInitialAnimations();
    }
  }, [loading, business, startInitialAnimations]);

  // Función para refrescar datos
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchBusiness(), loadPromotions()]);
    setRefreshing(false);
  }, [fetchBusiness, loadPromotions]);

  // Manejadores de eventos optimizados con useCallback
  const handleFavoriteToggle = useCallback(() => {
    Animated.sequence([
      Animated.spring(favoriteScale, {
        toValue: 1.4,
        tension: 120,
        friction: 4,
        useNativeDriver: true
      }),
      Animated.spring(favoriteScale, {
        toValue: 1,
        tension: 120,
        friction: 6,
        useNativeDriver: true
      })
    ]).start();
    
    toggleFavorite(businessId);
    setIsFav(prev => !prev);
  }, [favoriteScale, toggleFavorite, businessId]);

  const handleCallBusiness = useCallback(() => {
    if (!business?.phone) return;
    
    const phoneNumber = Platform.OS === 'android' 
      ? `tel:${business.phone}` 
      : `telprompt:${business.phone}`;
      
    Linking.canOpenURL(phoneNumber)
      .then(supported => {
        if (supported) {
          Linking.openURL(phoneNumber);
        } else {
          Alert.alert('Error', 'No se puede realizar la llamada en este dispositivo');
        }
      })
      .catch(error => {
        console.error('Error al intentar llamar:', error);
        Alert.alert('Error', 'No se pudo iniciar la llamada');
      });
  }, [business?.phone]);

  const handleEmailBusiness = useCallback(() => {
    if (!business?.email) return;
    
    const emailUrl = `mailto:${business.email}`;
    
    Linking.canOpenURL(emailUrl)
      .then(supported => {
        if (supported) {
          Linking.openURL(emailUrl);
        } else {
          Alert.alert('Error', 'No se puede enviar correo desde este dispositivo');
        }
      })
      .catch(error => {
        console.error('Error al intentar enviar correo:', error);
        Alert.alert('Error', 'No se pudo abrir el cliente de correo');
      });
  }, [business?.email]);

  const shareBusiness = useCallback(() => {
    if (!business) return;
    
    Share.share({
      title: business.name,
      message: `¡Mira este negocio en Localfy! ${business.name} - ${business.description}`,
    });
  }, [business]);

  const navigateToReservations = useCallback(() => {
    if (!business) return;
    
    navigation.navigate('Reservations', {
      businessId,
      businessName: business.name,
    });
  }, [navigation, businessId, business]);

  const navigateToPromotions = useCallback(() => {
    if (!business) return;
    
    navigation.navigate('Promotions', {
      businessId,
      businessName: business.name,
    });
  }, [navigation, businessId, business]);

  // Funciones de utilidad - memoizadas para evitar recálculos
  const getBusinessImage = useMemo(() => {
    if (!business?.images || business.images.length === 0) return null;
    
    const mainImage = business.images.find(img => img.isMain);
    if (mainImage && mainImage.url) {
      return mainImage.url;
    }
    return business.images[0].url;
  }, [business?.images]);

  // Mejorar la función handleStartChat para mayor robustez
  const handleStartChat = useCallback(async () => {
    if (!user || !business || !business.createdBy) {
      Alert.alert('Error', 'No se puede iniciar chat en este momento');
      return;
    }
    
    try {
      // Mostrar indicador de carga
      setIsLoading(true);
      
      // Verificar que el usuario tenga permisos para chatear
      if (user.uid === business.createdBy) {
        Alert.alert('Información', 'No puedes iniciar un chat contigo mismo como propietario');
        setIsLoading(false);
        return;
      }
      
      console.log('Iniciando chat con propietario:', business.createdBy);
      
      // SOLUCIÓN CRÍTICA: Orden correcto de usuarios
      const currentUserId = user.uid;
      const businessOwnerId = business.createdBy;
      
      // Obtener información del propietario
      const ownerDoc = await firebase.firestore()
        .collection('users')
        .doc(businessOwnerId)
        .get();
      
      if (!ownerDoc.exists) {
        throw new Error('No se pudo encontrar al propietario del negocio');
      }
      
      const ownerData = ownerDoc.data();
      const ownerName = ownerData?.displayName || 'Propietario';
      
      // SOLUCIÓN CRÍTICA: Log para depuración
      console.log('Attempting to create chat between', {
        currentUserId,
        userName: user.displayName || 'Usuario',
        businessOwnerId,
        ownerName,
        businessId: business.id,
        businessName: business.name
      });
      
      // Usar checkOrCreateBusinessConversation para garantizar conversación bilateral
      const result = await chatService.checkOrCreateBusinessConversation(
        currentUserId,
        user.displayName || 'Usuario',
        businessOwnerId,
        ownerName,
        business.id,
        business.name
      );
      
      if (result.success && result.data) {
        const conversationId = result.data.conversationId;
        
        // SOLUCIÓN CRÍTICA: Verificar que la conversación existe correctamente
        const verifyConversation = await firebase.firestore()
          .collection('conversations')
          .doc(conversationId)
          .get();
          
        if (!verifyConversation.exists) {
          throw new Error('La conversación no se creó correctamente');
        }
        
        // SOLUCIÓN CRÍTICA: Verificar que contiene al usuario actual
        const conversationData = verifyConversation.data();
        if (!conversationData?.participants.includes(currentUserId)) {
          console.error('La conversación no incluye al usuario actual', conversationData);
          throw new Error('Error en la creación de la conversación: usuario no incluido');
        }
        
        // SOLUCIÓN CRÍTICA: Forzar actualización de listado
        await refreshConversations();
        
        // SOLUCIÓN CRÍTICA: Cambio en navegación para asegurar la actualización
        // Primero navegar a Conversations para asegurar que se carga la lista actual
        navigation.navigate('Conversations');
        
        // Esperar a que la pantalla de conversaciones se monte
        setTimeout(() => {
          // Después de un breve retraso, navegar al chat
          navigation.navigate('Chat', { conversationId });
        }, 500);
      } else {
        throw new Error(result.error?.message || 'Error al crear conversación');
      }
    } catch (error) {
      console.error('Error iniciando chat:', error);
      Alert.alert('Error', 'No se pudo iniciar la conversación. Intente nuevamente más tarde.');
    } finally {
      setIsLoading(false);
    }
  }, [user, business, navigation, refreshConversations]);

  const getPlaceholderColor = useMemo(() => {
    if (!business) return '#E1E1E1';
    
    const colors = [
      '#007AFF', '#34C759', '#FF9500', '#FF2D55', '#AF52DE', 
      '#5856D6', '#FF3B30', '#5AC8FA', '#FFCC00', '#4CD964'
    ];
    
    const sum = business.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[sum % colors.length];
  }, [business]);

  const isOpenNow = useMemo(() => {
    if (!business?.businessHours) return null;
    
    const now = new Date();
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
    const currentHours = business.businessHours[dayOfWeek as keyof typeof business.businessHours];
    
    if (!currentHours || currentHours.closed) return false;
    
    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    return currentTimeStr >= currentHours.open && currentTimeStr <= currentHours.close;
  }, [business?.businessHours]);

  const isRestaurant = useMemo(() => {
    if (!business) return false;
    
    const category = business.category.toLowerCase();
    return category.includes('restaurante') || 
           category.includes('café') || 
           category.includes('cafetería') || 
           category.includes('comida') ||
           category.includes('bar');
  }, [business]);

  const isTouristAttraction = useMemo(() => {
    if (!business) return false;
    
    const category = business.category.toLowerCase();
    return category.includes('turismo') || 
           category.includes('atracción') || 
           category.includes('turisticos') ||
           category.includes('turística') ||
           category.includes('tour') ||
           category.includes('aventura');
  }, [business]);

  const availableTabs = useMemo(() => {
    const tabs = ['info', 'gallery'];
    
    if (business) {
      if (isRestaurant && (business.menu || business.menuUrl)) {
        tabs.push('menu');
      }
      
      if (business.videos && business.videos.length > 0) {
        tabs.push('videos');
      }
      
      tabs.push('promociones');
      tabs.push('reseñas');
      
      // Agregar tab de reservas si el negocio acepta reservaciones
      if (business.acceptsReservations !== false) {
        tabs.push('reservas');
      }
    }
    
    return tabs;
  }, [business, isRestaurant]);

  // Cálculo de la posición del indicador de pestañas
  const tabIndicatorPosition = useMemo(() => {
    const index = availableTabs.indexOf(activeTab);
    const tabWidth = dimensions.width / availableTabs.length;
    
    return {
      width: tabWidth,
      transform: [{ translateX: tabWidth * index }]
    };
  }, [activeTab, availableTabs, dimensions.width]);

  // Para manejar el scroll animado
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );

  // Distancia formateada
  const distance = business ? getFormattedDistance(business) : null;

  // Load reviews when tab changes to 'reseñas'
  useEffect(() => {
    if (activeTab === 'reseñas') {
      loadBusinessReviews();
    }
  }, [activeTab, businessId]);

  // Function to load reviews
  const loadBusinessReviews = useCallback(async () => {
    try {
      setLoadingReviews(true);
      // Implementation depends on your firebaseService structure
      const result = await firebaseService.reviews.getByBusinessId(businessId);
      if (result.success && result.data) {
        setReviews(result.data);
      } else {
        setReviews([]);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  }, [businessId]);

  // Review action handlers
  const handleReplyReview = (reviewId: string) => {
    // Implement reply logic (could open a form, navigate, etc.)
    console.log('Reply to review:', reviewId);
  };

  const handleReportReview = (reviewId: string) => {
    // Implement report logic
    Alert.alert(
      'Reportar Reseña',
      '¿Estás seguro de que quieres reportar esta reseña?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Reportar', style: 'destructive', onPress: () => console.log('Report review:', reviewId) }
      ]
    );
  };

  const handleEditReview = (review: any) => {
    // Implement edit logic
    console.log('Edit review:', review);
    // Could open the review form with prefilled data
  };

  const handleDeleteReview = (reviewId: string) => {
    // Implement delete logic
    Alert.alert(
      'Eliminar Reseña',
      '¿Estás seguro de que quieres eliminar esta reseña?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive', 
          onPress: async () => {
            try {
              // Implementation depends on your service structure
              const result = await firebaseService.reviews.delete(reviewId);
              if (result.success) {
                // Refresh reviews after deletion
                loadBusinessReviews();
              }
            } catch (error) {
              console.error('Error deleting review:', error);
              Alert.alert('Error', 'No se pudo eliminar la reseña');
            }
          } 
        }
      ]
    );
  };

  // Estados renderizados
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando negocio...</Text>
      </SafeAreaView>
    );
  }

  if (loadingError || !business) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={64} color="#FF3B30" />
        <Text style={styles.errorTitle}>¡Ups! Algo salió mal</Text>
        <Text style={styles.errorText}>{loadingError || 'No se pudo cargar el negocio'}</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Volver atrás"
        >
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Header flotante mejorado */}
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
          onPress={() => navigation.goBack()}
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
      
      <Animated.ScrollView 
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
        overScrollMode="never"
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh} 
            tintColor="#007AFF"
            colors={["#007AFF"]}
          />
        }
      >
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
              placeholder={Platform.OS === 'ios' ? null : { color: getPlaceholderColor }}
              accessibilityLabel={`Imagen principal de ${business.name}`}
            />
          ) : (
            <View style={[styles.placeholderImage, { backgroundColor: getPlaceholderColor }]}>
              <Text style={styles.placeholderText}>{business.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          
          {/* Gradiente mejorado para visibilidad */}
          <LinearGradient
            colors={['rgba(0,0,0,0.8)', 'transparent', 'rgba(0,0,0,0.5)']}
            style={styles.headerGradient}
            locations={[0, 0.4, 1]}
          />
          
          {/* Header Buttons con efecto al presionar */}
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Volver atrás"
            >
              <MaterialIcons name="arrow-back-ios" size={22} color="white" />
            </TouchableOpacity>
            
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
          
          {/* Nombre del negocio flotante animado */}
          <Animated.View style={[
            styles.overlayBusinessNameContainer,
            { opacity: headerAnimations.nameOpacity }
          ]}>
            <Text 
              style={styles.overlayBusinessName}
              numberOfLines={2}
              accessibilityRole="header"
            >
              {business.name}
            </Text>
            <View style={styles.ratingContainer}>
              <MaterialIcons name="star" size={16} color="#FFCC00" />
              <Text style={styles.ratingText}>
                {(business as any).averageRating?.toFixed(1) || "Nuevo"}
              </Text>
            </View>
          </Animated.View>
          
          {/* Estado de apertura con diseño mejorado */}
          {isOpenNow !== null && (
            <View style={[
              styles.openStatusBadge,
              isOpenNow ? styles.openBadge : styles.closedBadge
            ]}>
              <View style={[
                styles.statusDot,
                isOpenNow ? styles.openDot : styles.closedDot
              ]} />
              <Text style={styles.openStatusText}>
                {isOpenNow ? 'Abierto ahora' : 'Cerrado'}
              </Text>
            </View>
          )}
        </Animated.View>
        
        {/* Business Details con diseño mejorado */}
        <View style={styles.detailsContainer}>
          <Text 
            style={styles.businessName}
            accessibilityRole="header"
            numberOfLines={2}
          >
            {business.name}
          </Text>
          
          <View style={styles.infoRow}>
            <View style={styles.tagContainer}>
              <Text style={styles.categoryTag}>{business.category}</Text>
            </View>
            
            {distance && (
              <View style={styles.distanceContainer}>
                <MaterialIcons name="location-on" size={16} color="#8E8E93" />
                <Text style={styles.distanceText}>{distance}</Text>
              </View>
            )}
          </View>
          
          {/* Tabs de navegación animados */}
          <Animated.View 
            style={[
              styles.tabsContainer,
              { opacity: tabBarOpacity }
            ]}
            accessibilityRole="tablist"
          >
            {availableTabs.map(tab => (
              <TouchableOpacity 
                key={tab}
                style={[styles.tab, activeTab === tab && styles.activeTab]} 
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === tab }}
                accessibilityLabel={`Pestaña ${tab}`}
              >
                <MaterialIcons 
                  name={
                    tab === 'info' ? 'info' :
                    tab === 'gallery' ? 'photo-library' :
                    tab === 'menu' ? (isTouristAttraction ? 'hiking' : 'restaurant-menu') :
                    tab === 'videos' ? 'videocam' : 
                    tab === 'promociones' ? 'local-offer' :
                    tab === 'reservas' ? 'event-available' : 'rate-review'
                  } 
                  size={22} 
                  color={activeTab === tab ? "#FFFFFF" : "#8E8E93"} 
                />
                <Text style={[
                  styles.tabText, 
                  activeTab === tab && styles.activeTabText
                ]}>
                  {tab === 'info' ? 'Información' :
                   tab === 'gallery' ? 'Galería' :
                   tab === 'menu' ? (isTouristAttraction ? 'Planes' : 'Menú') :
                   tab === 'videos' ? 'Videos' : 
                   tab === 'promociones' ? 'Promos' :
                   tab === 'reservas' ? 'Reservas' : 'Reseñas'}
                </Text>
              </TouchableOpacity>
            ))}
            {/* Indicador animado */}
            <Animated.View style={[
              styles.tabIndicator,
              tabIndicatorPosition
            ]} />
          </Animated.View>
          
          {/* Contenido de la pestaña de Información */}
          {activeTab === 'info' && (
            <>
              <View style={styles.card}>
                <Text style={styles.cardSectionTitle}>Descripción</Text>
                <Text style={styles.description}>{business.description || "No hay descripción disponible."}</Text>
              </View>
              
              {/* Información de horarios */}
              {business.businessHours && (
                <View style={styles.card}>
                  <BusinessHoursView hours={business.businessHours} />
                </View>
              )}
              
              {/* Información de métodos de pago */}
              {business.paymentMethods && business.paymentMethods.length > 0 && (
                <View style={styles.card}>
                  <PaymentMethodsView methods={business.paymentMethods} />
                </View>
              )}
              
              {/* Información de contacto mejorada */}
              <View style={styles.card}>
                <Text style={styles.cardSectionTitle}>Información de contacto</Text>
                {business.phone && (
                  <TouchableOpacity 
                    style={styles.contactItem}
                    onPress={handleCallBusiness}
                    activeOpacity={0.6}
                    accessibilityRole="button"
                    accessibilityLabel={`Llamar a ${business.phone}`}
                  >
                    <View style={[styles.contactIconCircle, {backgroundColor: '#34C759'}]}>
                      <MaterialIcons name="phone" size={20} color="white" />
                    </View>
                    <Text style={styles.contactText}>{business.phone}</Text>
                    <MaterialIcons name="arrow-forward-ios" size={18} color="#8E8E93" style={{marginLeft: 'auto'}} />
                  </TouchableOpacity>
                )}
                {business.email && (
                  <TouchableOpacity 
                    style={styles.contactItem}
                    onPress={handleEmailBusiness}
                    activeOpacity={0.6}
                    accessibilityRole="button"
                    accessibilityLabel={`Enviar correo a ${business.email}`}
                  >
                    <View style={[styles.contactIconCircle, {backgroundColor: '#FF9500'}]}>
                      <MaterialIcons name="email" size={20} color="white" />
                    </View>
                    <Text style={styles.contactText}>{business.email}</Text>
                    <MaterialIcons name="arrow-forward-ios" size={18} color="#8E8E93" style={{marginLeft: 'auto'}} />
                  </TouchableOpacity>
                )}
                {business.address && (
                  <View style={styles.contactItem}>
                    <View style={[styles.contactIconCircle, {backgroundColor: '#FF2D55'}]}>
                      <MaterialIcons name="place" size={20} color="white" />
                    </View>
                    <Text style={styles.contactText}>{business.address}</Text>
                  </View>
                )}
                {business.website && (
                  <TouchableOpacity 
                    style={styles.contactItem}
                    onPress={() => {
                      let url = business.website || '';
                      if (!url.startsWith('http://') && !url.startsWith('https://')) {
                        url = 'https://' + url;
                      }
                      Linking.openURL(url);
                    }}
                    activeOpacity={0.6}
                    accessibilityRole="link"
                    accessibilityLabel={`Visitar sitio web ${business.website}`}
                  >
                    <View style={[styles.contactIconCircle, {backgroundColor: '#007AFF'}]}>
                      <MaterialIcons name="public" size={20} color="white" />
                    </View>
                    <Text style={[styles.contactText, styles.websiteText]} numberOfLines={1}>{business.website}</Text>
                    <MaterialIcons name="arrow-forward-ios" size={18} color="#8E8E93" style={{marginLeft: 'auto'}} />
                  </TouchableOpacity>
                )}
                {!business.phone && !business.email && !business.address && !business.website && (
                  <Text style={styles.noInfoText}>No hay información de contacto disponible</Text>
                )}
              </View>
              
              {/* Enlaces a redes sociales */}
              {business.socialLinks && Object.keys(business.socialLinks).length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.cardSectionTitle}>Redes Sociales</Text>
                  <SocialLinks links={business.socialLinks} />
                </View>
              )}
            </>
          )}
          
          {/* Contenido de la pestaña de Galería */}
          {activeTab === 'gallery' && (
            <>
              {business.images && business.images.length > 0 ? (
                <View style={styles.galleryCard}>
                  <Text style={styles.cardSectionTitle}>Galería de imágenes</Text>
                  <EnhancedGallery images={business.images} />
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <MaterialIcons name="photo-library" size={48} color="#E5E5EA" />
                  <Text style={styles.emptyCardText}>No hay imágenes disponibles</Text>
                </View>
              )}
            </>
          )}
          
          {/* Contenido de la pestaña de Menú */}
          {activeTab === 'menu' && (
            <>
              {(business.menu || business.menuUrl) ? (
                <View style={styles.card}>
                  <Text style={styles.cardSectionTitle}>
                    {isTouristAttraction ? 'Planes y Actividades' : 'Menú'}
                  </Text>
                  <MenuViewer 
                    menu={business.menu} 
                    menuUrl={business.menuUrl} 
                    isNested={true}
                    viewType={isTouristAttraction ? 'tourism' : 'restaurant'}
                  />
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <MaterialIcons 
                    name={isTouristAttraction ? "hiking" : "restaurant-menu"} 
                    size={48} 
                    color="#E5E5EA" 
                  />
                  <Text style={styles.emptyCardText}>
                    {isTouristAttraction ? 'No hay planes disponibles' : 'No hay menú disponible'}
                  </Text>
                </View>
              )}
            </>
          )}
          
          {/* Contenido de la pestaña de Videos */}
          {activeTab === 'videos' && (
            <>
              {business.videos && business.videos.length > 0 ? (
                <View style={styles.card}>
                  <Text style={styles.cardSectionTitle}>Videos</Text>
                  <VideoPlayer videos={business.videos} />
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <MaterialIcons name="videocam" size={48} color="#E5E5EA" />
                  <Text style={styles.emptyCardText}>No hay videos disponibles</Text>
                </View>
              )}
            </>
          )}

          {/* Contenido de la pestaña de Promociones */}
          {activeTab === 'promociones' && (
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.cardSectionTitle}>Promociones</Text>
                {isBusinessOwner && (
                  <TouchableOpacity 
                    style={styles.managementButton}
                    onPress={navigateToPromotions}
                  >
                    <MaterialIcons name="edit" size={20} color="#007AFF" />
                    <Text style={styles.managementButtonText}>Gestionar</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {loadingPromotions ? (
                <ActivityIndicator size="large" color="#007AFF" style={{marginVertical: 20}} />
              ) : promotions.length > 0 ? (
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.promotionsScrollContent}
                >
                  {promotions.map((promo) => (
                    <View key={promo.id} style={styles.promotionItemContainer}>
                      <PromoCard promotion={promo} compact={true} />
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.emptyStateContainer}>
                  <MaterialIcons name="local-offer" size={48} color="#E5E5EA" />
                  <Text style={styles.emptyStateText}>No hay promociones disponibles</Text>
                </View>
              )}

              {!isBusinessOwner && promotions.length > 0 && (
                <TouchableOpacity 
                  style={styles.viewAllButton}
                  onPress={navigateToPromotions}
                >
                  <Text style={styles.viewAllButtonText}>Ver todas las promociones</Text>
                  <MaterialIcons name="arrow-forward" size={16} color="#007AFF" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Contenido de la pestaña de Reservas */}
          {activeTab === 'reservas' && (
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.cardSectionTitle}>Reservaciones</Text>
                {isBusinessOwner && (
                  <TouchableOpacity 
                    style={styles.managementButton}
                    onPress={navigateToReservations}
                  >
                    <MaterialIcons name="edit" size={20} color="#007AFF" />
                    <Text style={styles.managementButtonText}>Gestionar</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <View style={styles.reservationInfoContainer}>
                <MaterialIcons name="event-available" size={48} color="#007AFF" style={styles.reservationIcon} />
                <Text style={styles.reservationTitle}>
                  {isBusinessOwner 
                    ? "Gestiona tus reservaciones"
                    : "Reserva en " + business.name}
                </Text>
                <Text style={styles.reservationDescription}>
                  {isBusinessOwner 
                    ? "Administra todas las reservaciones de tu negocio, confirma o rechaza solicitudes y configura tu disponibilidad."
                    : "Realiza una reservación en este negocio de manera fácil y rápida. Selecciona la fecha, hora y número de personas."}
                </Text>
                
                <TouchableOpacity 
                  style={styles.reservationButton}
                  onPress={navigateToReservations}
                >
                  <LinearGradient
                    colors={isBusinessOwner ? ['#FF9500', '#FF2D55'] : ['#007AFF', '#00C2FF']}
                    style={styles.reservationButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <MaterialIcons 
                      name={isBusinessOwner ? "event-note" : "event-available"} 
                      size={22} 
                      color="white" 
                    />
                    <Text style={styles.reservationButtonText}>
                      {isBusinessOwner ? "Gestionar Reservaciones" : "Hacer Reservación"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Contenido de la pestaña de Reseñas */}
          {activeTab === 'reseñas' && (
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.cardSectionTitle}>Reseñas</Text>
              </View>
              
              <ReviewList 
                businessId={businessId}
                isBusinessOwner={isBusinessOwner}
                business={business}
                reviews={reviews}
                currentUserId={user?.uid || ""}
                loading={loadingReviews}
                onAddReview={() => setShowReviewForm(true)}
                onReply={handleReplyReview}
                onReport={handleReportReview}
                onEditReview={handleEditReview}
                onDeleteReview={handleDeleteReview}
                activeFilter={reviewActiveFilter}
                onFilterChange={setReviewActiveFilter}
                sortBy={reviewSortBy}
                onSortChange={setReviewSortBy}
              />
            </View>
          )}
        </View>
      </Animated.ScrollView>
      
      {/* Botones de acción con animación de entrada */}
      {(business.phone || business.email || business.createdBy) && (
        <Animated.View style={[
          styles.actionButtonsContainer,
          { transform: [{ translateY: actionButtonsY }] }
        ]}>
          {business.phone && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleCallBusiness}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Llamar al negocio"
            >
              <LinearGradient
                colors={GRADIENT_COLORS.success}
                style={styles.actionButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <MaterialIcons name="phone" size={22} color="white" />
                <Text style={styles.actionButtonText}>Llamar</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          
          {business.email && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleEmailBusiness}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Enviar correo al negocio"
            >
              <LinearGradient
                colors={GRADIENT_COLORS.secondary}
                style={styles.actionButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <MaterialIcons name="email" size={22} color="white" />
                <Text style={styles.actionButtonText}>Correo</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          
          {/* Add new Chat button */}
          {business.createdBy && business.createdBy !== user?.uid && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleStartChat}
              activeOpacity={0.8}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Chatear con el negocio"
            >
              <LinearGradient
                colors={['#5856D6', '#AF52DE']}
                style={styles.actionButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <MaterialIcons name="chat" size={22} color="white" />
                    <Text style={styles.actionButtonText}>Chatear</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}
          
          {business.acceptsReservations !== false && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={navigateToReservations}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Hacer reservación"
            >
              <LinearGradient
                colors={GRADIENT_COLORS.primary}
                style={styles.actionButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <MaterialIcons name="event-available" size={22} color="white" />
                <Text style={styles.actionButtonText}>Reservar</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {/* Modal de formulario de reseña */}
      {showReviewForm && (
        <View style={[styles.reviewFormOverlay, { zIndex: 2000 }]}>
          <TouchableOpacity 
            style={styles.reviewFormBackdrop}
            onPress={() => setShowReviewForm(false)}
            activeOpacity={1}
          />
          <View style={[styles.reviewFormContainer]}>
            <View style={styles.reviewFormHeader}>
              <Text style={styles.reviewFormTitle}>Añadir Reseña</Text>
              <TouchableOpacity 
                onPress={() => setShowReviewForm(false)}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              >
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            {/* ReviewForm */}
            <ReviewForm
              businessId={businessId}
              businessName={business.name}
              userId={user?.uid || ""}
              userName={user?.displayName || user?.email?.split('@')[0] || "Usuario"}
              userPhotoURL={user?.photoURL || undefined}
              onSuccess={() => {
                setShowReviewForm(false);
                // Refrescar datos
                handleRefresh();
              }}
              onCancel={() => setShowReviewForm(false)}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 8,
    marginBottom: 24,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  floatingHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.95)',
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
    bottom: 80,
    left: 20,
    right: 20,
    zIndex: 2,
  },
  overlayBusinessName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  ratingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  detailsContainer: {
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#F5F7FF',
    marginTop: -24,
    paddingTop: 24,
  },
  businessName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 10,
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
  openBadge: {
    backgroundColor: 'rgba(52, 199, 89, 0.9)',
  },
  closedBadge: {
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  openDot: {
    backgroundColor: '#FFFFFF',
  },
  closedDot: {
    backgroundColor: '#FFFFFF',
  },
  openStatusText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  tagContainer: {
    flexDirection: 'row',
  },
  categoryTag: {
    backgroundColor: '#007AFF20',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(142, 142, 147, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  distanceText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 4,
    fontWeight: '500',
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    position: 'relative',
    backgroundColor: '#E5E5EA40',
    borderRadius: 30,
    padding: 4,
    marginTop: 20,
  },
  tab: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 25,
    zIndex: 1,
    flex: 1,
  },
  activeTab: {
    backgroundColor: 'transparent',
  },
  tabText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    fontWeight: '500',
  },
  activeTabText: {
    color: 'white',
    fontWeight: 'bold',
  },
  tabIndicator: {
    position: 'absolute',
    height: '90%',
    backgroundColor: '#007AFF',
    borderRadius: 25,
    top: '5%',
    left: 4,
    right: 4,
    zIndex: 0,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#666666',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F5',
  },
  contactIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactText: {
    fontSize: 16,
    color: '#333333',
    flex: 1,
  },
  websiteText: {
    color: '#007AFF',
  },
  noInfoText: {
    fontSize: 16,
    color: '#8E8E93',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 10,
  },
  galleryCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  emptyCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  emptyCardText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 12,
    textAlign: 'center',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    marginHorizontal: 8,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    width: '100%',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
  reviewFormOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewFormBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  reviewFormContainer: {
    width: '95%',
    height: '90%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  reviewFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F5',
  },
  reviewFormTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  managementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  managementButtonText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 4,
  },
  promotionsScrollContent: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  promotionItemContainer: {
    marginHorizontal: 8,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyStateText: {
    marginTop: 12,
    color: '#8E8E93',
    fontSize: 16,
    textAlign: 'center',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  viewAllButtonText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 16,
    marginRight: 4,
  },
  reservationInfoContainer: {
    alignItems: 'center',
    padding: 16,
  },
  reservationIcon: {
    marginBottom: 16,
  },
  reservationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
    textAlign: 'center',
  },
  reservationDescription: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  reservationButton: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  reservationButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  reservationButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
});

export default BusinessDetailScreen;