import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Animated,
  Share,
  Dimensions
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useBusinesses, Business } from '../context/BusinessContext';
import { useLocation } from '../hooks/useLocation';

// Importa los componentes de visualización
import BusinessHoursView from '../components/BusinessHoursView';
import PaymentMethodsView from '../components/PaymentMethodsView';
import EnhancedGallery from '../components/EnhancedGallery';
import VideoPlayer from '../components/VideoPlayer';
import SocialLinks from '../components/SocialLinks';
import MenuViewer from '../components/MenuViewer';

// Nuevas importaciones para reseñas
import { useBusinessReviews } from '../../hooks/useReviews';
import ReviewList from '../../components/reviews/ReviewList';
import ReviewForm from '../../components/reviews/ReviewForm';

// Constantes de diseño
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HEADER_HEIGHT = 350;  // Header más alto para mejor impacto visual

// Colores para efectos de gradiente - definición corregida
const GRADIENT_COLORS = {
  primary: ['#007AFF', '#00C2FF'] as const,
  secondary: ['#FF9500', '#FF2D55'] as const,
  success: ['#34C759', '#32D74B'] as const,
  danger: ['#FF3B30', '#FF2D55'] as const
};

type BusinessDetailRouteProp = RouteProp<RootStackParamList, 'BusinessDetail'>;
type NavigationProps = StackNavigationProp<RootStackParamList>;

const BusinessDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<BusinessDetailRouteProp>();
  const { businessId } = route.params;
  const { getBusinessById, toggleFavorite, isFavorite } = useBusinesses();
  const { getFormattedDistance } = useLocation();
  
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isFav, setIsFav] = useState(false);
  const [activeTab, setActiveTab] = useState('info');

  // Animaciones mejoradas
  const scrollY = useRef(new Animated.Value(0)).current;
  const favoriteScale = useRef(new Animated.Value(1)).current;
  const tabBarOpacity = useRef(new Animated.Value(0)).current;
  
  // Animación para los botones de acción
  const actionButtonsY = useRef(new Animated.Value(100)).current;
  
  // Más animaciones para los elementos de la interfaz
  const headerHeight = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT - 50],
    outputRange: [HEADER_HEIGHT, 80],
    extrapolate: 'clamp'
  });
  
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT - 120, HEADER_HEIGHT - 80],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp'
  });
  
  const businessNameOpacity = scrollY.interpolate({
    inputRange: [0, 80, 120],
    outputRange: [1, 0.8, 0],
    extrapolate: 'clamp'
  });
  
  // Mostrar animación de los botones de acción cuando se carga el componente
  useEffect(() => {
    setTimeout(() => {
      Animated.spring(actionButtonsY, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true
      }).start();
    }, 400);
    
    // Animar la aparición de la barra de pestañas
    Animated.timing(tabBarOpacity, {
      toValue: 1,
      duration: 400,
      delay: 300,
      useNativeDriver: true
    }).start();
  }, []);

  // Función para compartir negocio
  const shareBusiness = () => {
    if (!business) return;
    
    Share.share({
      title: business.name,
      message: `¡Mira este negocio en Localfy! ${business.name} - ${business.description}`,
    });
  };

  useEffect(() => {
    const fetchBusiness = async () => {
      try {
        setLoading(true);
        setLoadingError(null);
        
        const fetchedBusiness = await getBusinessById(businessId);
        if (fetchedBusiness) {
          setBusiness(fetchedBusiness);
          // Initialize favorite state
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
    };

    fetchBusiness();
  }, [businessId]);

  // Handle toggling favorite with improved animation
  const handleFavoriteToggle = () => {
    // Animar el botón de favorito con un efecto más pronunciado
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
    setIsFav(!isFav);
  };

  // Call business phone number
  const handleCallBusiness = () => {
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
  };

  // Send email to business
  const handleEmailBusiness = () => {
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
  };

  // Get business image or fallback
  const getBusinessImage = () => {
    if (business?.images && business.images.length > 0) {
      const mainImage = business.images.find(img => img.isMain);
      if (mainImage && mainImage.url) {
        return mainImage.url;
      }
      return business.images[0].url;
    }
    return null;
  };

  // Generate color from business name for placeholder
  const getPlaceholderColor = () => {
    if (!business) return '#E1E1E1';
    
    const colors = [
      '#007AFF', '#34C759', '#FF9500', '#FF2D55', '#AF52DE', 
      '#5856D6', '#FF3B30', '#5AC8FA', '#FFCC00', '#4CD964'
    ];
    
    const sum = business.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[sum % colors.length];
  };

  // Verificar si el negocio está abierto ahora
  const isOpenNow = () => {
    if (!business?.businessHours) return null;
    
    const now = new Date();
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
    const currentHours = business.businessHours[dayOfWeek as keyof typeof business.businessHours];
    
    if (!currentHours || currentHours.closed) return false;
    
    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    return currentTimeStr >= currentHours.open && currentTimeStr <= currentHours.close;
  };

  // Hook para cargar reseñas
  const {
    reviews,
    loading: reviewsLoading,
    error: reviewsError,
    hasMore: hasMoreReviews,
    stats: reviewsStats,
    loadMore: loadMoreReviews,
    filterByRating,
    activeFilter,
    sortBy,
    changeSortMethod,
  } = useBusinessReviews(businessId);

  // Se asume un currentUserId (reemplazar con el valor real de la sesión)
  const currentUserId = "currentUser";

  // Estado para mostrar formulario de reseña
  const [showReviewForm, setShowReviewForm] = useState(false);

  // Loading state with improved UI
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando negocio...</Text>
      </SafeAreaView>
    );
  }

  // Error state with improved UI
  if (loadingError || !business) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={64} color="#FF3B30" />
        <Text style={styles.errorTitle}>¡Ups! Algo salió mal</Text>
        <Text style={styles.errorText}>{loadingError || 'No se pudo cargar el negocio'}</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Get business image or use placeholder
  const businessImage = getBusinessImage();
  
  // Get formatted distance
  const distance = getFormattedDistance(business);

  // Función para determinar si es un restaurante basado en la categoría
  const isRestaurant = () => {
    const category = business.category.toLowerCase();
    return category.includes('restaurante') || 
           category.includes('café') || 
           category.includes('cafetería') || 
           category.includes('comida') ||
           category.includes('bar');
  };

  // Estado de apertura
  const openStatus = isOpenNow();

  // Animated TabBar indicator
  const getTabIndicatorPosition = () => {
    // Calculate position based on active tab
    const tabWidth = SCREEN_WIDTH / 4; // Assuming max 4 tabs
    const tabOptions = ['info', 'gallery'];
    
    if (isRestaurant() && (business?.menu || business?.menuUrl)) {
      tabOptions.push('menu');
    }
    
    if (business?.videos && business.videos.length > 0) {
      tabOptions.push('videos');
    }
    
    // Agregamos siempre la pestaña de reseñas
    tabOptions.push('reseñas');
    
    const index = tabOptions.indexOf(activeTab);
    const availableTabs = tabOptions.length;
    
    return {
      width: SCREEN_WIDTH / availableTabs,
      transform: [{ translateX: (SCREEN_WIDTH / availableTabs) * index }]
    };
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Header flotante mejorado */}
      <Animated.View style={[
        styles.floatingHeader,
        { 
          opacity: headerOpacity,
          transform: [{ translateY: headerOpacity.interpolate({
            inputRange: [0, 1],
            outputRange: [-50, 0]
          })}]
        }
      ]}>
        <TouchableOpacity 
          style={styles.floatingBackButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back-ios" size={22} color="#333" />
        </TouchableOpacity>
        <Text numberOfLines={1} style={styles.floatingHeaderTitle}>{business.name}</Text>
        <Animated.View style={{ transform: [{ scale: favoriteScale }] }}>
          <TouchableOpacity 
            style={styles.floatingActionButton}
            onPress={handleFavoriteToggle}
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
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Business Image Header con animación */}
        <Animated.View style={[styles.imageContainer, { height: headerHeight }]}>
          {businessImage ? (
            <Image 
              source={{ uri: businessImage }} 
              style={styles.businessImage}
              contentFit="cover"
              transition={500}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.placeholderImage, { backgroundColor: getPlaceholderColor() }]}>
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
            >
              <MaterialIcons name="arrow-back-ios" size={22} color="white" />
            </TouchableOpacity>
            
            <View style={styles.headerRightButtons}>
              <TouchableOpacity 
                style={styles.iconButton}
                onPress={shareBusiness}
                activeOpacity={0.7}
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
            { opacity: businessNameOpacity }
          ]}>
            <Text style={styles.overlayBusinessName}>{business.name}</Text>
            <View style={styles.ratingContainer}>
              <MaterialIcons name="star" size={16} color="#FFCC00" />
              <Text style={styles.ratingText}>
                {(Math.random() * 2 + 3).toFixed(1)}
              </Text>
            </View>
          </Animated.View>
          
          {/* Estado de apertura con diseño mejorado */}
          {openStatus !== null && (
            <View style={[
              styles.openStatusBadge,
              openStatus ? styles.openBadge : styles.closedBadge
            ]}>
              <View style={[
                styles.statusDot,
                openStatus ? styles.openDot : styles.closedDot
              ]} />
              <Text style={styles.openStatusText}>
                {openStatus ? 'Abierto ahora' : 'Cerrado'}
              </Text>
            </View>
          )}
        </Animated.View>
        
        {/* Business Details con diseño mejorado */}
        <View style={styles.detailsContainer}>
          <Text style={styles.businessName}>{business.name}</Text>
          
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
          >
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'info' && styles.activeTab]} 
              onPress={() => setActiveTab('info')}
              activeOpacity={0.8}
            >
              <MaterialIcons 
                name="info" 
                size={22} 
                color={activeTab === 'info' ? "#FFFFFF" : "#8E8E93"} 
              />
              <Text style={[
                styles.tabText, 
                activeTab === 'info' && styles.activeTabText
              ]}>Información</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'gallery' && styles.activeTab]} 
              onPress={() => setActiveTab('gallery')}
              activeOpacity={0.8}
            >
              <MaterialIcons 
                name="photo-library" 
                size={22} 
                color={activeTab === 'gallery' ? "#FFFFFF" : "#8E8E93"} 
              />
              <Text style={[
                styles.tabText, 
                activeTab === 'gallery' && styles.activeTabText
              ]}>Galería</Text>
            </TouchableOpacity>
            
            {isRestaurant() && (business.menu || business.menuUrl) && (
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'menu' && styles.activeTab]} 
                onPress={() => setActiveTab('menu')}
                activeOpacity={0.8}
              >
                <MaterialIcons 
                  name="restaurant-menu" 
                  size={22} 
                  color={activeTab === 'menu' ? "#FFFFFF" : "#8E8E93"} 
                />
                <Text style={[
                  styles.tabText, 
                  activeTab === 'menu' && styles.activeTabText
                ]}>Menú</Text>
              </TouchableOpacity>
            )}
            
            {business.videos && business.videos.length > 0 && (
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'videos' && styles.activeTab]} 
                onPress={() => setActiveTab('videos')}
                activeOpacity={0.8}
              >
                <MaterialIcons 
                  name="videocam" 
                  size={22} 
                  color={activeTab === 'videos' ? "#FFFFFF" : "#8E8E93"} 
                />
                <Text style={[
                  styles.tabText, 
                  activeTab === 'videos' && styles.activeTabText
                ]}>Videos</Text>
              </TouchableOpacity>
            )}
            
            {/* Nueva pestaña de reseñas */}
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'reseñas' && styles.activeTab]} 
              onPress={() => setActiveTab('reseñas')}
              activeOpacity={0.8}
            >
              <MaterialIcons 
                name="rate-review" 
                size={22} 
                color={activeTab === 'reseñas' ? "#FFFFFF" : "#8E8E93"} 
              />
              <Text style={[
                styles.tabText, 
                activeTab === 'reseñas' && styles.activeTabText
              ]}>Reseñas</Text>
            </TouchableOpacity>
            {/* Indicador animado */}
            <Animated.View style={[
              styles.tabIndicator,
              getTabIndicatorPosition()
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
                  >
                    <View style={[styles.contactIconCircle, {backgroundColor: '#007AFF'}]}>
                      <MaterialIcons name="public" size={20} color="white" />
                    </View>
                    <Text style={[styles.contactText, styles.websiteText]}>{business.website}</Text>
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
          {activeTab === 'menu' && isRestaurant() && (
            <>
              {(business.menu || business.menuUrl) ? (
                <View style={styles.card}>
                  <Text style={styles.cardSectionTitle}>Menú</Text>
                  <MenuViewer menu={business.menu} menuUrl={business.menuUrl} />
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <MaterialIcons name="restaurant-menu" size={48} color="#E5E5EA" />
                  <Text style={styles.emptyCardText}>No hay menú disponible</Text>
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

          {/* Nueva sección de reseñas */}
          {activeTab === 'reseñas' && (
            <View style={{ paddingVertical: 20 }}>
              {/* Lista de reseñas */}
              <ReviewList
                reviews={reviews}
                currentUserId={currentUserId}
                isBusinessOwner={false} // Ajustar según se requiera
                loading={reviewsLoading}
                loadMore={loadMoreReviews}
                hasMore={hasMoreReviews}
                stats={reviewsStats}
                onReply={(reviewId) => { /* Implementar respuesta */ }}
                onReport={(reviewId) => { /* Implementar reporte */ }}
                onEditReview={(review) => { /* Implementar edición */ }}
                onDeleteReview={(reviewId) => { /* Implementar eliminación */ }}
                onFilterChange={filterByRating}
                activeFilter={activeFilter}
                sortBy={sortBy}
                onSortChange={changeSortMethod}
              />
              {/* Botón para agregar reseña */}
              <TouchableOpacity 
                style={styles.addReviewButton}
                onPress={() => setShowReviewForm(true)}
              >
                <Text style={styles.addReviewButtonText}>Agregar Reseña</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Animated.ScrollView>
      
      {/* Botones de acción con animación de entrada */}
      {(business.phone || business.email) && (
        <Animated.View style={[
          styles.actionButtonsContainer,
          { transform: [{ translateY: actionButtonsY }] }
        ]}>
          {business.phone && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleCallBusiness}
              activeOpacity={0.8}
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
        </Animated.View>
      )}

      {/* Modal o renderizado condicional del formulario de reseña */}
      {showReviewForm && (
        // Ejemplo de modal inline; se puede reemplazar por un modal nativo
        <View style={styles.reviewFormContainer}>
          <ReviewForm
            businessId={businessId}
            businessName={business.name}
            userId={currentUserId}
            userName="Usuario Actual" // Reemplazar por nombre real
            onSuccess={(reviewId) => {
              setShowReviewForm(false);
              // Se podría refrescar la lista o notificar al usuario
            }}
            onCancel={() => setShowReviewForm(false)}
          />
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(240,240,245,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
    fontWeight: '500',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 4,
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
    paddingHorizontal: 20,
    borderRadius: 25,
    zIndex: 1,
    flex: 1,
  },
  activeTab: {
    backgroundColor: 'transparent',
  },
  tabText: {
    fontSize: 13,
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
  },
  websiteText: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  noInfoText: {
    fontSize: 16,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  galleryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
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
    borderRadius: 12,
    padding: 16,
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
    marginTop: 8,
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
  addReviewButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 16,
  },
  addReviewButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  reviewFormContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
});

export default BusinessDetailScreen;