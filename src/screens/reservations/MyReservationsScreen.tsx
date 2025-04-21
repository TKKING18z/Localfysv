import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, RouteProp, useRoute, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../context/AuthContext';
import { useReservations, ReservationFilter } from '../../../hooks/useReservations';
import ReservationCard from '../../components/reservations/ReservationCard';
import ReservationDetailModal from '../../components/reservations/ReservationDetailModal';
import { Reservation } from '../../../models/reservationTypes';
import { LinearGradient } from 'expo-linear-gradient';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

type MyReservationsRouteProp = RouteProp<RootStackParamList, 'MyReservations'>;
type NavigationProps = StackNavigationProp<RootStackParamList>;

interface FilterOption {
  id: ReservationFilter;
  label: string;
  icon: string;
}

const MyReservationsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<MyReservationsRouteProp>();
  const { user } = useAuth();
  const [isBusinessView, setIsBusinessView] = useState(route.params?.isBusinessView || false);
  const [businessName, setBusinessName] = useState<string>('');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<ReservationFilter>(ReservationFilter.ACTIVE);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());

  // Si hay un businessId específico en los params, lo usamos
  const businessId = route.params?.businessId;

  // Fetch business name if we have a business ID
  useEffect(() => {
    const fetchBusinessName = async () => {
      if (businessId) {
        try {
          const businessDoc = await firebase.firestore()
            .collection('businesses')
            .doc(businessId)
            .get();
          
          if (businessDoc.exists) {
            const business = businessDoc.data();
            if (business && business.name) {
              setBusinessName(business.name);
            }
          }
        } catch (error) {
          console.error('[MyReservationsScreen] Error fetching business name:', error);
        }
      }
    };
    
    fetchBusinessName();
  }, [businessId]);

  // Hook para manejar reservaciones
  const {
    reservations,
    loading,
    error,
    refreshing,
    filter,
    setFilter,
    refresh,
    cancelReservation,
    confirmReservation,
    completeReservation,
    lastLoaded
  } = useReservations({
    userId: isBusinessView ? undefined : user?.uid,
    businessId: isBusinessView ? (businessId || user?.uid) : undefined,
    initialFilter: ReservationFilter.ACTIVE
  });

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('[MyReservationsScreen] Screen focused, refreshing data');
      if (!refreshing && !loading) {
        refresh();
      }
      return () => {
        // Cleanup if needed
      };
    }, [refresh, refreshing, loading])
  );

  // Also refresh when user changes
  useEffect(() => {
    if (user?.uid) {
      console.log('[MyReservationsScreen] User changed, refreshing data');
      refresh();
    }
  }, [user?.uid, refresh]);

  // Refresh when isBusinessView changes
  useEffect(() => {
    console.log('[MyReservationsScreen] Business view changed to:', isBusinessView);
    refresh();
  }, [isBusinessView, refresh]);

  // Filtros disponibles
  const filterOptions: FilterOption[] = [
    { id: ReservationFilter.ACTIVE, label: 'Activas', icon: 'event-available' },
    { id: ReservationFilter.PENDING, label: 'Pendientes', icon: 'hourglass-empty' },
    { id: ReservationFilter.CONFIRMED, label: 'Confirmadas', icon: 'check-circle' },
    { id: ReservationFilter.COMPLETED, label: 'Completadas', icon: 'done-all' },
    { id: ReservationFilter.CANCELED, label: 'Canceladas', icon: 'cancel' },
  ];

  // Manejador para cambiar filtro
  const handleFilterChange = useCallback((newFilter: ReservationFilter) => {
    console.log('[MyReservationsScreen] Changing filter to:', newFilter);
    setActiveFilterTab(newFilter);
    setFilter(newFilter);
  }, [setFilter]);

  // Manejador para abrir detalle de reserva
  const handleOpenReservation = useCallback((reservation: Reservation) => {
    setSelectedReservation(reservation);
    setShowDetailModal(true);
  }, []);

  // Manual refresh handler
  const handleManualRefresh = useCallback(() => {
    console.log('[MyReservationsScreen] Manual refresh triggered');
    refresh();
    setLastRefreshTime(new Date());
  }, [refresh]);

  // Handle change business (navigate back to business list or choose a different view)
  const handleChangeBusiness = useCallback(() => {
    if (isBusinessView && businessId) {
      // If we're in business view and have a businessId, go back to business list
      navigation.navigate('MyBusinesses');
    } else {
      // Otherwise toggle between personal/business view
      setIsBusinessView(!isBusinessView);
    }
  }, [navigation, isBusinessView, businessId]);

  // Manejador para cancelar reserva
  const handleCancelReservation = useCallback(async (reservationId: string) => {
    Alert.alert(
      'Cancelar Reserva',
      '¿Estás seguro de que deseas cancelar esta reserva?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await cancelReservation(reservationId);
              if (success) {
                Alert.alert('Éxito', 'La reserva ha sido cancelada correctamente');
                // Refrescar datos
                refresh();
              } else {
                throw new Error('No se pudo cancelar la reserva');
              }
            } catch (error) {
              console.error('Error al cancelar reserva:', error);
              Alert.alert('Error', 'No se pudo cancelar la reserva. Inténtalo de nuevo más tarde.');
            }
          }
        }
      ]
    );
  }, [cancelReservation, refresh]);

  // Renderizar cada tarjeta de reserva
  const renderReservationCard = useCallback(({ item }: { item: Reservation }) => (
    <ReservationCard
      reservation={item}
      onPress={handleOpenReservation}
      onCancelReservation={handleCancelReservation}
      isBusinessView={isBusinessView}
    />
  ), [handleOpenReservation, handleCancelReservation, isBusinessView]);

  // Renderizar filtros en forma de pestañas
  const renderFilterTabs = () => (
    <View style={styles.filterTabsContainer}>
      <ScrollableFilterTabs
        options={filterOptions}
        activeFilter={activeFilterTab}
        onSelectFilter={handleFilterChange}
      />
    </View>
  );

  // Componente para las pestañas de filtro horizontales
  const ScrollableFilterTabs = ({ 
    options, 
    activeFilter, 
    onSelectFilter 
  }: { 
    options: FilterOption[], 
    activeFilter: ReservationFilter, 
    onSelectFilter: (filter: ReservationFilter) => void 
  }) => (
    <FlatList
      horizontal
      data={options}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[
            styles.filterTab,
            activeFilter === item.id && styles.activeFilterTab
          ]}
          onPress={() => onSelectFilter(item.id)}
        >
          <MaterialIcons
            name={item.icon as any}
            size={18}
            color={activeFilter === item.id ? '#FFFFFF' : '#007AFF'}
          />
          <Text
            style={[
              styles.filterTabText,
              activeFilter === item.id && styles.activeFilterTabText
            ]}
          >
            {item.label}
          </Text>
        </TouchableOpacity>
      )}
      keyExtractor={item => item.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterTabsScrollContent}
    />
  );

  // Renderizar el contenido vacío
  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="event-busy" size={80} color="#DDDDDD" />
      <Text style={styles.emptyTitle}>No hay reservaciones</Text>
      <Text style={styles.emptySubtitle}>
        {filter === ReservationFilter.ACTIVE 
          ? 'No tienes reservaciones activas en este momento'
          : filter === ReservationFilter.PENDING
          ? 'No hay reservaciones pendientes'
          : filter === ReservationFilter.CONFIRMED
          ? 'No hay reservaciones confirmadas'
          : filter === ReservationFilter.COMPLETED
          ? 'No has completado ninguna reservación todavía'
          : 'No hay reservaciones canceladas'}
      </Text>
      
      <TouchableOpacity
        style={styles.retryButton}
        onPress={refresh}
      >
        <Text style={styles.retryButtonText}>Actualizar</Text>
      </TouchableOpacity>
      
      {!isBusinessView && (
        <TouchableOpacity
          style={styles.exploreButton}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
        >
          <LinearGradient
            colors={['#007AFF', '#0055FF']}
            style={styles.exploreButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <MaterialIcons name="search" size={18} color="white" />
            <Text style={styles.exploreButtonText}>Explorar Negocios</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );

  // Last refresh indicator
  const renderLastRefreshInfo = () => {
    if (!lastLoaded) return null;
    
    const date = new Date(lastLoaded);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    return (
      <View style={styles.lastRefreshContainer}>
        <Text style={styles.lastRefreshText}>
          Última actualización: {hours}:{minutes}:{seconds}
        </Text>
      </View>
    );
  };

  // Generate title based on view mode and business name
  const getScreenTitle = () => {
    if (isBusinessView) {
      if (businessName) {
        return `Reservaciones: ${businessName}`;
      }
      return 'Reservaciones de Negocio';
    }
    return 'Mis Reservaciones';
  };

  // Debug info for development
  const renderDebugInfo = () => {
    if (process.env.NODE_ENV !== 'development') return null;
    
    return (
      <View style={styles.debugContainer}>
        <Text style={styles.debugText}>
          userId: {user?.uid ? user.uid.substring(0, 8) + '...' : 'none'}{'\n'}
          businessId: {businessId ? businessId.substring(0, 8) + '...' : 'none'}{'\n'}
          businessName: {businessName || 'N/A'}{'\n'}
          isBusinessView: {isBusinessView ? 'true' : 'false'}{'\n'}
          filter: {filter}{'\n'}
          count: {reservations.length}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {getScreenTitle()}
        </Text>
        <View style={styles.headerButtonsContainer}>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={handleManualRefresh}
            disabled={refreshing || loading}
          >
            <MaterialIcons 
              name="refresh" 
              size={24} 
              color="#007AFF" 
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.switchViewButton}
            onPress={handleChangeBusiness}
          >
            <MaterialIcons 
              name={isBusinessView ? (businessId ? "business" : "person") : "store"} 
              size={24} 
              color="#007AFF" 
            />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Filter tabs */}
      {renderFilterTabs()}
      
      {/* Last refresh indicator */}
      {renderLastRefreshInfo()}
      
      {/* Debug info in development */}
      {renderDebugInfo()}
      
      {/* Main content */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando reservaciones...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color="#FF3B30" />
          <Text style={styles.errorTitle}>¡Oops! Algo salió mal</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={refresh}
          >
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={reservations}
          renderItem={renderReservationCard}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.reservationsList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyComponent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              colors={['#007AFF']}
              tintColor="#007AFF"
            />
          }
        />
      )}
      
      {/* Reservation Detail Modal */}
      <ReservationDetailModal
        reservation={selectedReservation}
        visible={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedReservation(null);
        }}
        onCancelReservation={cancelReservation}
        onConfirmReservation={isBusinessView ? confirmReservation : undefined}
        onCompleteReservation={isBusinessView ? completeReservation : undefined}
        isBusinessView={isBusinessView}
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    textAlign: 'center',
  },
  headerButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshButton: {
    padding: 8,
    marginRight: 8,
  },
  switchViewButton: {
    padding: 8,
  },
  lastRefreshContainer: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingVertical: 4,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  lastRefreshText: {
    fontSize: 12,
    color: '#666666',
  },
  debugContainer: {
    backgroundColor: '#FFE8E6',
    padding: 8,
    margin: 8,
    borderRadius: 4,
  },
  debugText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#333333',
  },
  filterTabsContainer: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 8,
  },
  filterTabsScrollContent: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 6,
    backgroundColor: 'rgba(0,122,255,0.1)',
  },
  activeFilterTab: {
    backgroundColor: '#007AFF',
  },
  filterTabText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  activeFilterTabText: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 16,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666666',
    marginTop: 8,
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 16,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  reservationsList: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666666',
    marginTop: 8,
    marginBottom: 24,
    textAlign: 'center',
  },
  exploreButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  exploreButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  exploreButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
});

export default MyReservationsScreen; 