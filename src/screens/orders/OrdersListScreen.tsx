import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useOrders, OrderSummary, OrderStatus } from '../../context/OrderContext';
import { format, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';

type OrdersListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'OrdersList'>;

type StatusFilter = OrderStatus | 'all';

const OrdersListScreen: React.FC = () => {
  const navigation = useNavigation<OrdersListScreenNavigationProp>();
  const { userOrders, loadUserOrders, isLoading, error } = useOrders();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredOrders, setFilteredOrders] = useState<OrderSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  
  // Load orders on component mount
  useEffect(() => {
    loadOrders();
  }, []);
  
  // Filter orders whenever the search query, status filter, or orders list changes
  useEffect(() => {
    filterOrders();
  }, [searchQuery, statusFilter, userOrders]);
  
  const loadOrders = async () => {
    setRefreshing(true);
    await loadUserOrders();
    setRefreshing(false);
  };
  
  const filterOrders = () => {
    let filtered = [...userOrders];
    
    // Filter by status if a specific status is selected
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }
    
    // Filter by search query (search in order number or business name)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        order => 
          order.orderNumber.toLowerCase().includes(query) ||
          order.businessName.toLowerCase().includes(query)
      );
    }
    
    setFilteredOrders(filtered);
  };
  
  const handleSelectOrder = (orderId: string) => {
    navigation.navigate('OrderDetails', { orderId });
  };
  
  const handleStatusFilterChange = (status: StatusFilter) => {
    setStatusFilter(status);
  };
  
  const onRefresh = useCallback(async () => {
    await loadOrders();
  }, []);
  
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
  
  const formatDate = (date: Date | any) => {
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
  };
  
  const renderItem = ({ item }: { item: OrderSummary }) => (
    <TouchableOpacity 
      style={styles.orderItem} 
      onPress={() => handleSelectOrder(item.id)}
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
  );
  
  const renderEmptyList = () => (
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
  );
  
  const renderHeader = () => (
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
  );
  
  if (isLoading && !refreshing && userOrders.length === 0) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando pedidos...</Text>
      </SafeAreaView>
    );
  }
  
  if (error && !refreshing && userOrders.length === 0) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={64} color="#FF3B30" />
        <Text style={styles.errorTitle}>Error al cargar los pedidos</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadOrders}>
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Tus pedidos</Text>
      </View>
      
      <FlatList
        data={filteredOrders}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
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
      />
    </SafeAreaView>
  );
};

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