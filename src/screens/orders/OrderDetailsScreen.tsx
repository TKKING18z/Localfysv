import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useOrders, Order } from '../../context/OrderContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../../context/AuthContext';
import firebase from '../../../firebase.config';
import BasicAdInterstitial from '../../components/ads/BasicAdInterstitial';

type OrderDetailsScreenRouteProp = RouteProp<RootStackParamList, 'OrderDetails'>;
type OrderDetailsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'OrderDetails'>;

const OrderDetailsScreen: React.FC = () => {
  const navigation = useNavigation<OrderDetailsScreenNavigationProp>();
  const route = useRoute<OrderDetailsScreenRouteProp>();
  const { orderId } = route.params;
  const { getOrder, updateOrderStatus, cancelOrder, isLoading, error } = useOrders();
  const { user } = useAuth();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isBusinessOwner, setIsBusinessOwner] = useState(false);
  
  useEffect(() => {
    loadOrder();
  }, [orderId]);
  
  useEffect(() => {
    if (order) {
      checkBusinessOwnership();
    }
  }, [order, user]);
  
  const loadOrder = async () => {
    setRefreshing(true);
    const orderData = await getOrder(orderId);
    if (orderData) {
      setOrder(orderData);
    }
    setRefreshing(false);
  };
  
  const checkBusinessOwnership = async () => {
    if (!order || !user) return;
    
    try {
      // En una implementación real, deberías verificar si el usuario es el dueño del negocio
      // consultando la colección de negocios en Firestore
      // Para esta demostración, usaremos una verificación simplificada
      
      // Opción 1: Verificar si el ID del negocio coincide con el ID del usuario
      // (esto funcionaría si el usuario es el dueño directo)
      let isOwner = order.businessId === user.uid;
      
      if (!isOwner) {
        // Opción 2: Verificar si el usuario tiene permisos sobre este negocio
        // consultando una colección especial business_permissions
        try {
          const db = firebase.firestore();
          const permissionsRef = db.collection('business_permissions');
          const query = permissionsRef
            .where('userId', '==', user.uid)
            .where('businessId', '==', order.businessId)
            .where('role', 'in', ['owner', 'manager', 'admin']);
          
          const snapshot = await query.get();
          isOwner = !snapshot.empty;
        } catch (error) {
          console.log('Error checking business permissions:', error);
        }
      }
      
      // Por defecto, asegurarnos de que isOwner sea false a menos que se verifique exitosamente
      setIsBusinessOwner(!!isOwner);
      console.log('isBusinessOwner set to:', !!isOwner); // Debugging log
    } catch (error) {
      console.error('Error checking business ownership:', error);
      setIsBusinessOwner(false);
    }
  };
  
  const handleBack = () => {
    navigation.goBack();
  };
  
  const handleCancelOrder = () => {
    if (!order) return;
    
    // Only allow cancellation of orders in created or paid status
    if (order.status !== 'created' && order.status !== 'paid') {
      Alert.alert(
        'No se puede cancelar',
        'Este pedido ya está en proceso y no puede ser cancelado.',
        [{ text: 'Entendido' }]
      );
      return;
    }
    
    Alert.alert(
      'Cancelar pedido',
      '¿Estás seguro de que deseas cancelar este pedido?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Sí, cancelar', style: 'destructive', onPress: confirmCancelOrder }
      ]
    );
  };
  
  const confirmCancelOrder = async () => {
    if (!order) return;
    
    setRefreshing(true);
    const success = await cancelOrder(orderId);
    setRefreshing(false);
    
    if (success) {
      Alert.alert(
        'Pedido cancelado',
        'Tu pedido ha sido cancelado correctamente.',
        [{ text: 'OK' }]
      );
      // Reload order data to get updated status
      loadOrder();
    } else {
      Alert.alert(
        'Error',
        'No se pudo cancelar el pedido. Por favor, intenta de nuevo.',
        [{ text: 'OK' }]
      );
    }
  };
  
  const handleContactBusiness = () => {
    if (!order) return;
    
    // Here you could implement a direct way to contact the business
    // For example, open a chat, make a call, or send an email
    Alert.alert(
      'Contactar a ' + order.businessName,
      'Selecciona cómo quieres contactar a este negocio:',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Llamar', onPress: () => {
          // This is a placeholder. In a real app, you'd use the actual phone number
          Linking.openURL('tel:+1234567890');
        }},
        { text: 'Mensaje', onPress: () => {
          // Navigate to chat screen or similar
          navigation.navigate('Chat', { conversationId: 'business_' + order.businessId });
        }}
      ]
    );
  };
  
  const formatDate = (date: Date | any, showTime = true) => {
    if (!date) return '';
    
    try {
      const dateObj = date.toDate ? date.toDate() : new Date(date);
      if (showTime) {
        return format(dateObj, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es });
      }
      return format(dateObj, "d 'de' MMMM 'de' yyyy", { locale: es });
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };
  
  const getStatusText = (status: string) => {
    switch(status) {
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
  
  // This would be used by a business user to update the order status
  const handleUpdateStatus = (newStatus: string) => {
    if (!order) return;
    
    Alert.alert(
      'Actualizar estado',
      `¿Estás seguro de cambiar el estado a "${getStatusText(newStatus)}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Actualizar', onPress: async () => {
          setRefreshing(true);
          const success = await updateOrderStatus(orderId, newStatus as any);
          setRefreshing(false);
          
          if (success) {
            // Reload order data to get updated status
            loadOrder();
          } else {
            Alert.alert('Error', 'No se pudo actualizar el estado.');
          }
        }}
      ]
    );
  };
  
  // Función para completar un pedido sin mostrar anuncio (ya que el anuncio se maneja en el botón)
  const handleCompleteOrder = async () => {
    try {
      if (!order) {
        Alert.alert('Error', 'No hay información del pedido disponible');
        return;
      }

      const success = await updateOrderStatus(orderId, 'delivered');
      
      if (!success) {
        Alert.alert('Error', 'No se pudo completar el pedido');
        return;
      }
      
      Alert.alert('Éxito', 'Pedido marcado como entregado');
      navigation.goBack();
    } catch (error) {
      console.error('Error al completar el pedido:', error);
      Alert.alert('Error', 'No se pudo completar el pedido');
    }
  };
  
  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando detalles del pedido...</Text>
      </SafeAreaView>
    );
  }
  
  if (error && !order) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={64} color="#FF3B30" />
        <Text style={styles.errorTitle}>Error al cargar el pedido</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={handleBack}>
          <Text style={styles.buttonText}>Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  
  if (!order) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <MaterialIcons name="help-outline" size={64} color="#FF9500" />
        <Text style={styles.errorTitle}>Pedido no encontrado</Text>
        <Text style={styles.errorText}>No se pudo encontrar información para este pedido.</Text>
        <TouchableOpacity style={styles.button} onPress={handleBack}>
          <Text style={styles.buttonText}>Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalles del pedido</Text>
        <View style={styles.headerRight} />
      </View>
      
      {refreshing && (
        <View style={styles.refreshingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.refreshingText}>Actualizando...</Text>
        </View>
      )}
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.orderHeader}>
          <View style={styles.orderNumberContainer}>
            <Text style={styles.orderNumberLabel}>Pedido #{order.orderNumber}</Text>
            <View style={[styles.statusBadge, styles[`status_${order.status}`]]}>
              <Text style={styles.statusText}>{getStatusText(order.status)}</Text>
            </View>
          </View>
          <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Negocio</Text>
          <View style={styles.businessInfo}>
            <MaterialIcons name="store" size={24} color="#007AFF" style={styles.icon} />
            <View style={styles.businessDetails}>
              <Text style={styles.businessName}>{order.businessName}</Text>
              <TouchableOpacity onPress={handleContactBusiness}>
                <Text style={styles.contactText}>Contactar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado del pedido</Text>
          <View style={styles.statusTracker}>
            <View style={styles.statusStep}>
              <View style={[
                styles.statusDot, 
                order.status !== 'canceled' ? styles.statusDotActive : styles.statusDotCanceled
              ]} />
              <Text style={styles.statusStepText}>Creado</Text>
            </View>
            <View style={[
              styles.statusLine, 
              (order.status === 'paid' || order.status === 'preparing' || order.status === 'in_transit' || order.status === 'delivered')
                ? styles.statusLineActive 
                : order.status === 'canceled' ? styles.statusLineCanceled : styles.statusLineInactive
            ]} />
            <View style={styles.statusStep}>
              <View style={[
                styles.statusDot, 
                (order.status === 'paid' || order.status === 'preparing' || order.status === 'in_transit' || order.status === 'delivered')
                  ? styles.statusDotActive 
                  : order.status === 'canceled' ? styles.statusDotCanceled : styles.statusDotInactive
              ]} />
              <Text style={styles.statusStepText}>Pagado</Text>
            </View>
            <View style={[
              styles.statusLine, 
              (order.status === 'preparing' || order.status === 'in_transit' || order.status === 'delivered')
                ? styles.statusLineActive 
                : order.status === 'canceled' ? styles.statusLineCanceled : styles.statusLineInactive
            ]} />
            <View style={styles.statusStep}>
              <View style={[
                styles.statusDot, 
                (order.status === 'preparing' || order.status === 'in_transit' || order.status === 'delivered')
                  ? styles.statusDotActive 
                  : order.status === 'canceled' ? styles.statusDotCanceled : styles.statusDotInactive
              ]} />
              <Text style={styles.statusStepText}>Preparando</Text>
            </View>
            <View style={[
              styles.statusLine, 
              (order.status === 'in_transit' || order.status === 'delivered')
                ? styles.statusLineActive 
                : order.status === 'canceled' ? styles.statusLineCanceled : styles.statusLineInactive
            ]} />
            <View style={styles.statusStep}>
              <View style={[
                styles.statusDot, 
                (order.status === 'in_transit' || order.status === 'delivered')
                  ? styles.statusDotActive 
                  : order.status === 'canceled' ? styles.statusDotCanceled : styles.statusDotInactive
              ]} />
              <Text style={styles.statusStepText}>En camino</Text>
            </View>
            <View style={[
              styles.statusLine, 
              order.status === 'delivered'
                ? styles.statusLineActive 
                : order.status === 'canceled' ? styles.statusLineCanceled : styles.statusLineInactive
            ]} />
            <View style={styles.statusStep}>
              <View style={[
                styles.statusDot, 
                order.status === 'delivered'
                  ? styles.statusDotActive 
                  : order.status === 'canceled' ? styles.statusDotCanceled : styles.statusDotInactive
              ]} />
              <Text style={styles.statusStepText}>Entregado</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumen del pedido</Text>
          <View style={styles.itemsContainer}>
            {order.items.map((item, index) => (
              <View key={index} style={styles.item}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {item.options && item.options.length > 0 && (
                    <Text style={styles.itemOptions}>
                      {item.options.map(opt => `${opt.name}: ${opt.choice}`).join(', ')}
                    </Text>
                  )}
                  {item.notes && <Text style={styles.itemNotes}>Nota: {item.notes}</Text>}
                </View>
                <View style={styles.itemPriceContainer}>
                  <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                  <Text style={styles.itemPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumen de pago</Text>
          <View style={styles.paymentSummary}>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Subtotal</Text>
              <Text style={styles.paymentValue}>${order.subtotal.toFixed(2)}</Text>
            </View>
            
            {(order.tax !== undefined && order.tax > 0) && (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Impuestos</Text>
                <Text style={styles.paymentValue}>${order.tax.toFixed(2)}</Text>
              </View>
            )}
            
            {(order.deliveryFee !== undefined && order.deliveryFee > 0) && (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Gastos de envío</Text>
                <Text style={styles.paymentValue}>${order.deliveryFee.toFixed(2)}</Text>
              </View>
            )}
            
            {(order.tip !== undefined && order.tip > 0) && (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Propina</Text>
                <Text style={styles.paymentValue}>${order.tip.toFixed(2)}</Text>
              </View>
            )}
            
            <View style={styles.paymentRowTotal}>
              <Text style={styles.paymentLabelTotal}>Total</Text>
              <Text style={styles.paymentValueTotal}>${order.total.toFixed(2)}</Text>
            </View>
            
            <View style={styles.paymentMethod}>
              <MaterialIcons name="payment" size={20} color="#007AFF" />
              <Text style={styles.paymentMethodText}>
                Método de pago: {' '}
                <Text style={styles.paymentMethodValue}>
                  {order.paymentMethod === 'card' ? 'Tarjeta' : 
                  order.paymentMethod === 'cash' ? 'Efectivo' : 'Otro'}
                </Text>
              </Text>
            </View>
          </View>
        </View>
        
        {order.address && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dirección de entrega</Text>
            <View style={styles.addressContainer}>
              <MaterialIcons name="location-on" size={20} color="#007AFF" style={styles.addressIcon} />
              <View style={styles.addressInfo}>
                {typeof order.address === 'string' ? (
                  <Text style={styles.addressText}>{order.address}</Text>
                ) : (
                  <>
                    <Text style={styles.addressText}>
                      {order.address.street}, {order.address.city}
                    </Text>
                    <Text style={styles.addressText}>
                      {order.address.state}, {order.address.zipCode}
                    </Text>
                    {order.address.notes && (
                      <Text style={styles.addressNotes}>
                        Notas: {order.address.notes}
                      </Text>
                    )}
                  </>
                )}
              </View>
            </View>
          </View>
        )}
        
        {order.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notas adicionales</Text>
            <View style={styles.notesContainer}>
              <Text style={styles.notesText}>{order.notes}</Text>
            </View>
          </View>
        )}
        
        {(order.status === 'created' || order.status === 'paid') && (
          <View style={styles.section}>
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={handleCancelOrder}
            >
              <MaterialIcons name="cancel" size={20} color="#FF3B30" />
              <Text style={styles.cancelButtonText}>Cancelar pedido</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Esta sección es solo para dueños de negocios verificados */}
        {isBusinessOwner === true && order && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actualizar estado del pedido</Text>
            <View style={styles.businessActions}>
              {order.status === 'created' && (
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={() => handleUpdateStatus('paid')}
                >
                  <Text style={styles.actionButtonText}>Marcar como pagado</Text>
                </TouchableOpacity>
              )}
              
              {order.status === 'paid' && (
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={() => handleUpdateStatus('preparing')}
                >
                  <Text style={styles.actionButtonText}>Iniciar preparación</Text>
                </TouchableOpacity>
              )}
              
              {order.status === 'preparing' && (
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={() => handleUpdateStatus('in_transit')}
                >
                  <Text style={styles.actionButtonText}>Enviar pedido</Text>
                </TouchableOpacity>
              )}
              
              {order.status === 'in_transit' && (
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={() => handleUpdateStatus('delivered')}
                >
                  <Text style={styles.actionButtonText}>Marcar como entregado</Text>
                </TouchableOpacity>
              )}
              
              {(order.status === 'created' || order.status === 'paid') && (
                <TouchableOpacity 
                  style={styles.cancelOrderButton} 
                  onPress={handleCancelOrder}
                >
                  <MaterialIcons name="cancel" size={20} color="#FF3B30" />
                  <Text style={styles.cancelOrderButtonText}>Cancelar pedido</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
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
  },
  headerRight: {
    width: 32,
  },
  refreshingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#F0F8FF',
  },
  refreshingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#007AFF',
  },
  scrollView: {
    flex: 1,
  },
  orderHeader: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  orderNumberContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderNumberLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  orderDate: {
    fontSize: 14,
    color: '#8E8E93',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#E5E5EA',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  status_created: {
    backgroundColor: '#007AFF',
  },
  status_paid: {
    backgroundColor: '#5856D6',
  },
  status_preparing: {
    backgroundColor: '#FF9500',
  },
  status_in_transit: {
    backgroundColor: '#FF3B30',
  },
  status_delivered: {
    backgroundColor: '#34C759',
  },
  status_canceled: {
    backgroundColor: '#8E8E93',
  },
  status_refunded: {
    backgroundColor: '#FF2D55',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
  },
  businessDetails: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  businessName: {
    fontSize: 16,
    color: '#000',
  },
  contactText: {
    fontSize: 14,
    color: '#007AFF',
  },
  statusTracker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusStep: {
    alignItems: 'center',
    width: 60,
  },
  statusDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  statusDotActive: {
    backgroundColor: '#34C759',
  },
  statusDotInactive: {
    backgroundColor: '#D1D1D6',
  },
  statusDotCanceled: {
    backgroundColor: '#FF3B30',
  },
  statusLine: {
    height: 2,
    flex: 1,
  },
  statusLineActive: {
    backgroundColor: '#34C759',
  },
  statusLineInactive: {
    backgroundColor: '#D1D1D6',
  },
  statusLineCanceled: {
    backgroundColor: '#FF3B30',
  },
  statusStepText: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
  itemsContainer: {
    marginTop: 8,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  itemInfo: {
    flex: 1,
    paddingRight: 8,
  },
  itemName: {
    fontSize: 15,
    color: '#000',
    marginBottom: 4,
  },
  itemOptions: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 2,
  },
  itemNotes: {
    fontSize: 13,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  itemPriceContainer: {
    alignItems: 'flex-end',
  },
  itemQuantity: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
  },
  paymentSummary: {
    marginTop: 8,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  paymentLabel: {
    fontSize: 15,
    color: '#000',
  },
  paymentValue: {
    fontSize: 15,
    color: '#000',
  },
  paymentRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  paymentLabelTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  paymentValueTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  paymentMethodText: {
    fontSize: 14,
    color: '#000',
    marginLeft: 8,
  },
  paymentMethodValue: {
    fontWeight: '500',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  addressInfo: {
    flex: 1,
  },
  addressText: {
    fontSize: 15,
    color: '#000',
    marginBottom: 4,
  },
  addressNotes: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
    marginTop: 4,
  },
  notesContainer: {
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 8,
  },
  notesText: {
    fontSize: 14,
    color: '#000',
    fontStyle: 'italic',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#FFF1F0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFCCCC',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
    marginLeft: 8,
  },
  businessActions: {
    marginTop: 8,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  actionButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 30,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 20,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 10,
    backgroundColor: '#FFF1F0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFCCCC',
  },
  cancelOrderButtonText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default OrderDetailsScreen; 