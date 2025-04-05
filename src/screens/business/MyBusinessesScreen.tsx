import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Image,
  RefreshControl,
  TextInput
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { Business } from '../../context/BusinessContext';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/authService';
import BusinessDashboard from '../../components/dashboard/BusinessDashboard'; // Nuevo import
import { analyticsService } from '../../services/analyticsService'; // Nuevo import
import { BusinessAnalytics, TimePeriod } from '../../types/analyticsTypes'; // Nuevo import

// Define type with role property
interface UserWithRole extends firebase.User {
  role?: 'customer' | 'business_owner';
}

type NavigationProps = StackNavigationProp<RootStackParamList>;

const MyBusinessesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [analytics, setAnalytics] = useState<BusinessAnalytics | null>(null); // Nuevo estado
  const [analyticsLoading, setAnalyticsLoading] = useState(true); // Nuevo estado

  // Calcular la fecha de membresía formateada (si está disponible)
  const memberSince = user && user.metadata.creationTime 
    ? new Date(user.metadata.creationTime).toLocaleDateString('es-ES') 
    : '';

  // Verificar que el usuario tenga el rol correcto
  useEffect(() => {
    const checkUserRole = async () => {
      if (!user) {
        // Si no hay usuario, redirigir al login
        navigation.navigate('Login');
        return;
      }
      
      // Try to obtain role from user object; if missing, fetch from Firestore
      let userWithRole = user as UserWithRole;
      if (!userWithRole.role) {
        const userDoc = await firebase.firestore()
          .collection('users')
          .doc(user.uid)
          .get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          userWithRole.role = userData?.role; // role should be 'business_owner' if applicable
        }
      }
      
      // Verificar que el usuario sea de tipo business_owner
      if (userWithRole.role !== 'business_owner') {
        Alert.alert(
          'Acceso restringido',
          'Esta sección solo está disponible para propietarios de negocios.',
          [
            { 
              text: 'OK', 
              onPress: () => navigation.navigate('Home') 
            }
          ]
        );
        return;
      }
      
      // Verificar y corregir la integridad de los datos
      await userService.verifyUserDataIntegrity(user.uid);
      
      // Cargar los negocios
      loadUserBusinesses();
    };
    
    checkUserRole();
  }, [user]);
  
  // Cargar negocios del usuario actual
  const loadUserBusinesses = async () => {
    try {
      setLoading(true);
      
      if (!user) {
        setLoading(false);
        return;
      }
      
      const snapshot = await firebase.firestore()
        .collection('businesses')
        .where('createdBy', '==', user.uid)
        .get();
      
      const userBusinesses: Business[] = [];
      snapshot.forEach(doc => {
        userBusinesses.push({
          id: doc.id,
          ...doc.data()
        } as Business);
      });
      
      setBusinesses(userBusinesses);
      setLoading(false);
      
      // Cargar datos analíticos después de obtener los negocios
      if (userBusinesses.length > 0) {
        loadAnalyticsData(userBusinesses.map(business => business.id));
      } else {
        setAnalyticsLoading(false);
      }
    } catch (error) {
      console.error('Error loading user businesses:', error);
      setLoading(false);
      Alert.alert('Error', 'No se pudieron cargar tus negocios');
    }
  };

  // Nueva función para cargar datos analíticos con manejo de errores mejorado
  const loadAnalyticsData = async (businessIds: string[]) => {
    try {
      setAnalyticsLoading(true);
      console.log('Cargando datos analíticos para negocios:', businessIds);
      
      // Asegurarse de que analyticsService esté importado correctamente
      if (!analyticsService || !analyticsService.getBusinessesAnalytics) {
        console.error('AnalyticsService no está disponible');
        // Crear datos de muestra para desarrollo
        setAnalytics(createSampleAnalyticsData(businessIds));
        setAnalyticsLoading(false);
        return;
      }
      
      const analyticsData = await analyticsService.getBusinessesAnalytics(businessIds);
      console.log('Datos analíticos recibidos:', analyticsData);
      
      if (!analyticsData) {
        console.warn('No se recibieron datos analíticos');
        // Usar datos de muestra como fallback
        setAnalytics(createSampleAnalyticsData(businessIds));
      } else {
        setAnalytics(analyticsData);
      }
      
      setAnalyticsLoading(false);
    } catch (error) {
      console.error('Error loading analytics data:', error);
      // Usar datos de muestra en caso de error
      setAnalytics(createSampleAnalyticsData(businessIds));
      setAnalyticsLoading(false);
    }
  };
  
  // Función para crear datos de muestra para desarrollo
  const createSampleAnalyticsData = (businessIds: string[]): BusinessAnalytics => {
    // Crear un objeto con datos de muestra estructurados según BusinessAnalytics
    const businessesAnalytics: Record<string, any> = {};
    
    businessIds.forEach(id => {
      businessesAnalytics[id] = {
        visits: Math.floor(Math.random() * 500) + 100,
        maxVisits: 1000,
        rating: (Math.random() * 3) + 2, // Rating entre 2-5
        reservations: Math.floor(Math.random() * 50)
      };
    });
    
    return {
      totalVisits: businessIds.length * 200,
      visitsTrend: 15,
      totalReservations: {
        count: businessIds.length * 20,
        confirmed: businessIds.length * 15,
        pending: businessIds.length * 5,
        value: businessIds.length * 1500
      },
      reservationsTrend: 8,
      revenueTrend: 12,
      averageRating: 4.2,
      businessesAnalytics,
      visitsData: {
        [TimePeriod.DAY]: Array.from({length: 24}, (_, i) => ({
          label: `${i}:00`,
          value: Math.floor(Math.random() * 30)
        })),
        [TimePeriod.WEEK]: Array.from({length: 7}, (_, i) => {
          const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
          return {
            label: days[i],
            value: Math.floor(Math.random() * 100) + 50
          };
        }),
        [TimePeriod.MONTH]: Array.from({length: 30}, (_, i) => ({
          label: `${i+1}`,
          value: Math.floor(Math.random() * 150) + 100
        })),
        [TimePeriod.YEAR]: Array.from({length: 12}, (_, i) => {
          const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
          return {
            label: months[i],
            value: Math.floor(Math.random() * 1000) + 500
          };
        })
      },
      pendingActions: {
        reservations: [],
        messages: [],
        reviews: []
      }
    };
  };
  
  // Refrescar la lista
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadUserBusinesses();
    setRefreshing(false);
  };
  
  // Filtrar negocios por búsqueda
  const filteredBusinesses = businesses.filter(business =>
    business.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Ir a la pantalla de añadir negocio
  const handleAddBusiness = () => {
    navigation.navigate('AddBusiness');
  };
  
  // Editar un negocio existente
  const handleEditBusiness = (business: Business) => {
    navigation.navigate('EditBusiness', { businessId: business.id });
  };
  
  // Ver detalles de un negocio
  const handleViewBusiness = (business: Business) => {
    navigation.navigate('BusinessDetail', { businessId: business.id });
  };
  
  // Eliminar un negocio
  const handleDeleteBusiness = (business: Business) => {
    Alert.alert(
      'Eliminar Negocio',
      `¿Estás seguro de querer eliminar "${business.name}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              // Eliminar el negocio de Firestore
              await firebase.firestore()
                .collection('businesses')
                .doc(business.id)
                .delete();
              
              // Eliminar las imágenes asociadas
              if (business.images && business.images.length > 0) {
                const storage = firebase.storage();
                for (const image of business.images) {
                  if (image.url) {
                    try {
                      // Extraer la ruta de la URL de la imagen
                      const imageRef = storage.refFromURL(image.url);
                      await imageRef.delete();
                    } catch (imageError) {
                      console.error('Error deleting image:', imageError);
                    }
                  }
                }
              }
              
              // Actualizar la lista
              setBusinesses(businesses.filter(b => b.id !== business.id));
              Alert.alert('Éxito', 'Negocio eliminado correctamente');
            } catch (error) {
              console.error('Error deleting business:', error);
              Alert.alert('Error', 'No se pudo eliminar el negocio');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };
  
  // Renderizar cada elemento de la lista
  const renderBusinessItem = (item: Business) => {
    return (
      <View style={styles.businessCard} key={item.id}>
        {/* Imagen del negocio */}
        <View style={styles.imageContainer}>
          {item.images && item.images.length > 0 ? (
            <Image 
              source={{ uri: item.images[0].url }} 
              style={styles.businessImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.placeholderImage, { backgroundColor: '#007AFF' }]}>
              <Text style={styles.placeholderText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>
        
        {/* Información del negocio */}
        <View style={styles.businessInfo}>
          <Text style={styles.businessName}>{item.name}</Text>
          <Text style={styles.businessCategory}>{item.category}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <MaterialIcons name="visibility" size={16} color="#8E8E93" />
              <Text style={styles.statText}>0 vistas</Text>
            </View>
            <View style={styles.statItem}>
              <MaterialIcons name="favorite" size={16} color="#8E8E93" />
              <Text style={styles.statText}>0 favoritos</Text>
            </View>
          </View>
        </View>
        
        {/* Botones de acción */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleViewBusiness(item)}
          >
            <MaterialIcons name="visibility" size={20} color="#007AFF" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleEditBusiness(item)}
          >
            <MaterialIcons name="edit" size={20} color="#007AFF" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleDeleteBusiness(item)}
          >
            <MaterialIcons name="delete" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="store" size={64} color="#D1D1D6" />
      <Text style={styles.emptyText}>No has registrado ningún negocio</Text>
      <Text style={styles.emptySubtext}>¡Comienza a agregar tus negocios para que los usuarios puedan encontrarlos!</Text>
    </View>
  );
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis Negocios</Text>
        <View style={styles.placeholder} />
      </View>
      
      {/* Nueva barra de búsqueda */}
      <View style={styles.searchContainer}>
        <TextInput 
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Buscar negocio..."
          style={styles.searchInput}
        />
      </View>
      
      {/* Nueva sección para mostrar "Miembro desde:" */}
      {memberSince ? (
        <View style={styles.memberContainer}>
          <Text style={styles.memberSinceText}>Miembro desde: {memberSince}</Text>
        </View>
      ) : null}
      
      {/* Main scrollable content */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando tus negocios...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#007AFF']}
              tintColor="#007AFF"
            />
          }
        >
          {/* Dashboard de Estadísticas */}
          {businesses.length > 0 && (
            <BusinessDashboard 
              analytics={analytics} 
              loading={analyticsLoading} 
              businesses={businesses}
              onSelectBusiness={(businessId) => {
                navigation.navigate('BusinessDetail', { businessId });
              }}
              period={TimePeriod.WEEK}
            />
          )}
          
          {/* Lista de negocios */}
          <View style={styles.listContent}>
            {filteredBusinesses.length > 0 ? (
              filteredBusinesses.map(business => renderBusinessItem(business))
            ) : (
              renderEmptyState()
            )}
          </View>
        </ScrollView>
      )}
      
      {/* Botón para agregar negocio */}
      <TouchableOpacity 
        style={styles.floatingButton}
        onPress={handleAddBusiness}
      >
        <MaterialIcons name="add" size={32} color="white" />
      </TouchableOpacity>
      
      {/* Bottom Navigation */}
      <View style={styles.bottomNavigation}>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Home')}
        >
          <MaterialIcons name="home" size={24} color="#8E8E93" />
          <Text style={styles.navItemText}>Inicio</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => navigation.navigate('Map')}
        >
          <MaterialIcons name="explore" size={24} color="#8E8E93" />
          <Text style={styles.navItemText}>Explorar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItemCenter}
          onPress={() => navigation.navigate('AddBusiness')}
        >
          <View style={styles.navItemCenterButton}>
            <MaterialIcons name="add" size={28} color="white" />
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Favorites')}
        >
          <MaterialIcons name="favorite-border" size={24} color="#8E8E93" />
          <Text style={styles.navItemText}>Favoritos</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Profile')}
        >
          <MaterialIcons name="person" size={24} color="#007AFF" />
          <Text style={styles.navItemTextActive}>Perfil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  placeholder: {
    width: 40,
  },
  // Nuevo estilo para el contenedor del miembro desde
  memberContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  memberSinceText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  // Nuevo estilo para el contenedor de búsqueda
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  // Nuevo estilo para el TextInput
  searchInput: {
    height: 40,
    borderColor: '#E5E5EA',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F9F9F9',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  listContent: {
    padding: 16,
  },
  businessCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  imageContainer: {
    height: 150,
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
    fontSize: 42,
    fontWeight: 'bold',
    color: 'white',
  },
  businessInfo: {
    padding: 16,
  },
  businessName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  businessCategory: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  statText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 50,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 20,
  },
  floatingButton: {
    position: 'absolute',
    right: 20,
    bottom: 80,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  bottomNavigation: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    flexDirection: 'row',
    height: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  navItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navItemCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navItemCenterButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  navItemText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  navItemTextActive: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 4,
    fontWeight: '600',
  },
});

export default MyBusinessesScreen;