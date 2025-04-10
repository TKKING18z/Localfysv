import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  Share,
  Alert,
  Animated,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useOrders, Order } from '../../context/OrderContext';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

type OrderConfirmationScreenRouteProp = RouteProp<RootStackParamList, 'OrderConfirmation'>;
type OrderConfirmationScreenNavigationProp = StackNavigationProp<RootStackParamList, 'OrderConfirmation'>;

const OrderConfirmationScreen: React.FC = () => {
  const navigation = useNavigation<OrderConfirmationScreenNavigationProp>();
  const route = useRoute<OrderConfirmationScreenRouteProp>();
  const { orderId, orderNumber } = route.params;
  const { getOrder, isLoading, error } = useOrders();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [successAnimation] = useState(new Animated.Value(0));
  
  useEffect(() => {
    const loadOrder = async () => {
      const orderData = await getOrder(orderId);
      if (orderData) {
        setOrder(orderData);
        
        // Animate success checkmark
        Animated.timing(successAnimation, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }).start();
      }
    };
    
    loadOrder();
  }, [orderId]);
  
  const handleShareOrder = async () => {
    if (!order) return;
    
    try {
      const result = await Share.share({
        message: `¡He realizado un pedido en ${order.businessName}! Mi número de pedido es ${order.orderNumber}. Total: $${order.total.toFixed(2)}`,
        title: 'Mi pedido en Localfy',
      });
      
      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // Shared with activity type of result.activityType
          console.log(`Shared with ${result.activityType}`);
        } else {
          // Shared
          console.log('Shared successfully');
        }
      } else if (result.action === Share.dismissedAction) {
        // Dismissed
        console.log('Share dismissed');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };
  
  const handleViewOrderDetails = () => {
    navigation.navigate('OrderDetails', { orderId });
  };
  
  const handleBackToHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs' }],
    });
  };
  
  const formatDate = (date: Date | any) => {
    if (!date) return '';
    
    try {
      const dateObj = date.toDate ? date.toDate() : new Date(date);
      return formatDistanceToNow(dateObj, { addSuffix: true, locale: es });
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };
  
  // Animated success checkmark style
  const checkmarkScale = successAnimation.interpolate({
    inputRange: [0, 0.5, 0.7, 1],
    outputRange: [0, 1.3, 0.9, 1],
  });
  
  const checkmarkOpacity = successAnimation.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0.3, 1],
  });
  
  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando detalles del pedido...</Text>
      </SafeAreaView>
    );
  }
  
  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={64} color="#FF3B30" />
        <Text style={styles.errorTitle}>Error al cargar el pedido</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={handleBackToHome}>
          <Text style={styles.buttonText}>Volver al inicio</Text>
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
        <TouchableOpacity style={styles.button} onPress={handleBackToHome}>
          <Text style={styles.buttonText}>Volver al inicio</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Animated.View 
            style={[
              styles.successIconContainer, 
              {
                transform: [{ scale: checkmarkScale }],
                opacity: checkmarkOpacity
              }
            ]}
          >
            <MaterialIcons name="check-circle" size={80} color="#34C759" />
          </Animated.View>
          <Text style={styles.title}>¡Pedido confirmado!</Text>
          <Text style={styles.subtitle}>Tu pedido ha sido recibido exitosamente.</Text>
        </View>
        
        <View style={styles.orderInfoContainer}>
          <View style={styles.orderNumberContainer}>
            <Text style={styles.orderNumberLabel}>Número de Pedido:</Text>
            <Text style={styles.orderNumber}>{order.orderNumber}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <MaterialIcons name="store" size={20} color="#007AFF" />
            <Text style={styles.infoLabel}>Negocio:</Text>
            <Text style={styles.infoValue}>{order.businessName}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <MaterialIcons name="access-time" size={20} color="#007AFF" />
            <Text style={styles.infoLabel}>Fecha:</Text>
            <Text style={styles.infoValue}>{formatDate(order.createdAt)}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <MaterialIcons name="payment" size={20} color="#007AFF" />
            <Text style={styles.infoLabel}>Método de pago:</Text>
            <Text style={styles.infoValue}>
              {order.paymentMethod === 'card' ? 'Tarjeta' : 
               order.paymentMethod === 'cash' ? 'Efectivo' : 'Otro'}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <MaterialIcons name="local-shipping" size={20} color="#007AFF" />
            <Text style={styles.infoLabel}>Tipo:</Text>
            <Text style={styles.infoValue}>
              {order.isDelivery ? 'Entrega a domicilio' : 'Recogida en tienda'}
            </Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.itemsContainer}>
            <Text style={styles.sectionTitle}>Resumen del pedido</Text>
            
            {order.items.map((item, index) => (
              <View key={index} style={styles.orderItem}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                </View>
                <Text style={styles.itemPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
              </View>
            ))}
            
            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalAmount}>${order.total.toFixed(2)}</Text>
            </View>
          </View>
          
          <View style={styles.statusContainer}>
            <Text style={styles.statusLabel}>Estado del pedido:</Text>
            <View style={[styles.statusBadge, styles[`status_${order.status}`]]}>
              <Text style={styles.statusText}>
                {order.status === 'created' ? 'Creado' :
                 order.status === 'paid' ? 'Pagado' :
                 order.status === 'preparing' ? 'En preparación' :
                 order.status === 'in_transit' ? 'En camino' :
                 order.status === 'delivered' ? 'Entregado' :
                 order.status === 'canceled' ? 'Cancelado' : 'Desconocido'}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={handleViewOrderDetails}>
            <MaterialIcons name="receipt" size={20} color="#007AFF" />
            <Text style={styles.actionText}>Ver detalles completos</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleShareOrder}>
            <MaterialIcons name="share" size={20} color="#007AFF" />
            <Text style={styles.actionText}>Compartir pedido</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleBackToHome}>
          <Text style={styles.primaryButtonText}>Volver al inicio</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  successIconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  orderInfoContainer: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  orderNumberContainer: {
    flexDirection: 'column',
    marginBottom: 20,
    alignItems: 'center',
  },
  orderNumberLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  orderNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
    marginLeft: 8,
    width: 120,
  },
  infoValue: {
    fontSize: 15,
    color: '#000',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 16,
  },
  itemsContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  itemQuantity: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statusContainer: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLabel: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
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
  actionsContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  actionText: {
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 12,
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
});

export default OrderConfirmationScreen; 