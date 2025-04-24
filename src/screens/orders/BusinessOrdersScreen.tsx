import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useOrders, OrderSummary, OrderStatus } from '../../context/OrderContext';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ScrollView } from 'react-native-gesture-handler';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import firebase from '../../../firebase.config';
import MapView, { Marker } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';

type BusinessOrdersScreenRouteProp = RouteProp<RootStackParamList, 'BusinessOrders'>;
type BusinessOrdersScreenNavigationProp = StackNavigationProp<RootStackParamList, 'BusinessOrders'>;

type StatusFilter = OrderStatus | 'all';

// Extender el tipo OrderSummary para incluir el nombre de usuario si está disponible
type ExtendedOrderSummary = OrderSummary & {
  userName?: string;
  deliveryAddress?: string | any; // Dirección de entrega
  notes?: string; // Notas del cliente
  location?: {
    latitude: number;
    longitude: number;
  }; // Ubicación del usuario
};

// Update color constants for a more cohesive and aesthetic color scheme
const COLORS = {
  primary: '#3498db',          // Modern blue - primary actions
  secondary: '#2ecc71',        // Emerald green - secondary actions
  location: '#16a085',         // Green-blue - location button
  warning: '#f39c12',          // Amber - preparation state
  danger: '#e74c3c',           // Red - cancellation
  info: '#3498db',             // Blue - information 
  muted: '#95a5a6',            // Gray - inactive states
  text: '#2c3e50',             // Dark blue-gray for text
  // Status colors
  created: '#3498db',          // Blue for created orders
  paid: '#1abc9c',             // Teal for paid orders
  preparing: '#f39c12',        // Amber for orders in preparation
  inTransit: '#e67e22',        // Orange for orders in transit
  delivered: '#2ecc71',        // Green for delivered orders
  canceled: '#95a5a6',         // Gray for canceled orders
  refunded: '#e74c3c',         // Red for refunded orders
};

// Update the getStatusColor function to use the new color palette
const getStatusColor = (status: OrderStatus) => {
  switch (status) {
    case 'created': return COLORS.created;
    case 'paid': return COLORS.paid;
    case 'preparing': return COLORS.preparing;
    case 'in_transit': return COLORS.inTransit;
    case 'delivered': return COLORS.delivered;
    case 'canceled': return COLORS.canceled;
    case 'refunded': return COLORS.refunded;
    default: return COLORS.muted;
  }
};

const BusinessOrdersScreen: React.FC = () => {
  const navigation = useNavigation<BusinessOrdersScreenNavigationProp>();
  const route = useRoute<BusinessOrdersScreenRouteProp>();
  const { businessId, businessName } = route.params;
  const { businessOrders, loadBusinessOrders, updateOrderStatus, cancelOrder, isLoading, error } = useOrders();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredOrders, setFilteredOrders] = useState<ExtendedOrderSummary[]>([]);
  const [allOrders, setAllOrders] = useState<ExtendedOrderSummary[]>([]); // Store all orders
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ExtendedOrderSummary | null>(null);
  
  // Hide the React Navigation header when this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({
        headerShown: false
      });
    }, [navigation])
  );
  
  // Load orders on component mount
  useEffect(() => {
    loadOrders();
  }, [businessId]);
  
  // Modify the useEffect that listens to Firestore changes
  useEffect(() => {
    if (!businessId) return;
    
    const db = firebase.firestore();
    const ordersRef = collection(db, 'orders');
    
    // Usa esta consulta que coincide con tu índice exacto
    const q = query(
      ordersRef,
      where('businessId', '==', businessId),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`Pedidos encontrados: ${snapshot.docs.length}`);
      
      if (!snapshot.empty) {
        const orders = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            orderNumber: data.orderNumber,
            businessName: data.businessName,
            status: data.status,
            total: data.total,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            itemCount: data.items?.length || 0,
            userName: data.userName,
            deliveryAddress: data.address, // Agregar dirección
            notes: data.notes, // Agregar notas
            location: data.location, // Agregar ubicación
          };
        });
        
        setAllOrders(orders); // Store all orders
        filterOrdersWithStatus(orders, statusFilter, searchQuery); // Apply current filters
      } else {
        setAllOrders([]);
        setFilteredOrders([]);
      }
    }, (error) => {
      console.error('Error escuchando pedidos:', error);
    });
    
    return () => unsubscribe();
  }, [businessId]);
  
  // Add a separate function to filter orders based on status and search query
  const filterOrdersWithStatus = (orders: ExtendedOrderSummary[], status: StatusFilter, query: string) => {
    let filtered = [...orders];
    
    // Filter by status if a specific status is selected
    if (status !== 'all') {
      filtered = filtered.filter(order => order.status === status);
    }
    
    // Filter by search query (search in order number)
    if (query.trim()) {
      const searchTerm = query.toLowerCase().trim();
      filtered = filtered.filter(
        order => order.orderNumber.toLowerCase().includes(searchTerm)
      );
    }
    
    setFilteredOrders(filtered);
  };
  
  // Adjust the filter effect to use the new function
  useEffect(() => {
    filterOrdersWithStatus(allOrders, statusFilter, searchQuery);
  }, [statusFilter, searchQuery]);
  
  // Modify the loadOrders function
  const loadOrders = async () => {
    setRefreshing(true);
    await loadBusinessOrders(businessId);
    setRefreshing(false);
  };
  
  // Modify the filter handler
  const handleFilterChange = (filter: StatusFilter) => {
    setStatusFilter(filter);
    filterOrdersWithStatus(allOrders, filter, searchQuery);
  };
  
  const handleBack = () => {
    navigation.goBack();
  };
  
  const handleViewOrderDetails = (orderId: string) => {
    navigation.navigate('OrderDetails', { orderId });
  };
  
  const handleUpdateStatus = (orderId: string, currentStatus: OrderStatus) => {
    const nextStatus = getNextStatus(currentStatus);
    if (!nextStatus) return;
    
    Alert.alert(
      'Actualizar estado',
      `¿Cambiar estado de "${getStatusText(currentStatus)}" a "${getStatusText(nextStatus)}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Actualizar', 
          onPress: async () => {
            setRefreshing(true);
            const success = await updateOrderStatus(orderId, nextStatus);
            
            // If order was successfully updated, update analytics data if it's now paid
            if (success && nextStatus === 'paid') {
              try {
                const db = firebase.firestore();
                // Get the order document to access its total
                const orderDoc = await db.collection('orders').doc(orderId).get();
                if (orderDoc.exists) {
                  const orderData = orderDoc.data();
                  const orderTotal = orderData?.total || 0;
                  const businessId = orderData?.businessId;
                  
                  if (businessId && orderTotal > 0) {
                    // Import analyticsService
                    const { analyticsService } = require('../../services/analyticsService');
                    
                    // Register the order revenue in analytics using the new function
                    await analyticsService.trackOrderRevenue(businessId, orderTotal);
                    console.log(`Ingresos actualizados para el pedido ${orderId}: $${orderTotal}`);
                  }
                }
              } catch (error) {
                console.error('Error actualizando datos analíticos:', error);
              }
            }
            
            setRefreshing(false);
            
            if (!success) {
              Alert.alert('Error', 'No se pudo actualizar el estado del pedido.');
            }
          }
        }
      ]
    );
  };
  
  const handleCancelOrder = (orderId: string) => {
    Alert.alert(
      'Cancelar pedido',
      '¿Estás seguro de que deseas cancelar este pedido? Esta acción no se puede deshacer.',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Sí, cancelar', 
          style: 'destructive',
          onPress: async () => {
            setRefreshing(true);
            const success = await cancelOrder(orderId);
            setRefreshing(false);
            
            if (success) {
              Alert.alert('Éxito', 'El pedido ha sido cancelado.');
            } else {
              Alert.alert('Error', 'No se pudo cancelar el pedido.');
            }
          }
        }
      ]
    );
  };
  
  const getNextStatus = (currentStatus: OrderStatus): OrderStatus | null => {
    switch (currentStatus) {
      case 'created': return 'paid';
      case 'paid': return 'preparing';
      case 'preparing': return 'in_transit';
      case 'in_transit': return 'delivered';
      default: return null; // No next status for delivered, canceled or refunded
    }
  };
  
  const getStatusText = (status: OrderStatus) => {
    switch (status) {
      case 'created': return 'Creado';
      case 'paid': return 'Pagado';
      case 'preparing': return 'En preparación';
      case 'in_transit': return 'En camino';
      case 'delivered': return 'Entregado';
      case 'canceled': return 'Cancelado';
      case 'refunded': return 'Reembolsado';
      default: return 'Desconocido';
    }
  };
  
  const formatTimeAgo = (date: Date | any) => {
    if (!date) return '';
    
    try {
      const dateObj = date.toDate ? date.toDate() : new Date(date);
      return formatDistanceToNow(dateObj, { addSuffix: true, locale: es });
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };
  
  const onRefresh = useCallback(async () => {
    await loadOrders();
  }, [businessId]);
  
  const handleViewLocation = (order: ExtendedOrderSummary) => {
    setSelectedOrder(order);
    setMapModalVisible(true);
  };
  
  const renderOrderItem = ({ item }: { item: ExtendedOrderSummary }) => {
    // Get status color
    const statusColor = getStatusColor(item.status);
    const nextStatusColor = getNextStatus(item.status) ? getStatusColor(getNextStatus(item.status)!) : COLORS.muted;

    return (
      <View style={styles.orderCard}>
        {/* Status indicator line at top of card */}
        <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
        
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderNumber}>Pedido #{item.orderNumber}</Text>
            <Text style={styles.timeAgo}>{formatTimeAgo(item.createdAt)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
        </View>
        
        <View style={styles.dividerLine} />
        
        <View style={styles.orderContentRow}>
          <View style={styles.orderContentLeft}>
            <View style={styles.detailRow}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="shopping-basket" size={16} color="#007AFF" />
              </View>
              <Text style={styles.detailText}>
                {item.itemCount} {item.itemCount === 1 ? 'producto' : 'productos'}
              </Text>
            </View>
            
            <View style={styles.detailRow}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="attach-money" size={16} color="#34C759" />
              </View>
              <Text style={styles.priceText}>
                ${item.total.toFixed(2)}
              </Text>
            </View>

            {item.userName && (
              <View style={styles.detailRow}>
                <View style={styles.iconContainer}>
                  <MaterialIcons name="person" size={16} color="#FF9500" />
                </View>
                <Text style={styles.detailText}>
                  {item.userName}
                </Text>
              </View>
            )}
          </View>
          
          <View style={styles.orderContentRight}>
            {item.notes && (
              <View style={styles.notesContainer}>
                <MaterialIcons name="notes" size={16} color="#8E8E93" />
                <Text style={styles.notesText} numberOfLines={2}>
                  {item.notes}
                </Text>
              </View>
            )}
          </View>
        </View>
        
        <View style={styles.dividerLine} />
        
        <View style={styles.orderActionButtons}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => handleViewOrderDetails(item.id)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="visibility" size={16} color={COLORS.primary} />
            <Text style={[styles.actionButtonText, { color: COLORS.primary }]}>Detalles</Text>
          </TouchableOpacity>
          
          {item.deliveryAddress && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleViewLocation(item)}
              activeOpacity={0.7}
            >
              <MaterialIcons name="map" size={16} color={COLORS.location} />
              <Text style={[styles.actionButtonText, { color: COLORS.location }]}>Ver ubicación</Text>
            </TouchableOpacity>
          )}
          
          {getNextStatus(item.status) && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleUpdateStatus(item.id, item.status)}
              activeOpacity={0.7}
            >
              <MaterialIcons name="arrow-forward" size={16} color={nextStatusColor} />
              <Text style={[styles.actionButtonText, { color: nextStatusColor }]}>
                {item.status === 'created' ? 'Marcar pagado' :
                 item.status === 'paid' ? 'Preparar' :
                 item.status === 'preparing' ? 'Enviar' :
                 item.status === 'in_transit' ? 'Entregado' : 'Actualizar'}
              </Text>
            </TouchableOpacity>
          )}

          {(item.status === 'created' || item.status === 'paid') && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleCancelOrder(item.id)}
              activeOpacity={0.7}
            >
              <MaterialIcons name="cancel" size={16} color={COLORS.danger} />
              <Text style={[styles.actionButtonText, { color: COLORS.danger }]}>Cancelar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };
  
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por # de pedido"
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            filterOrdersWithStatus(allOrders, statusFilter, text);
          }}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => {
            setSearchQuery('');
            filterOrdersWithStatus(allOrders, statusFilter, '');
          }}>
            <MaterialIcons name="clear" size={20} color="#8E8E93" />
          </TouchableOpacity>
        )}
      </View>
      
      <ScrollableStatusFilter 
        currentFilter={statusFilter}
        onFilterChange={handleFilterChange}
      />
    </View>
  );
  
  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="inbox" size={64} color="#CCC" />
      <Text style={styles.emptyTitle}>Sin pedidos</Text>
      {statusFilter !== 'all' ? (
        <Text style={styles.emptyText}>No hay pedidos con el estado "{getStatusText(statusFilter as OrderStatus)}"</Text>
      ) : searchQuery ? (
        <Text style={styles.emptyText}>No se encontraron pedidos para "{searchQuery}"</Text>
      ) : allOrders.length > 0 ? (
        <Text style={styles.emptyText}>Error al filtrar pedidos. Intenta de nuevo</Text>
      ) : (
        <Text style={styles.emptyText}>Aún no hay pedidos para este negocio</Text>
      )}
      
      {(statusFilter !== 'all' || searchQuery) && (
        <TouchableOpacity
          style={styles.resetFiltersButton}
          onPress={() => {
            setStatusFilter('all');
            setSearchQuery('');
            setFilteredOrders(allOrders);
          }}
        >
          <Text style={styles.resetFiltersButtonText}>Mostrar todos los pedidos</Text>
        </TouchableOpacity>
      )}
    </View>
  );
  
  if (isLoading && !refreshing && businessOrders.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pedidos de {businessName}</Text>
          <View style={{ width: 24 }} />
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando pedidos...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  if (error && !refreshing && businessOrders.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pedidos de {businessName}</Text>
          <View style={{ width: 24 }} />
        </View>
        
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color="#FF3B30" />
          <Text style={styles.errorTitle}>Error al cargar pedidos</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadOrders}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pedidos de {businessName}</Text>
        <TouchableOpacity onPress={loadOrders} style={styles.refreshButton}>
          <MaterialIcons name="refresh" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
      
      {refreshing && (
        <View style={styles.refreshingBar}>
          <ActivityIndicator size="small" color="#FFF" />
          <Text style={styles.refreshingText}>Actualizando...</Text>
        </View>
      )}
      
      <FlatList
        data={filteredOrders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={filteredOrders.length === 0 ? { flex: 1 } : { paddingBottom: 16 }}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#007AFF']}
            tintColor="#007AFF"
          />
        }
      />
      
      {/* Map Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={mapModalVisible}
        onRequestClose={() => setMapModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ubicación de Entrega</Text>
              <TouchableOpacity onPress={() => setMapModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.mapContainer}>
              {selectedOrder?.location ? (
                <MapView
                  style={styles.map}
                  initialRegion={{
                    latitude: selectedOrder.location.latitude,
                    longitude: selectedOrder.location.longitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                  }}
                >
                  <Marker
                    coordinate={{
                      latitude: selectedOrder.location.latitude,
                      longitude: selectedOrder.location.longitude,
                    }}
                  />
                </MapView>
              ) : (
                <View style={styles.noLocationContainer}>
                  <MaterialIcons name="location-off" size={48} color="#999" />
                  <Text style={styles.noLocationText}>
                    No hay coordenadas disponibles para esta dirección.
                  </Text>
                  <Text style={styles.addressText}>
                    {selectedOrder?.deliveryAddress ? 
                      (typeof selectedOrder.deliveryAddress === 'string' 
                        ? selectedOrder.deliveryAddress 
                        : `${selectedOrder.deliveryAddress.street}, ${selectedOrder.deliveryAddress.city}`)
                      : 'Dirección no disponible'
                    }
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => setMapModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// Scrollable status filter component - replace with solid colors
const ScrollableStatusFilter: React.FC<{
  currentFilter: StatusFilter;
  onFilterChange: (filter: StatusFilter) => void;
}> = ({ currentFilter, onFilterChange }) => {
  
  const statusOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: 'all', label: 'Todos' },
    { value: 'created', label: 'Creados' },
    { value: 'paid', label: 'Pagados' },
    { value: 'preparing', label: 'En preparación' },
    { value: 'in_transit', label: 'En camino' },
    { value: 'delivered', label: 'Entregados' },
    { value: 'canceled', label: 'Cancelados' },
  ];

  // Update the filter color function to use the new color palette
  const getFilterColor = (status: StatusFilter): string => {
    if (status === 'all') return COLORS.primary;
    if (status === 'created') return COLORS.created;
    if (status === 'paid') return COLORS.paid;
    if (status === 'preparing') return COLORS.preparing;
    if (status === 'in_transit') return COLORS.inTransit;
    if (status === 'delivered') return COLORS.delivered;
    if (status === 'canceled') return COLORS.canceled;
    if (status === 'refunded') return COLORS.refunded;
    return COLORS.muted;
  };
  
  return (
    <View style={styles.filterContainer}>
      <FlatList
        horizontal
        data={statusOptions}
        renderItem={({ item }) => {
          const isActive = currentFilter === item.value;
          const backgroundColor = isActive ? getFilterColor(item.value) : 'transparent';
            
          return (
            <TouchableOpacity
              style={[
                styles.filterItem,
                isActive && { backgroundColor: backgroundColor }
              ]}
              onPress={() => onFilterChange(item.value)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.filterText,
                isActive && styles.filterTextActive
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }}
        keyExtractor={(item) => item.value}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  refreshButton: {
    padding: 4,
  },
  headerContainer: {
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFEFF4',
    borderRadius: 10,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    height: '100%',
  },
  refreshingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 8,
  },
  refreshingText: {
    color: '#FFFFFF',
    marginLeft: 8,
    fontSize: 14,
  },
  filterContainer: {
    marginBottom: 8,
    paddingTop: 8,
  },
  filterList: {
    paddingHorizontal: 16,
  },
  filterItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E2E8',
  },
  filterText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    position: 'relative',
  },
  statusIndicator: {
    height: 4,
    width: '100%',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  timeAgo: {
    fontSize: 13,
    color: '#8E8E93',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#F2F2F7',
    marginHorizontal: 16,
  },
  orderContentRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  orderContentLeft: {
    flex: 1,
  },
  orderContentRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconContainer: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  priceText: {
    fontSize: 15,
    color: '#333',
    fontWeight: 'bold',
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9F9FB',
    padding: 8,
    borderRadius: 8,
    maxWidth: '90%',
  },
  notesText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginLeft: 6,
    flex: 1,
  },
  orderActionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 14,
    justifyContent: 'flex-start',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    marginRight: 8,
    minWidth: 100,
    borderWidth: 1,
    borderColor: '#E2E2E8',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  mapActionButton: {
    // Remove this style since we're now using actionButton for all buttons
  },
  mapActionButtonText: {
    // Remove this style since we're now using actionButtonText for all button text
  },
  statusActionButton: {
    // Remove this style since we're now using actionButton for all buttons
  },
  statusActionButtonText: {
    // Remove this style since we're now using actionButtonText
  },
  cancelButton: {
    // Remove this style since we're now using actionButton for all buttons
  },
  cancelButtonText: {
    // Remove this style since we're now using actionButtonText for all button text
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: Dimensions.get('window').width * 0.9,
    maxHeight: Dimensions.get('window').height * 0.8,
    backgroundColor: 'white',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  mapContainer: {
    height: 350,
    width: '100%',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  noLocationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F9F9FB',
  },
  noLocationText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  addressText: {
    fontSize: 15,
    color: '#333',
    textAlign: 'center',
    fontWeight: '600',
    backgroundColor: '#F0F0F5',
    padding: 12,
    borderRadius: 8,
    width: '100%',
    marginTop: 8,
  },
  modalFooter: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  modalButton: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 12,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  resetFiltersButton: {
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
  },
  resetFiltersButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default BusinessOrdersScreen; 