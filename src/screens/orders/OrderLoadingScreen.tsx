import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  BackHandler,
  Alert,
  InteractionManager,
  AppState
} from 'react-native';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useOrders, Order } from '../../context/OrderContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import NavigationService from '../../navigation/services/NavigationService';

type OrderLoadingScreenRouteProp = RouteProp<RootStackParamList, 'OrderLoading'>;
type OrderLoadingScreenNavigationProp = StackNavigationProp<RootStackParamList, 'OrderLoading'>;

// Mantener una referencia global para evitar cargas duplicadas
const loadingOrders = new Set<string>();

/**
 * Pantalla de transición que carga los datos del pedido antes de mostrar la confirmación
 * Esta pantalla actúa como un "buffer" para evitar problemas de navegación/remontaje
 */
const OrderLoadingScreen: React.FC = () => {
  // Referencias para manejo de ciclo de vida
  const isMountedRef = useRef(true);
  const startedLoadingRef = useRef(false);
  const backHandlerRef = useRef<any>(null);
  const loadAttemptRef = useRef(0);
  const appStateRef = useRef(AppState.currentState);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Navegación y contexto
  const navigation = useNavigation<OrderLoadingScreenNavigationProp>();
  const { getOrder } = useOrders();
  
  // Capturar parámetros de ruta una sola vez de forma inmutable
  const routeParams = useRoute<OrderLoadingScreenRouteProp>().params || {};
  const routeParamsRef = useRef({
    orderId: routeParams.orderId || '',
    orderNumber: routeParams.orderNumber || ''
  });
  
  // Estados locales
  const [loadingText, setLoadingText] = useState('Preparando la información de tu pedido...');
  const [isLoading, setIsLoading] = useState(true);
  
  // Limpiar cualquier timeout existente
  const clearTimers = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  
  // Manejar el caso en que debamos navegar a MainTabs por error
  const navigateToMainTabs = () => {
    console.log('[OrderLoadingScreen] Navigating to MainTabs due to error or cancellation');
    
    // Asegurarnos de no ejecutar navigation.reset si no estamos montados
    if (isMountedRef.current) {
      NavigationService.reset('MainTabs');
    }
  };
  
  // Función para cargar los datos del pedido
  const loadOrderData = async () => {
    const orderId = routeParamsRef.current.orderId;
    
    if (!orderId) {
      console.error('[OrderLoadingScreen] No se recibió orderId en los parámetros');
      navigateToMainTabs();
      return;
    }
    
    // Evitar cargas duplicadas para el mismo pedido entre remontajes
    if (loadingOrders.has(orderId)) {
      console.log(`[OrderLoadingScreen] El pedido ${orderId} ya está siendo cargado, esperando...`);
      return;
    }
    
    try {
      // Marcar que estamos cargando este pedido
      loadingOrders.add(orderId);
      startedLoadingRef.current = true;
      
      loadAttemptRef.current += 1;
      const attemptNum = loadAttemptRef.current;
      
      console.log(`[OrderLoadingScreen] Intento #${attemptNum}: Cargando datos del pedido ${orderId}`);
      
      if (isMountedRef.current) {
        setLoadingText(`Obteniendo detalles de tu pedido... (${attemptNum})`);
      }
      
      // Obtenemos el pedido del servidor
      const orderData = await getOrder(orderId);
      
      // Si el componente se ha desmontado mientras cargábamos, no hacer nada más
      if (!isMountedRef.current) {
        console.log('[OrderLoadingScreen] Componente desmontado durante la carga, abortando actualización');
        return;
      }
      
      if (orderData) {
        console.log('[OrderLoadingScreen] Datos del pedido cargados correctamente, navegando a confirmación');
        
        // Asegurar que los datos del pedido están completos antes de navegar
        const orderInfo = {
          ...orderData,
          id: orderId,
          orderNumber: orderData.orderNumber || routeParamsRef.current.orderNumber
        };
        
        // Usar InteractionManager para esperar a que terminen las animaciones/transiciones pendientes
        InteractionManager.runAfterInteractions(() => {
          if (isMountedRef.current) {
            // Navegar a la pantalla de confirmación con los datos ya cargados
            // Usar replace para evitar tener OrderLoading en el stack de navegación
            navigation.replace('OrderConfirmation', {
              orderId: routeParamsRef.current.orderId,
              orderNumber: orderInfo.orderNumber,
              preloadedOrder: orderInfo // Pasamos los datos ya cargados
            });
          }
        });
      } else if (isMountedRef.current && attemptNum < 3) {
        // Reintentar hasta 3 veces con retraso incremental
        console.error('[OrderLoadingScreen] No se encontraron datos para el pedido, reintentando...');
        
        // Limpiamos el estado de carga para reintentar
        loadingOrders.delete(orderId);
        
        const delay = 1000 * attemptNum;
        console.log(`[OrderLoadingScreen] Reintentando en ${delay}ms`);
        
        if (isMountedRef.current) {
          setLoadingText(`Reintentando carga... (${attemptNum + 1})`);
        }
        
        // Programar un nuevo intento después de un retardo
        timerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            loadOrderData();
          }
        }, delay);
      } else if (isMountedRef.current) {
        // Después de 3 intentos, mostrar error y volver al inicio
        console.error('[OrderLoadingScreen] No se pudo cargar el pedido después de varios intentos');
        
        Alert.alert(
          'No se pudo cargar el pedido',
          'Hubo un problema al cargar la información de tu pedido. Puedes verlo en tu historial de pedidos.',
          [
            {
              text: 'Volver al inicio',
              onPress: navigateToMainTabs
            }
          ],
          { cancelable: false }
        );
      }
    } catch (error) {
      console.error('[OrderLoadingScreen] Error cargando el pedido:', error);
      
      // Limpiar el estado de carga
      loadingOrders.delete(routeParamsRef.current.orderId);
      
      if (isMountedRef.current) {
        Alert.alert(
          'Error al cargar el pedido',
          'Hubo un problema al cargar la información de tu pedido. Puedes verlo en tu historial de pedidos.',
          [{ text: 'Volver al inicio', onPress: navigateToMainTabs }],
          { cancelable: false }
        );
      }
    }
  };
  
  // Manejar los cambios en el estado de la aplicación
  useEffect(() => {
    // Suscribirse al estado de la aplicación
    const appStateSubscription = AppState.addEventListener('change', nextAppState => {
      // Si la aplicación vuelve a primer plano
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isMountedRef.current &&
        startedLoadingRef.current
      ) {
        console.log('[OrderLoadingScreen] App volvió a primer plano, comprobando estado de carga...');
        
        // Si ya estábamos cargando pero la app estaba en segundo plano, reintentar
        if (!loadingOrders.has(routeParamsRef.current.orderId)) {
          console.log('[OrderLoadingScreen] Reanudando carga interrumpida');
          loadOrderData();
        }
      }
      
      appStateRef.current = nextAppState;
    });
    
    return () => {
      appStateSubscription.remove();
    };
  }, []);
  
  // Efecto principal con patrón del README
  useEffect(() => {
    console.log('[OrderLoadingScreen] Montada. Iniciando carga de pedido:', routeParamsRef.current.orderId);
    isMountedRef.current = true;
    
    // Controlar el botón de retroceso para evitar salir durante la carga
    backHandlerRef.current = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert(
        'Procesando información',
        '¿Estás seguro de que deseas cancelar y volver al inicio?',
        [
          { text: 'Esperar', style: 'cancel' },
          { 
            text: 'Volver al inicio', 
            style: 'destructive',
            onPress: navigateToMainTabs
          }
        ]
      );
      return true;
    });
    
    // Esperar a que se completen las transiciones de navegación
    // antes de iniciar operaciones costosas
    InteractionManager.runAfterInteractions(() => {
      if (isMountedRef.current) {
        // Iniciar la carga con un pequeño retraso para asegurar estabilidad del UI
        timerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            loadOrderData();
          }
        }, 300);
      }
    });
    
    // Limpieza al desmontar
    return () => {
      console.log('[OrderLoadingScreen] Desmontada - limpiando referencias');
      isMountedRef.current = false;
      
      // Limpiar listener de botón de retroceso
      if (backHandlerRef.current) {
        backHandlerRef.current.remove();
        backHandlerRef.current = null;
      }
      
      // Limpiar timers
      clearTimers();
    };
  }, []); // Sin dependencias - patrón README
  
  return (
    <SafeAreaView style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      <Text style={styles.text}>{loadingText}</Text>
      <Text style={styles.subText}>Pedido: {routeParamsRef.current.orderNumber || routeParamsRef.current.orderId}</Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FF',
    padding: 20
  },
  loader: {
    marginBottom: 20
  },
  text: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10
  },
  subText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center'
  }
});

export default OrderLoadingScreen; 