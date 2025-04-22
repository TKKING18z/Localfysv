import React, { useEffect, useState, useRef, useCallback, useMemo, Suspense, lazy } from 'react';
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
  Image,
  ScrollView,
  RefreshControl
} from 'react-native';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useBusinesses, Business } from '../context/BusinessContext';
import { useLocation } from '../hooks/useLocation';
import { useAuth } from '../context/AuthContext';
import { firebaseService } from '../services/firebaseService';
import { Promotion } from '../types/businessTypes';
import { useChat } from '../context/ChatContext';
import { useCart } from '../context/CartContext';
import firebase from 'firebase/compat/app';
import { useNetwork } from '../context/NetworkContext';
import OfflineBanner from '../components/common/OfflineBanner';
import { throttle, debounce } from '../utils/performanceUtils';

// Creamos un componente de imagen seguro que podemos usar en lugar de FastImageView
// Este componente es compatible con la API de FastImageView pero usa Image de React Native
interface SafeImageViewProps {
  source: any;
  style?: any;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  showLoadingIndicator?: boolean;
  placeholderColor?: string;
  [key: string]: any;
}

// Añadir export a la definición del componente
export const SafeImageView: any = (props: SafeImageViewProps) => {
  const {
    source,
    style,
    resizeMode = 'cover',
    showLoadingIndicator = false,
    placeholderColor = '#E1E1E1',
    ...rest
  } = props;
  
  const [isLoading, setIsLoading] = useState(true);
  
  return (
    <View style={[{ backgroundColor: placeholderColor }, style]}>
      {isLoading && showLoadingIndicator && (
        <ActivityIndicator
          style={StyleSheet.absoluteFill}
          size="small"
          color="#007AFF"
        />
      )}
      <Image
        source={source}
        style={[{ width: '100%', height: '100%' }, style]}
        resizeMode={resizeMode}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        {...rest}
      />
    </View>
  );
};

// Añadir propiedades estáticas necesarias para compatibilidad con FastImage
SafeImageView.resizeMode = {
  contain: 'contain',
  cover: 'cover',
  stretch: 'stretch',
  center: 'center'
};

SafeImageView.priority = {
  low: 'low',
  normal: 'normal',
  high: 'high'
};

SafeImageView.cacheControl = {
  immutable: 'immutable',
  web: 'web',
  cacheOnly: 'cacheOnly'
};

// Importar componentes modularizados
import {
  BusinessHeader,
  BusinessTabs,
  BusinessInfoTab,
  BusinessGalleryTab,
  BusinessMenuTab,
  BusinessPromotionsTab,
  BusinessReservationsTab,
  BusinessReviewsTab,
  BusinessActionButtons,
  ReviewFormModal,
} from '../components/businessDetail';

// Constants
const HEADER_HEIGHT = 350;
const GRADIENT_COLORS = {
  primary: ['#007aff', '#0066CC'] as readonly [string, string],
  call: ['#007aff', '#007aff'] as readonly [string, string], // Updated to uniform blue
  email: ['#007aff', '#64D2FF'] as readonly [string, string],
  chat: ['#007aff', '#5E5CE6'] as readonly [string, string],
  reserve: ['#007aff', '#0066CC'] as readonly [string, string]
};

// Types
type BusinessDetailRouteProp = RouteProp<RootStackParamList, 'BusinessDetail'>;
type NavigationProps = StackNavigationProp<RootStackParamList>;

// Error Boundary simplificado para manejo de errores a nivel de componente
const ErrorBoundaryFallback = React.memo(({ error, retry }: { error: Error, retry: () => void }) => (
  <View style={styles.errorContainer}>
    <MaterialIcons name="error-outline" size={64} color="#FF3B30" />
    <Text style={styles.errorTitle}>¡Ups! Algo salió mal</Text>
    <Text style={styles.errorText}>{error.message || 'Error desconocido'}</Text>
    <TouchableOpacity 
      style={styles.backButton}
      onPress={retry}
      accessibilityRole="button"
      accessibilityLabel="Reintentar"
    >
      <Text style={styles.backButtonText}>Reintentar</Text>
    </TouchableOpacity>
  </View>
));

// Componente de carga optimizado y reusable
const LoadingScreen = React.memo(() => (
  <SafeAreaView style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#007AFF" />
    <Text style={styles.loadingText}>Cargando negocio...</Text>
  </SafeAreaView>
));

// Componente principal optimizado
const BusinessDetailScreen: React.FC = () => {
  const dimensions = useWindowDimensions();
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<BusinessDetailRouteProp>();
  const { businessId } = route.params;
  const fromOnboarding = route.params.fromOnboarding || false;
  const { getBusinessById, toggleFavorite, isFavorite } = useBusinesses();
  const { getFormattedDistance } = useLocation();
  const { user } = useAuth();
  const { createConversation, refreshConversations } = useChat();
  const { cart } = useCart();
  const { isConnected, isSlowConnection } = useNetwork();
  
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
  const [isLoading, setIsLoading] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  
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
      Animated.parallel(animations).start();
    }, 100);
  }, [actionButtonsY, tabBarOpacity]);

  // Carga de datos del negocio - optimizado con useCallback y debounce para evitar múltiples llamadas
  const fetchBusiness = useCallback(debounce(async () => {
    if (!isConnected && !business) {
      setLoadingError('Sin conexión a Internet. Comprueba tu conexión y vuelve a intentarlo.');
      setLoading(false);
      return;
    }

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
    } catch (error: any) {
      console.error('Error fetching business details:', error);
      setLoadingError(error.message || 'Error al cargar los detalles del negocio');
    } finally {
      setLoading(false);
    }
  }, 300), [businessId, getBusinessById, isFavorite, isConnected, business]);

  // Cargar promociones - optimizado para conexiones lentas
  const loadPromotions = useCallback(async () => {
    if (!isConnected && promotions.length === 0) {
      // No cargar si no hay conexión y no tenemos datos
      return;
    }
    
    try {
      setLoadingPromotions(true);
      const result = await firebaseService.promotions.getByBusinessId(businessId);
      if (result.success && result.data) {
        setPromotions(result.data);
      }
    } catch (error) {
      console.error('Error loading promotions:', error);
      // No mostrar error si ya tenemos algunos datos
      if (promotions.length === 0) {
        // Alert.alert('Error', 'No se pudieron cargar las promociones');
      }
    } finally {
      setLoadingPromotions(false);
    }
  }, [businessId, isConnected, promotions.length]);

  // Inicializar datos y animaciones
  useEffect(() => {
    fetchBusiness();
  }, [fetchBusiness, retryAttempt]);

  useEffect(() => {
    if (business) {
      loadPromotions();
    }
  }, [business, loadPromotions]);

  useEffect(() => {
    if (!loading && business) {
      startInitialAnimations();
    }
  }, [loading, business, startInitialAnimations]);

  // Función para refrescar datos
  const handleRefresh = useCallback(async () => {
    if (!isConnected) {
      Alert.alert('Sin conexión', 'No es posible actualizar los datos sin conexión a Internet.');
      return;
    }
    
    setRefreshing(true);
    await Promise.all([fetchBusiness(), loadPromotions()]);
    setRefreshing(false);
  }, [fetchBusiness, loadPromotions, isConnected]);

  // Manejar navegación de vuelta
  const handleGoBack = useCallback(() => {
    // Si venimos del onboarding, navegar a Home en lugar de volver
    if (fromOnboarding) {
      // Reiniciar la pila de navegación y navegar a Home
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            { name: 'MainTabs', params: { screen: 'Home' } },
          ],
        })
      );
    } else {
      // Comportamiento normal de volver atrás
      navigation.goBack();
    }
  }, [navigation, fromOnboarding]);

  // Función optimizada para reintentar en caso de error
  const handleRetry = useCallback(() => {
    setRetryAttempt(prev => prev + 1);
    setLoadingError(null);
    setLoading(true);
  }, []);

  // Manejadores de eventos optimizados con useCallback
  const handleFavoriteToggle = useCallback(throttle(() => {
    if (!isConnected) {
      Alert.alert('Sin conexión', 'Esta acción requiere conexión a Internet.');
      return;
    }
    
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
  }, 500), [favoriteScale, toggleFavorite, businessId, isConnected]);

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
    
    if (!isConnected) {
      Alert.alert('Sin conexión', 'Necesitas conexión a Internet para acceder a las reservas.');
      return;
    }
    
    navigation.navigate('Reservations', {
      businessId,
      businessName: business.name,
    });
  }, [navigation, businessId, business, isConnected]);

  const navigateToPromotions = useCallback(() => {
    if (!business) return;
    
    if (!isConnected) {
      Alert.alert('Sin conexión', 'Necesitas conexión a Internet para acceder a las promociones.');
      return;
    }
    
    navigation.navigate('Promotions', {
      businessId,
      businessName: business.name,
    });
  }, [navigation, businessId, business, isConnected]);

  // Funciones de utilidad - memoizadas para evitar recálculos
  const getBusinessImage = useMemo(() => {
    if (!business?.images || business.images.length === 0) return null;
    
    const mainImage = business.images.find(img => img.isMain);
    if (mainImage && mainImage.url) {
      return mainImage.url;
    }
    return business.images[0].url;
  }, [business?.images]);

  // Mejorar la función handleStartChat para mayor robustez y manejo de errores
  const handleStartChat = useCallback(async () => {
    if (!isConnected) {
      Alert.alert('Sin conexión', 'Necesitas conexión a Internet para iniciar un chat.');
      return;
    }
    
    if (!user || !business || !business.createdBy) {
      Alert.alert('Error', 'No se puede iniciar chat en este momento');
      return;
    }
    
    try {
      // Mostrar indicador de carga
      setIsLoading(true);
      
      // Verificar si el usuario es el propietario del negocio (no puede chatear consigo mismo)
      if (user.uid === business.createdBy) {
        Alert.alert('Información', 'No puedes iniciar un chat contigo mismo como propietario');
        setIsLoading(false);
        return;
      }
      
      // Mostrar mensaje de advertencia en conexiones lentas
      if (isSlowConnection) {
        Alert.alert(
          'Conexión lenta',
          'Tu conexión a Internet es lenta. El chat podría tardar más tiempo en iniciar.',
          [{ text: 'Continuar de todos modos' }]
        );
      }
      
      console.log('[BusinessDetail] Iniciando chat con propietario:', business.createdBy);
      console.log('[BusinessDetail] Usuario actual:', user.uid);
      console.log('[BusinessDetail] Negocio ID:', business.id);
      
      // Obtener información del propietario
      const ownerDoc = await firebase.firestore()
        .collection('users')
        .doc(business.createdBy)
        .get();
      
      if (!ownerDoc.exists) {
        console.error('[BusinessDetail] No se pudo encontrar al propietario con ID:', business.createdBy);
        throw new Error('No se pudo encontrar al propietario del negocio');
      }
      
      const ownerData = ownerDoc.data();
      console.log('[BusinessDetail] Datos del propietario:', ownerData);
      // Usar un nombre por defecto si no hay displayName
      const ownerName = ownerData?.displayName || 'Propietario';
      
      // Primero buscar si ya existe una conversación con este negocio para no duplicar
      console.log('[BusinessDetail] Verificando si ya existe una conversación...');
      const existingChats = await firebase.firestore()
        .collection('conversations')
        .where('participants', 'array-contains', user.uid)
        .where('businessId', '==', business.id)
        .get();
      
      let conversationId = null;
      
      // Si ya existe una conversación, usarla
      if (!existingChats.empty) {
        console.log('[BusinessDetail] Conversación existente encontrada');
        // Usar la primera conversación encontrada
        conversationId = existingChats.docs[0].id;
        console.log('[BusinessDetail] Usando conversación existente:', conversationId);
      } else {
        // Si no existe, crear una nueva
        console.log('[BusinessDetail] Creando nueva conversación...');
        conversationId = await createConversation(
          business.createdBy, // recipientId = propietario del negocio
          ownerName,
          business.id,      // businessId
          business.name     // businessName
        );
      }
      if (!conversationId) {
        console.error('[BusinessDetail] createConversation devolvió null');
        throw new Error('No se pudo crear la conversación - ID nulo');
      }
      
      console.log('[BusinessDetail] Conversación creada con ID:', conversationId);
      
      // Esperar explícitamente para asegurar que la conversación esté creada
      console.log('[BusinessDetail] Esperando para asegurar la sincronización...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Actualizar lista de conversaciones antes de navegar
      try {
        console.log('[BusinessDetail] Actualizando lista de conversaciones...');
        await refreshConversations();
        console.log('[BusinessDetail] Lista de conversaciones actualizada');
      } catch (refreshError) {
        console.error('[BusinessDetail] Error al actualizar lista de conversaciones:', refreshError);
        // Continuamos igual
      }
      
      // Verificar que la conversación exista en Firestore antes de navegar
      console.log('[BusinessDetail] Verificando que la conversación exista...');
      const convDoc = await firebase.firestore()
        .collection('conversations')
        .doc(conversationId)
        .get();
      
      if (!convDoc.exists) {
        console.error('[BusinessDetail] ¡La conversación no existe en Firestore! Esperando más...');
        // Esperar más tiempo si la conversación aún no existe
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      console.log('[BusinessDetail] Navegando a Chat con ID:', conversationId);
      
      // Importante: resetear el estado de carga antes de navegar
      setIsLoading(false);
      
      // En lugar de navegar directamente a Chat, vamos a la pantalla de Conversaciones
      // Esto evita los problemas de carga infinita en ChatScreen
      console.log('[BusinessDetail] Navegando a Conversaciones para evitar problemas de carga...');
      navigation.navigate('MainTabs', { screen: 'Conversations' });
      
      // Mostramos mensaje de éxito al usuario
      Alert.alert(
        'Conversación creada',
        'La conversación ha sido creada correctamente. Accede a ella desde la pestaña de Mensajes.'
      );
      
    } catch (error) {
      console.error('[BusinessDetail] Error detallado:', error);
      Alert.alert(
        'Error',
        'No se pudo iniciar la conversación. Inténtalo de nuevo más tarde.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [user, business, navigation, createConversation, refreshConversations, isConnected, isSlowConnection]);

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
      // Mostrar pestaña de menú/planes si hay contenido, sin importar el tipo de negocio
      if ((business.menu && business.menu.length > 0) || business.menuUrl) {
        tabs.push('menu');
      }
      
      tabs.push('promociones');
      tabs.push('reseñas');
      
      // Agregar tab de reservas si el negocio acepta reservaciones
      if (business.acceptsReservations !== false) {
        tabs.push('reservas');
      }
    }
    
    return tabs;
  }, [business]);

  // Para manejar el scroll animado - optimizado para rendimiento
  const handleScroll = useMemo(() => {
    return Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      { useNativeDriver: false }
    );
  }, [scrollY]);

  // Distancia formateada - asegurando que siempre sea string | null
  const distance: string | null = business 
    ? (getFormattedDistance(business) || null) 
    : null;

  // Load reviews when tab changes to 'reseñas'
  useEffect(() => {
    if (activeTab === 'reseñas' && isConnected) {
      loadBusinessReviews();
    }
  }, [activeTab, businessId, isConnected]);

  // Function to load reviews
  const loadBusinessReviews = useCallback(async () => {
    try {
      setLoadingReviews(true);
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
  const handleReplyReview = useCallback((reviewId: string) => {
    // Implement reply logic (could open a form, navigate, etc.)
    console.log('Reply to review:', reviewId);
  }, []);

  const handleReportReview = useCallback((reviewId: string) => {
    // Implement report logic
    Alert.alert(
      'Reportar Reseña',
      '¿Estás seguro de que quieres reportar esta reseña?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Reportar', style: 'destructive', onPress: () => console.log('Report review:', reviewId) }
      ]
    );
  }, []);

  const handleEditReview = useCallback((review: any) => {
    // Implement edit logic
    console.log('Edit review:', review);
    // Could open the review form with prefilled data
  }, []);

  const handleDeleteReview = useCallback((reviewId: string) => {
    if (!isConnected) {
      Alert.alert('Sin conexión', 'Necesitas conexión a Internet para eliminar una reseña.');
      return;
    }
    
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
  }, [loadBusinessReviews, isConnected]);

  // Handler para navegar al carrito
  const handleGoToCart = useCallback(() => {
    navigation.navigate('Cart', {});
  }, [navigation]);

  // Add an useEffect to smooth out animation when changing tabs
  useEffect(() => {
    if (activeTab) {
      // This resets the scroll position slightly to trigger header animation
      scrollY.setValue(10);
      setTimeout(() => {
        scrollY.setValue(0);
      }, 100);
    }
  }, [activeTab, scrollY]);

  // Estados renderizados
  if (loading) {
    return <LoadingScreen />;
  }

  if (loadingError || !business) {
    return (
      <ErrorBoundaryFallback
        error={new Error(loadingError || 'No se pudo cargar el negocio')}
        retry={handleRetry}
      />
    );
  }

  // Renderizado optimizado de filtros usando arrays para múltiples elementos idénticos
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Offline Banner - aparece cuando no hay conexión o es lenta */}
      {!isConnected && <OfflineBanner />}
      {isConnected && isSlowConnection && (
        <OfflineBanner 
          offlineText="Conexión lenta detectada" 
          slowConnectionText="Conexión lenta detectada"
        />
      )}
      
      {/* Header */}
      <BusinessHeader
        business={business}
        scrollY={scrollY}
        getBusinessImage={getBusinessImage}
        isFav={isFav}
        isOpenNow={isOpenNow}
        getPlaceholderColor={getPlaceholderColor}
        headerAnimations={headerAnimations}
        favoriteScale={favoriteScale}
        handleFavoriteToggle={handleFavoriteToggle}
        goBack={handleGoBack}
        shareBusiness={shareBusiness}
        distance={distance}
      />

      {/* Replace ScrollView with a View that contains each tab content */}
      <View style={styles.mainContainer}>
        {/* Business Details */}
        <View style={styles.detailsContainer}>
          {/* Tabs */}
          <BusinessTabs
            availableTabs={availableTabs}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabBarOpacity={tabBarOpacity}
            isTouristAttraction={isTouristAttraction}
          />
          
          {/* Tab Content - Each tab in its own container */}
          <View style={styles.tabContentContainer}>
            {activeTab === 'info' && (
              <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                overScrollMode="never"
                bounces={true}
                alwaysBounceVertical={true}
                refreshControl={
                  <RefreshControl 
                    refreshing={refreshing} 
                    onRefresh={handleRefresh} 
                    tintColor="#007AFF" 
                    colors={["#007AFF"]} 
                  />
                }
              >
                <BusinessInfoTab
                  business={business}
                  handleCallBusiness={handleCallBusiness}
                  handleEmailBusiness={handleEmailBusiness}
                  navigation={navigation}
                />
              </ScrollView>
            )}
            
            {activeTab === 'gallery' && (
              <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                overScrollMode="never"
                bounces={true}
                alwaysBounceVertical={true}
                refreshControl={
                  <RefreshControl 
                    refreshing={refreshing} 
                    onRefresh={handleRefresh} 
                    tintColor="#007AFF" 
                    colors={["#007AFF"]} 
                  />
                }
              >
                <BusinessGalleryTab images={business.images} />
              </ScrollView>
            )}
            
            {activeTab === 'menu' && (
              <View style={styles.menuTabContainer}>
                <BusinessMenuTab
                  menu={business.menu}
                  menuUrl={business.menuUrl}
                  isTouristAttraction={isTouristAttraction}
                  businessId={business.id}
                  businessName={business.name}
                />
              </View>
            )}
            
            {activeTab === 'promociones' && (
              <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                overScrollMode="never"
                bounces={true}
                alwaysBounceVertical={true}
                refreshControl={
                  <RefreshControl 
                    refreshing={refreshing} 
                    onRefresh={handleRefresh} 
                    tintColor="#007AFF" 
                    colors={["#007AFF"]} 
                  />
                }
              >
                <BusinessPromotionsTab
                  promotions={promotions}
                  loadingPromotions={loadingPromotions}
                  isBusinessOwner={isBusinessOwner}
                  navigateToPromotions={navigateToPromotions}
                />
              </ScrollView>
            )}
            
            {activeTab === 'reservas' && (
              <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                overScrollMode="never"
                bounces={true}
                alwaysBounceVertical={true}
                refreshControl={
                  <RefreshControl 
                    refreshing={refreshing} 
                    onRefresh={handleRefresh} 
                    tintColor="#007AFF" 
                    colors={["#007AFF"]} 
                  />
                }
              >
                <BusinessReservationsTab
                  isBusinessOwner={isBusinessOwner}
                  businessName={business.name}
                  navigateToReservations={navigateToReservations}
                />
              </ScrollView>
            )}
            
            {activeTab === 'reseñas' && (
              <View style={styles.reviewsTabContainer}>
                <BusinessReviewsTab
                  businessId={businessId}
                  business={business}
                  reviews={reviews}
                  isBusinessOwner={isBusinessOwner}
                  currentUserId={user?.uid || ""}
                  loadingReviews={loadingReviews}
                  reviewActiveFilter={reviewActiveFilter}
                  reviewSortBy={reviewSortBy}
                  onShowReviewForm={() => setShowReviewForm(true)}
                  onReplyReview={handleReplyReview}
                  onReportReview={handleReportReview}
                  onEditReview={handleEditReview}
                  onDeleteReview={handleDeleteReview}
                  onFilterChange={setReviewActiveFilter}
                  onSortChange={setReviewSortBy}
                />
              </View>
            )}
          </View>
        </View>
      </View>
      
      {/* Action Buttons */}
      <BusinessActionButtons
        business={business}
        hasPhone={!!business.phone}
        hasCreator={!!business.createdBy}
        userIsCreator={user?.uid === business.createdBy}
        isLoading={isLoading}
        cartItemsCount={cart.items.length}
        acceptsReservations={business.acceptsReservations !== false}
        actionButtonsY={actionButtonsY}
        onCallBusiness={handleCallBusiness}
        onStartChat={handleStartChat}
        onGoToReservations={navigateToReservations}
        onGoToCart={handleGoToCart}
      />

      {/* Review Form Modal */}
      <ReviewFormModal
        showReviewForm={showReviewForm}
        businessId={businessId}
        businessName={business.name}
        userId={user?.uid || ""}
        userName={user?.displayName || user?.email?.split('@')[0] || "Usuario"}
        userPhotoURL={user?.photoURL || undefined}
        onClose={() => setShowReviewForm(false)}
        onSuccess={handleRefresh}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },
  mainContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Platform.OS === 'ios' ? 150 : 120,
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
  detailsContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#F5F7FF',
    marginTop: -24,
    paddingTop: 20,
    flex: 1,
  },
  tabContentContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    flex: 1,
  },
  reviewsTabContainer: {
    flex: 1,
  },
  menuTabContainer: {
    flex: 1,
  },
});

export default React.memo(BusinessDetailScreen);