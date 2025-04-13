import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useOrders, OrderSummary, OrderStatus } from '../../context/OrderContext';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ScrollView } from 'react-native-gesture-handler';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import firebase from '../../../firebase.config';
import { Timestamp } from 'firebase/firestore';

type BusinessOrdersScreenRouteProp = RouteProp<RootStackParamList, 'BusinessOrders'>;
type BusinessOrdersScreenNavigationProp = StackNavigationProp<RootStackParamList, 'BusinessOrders'>;

type StatusFilter = OrderStatus | 'all';

// Extender el tipo OrderSummary para incluir el nombre de usuario si está disponible
type ExtendedOrderSummary = OrderSummary & {
  userName?: string;
};

const BusinessOrdersScreen: React.FC = () => {
  // IMPORTANTE: No usamos useRoute directamente sino que guardamos su valor inicial
  const navigation = useNavigation<BusinessOrdersScreenNavigationProp>();
  const routeParams = useRef(useRoute<BusinessOrdersScreenRouteProp>().params).current;
  const businessId = routeParams.businessId;
  const businessName = routeParams.businessName;
  
  // Solo usamos el hook para funciones, no para estado
  const { updateOrderStatus, cancelOrder } = useOrders();
  
  // Todos los estados son locales
  const [orders, setOrders] = useState<ExtendedOrderSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredOrders, setFilteredOrders] = useState<ExtendedOrderSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);
  
  // Referencias para rastrear el estado interno
  const listenerRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);
  
  // Estados para modales de entrada
  const [isDeliveryEstimateModalVisible, setDeliveryEstimateModalVisible] = useState(false);
  const [isDeliveryNoteModalVisible, setDeliveryNoteModalVisible] = useState(false);
  const [deliveryEstimateMinutes, setDeliveryEstimateMinutes] = useState('30');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [currentOrderStatus, setCurrentOrderStatus] = useState<OrderStatus | null>(null);
  
  // Este useEffect solo se ejecuta una vez al montar
  useEffect(() => {
    console.log('Business Orders Screen - Componente montado');
    isMountedRef.current = true;
    
    // Configurar el listener de Firestore
    setupOrdersListener();
    
    // Limpiar al desmontar
    return () => {
      console.log('Business Orders Screen - Componente desmontado');
      isMountedRef.current = false;
      
      // Desconectar listener al salir
      if (listenerRef.current) {
        console.log('Desconectando listener de pedidos');
        listenerRef.current();
        listenerRef.current = null;
      }
    };
  }, []); // Array de dependencias vacío - solo una vez
  
  // Esta función configura el listener sin causar re-renderizaciones
  const setupOrdersListener = () => {
    if (!businessId) {
      console.log('No hay businessId, no se puede configurar el listener');
      setLoading(false);
      return;
    }
    
    // Si ya hay un listener, no crear otro
    if (listenerRef.current) {
      console.log('Ya existe un listener, no se creará otro');
      return;
    }
    
    console.log(`Configurando listener para pedidos del negocio: ${businessId}`);
    setRefreshing(true);
    setLoading(true);
    
    try {
      const db = firebase.firestore();
      const ordersColRef = collection(db, 'orders');
      
      // Consulta con índice existente
      const q = query(
        ordersColRef,
        where('businessId', '==', businessId),
        orderBy('createdAt', 'desc')
      );
      
      // Crear el listener
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!isMountedRef.current) return;
        
        setRefreshing(false);
        setLoading(false);
        
        // Procesar resultados
        if (!snapshot.empty) {
          const newOrders = snapshot.docs.map(doc => {
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
              userName: data.userName
            };
          });
          
          console.log(`Pedidos encontrados: ${newOrders.length}`);
          setOrders(newOrders);
        } else {
          console.log('No se encontraron pedidos para este negocio');
          setOrders([]);
        }
      }, (error) => {
        if (!isMountedRef.current) return;
        
        console.error('Error al escuchar pedidos:', error);
        setLocalError(`Error al escuchar cambios en pedidos: ${error.message}`);
        setRefreshing(false);
        setLoading(false);
      });
      
      // Guardar el unsubscribe en la referencia
      listenerRef.current = unsubscribe;
    } catch (error: any) {
      if (!isMountedRef.current) return;
      
      console.error('Error configurando listener de pedidos:', error);
      setLocalError(`Error al configurar listener de pedidos: ${error.message}`);
      setRefreshing(false);
      setLoading(false);
    }
  };
  
  // Filtra órdenes cuando cambia el query o el filtro de estado
  useEffect(() => {
    filterOrders();
  }, [searchQuery, statusFilter, orders]);
  
  // Función de filtrado que no depende del contexto
  const filterOrders = () => {
    if (!orders || !Array.isArray(orders)) {
      setFilteredOrders([]);
      return;
    }
    
    let filtered = [...orders];
    
    // Filtrar por estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }
    
    // Filtrar por texto de búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        order => order.orderNumber?.toLowerCase().includes(query) || false
      );
    }
    
    setFilteredOrders(filtered);
  };
  
  // Manejo manual de la recarga
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    
    // Forzar actualización visual
    setTimeout(() => {
      if (isMountedRef.current) {
        setRefreshing(false);
      }
    }, 2000);
  }, []);
  
  const handleBack = () => {
    navigation.goBack();
  };
  
  const handleViewOrderDetails = (orderId: string) => {
    navigation.navigate('OrderDetails', { orderId });
  };
  
  const handleUpdateStatus = (orderId: string, currentStatus: OrderStatus) => {
    const nextStatus = getNextStatus(currentStatus);
    if (!nextStatus) return;
    
    // Diferentes mensajes según el cambio de estado
    const getStatusChangeMessage = () => {
      switch (currentStatus) {
        case 'created': return '¿Confirmar que el pago ha sido recibido?';
        case 'paid': return '¿Iniciar la preparación del pedido?';
        case 'preparing': return '¿Confirmar que el pedido está en camino para entrega?';
        case 'in_transit': return '¿Confirmar que el pedido ha sido entregado exitosamente?';
        default: return `¿Cambiar estado de "${getStatusText(currentStatus)}" a "${getStatusText(nextStatus)}"?`;
      }
    };
    
    const getStatusChangeTitle = () => {
      switch (currentStatus) {
        case 'created': return 'Confirmar pago';
        case 'paid': return 'Iniciar preparación';
        case 'preparing': return 'Enviar pedido';
        case 'in_transit': return 'Confirmar entrega';
        default: return 'Actualizar estado';
      }
    };
    
    // Si va a marcar como en camino, permitir añadir tiempo estimado de entrega
    if (currentStatus === 'preparing') {
      // Mostrar modal para ingresar tiempo estimado de entrega
      setCurrentOrderId(orderId);
      setCurrentOrderStatus(currentStatus);
      setDeliveryEstimateModalVisible(true);
    }
    // Si está marcando como entregado, permitir añadir una nota
    else if (currentStatus === 'in_transit') {
      Alert.alert(
        getStatusChangeTitle(),
        getStatusChangeMessage(),
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'Añadir nota', 
            onPress: () => {
              setCurrentOrderId(orderId);
              setCurrentOrderStatus(currentStatus);
              setDeliveryNoteModalVisible(true);
            }
          },
          { 
            text: 'Confirmar entrega', 
            onPress: async () => {
              setRefreshing(true);
              const success = await updateOrderStatus(orderId, nextStatus);
              setRefreshing(false);
              
              if (success) {
                Alert.alert('¡Éxito!', 'El pedido ha sido marcado como entregado.');
              } else {
                Alert.alert('Error', 'No se pudo actualizar el estado del pedido.');
              }
            }
          }
        ]
      );
    } else {
      Alert.alert(
        getStatusChangeTitle(),
        getStatusChangeMessage(),
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'Actualizar', 
            onPress: async () => {
              setRefreshing(true);
              const success = await updateOrderStatus(orderId, nextStatus);
              setRefreshing(false);
              
              if (success) {
                // Mensaje de éxito específico para cada transición
                let successMessage = '';
                switch (nextStatus) {
                  case 'paid':
                    successMessage = 'Pago confirmado. El pedido está listo para preparación.';
                    break;
                  case 'preparing':
                    successMessage = 'Pedido en preparación. Notifica al cliente cuando esté listo para entrega.';
                    break;
                  case 'in_transit':
                    successMessage = 'Pedido en camino. Asegúrate de que el cliente está informado del tiempo estimado de entrega.';
                    break;
                  default:
                    successMessage = `Estado actualizado a ${getStatusText(nextStatus)}.`;
                }
                Alert.alert('¡Éxito!', successMessage);
              } else {
                Alert.alert('Error', 'No se pudo actualizar el estado del pedido.');
              }
            }
          }
        ]
      );
    }
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
  
  const getStatusShortText = (status: OrderStatus) => {
    switch (status) {
      case 'created': return 'Nuevo';
      case 'paid': return 'Pagado';
      case 'preparing': return 'Preparando';
      case 'in_transit': return 'En camino';
      case 'delivered': return 'Entregado';
      case 'canceled': return 'Cancelado';
      case 'refunded': return 'Reembolsado';
      default: return 'Desconocido';
    }
  };
  
  const getStatusOrderValue = (status: OrderStatus): number => {
    switch (status) {
      case 'created': return 1;
      case 'paid': return 2;
      case 'preparing': return 3;
      case 'in_transit': return 4;
      case 'delivered': return 5;
      case 'canceled': return -1;
      case 'refunded': return -2;
      default: return 0;
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
  
  // Manejar la confirmación del tiempo estimado de entrega
  const handleDeliveryEstimateConfirm = async () => {
    if (!currentOrderId || !currentOrderStatus) return;
    
    if (!deliveryEstimateMinutes || isNaN(Number(deliveryEstimateMinutes))) {
      Alert.alert('Error', 'Por favor ingresa un número válido de minutos.');
      return;
    }
    
    setDeliveryEstimateModalVisible(false);
    setRefreshing(true);
    
    const nextStatus = getNextStatus(currentOrderStatus);
    if (!nextStatus) {
      setRefreshing(false);
      return;
    }
    
    // Calcular tiempo estimado de entrega
    const now = new Date();
    const estimatedTime = new Date(now.getTime() + Number(deliveryEstimateMinutes) * 60000);
    
    const success = await updateOrderStatus(currentOrderId, nextStatus, {
      notes: `Pedido en camino. Tiempo estimado de entrega: ${deliveryEstimateMinutes} minutos.`,
      estimatedDeliveryTime: Timestamp.fromDate(estimatedTime)
    });
    
    setRefreshing(false);
    
    if (success) {
      Alert.alert(
        '¡Éxito!', 
        `El pedido está en camino. Tiempo estimado de entrega: ${deliveryEstimateMinutes} minutos.`
      );
    } else {
      Alert.alert('Error', 'No se pudo actualizar el estado del pedido.');
    }
  };
  
  // Manejar la confirmación de nota de entrega
  const handleDeliveryNoteConfirm = async () => {
    if (!currentOrderId || !currentOrderStatus) return;
    
    setDeliveryNoteModalVisible(false);
    setRefreshing(true);
    
    const nextStatus = getNextStatus(currentOrderStatus);
    if (!nextStatus) {
      setRefreshing(false);
      return;
    }
    
    const success = await updateOrderStatus(currentOrderId, nextStatus, {
      notes: deliveryNote || 'Pedido entregado correctamente.'
    });
    
    setRefreshing(false);
    
    if (success) {
      Alert.alert('¡Éxito!', 'El pedido ha sido marcado como entregado.');
    } else {
      Alert.alert('Error', 'No se pudo actualizar el estado del pedido.');
    }
  };
  
  // Renderizar el contenido principal en función del estado
  const renderContent = () => {
    if (loading && !refreshing && orders.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando pedidos...</Text>
        </View>
      );
    }
    
    if (localError && !refreshing && orders.length === 0) {
      return (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color="#FF3B30" />
          <Text style={styles.errorTitle}>Error al cargar pedidos</Text>
          <Text style={styles.errorText}>{localError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    return (
      <FlatList
        data={filteredOrders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          filteredOrders.length === 0 ? { flex: 1 } : { paddingBottom: 16 }
        }
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
    );
  };
  
  // Renderizar element de la lista
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
      
      <View style={styles.orderProgress}>
        <View style={styles.progressContainer}>
          <View style={styles.progressLine} />
          {/* Puntos de progreso */}
          {['created', 'paid', 'preparing', 'in_transit', 'delivered'].map((status, index) => (
            <View 
              key={status}
              style={[
                styles.progressDot, 
                { 
                  backgroundColor: getStatusOrderValue(item.status) >= getStatusOrderValue(status as OrderStatus) 
                    ? getStatusColor(status as OrderStatus) 
                    : '#E5E5EA'
                }
              ]}
            />
          ))}
        </View>
        <View style={styles.progressLabelsContainer}>
          {['created', 'paid', 'preparing', 'in_transit', 'delivered'].map((status) => (
            <Text 
              key={status}
              style={[
                styles.progressLabel,
                getStatusOrderValue(item.status) >= getStatusOrderValue(status as OrderStatus) 
                  ? { color: getStatusColor(status as OrderStatus), fontWeight: '500' } 
                  : { color: '#8E8E93' }
              ]}
            >
              {getStatusShortText(status as OrderStatus)}
            </Text>
          ))}
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
      </View>
      
      <View style={styles.orderActions}>
        <TouchableOpacity 
          style={styles.viewButton} 
          onPress={() => handleViewOrderDetails(item.id)}
        >
          <MaterialIcons name="visibility" size={18} color="#007AFF" />
          <Text style={styles.viewButtonText}>Ver detalles</Text>
        </TouchableOpacity>
        
        {item.status !== 'canceled' && item.status !== 'delivered' && (
          <TouchableOpacity 
            style={[styles.updateButton, { backgroundColor: getStatusColor(getNextStatus(item.status) || item.status) }]} 
            onPress={() => handleUpdateStatus(item.id, item.status)}
          >
            <MaterialIcons name="arrow-forward" size={18} color="#FFF" />
            <Text style={styles.updateButtonText}>
              {item.status === 'created' ? 'Confirmar pago' :
               item.status === 'paid' ? 'Iniciar preparación' :
               item.status === 'preparing' ? 'Enviar pedido' :
               item.status === 'in_transit' ? 'Marcar entregado' : 'Actualizar'}
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
  
  // Renderizar modal para tiempo estimado de entrega
  const renderDeliveryEstimateModal = () => (
    <Modal
      visible={isDeliveryEstimateModalVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setDeliveryEstimateModalVisible(false)}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Tiempo estimado de entrega</Text>
          <Text style={styles.modalSubtitle}>Ingresa el tiempo estimado de entrega en minutos</Text>
          
          <TextInput
            style={styles.modalInput}
            value={deliveryEstimateMinutes}
            onChangeText={setDeliveryEstimateMinutes}
            keyboardType="numeric"
            placeholder="Minutos"
            maxLength={3}
            autoFocus
          />
          
          <View style={styles.modalButtonContainer}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalCancelButton]}
              onPress={() => setDeliveryEstimateModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.modalConfirmButton]}
              onPress={handleDeliveryEstimateConfirm}
            >
              <Text style={styles.modalConfirmText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
  
  // Renderizar modal para nota de entrega
  const renderDeliveryNoteModal = () => (
    <Modal
      visible={isDeliveryNoteModalVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setDeliveryNoteModalVisible(false)}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Nota de entrega</Text>
          <Text style={styles.modalSubtitle}>Añade una nota sobre la entrega (opcional)</Text>
          
          <TextInput
            style={[styles.modalInput, styles.textAreaInput]}
            value={deliveryNote}
            onChangeText={setDeliveryNote}
            placeholder="Ej: Entregado en recepción"
            multiline
            textAlignVertical="top"
            numberOfLines={4}
            autoFocus
          />
          
          <View style={styles.modalButtonContainer}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalCancelButton]}
              onPress={() => setDeliveryNoteModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.modalConfirmButton]}
              onPress={handleDeliveryNoteConfirm}
            >
              <Text style={styles.modalConfirmText}>Confirmar entrega</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pedidos de {businessName}</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <MaterialIcons name="refresh" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
      
      {refreshing && (
        <View style={styles.refreshingBar}>
          <ActivityIndicator size="small" color="#FFF" />
          <Text style={styles.refreshingText}>Actualizando...</Text>
        </View>
      )}
      
      {renderContent()}
      
      {renderDeliveryEstimateModal()}
      {renderDeliveryNoteModal()}
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
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
    textAlign: 'center',
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  orderProgress: {
    marginVertical: 16,
    paddingHorizontal: 8,
  },
  progressContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 24,
    marginBottom: 8,
  },
  progressLine: {
    position: 'absolute',
    top: 11,
    left: 8,
    right: 8,
    height: 3,
    backgroundColor: '#E5E5EA',
    zIndex: 1,
  },
  progressDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  progressLabelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  progressLabel: {
    fontSize: 11,
    textAlign: 'center',
    width: 60,
    marginHorizontal: -6,
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
    flexWrap: 'wrap',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginVertical: 4,
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
    marginVertical: 4,
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
    marginVertical: 4,
  },
  cancelButtonText: {
    marginLeft: 4,
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    padding: 12,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  modalCancelButton: {
    backgroundColor: '#8E8E93',
  },
  modalCancelText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalConfirmButton: {
    backgroundColor: '#34C759',
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  textAreaInput: {
    height: 100,
    textAlignVertical: 'top',
    padding: 10,
  },
});

export default BusinessOrdersScreen; 