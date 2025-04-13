import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Animated, 
  Dimensions 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { OrderStatus } from '../../context/OrderContext';

interface OrderStatusNotificationProps {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  onDismiss: () => void;
}

const OrderStatusNotification: React.FC<OrderStatusNotificationProps> = ({
  orderId,
  orderNumber,
  status,
  onDismiss
}) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [animation] = useState(new Animated.Value(-100));
  
  // Ref para controlar si el componente está montado
  const isMounted = useRef(true);
  // Ref para el temporizador
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Animación de entrada
    const animateIn = Animated.timing(animation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true
    });
    
    animateIn.start();
    
    // Auto-dismiss después de 5 segundos
    timerRef.current = setTimeout(() => {
      if (isMounted.current) {
        handleDismiss();
      }
    }, 5000);
    
    // Cleanup cuando el componente se desmonta
    return () => {
      // Marcar como desmontado
      isMounted.current = false;
      
      // Detener la animación
      animateIn.stop();
      
      // Limpiar el temporizador
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);
  
  const handleDismiss = () => {
    // Solo proceder si el componente sigue montado
    if (!isMounted.current) return;
    
    // Limpiar el temporizador si existe
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    // Animación de salida
    Animated.timing(animation, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true
    }).start(() => {
      // Solo ejecutar el callback si el componente sigue montado
      if (isMounted.current) {
        onDismiss();
      }
    });
  };
  
  const handlePress = () => {
    // Solo proceder si el componente sigue montado
    if (!isMounted.current) return;
    
    // Limpiar temporizador y ejecutar onDismiss
    handleDismiss();
    
    // Navegar a los detalles del pedido
    navigation.navigate('OrderDetails', { orderId });
  };
  
  const getStatusText = (status: OrderStatus) => {
    switch(status) {
      case 'created': return 'Pedido creado';
      case 'paid': return 'Pago confirmado';
      case 'preparing': return 'En preparación';
      case 'in_transit': return 'En camino';
      case 'delivered': return 'Entregado';
      case 'canceled': return 'Cancelado';
      case 'refunded': return 'Reembolsado';
      default: return 'Estado actualizado';
    }
  };
  
  const getStatusDescription = (status: OrderStatus) => {
    switch(status) {
      case 'created': return 'Tu pedido ha sido recibido';
      case 'paid': return 'El pago ha sido confirmado';
      case 'preparing': return 'Tu pedido está siendo preparado';
      case 'in_transit': return 'Tu pedido está en camino';
      case 'delivered': return '¡Tu pedido ha sido entregado!';
      case 'canceled': return 'Tu pedido ha sido cancelado';
      case 'refunded': return 'Se ha procesado un reembolso';
      default: return 'El estado ha sido actualizado';
    }
  };
  
  const getStatusIcon = (status: OrderStatus) => {
    switch(status) {
      case 'created': return 'receipt';
      case 'paid': return 'payments';
      case 'preparing': return 'restaurant';
      case 'in_transit': return 'local-shipping';
      case 'delivered': return 'check-circle';
      case 'canceled': return 'cancel';
      case 'refunded': return 'money-off';
      default: return 'notifications';
    }
  };
  
  const getStatusColor = (status: OrderStatus) => {
    switch(status) {
      case 'created': return '#007AFF';
      case 'paid': return '#5856D6';
      case 'preparing': return '#FF9500';
      case 'in_transit': return '#FF3B30';
      case 'delivered': return '#34C759';
      case 'canceled': return '#8E8E93';
      case 'refunded': return '#FF2D55';
      default: return '#007AFF';
    }
  };
  
  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          transform: [{ translateY: animation }],
          backgroundColor: getStatusColor(status)
        }
      ]}
    >
      <TouchableOpacity style={styles.content} onPress={handlePress}>
        <View style={styles.iconContainer}>
          <MaterialIcons name={getStatusIcon(status)} size={28} color="#FFF" />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.title}>{getStatusText(status)}</Text>
          <Text style={styles.description}>
            {getStatusDescription(status)} - Pedido #{orderNumber}
          </Text>
        </View>
        
        <TouchableOpacity style={styles.closeButton} onPress={handleDismiss}>
          <MaterialIcons name="close" size={20} color="#FFF" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 40, // Space for status bar
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  description: {
    color: '#FFF',
    fontSize: 14,
    opacity: 0.9,
  },
  closeButton: {
    padding: 4,
  },
});

export default OrderStatusNotification; 