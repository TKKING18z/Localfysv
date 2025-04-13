import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { format, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth';

// Define RootStackParamList localmente para evitar errores de importación
type RootStackParamList = {
  OrdersList: undefined;
  OrderDetails: { orderId: string };
  BusinessDetail: { businessId: string };
  // Otras rutas que puedan ser necesarias
};

type OrdersListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'OrdersList'>;

// Define OrderStatus localmente para evitar errores de importación
type OrderStatus = 
  | 'created' 
  | 'paid' 
  | 'preparing' 
  | 'in_transit' 
  | 'delivered' 
  | 'canceled' 
  | 'refunded';

type StatusFilter = OrderStatus | 'all';

// Redefinir la estructura OrderSummary localmente para no depender del contexto
interface OrderSummary {
  id: string;
  orderNumber: string;
  businessName: string;
  status: OrderStatus;
  total: number;
  createdAt: any;
  updatedAt: any;
  itemCount: number;
}

const OrdersListScreen: React.FC = () => {
  const navigation = useNavigation<OrdersListScreenNavigationProp>();
  
  // Estado local en lugar de usar el contexto
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Referencias para gestionar el estado interno
  const isMountedRef = useRef(true);
  const listenerRef = useRef<(() => void) | null>(null);
  
  // Configurar el listener de Firestore al montar el componente
  useEffect(() => {
    console.log('Orders List Screen - Componente montado');
    isMountedRef.current = true;
    
    // Configurar el listener de pedidos
    setupOrdersListener();
    
    // Limpiar al desmontar
    return () => {
      console.log('Orders List Screen - Componente desmontado');
      isMountedRef.current = false;
      
      // Desconectar listener
      if (listenerRef.current) {
        console.log('Desconectando listener de pedidos');
        listenerRef.current();
        listenerRef.current = null;
      }
    };
  }, []); // Sin dependencias - solo una vez
  
  // Configurar listener de Firestore
  const setupOrdersListener = () => {
    // Verificar si hay un usuario autenticado
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
      console.log('No hay usuario autenticado, no se puede configurar el listener');
      setLoading(false);
      setError('Debes iniciar sesión para ver tus pedidos');
      return;
    }
    
    // Si ya hay un listener, no crear otro
    if (listenerRef.current) {
      console.log('Ya existe un listener, no se creará otro');
      return;
    }
    
    const userId = currentUser.uid;
    console.log(`Configurando listener para pedidos del usuario: ${userId}`);
    setRefreshing(true);
    setLoading(true);
    
    try {
      const db = firebase.firestore();
      const ordersColRef = collection(db, 'orders');
      
      // Consulta con índice existente
      const q = query(
        ordersColRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      // Crear listener
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!isMountedRef.current) return;
        
        setRefreshing(false);
        setLoading(false);
        
        // Procesar resultados
        if (!snapshot.empty) {
          const userOrders = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              orderNumber: data.orderNumber,
              businessName: data.businessName,
              status: data.status,
              total: data.total,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
              itemCount: data.items?.length || 0
            };
          });
          
          console.log(`Pedidos del usuario encontrados: ${userOrders.length}`);
          setOrders(userOrders);
        } else {
          console.log('No se encontraron pedidos para este usuario');
          setOrders([]);
        }
      }, (error) => {
        if (!isMountedRef.current) return;
        
        console.error('Error al escuchar pedidos del usuario:', error);
        setError(`Error al cargar tus pedidos: ${error.message}`);
        setRefreshing(false);
        setLoading(false);
      });
      
      // Guardar referencia al listener
      listenerRef.current = unsubscribe;
    } catch (error: any) {
      if (!isMountedRef.current) return;
      
      console.error('Error configurando listener de pedidos del usuario:', error);
      setError(`Error al configurar listener de pedidos: ${error.message}`);
      setRefreshing(false);
      setLoading(false);
    }
  };
  
  // Use useMemo to calculate filtered orders instead of an effect + state
  const filteredOrders = useMemo(() => {
    // Add defensive check
    if (!orders || !Array.isArray(orders)) {
      console.log('Warning: orders is not an array', orders);
      return [];
    }
    
    let filtered = [...orders];
    
    // Filter by status if a specific status is selected
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }
    
    // Filter by search query (search in order number or business name)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        order => 
          (order.orderNumber?.toString().toLowerCase().includes(query) || false) ||
          (order.businessName?.toString().toLowerCase().includes(query) || false)
      );
    }
    
    return filtered;
  }, [orders, statusFilter, searchQuery]);
  
  // Funciones de utilidad optimizadas con useCallback
  const handleSelectOrder = useCallback((orderId: string) => {
    navigation.navigate('OrderDetails', { orderId });
  }, [navigation]);
  
  const handleStatusFilterChange = useCallback((status: StatusFilter) => {
    setStatusFilter(status);
  }, []);
  
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    
    // Forzar actualización visual
    setTimeout(() => {
      if (isMountedRef.current) {
        setRefreshing(false);
      }
    }, 2000);
  }, []);
  
  const getStatusColor = useCallback((status: OrderStatus) => {
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
  }, []);
  
  const getStatusText = useCallback((status: OrderStatus) => {
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
  }, []);
  
  const formatDate = useCallback((date: Date | any) => {
    if (!date) return '';
    
    try {
      const dateObj = date.toDate ? date.toDate() : new Date(date);
      
      if (isToday(dateObj)) {
        return `Hoy a las ${format(dateObj, 'HH:mm')}`;
      } else if (isYesterday(dateObj)) {
        return `Ayer a las ${format(dateObj, 'HH:mm')}`;
      } else {
        return format(dateObj, "d MMM yyyy", { locale: es });
      }
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  }, []);
  
  // Componentes renderizados memoizados
  const renderItem = useCallback(({ item }: { item: OrderSummary }) => {
    if (!item || !item.id) {
      console.warn('Attempted to render invalid order item:', item);
      return null;
    }
    
    return (
      <OrderItemComponent 
        item={item}
        onPress={handleSelectOrder}
        getStatusColor={getStatusColor}
        getStatusText={getStatusText}
        formatDate={formatDate}
      />
    );
  }, [handleSelectOrder, getStatusColor, getStatusText, formatDate]);
  
  const renderEmptyList = useCallback(() => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="receipt-long" size={64} color="#CCC" />
      <Text style={styles.emptyTitle}>Sin pedidos</Text>
      {statusFilter !== 'all' ? (
        <Text style={styles.emptyText}>No tienes pedidos con el estado "{getStatusText(statusFilter as OrderStatus)}"</Text>
      ) : searchQuery ? (
        <Text style={styles.emptyText}>No se encontraron pedidos para "{searchQuery}"</Text>
      ) : (
        <Text style={styles.emptyText}>¡Realiza tu primer pedido para ver el historial aquí!</Text>
      )}
    </View>
  ), [statusFilter, searchQuery, getStatusText]);
  
  const renderHeader = useCallback(() => (
    <View style={styles.headerContainer}>
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por # de pedido o negocio"
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
        onFilterChange={handleStatusFilterChange}
      />
    </View>
  ), [searchQuery, statusFilter, handleStatusFilterChange]);
  
  // Optimizaciones para el FlatList
  const keyExtractor = useCallback((item: OrderSummary) => item.id, []);
  
  const getItemLayout = useCallback(
    (data: ArrayLike<OrderSummary> | null | undefined, index: number) => ({
      length: 140, // Approximate height of each order item
      offset: 140 * index,
      index,
    }),
    []
  );
  
  // Renderizado condicional para estados de carga/error
  const renderContent = () => {
    if (loading && !refreshing && orders.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando pedidos...</Text>
        </View>
      );
    }
    
    if (error && !refreshing && orders.length === 0) {
      return (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color="#FF3B30" />
          <Text style={styles.errorTitle}>Error al cargar los pedidos</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    return (
      <FlatList
        data={filteredOrders}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyList}
        contentContainerStyle={filteredOrders.length === 0 ? styles.emptyListContent : styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#007AFF']}
            tintColor="#007AFF"
          />
        }
        windowSize={Platform.OS === 'ios' ? 5 : 5}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={true}
        initialNumToRender={10}
      />
    );
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Tus pedidos</Text>
      </View>
      
      {renderContent()}
    </SafeAreaView>
  );
};

// Separate component for OrderItem with React.memo for performance
const OrderItemComponent = React.memo(({ 
  item, 
  onPress, 
  getStatusColor, 
  getStatusText, 
  formatDate 
}: { 
  item: OrderSummary; 
  onPress: (id: string) => void;
  getStatusColor: (status: OrderStatus) => string;
  getStatusText: (status: OrderStatus) => string;
  formatDate: (date: any) => string;
}) => (
  <TouchableOpacity 
    style={styles.orderItem} 
    onPress={() => onPress(item.id)}
  >
    <View style={styles.orderHeader}>
      <Text style={styles.orderNumber}>#{item.orderNumber}</Text>
      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
        <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
      </View>
    </View>
    
    <View style={styles.orderDetails}>
      <View style={styles.businessInfo}>
        <MaterialIcons name="store" size={18} color="#666" style={styles.icon} />
        <Text style={styles.businessName}>{item.businessName}</Text>
      </View>
      
      <View style={styles.orderFooter}>
        <View style={styles.itemsInfo}>
          <MaterialIcons name="shopping-basket" size={18} color="#666" style={styles.icon} />
          <Text style={styles.itemsCount}>{item.itemCount} {item.itemCount === 1 ? 'artículo' : 'artículos'}</Text>
        </View>
        
        <View style={styles.dateInfo}>
          <MaterialIcons name="schedule" size={18} color="#666" style={styles.icon} />
          <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
        </View>
      </View>
    </View>
    
    <View style={styles.priceContainer}>
      <Text style={styles.priceText}>${item.total.toFixed(2)}</Text>
      <MaterialIcons name="chevron-right" size={20} color="#8E8E93" />
    </View>
  </TouchableOpacity>
));

// Horizontal scrollable filter for order status
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
  titleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
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
  listContent: {
    paddingBottom: 16,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  orderItem: {
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
    alignItems: 'center',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  orderDetails: {
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFF4',
    paddingBottom: 12,
    marginBottom: 12,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  businessName: {
    fontSize: 15,
    color: '#000',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemsCount: {
    fontSize: 14,
    color: '#666',
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 14,
    color: '#666',
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  icon: {
    marginRight: 6,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
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
    backgroundColor: '#F2F2F7',
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
  }
});

export default OrdersListScreen; 