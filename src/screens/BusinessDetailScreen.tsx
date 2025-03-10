import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useBusinesses, Business } from '../context/BusinessContext';

type BusinessDetailRouteProp = RouteProp<RootStackParamList, 'BusinessDetail'>;
type NavigationProps = StackNavigationProp<RootStackParamList>;

const BusinessDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<BusinessDetailRouteProp>();
  const { businessId } = route.params;
  const { getBusinessById, toggleFavorite, isFavorite } = useBusinesses();
  
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBusiness = async () => {
      try {
        const fetchedBusiness = await getBusinessById(businessId);
        setBusiness(fetchedBusiness);
      } catch (error) {
        console.error('Error fetching business details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBusiness();
  }, [businessId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  if (!business) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>No se pudo cargar el negocio</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Get the main image or first available image
  const mainImage = business.images && business.images.length > 0 
    ? business.images.find(img => img.isMain)?.url || business.images[0].url
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <ScrollView>
        {/* Business Image Header */}
        <View style={styles.imageContainer}>
          {mainImage ? (
            <Image source={{ uri: mainImage }} style={styles.businessImage} />
          ) : (
            <View style={styles.placeholderImage}>
              <MaterialIcons name="store" size={48} color="#CCCCCC" />
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
              onPress={() => toggleFavorite(business.id)}
            >
              <MaterialIcons 
                name={isFavorite(business.id) ? "favorite" : "favorite-border"} 
                size={24} 
                color="white" 
              />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Business Details */}
        <View style={styles.detailsContainer}>
          <Text style={styles.businessName}>{business.name}</Text>
          <View style={styles.tagContainer}>
            <Text style={styles.categoryTag}>{business.category}</Text>
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
          </View>
        </View>
      </ScrollView>
      
      {/* Contact Buttons */}
      <View style={styles.actionButtonsContainer}>
        {business.phone && (
          <TouchableOpacity style={styles.actionButton}>
            <MaterialIcons name="phone" size={24} color="white" />
            <Text style={styles.actionButtonText}>Llamar</Text>
          </TouchableOpacity>
        )}
        {business.email && (
          <TouchableOpacity style={styles.actionButton}>
            <MaterialIcons name="email" size={24} color="white" />
            <Text style={styles.actionButtonText}>Correo</Text>
          </TouchableOpacity>
        )}
      </View>
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
    marginBottom: 20,
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
    resizeMode: 'cover',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0F0F5',
    justifyContent: 'center',
    alignItems: 'center',
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
  tagContainer: {
    flexDirection: 'row',
    marginBottom: 20,
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
