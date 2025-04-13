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

type BusinessOrdersScreenRouteProp = RouteProp<RootStackParamList, 'BusinessOrders'>;
type BusinessOrdersScreenNavigationProp = StackNavigationProp<RootStackParamList, 'BusinessOrders'>;

type StatusFilter = OrderStatus | 'all';

// Extender el tipo OrderSummary para incluir el nombre de usuario si está disponible
type ExtendedOrderSummary = OrderSummary & {
  userName?: string;
  deliveryAddress?: string | any; // Dirección de entrega
  notes?: string; // Notas del cliente
};

const BusinessOrdersScreen: React.FC = () => {
  const navigation = useNavigation<BusinessOrdersScreenNavigationProp>();
  const route = useRoute<BusinessOrdersScreenRouteProp>();
  const { businessId, businessName } = route.params;
  const { businessOrders, loadBusinessOrders, updateOrderStatus, cancelOrder, isLoading, error } = useOrders();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredOrders, setFilteredOrders] = useState<ExtendedOrderSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  
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
  
  // Filter orders whenever the search query, status filter, or orders list changes
  useEffect(() => {
    filterOrders();
  }, [searchQuery, statusFilter, businessOrders]);
  
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
            notes: data.notes // Agregar notas
          };
        });
        
        setFilteredOrders(orders);
      }
    }, (error) => {
      console.error('Error escuchando pedidos:', error);
    });
    
    return () => unsubscribe();
  }, [businessId]);
  
  const loadOrders = async () => {
    setRefreshing(true);
    await loadBusinessOrders(businessId);
    setRefreshing(false);
  };
  
  const filterOrders = () => {
    let filtered = [...businessOrders];
    
    // Filter by status if a specific status is selected
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }
    
    // Filter by search query (search in order number)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        order => order.orderNumber.toLowerCase().includes(query)
      );
    }
    
    // Solo actualizar filteredOrders si no hay un listener activo
    // o si cambian los filtros
    if (searchQuery.trim() || statusFilter !== 'all') {
      setFilteredOrders(filtered);
    }
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
  
  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'created': return '#007AFF'; // Blue
      case 'paid': return '#5856D6';    // Purple 
      case 'preparing': return '#FF9500'; // Orange
      case 'in_transit': return '#FF3B30'; // Red
      case 'delivered': return '#34C759'; // Green
      case 'canceled': return '#8E8E93';  // Gray
      case 'refunded': return '#FF2D55';  // Pink
      default: return '#8E8E93';
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
  
  const renderOrderItem = ({ item }: { item: ExtendedOrderSummary }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderNumber}>Pedido #{item.orderNumber}</Text>
          <Text style={styles.timeAgo}>{formatTimeAgo(item.createdAt)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>
      
      <View style={styles.orderDetails}>
        <View style={styles.detailRow}>
          <MaterialIcons name="shopping-basket" size={18} color="#666" />
          <Text style={styles.detailText}>
            {item.itemCount} {item.itemCount === 1 ? 'producto' : 'productos'}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <MaterialIcons name="attach-money" size={18} color="#666" />
          <Text style={styles.detailText}>
            ${item.total.toFixed(2)}
          </Text>
        </View>

        {item.userName && (
          <View style={styles.detailRow}>
            <MaterialIcons name="person" size={18} color="#666" />
            <Text style={styles.detailText}>
              {item.userName}
            </Text>
          </View>
        )}
        
        {item.deliveryAddress && (
          <View style={styles.detailRow}>
            <MaterialIcons name="location-on" size={18} color="#666" />
            <Text style={styles.detailText} numberOfLines={1}>
              {typeof item.deliveryAddress === 'string' 
                ? item.deliveryAddress 
                : `${item.deliveryAddress.street}, ${item.deliveryAddress.city}`}
            </Text>
          </View>
        )}
        
        {item.notes && (
          <View style={styles.detailRow}>
            <MaterialIcons name="notes" size={18} color="#666" />
            <Text style={styles.detailText} numberOfLines={1}>
              Notas: {item.notes}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.orderActions}>
        <TouchableOpacity 
          style={styles.viewButton} 
          onPress={() => handleViewOrderDetails(item.id)}
        >
          <MaterialIcons name="visibility" size={18} color="#007AFF" />
          <Text style={styles.viewButtonText}>Ver detalles</Text>
        </TouchableOpacity>
        
        {getNextStatus(item.status) && (
          <TouchableOpacity 
            style={[styles.updateButton, { backgroundColor: getStatusColor(getNextStatus(item.status)!) }]} 
            onPress={() => handleUpdateStatus(item.id, item.status)}
          >
            <MaterialIcons name="arrow-forward" size={18} color="#FFF" />
            <Text style={styles.updateButtonText}>
              {item.status === 'created' ? 'Marcar pagado' :
               item.status === 'paid' ? 'Preparar' :
               item.status === 'preparing' ? 'Enviar' :
               item.status === 'in_transit' ? 'Entregado' : 'Actualizar'}
            </Text>
          </TouchableOpacity>
        )}

        {(item.status === 'created' || item.status === 'paid') && (
          <TouchableOpacity 
            style={styles.cancelButton} 
            onPress={() => handleCancelOrder(item.id)}
          >
            <MaterialIcons name="cancel" size={18} color="#FF3B30" />
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
  
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por # de pedido"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <MaterialIcons name="clear" size={20} color="#8E8E93" />
          </TouchableOpacity>
        )}
      </View>
      
      <ScrollableStatusFilter 
        currentFilter={statusFilter}
        onFilterChange={setStatusFilter}
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
      ) : (
        <Text style={styles.emptyText}>Aún no hay pedidos para este negocio</Text>
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
    </SafeAreaView>
  );
};

// Scrollable status filter component
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
  
  return (
    <View style={styles.filterContainer}>
      <FlatList
        horizontal
        data={statusOptions}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterItem,
              currentFilter === item.value && styles.filterItemActive
            ]}
            onPress={() => onFilterChange(item.value)}
          >
            <Text
              style={[
                styles.filterText,
                currentFilter === item.value && styles.filterTextActive
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
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
  },
  filterList: {
    paddingHorizontal: 16,
  },
  filterItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#EFEFF4',
  },
  filterItemActive: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
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
    fontSize: 14,
    color: '#8E8E93',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EFEFEF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  orderActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  viewButtonText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 4,
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C759',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  updateButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 4,
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
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginLeft: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  cancelButtonText: {
    marginLeft: 4,
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default BusinessOrdersScreen; 