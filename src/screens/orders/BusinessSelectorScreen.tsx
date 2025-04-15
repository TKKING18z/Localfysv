import React, { useEffect, useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import firebase from '../../../firebase.config';
import BannerAd from '../../components/ads/BannerAd';

type BusinessSelectorNavigationProp = StackNavigationProp<RootStackParamList, 'BusinessSelector'>;

type Business = {
  id: string;
  name: string;
  ownerId: string;
};

// Modern color palette
const COLORS = {
  primary: '#3498db',          // Modern blue
  secondary: '#2ecc71',        // Emerald green
  background: '#f8f9fa',       // Light background
  card: '#ffffff',             // White card
  text: '#2c3e50',             // Dark blue-gray for text
  textSecondary: '#7f8c8d',    // Lighter text color
  border: '#ecf0f1',           // Very light gray for borders
  accent: '#e74c3c',           // Red for errors/important actions
  iconBg: '#e3f2fd',           // Light blue for icon backgrounds
};

const BusinessSelectorScreen: React.FC = () => {
  const navigation = useNavigation<BusinessSelectorNavigationProp>();
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hide the default React Navigation header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false // This will hide the default header
    });
  }, [navigation]);

  useEffect(() => {
    loadUserBusinesses();
  }, []);

  const loadUserBusinesses = async () => {
    if (!user?.uid) {
      setError('Usuario no autenticado');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const db = firebase.firestore();
      const businessesRef = collection(db, 'businesses');
      
      // Query businesses where the current user is the owner
      const q = query(businessesRef, where('ownerId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setBusinesses([]);
      } else {
        const businessList: Business[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          businessList.push({
            id: doc.id,
            name: data.name || 'Negocio sin nombre',
            ownerId: data.ownerId,
          });
        });
        setBusinesses(businessList);
      }
    } catch (err) {
      console.error('Error cargando negocios:', err);
      setError('Error al cargar tus negocios');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBusiness = (business: Business) => {
    navigation.navigate('BusinessOrders', {
      businessId: business.id,
      businessName: business.name
    });
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const renderBusinessItem = ({ item }: { item: Business }) => (
    <TouchableOpacity 
      style={styles.businessCard}
      onPress={() => handleSelectBusiness(item)}
      activeOpacity={0.7}
    >
      <View style={styles.businessContent}>
        <View style={styles.businessIcon}>
          <MaterialIcons name="store" size={24} color={COLORS.primary} />
        </View>
        <View style={styles.businessInfo}>
          <Text style={styles.businessName}>{item.name}</Text>
          <Text style={styles.businessId}>ID: {item.id.substring(0, 8)}...</Text>
        </View>
      </View>
      <View style={styles.actionContainer}>
        <Text style={styles.actionText}>Ver pedidos</Text>
        <MaterialIcons name="arrow-forward-ios" size={16} color={COLORS.primary} />
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.listHeader}>
      <Text style={styles.listHeaderTitle}>Tus Negocios</Text>
      <Text style={styles.listHeaderSubtitle}>
        Selecciona un negocio para ver sus pedidos
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back-ios" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mis Negocios</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Cargando tus negocios...</Text>
        </View>

        {/* Banner de anuncios */}
        <BannerAd />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back-ios" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mis Negocios</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color={COLORS.accent} />
          <Text style={styles.errorTitle}>No pudimos cargar tus negocios</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadUserBusinesses}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>

        {/* Banner de anuncios */}
        <BannerAd />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back-ios" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis Negocios</Text>
        <TouchableOpacity onPress={loadUserBusinesses} style={styles.refreshButton}>
          <MaterialIcons name="refresh" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      
      {businesses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="storefront" size={72} color="#e0e0e0" />
          <Text style={styles.emptyTitle}>No tienes negocios registrados</Text>
          <Text style={styles.emptyText}>
            No se encontraron negocios asociados a tu cuenta.
          </Text>
        </View>
      ) : (
        <FlatList
          data={businesses}
          renderItem={renderBusinessItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
        />
      )}

      {/* Banner de anuncios */}
      <BannerAd />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  listHeader: {
    marginTop: 16,
    marginBottom: 16,
  },
  listHeaderTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  listHeaderSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  businessCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    marginBottom: 16,
    padding: 18,
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  businessContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  businessIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.iconBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  businessId: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    justifyContent: 'flex-end',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
    marginRight: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

export default BusinessSelectorScreen; 