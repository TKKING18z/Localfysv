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
import { useChat } from '../context/ChatContext';
import { useCart } from '../context/CartContext';
import firebase from 'firebase/compat/app';

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

// Componente principal optimizado
const BusinessDetailScreen: React.FC = () => {
  const dimensions = useWindowDimensions();
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<BusinessDetailRouteProp>();
  const { businessId } = route.params;
  const { getBusinessById, toggleFavorite, isFavorite } = useBusinesses();
  const { getFormattedDistance } = useLocation();
  const { user } = useAuth();
  const { createConversation, refreshConversations } = useChat();
  const { cart } = useCart();
  
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

  // Mejorar la función handleStartChat para mayor robustez y manejo de errores
  const handleStartChat = useCallback(async () => {
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
      
    } finally {
      setIsLoading(false);
    }
  }, [user, business, navigation, createConversation, refreshConversations]);

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
      tabs.push('promociones');
      tabs.push('reseñas');
      
      // Agregar tab de reservas si el negocio acepta reservaciones
      if (business.acceptsReservations !== false) {
        tabs.push('reservas');
      }
    }
    
    return tabs;
  }, [business, isRestaurant]);

  // Para manejar el scroll animado
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );

  // Distancia formateada - asegurando que siempre sea string | null
  const distance: string | null = business 
    ? (getFormattedDistance(business) || null) 
    : null;

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
        goBack={() => navigation.goBack()}
        shareBusiness={shareBusiness}
        distance={distance}
      />

      <Animated.ScrollView 
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
        overScrollMode="never"
        bounces={true}
        alwaysBounceVertical={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#007AFF" colors={["#007AFF"]} />}
      >
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
          
          {/* Tab Content */}
          <View style={styles.tabContentContainer}>
            {activeTab === 'info' && (
              <BusinessInfoTab
                business={business}
                handleCallBusiness={handleCallBusiness}
                handleEmailBusiness={handleEmailBusiness}
                navigation={navigation}
              />
            )}
            
            {activeTab === 'gallery' && (
              <BusinessGalleryTab images={business.images} />
            )}
            
            {activeTab === 'menu' && (
              <BusinessMenuTab
                menu={business.menu}
                menuUrl={business.menuUrl}
                isTouristAttraction={isTouristAttraction}
                businessId={business.id}
                businessName={business.name}
              />
            )}
            
            {activeTab === 'promociones' && (
              <BusinessPromotionsTab
                promotions={promotions}
                loadingPromotions={loadingPromotions}
                isBusinessOwner={isBusinessOwner}
                navigateToPromotions={navigateToPromotions}
              />
            )}
            
            {activeTab === 'reservas' && (
              <BusinessReservationsTab
                isBusinessOwner={isBusinessOwner}
                businessName={business.name}
                navigateToReservations={navigateToReservations}
              />
            )}
            
            {activeTab === 'reseñas' && (
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
            )}
          </View>
        </View>
      </Animated.ScrollView>
      
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
  },
});

export default BusinessDetailScreen;