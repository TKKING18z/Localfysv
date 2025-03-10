import React, { useEffect, useState } from 'react';
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
  Platform
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useBusinesses, Business } from '../context/BusinessContext';
import { useLocation } from '../hooks/useLocation';

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

  // Handle toggling favorite
  const handleFavoriteToggle = () => {
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

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando negocio...</Text>
      </SafeAreaView>
    );
  }

  // Error state
  if (loadingError || !business) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={64} color="#FF3B30" />
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Business Image Header */}
        <View style={styles.imageContainer}>
          {businessImage ? (
            <Image 
              source={{ uri: businessImage }} 
              style={styles.businessImage}
              contentFit="cover"
              transition={300}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.placeholderImage, { backgroundColor: getPlaceholderColor() }]}>
              <Text style={styles.placeholderText}>{business.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          
          {/* Header Buttons */}
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => navigation.goBack()}
            >
              <MaterialIcons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={handleFavoriteToggle}
            >
              <MaterialIcons 
                name={isFav ? "favorite" : "favorite-border"} 
                size={24} 
                color="white" 
              />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Business Details */}
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
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Descripción</Text>
            <Text style={styles.description}>{business.description || "No hay descripción disponible."}</Text>
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Información de contacto</Text>
            {business.phone && (
              <View style={styles.contactItem}>
                <MaterialIcons name="phone" size={20} color="#007AFF" />
                <Text style={styles.contactText}>{business.phone}</Text>
              </View>
            )}
            {business.email && (
              <View style={styles.contactItem}>
                <MaterialIcons name="email" size={20} color="#007AFF" />
                <Text style={styles.contactText}>{business.email}</Text>
              </View>
            )}
            {business.address && (
              <View style={styles.contactItem}>
                <MaterialIcons name="place" size={20} color="#007AFF" />
                <Text style={styles.contactText}>{business.address}</Text>
              </View>
            )}
            {!business.phone && !business.email && !business.address && (
              <Text style={styles.noInfoText}>No hay información de contacto disponible</Text>
            )}
          </View>
        </View>
      </ScrollView>
      
      {/* Contact Buttons */}
      {(business.phone || business.email) && (
        <View style={styles.actionButtonsContainer}>
          {business.phone && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleCallBusiness}
            >
              <MaterialIcons name="phone" size={24} color="white" />
              <Text style={styles.actionButtonText}>Llamar</Text>
            </TouchableOpacity>
          )}
          {business.email && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleEmailBusiness}
            >
              <MaterialIcons name="email" size={24} color="white" />
              <Text style={styles.actionButtonText}>Correo</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  errorText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  imageContainer: {
    height: 250,
    position: 'relative',
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
    top: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    padding: 20,
  },
  businessName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 10,
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
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
    marginBottom: 12,
  },
  contactText: {
    fontSize: 16,
    color: '#333333',
    marginLeft: 12,
  },
  noInfoText: {
    fontSize: 16,
    color: '#8E8E93',
    fontStyle: 'italic',
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
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 10,
    marginHorizontal: 8,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default BusinessDetailScreen;