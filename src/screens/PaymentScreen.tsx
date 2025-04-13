import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
  BackHandler,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useOrders } from '../context/OrderContext';

type PaymentScreenRouteProp = RouteProp<RootStackParamList, 'Payment'>;
type PaymentScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Payment'>;

// URL de tu servidor - Usa IP local para emuladores/dispositivos físicos
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

// Define tipos explícitos para los items del carrito y opciones
interface CartItemOption {
  name: string;
  choice: string;
  extraPrice: number | string;
}

interface CartItemType {
  id: string;
  name: string;
  price: number | string;
  quantity: number | string;
  businessId: string;
  options?: CartItemOption[];
}

// Define el tipo para RootStackParamList si no puede importarlo
type RootStackParamList = {
  Payment: {
    businessId?: string;
    businessName?: string;
    amount?: number;
    cartItems?: CartItemType[];
    isCartPayment?: boolean;
  };
  OrderConfirmation: {
    orderId: string;
    orderNumber: string;
  };
  MainTabs: undefined;
};

// Define el tipo PaymentMethod si no puede importarlo
type PaymentMethod = 'card' | 'cash';

// Define el tipo de usuario Auth si no puede importarlo
interface User {
  uid: string;
  email: string | null;
}

const PaymentScreen: React.FC = () => {
  // Referencias para manejo de ciclo de vida
  const isMountedRef = useRef(true);
  const initialDataValidatedRef = useRef(false);
  const processingPaymentRef = useRef(false);
  const alertTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const serverCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Hooks de navegación y contextos
  const navigation = useNavigation<PaymentScreenNavigationProp>();
  const route = useRoute<PaymentScreenRouteProp>();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { user } = useAuth();
  const { clearCart } = useCart();
  const { createOrder } = useOrders();

  // Capturar parámetros de la ruta al iniciar (inmutables)
  const routeParamsRef = useRef({
    businessId: route.params?.businessId || '',
    businessName: route.params?.businessName || 'Negocio',
    initialAmount: route.params?.amount || 0,
    cartItems: Array.isArray(route.params?.cartItems) ? route.params.cartItems : [],
    isCartPayment: Boolean(route.params?.isCartPayment)
  });

  // Estados
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [amount, setAmount] = useState(
    routeParamsRef.current.initialAmount 
      ? routeParamsRef.current.initialAmount.toFixed(2) 
      : ''
  );
  const [paymentMethod, setPaymentMethod] = useState<'card'>('card');
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [processingPayment, setProcessingPayment] = useState(false);

  // Efecto de inicialización
  useEffect(() => {
    console.log('PaymentScreen montado');
    isMountedRef.current = true;
    
    // Validar datos y comprobar servidor una sola vez al montar
    if (!initialDataValidatedRef.current) {
      validateInitialData();
      checkServerStatus();
      initialDataValidatedRef.current = true;
    }
    
    // Manejar el botón de retroceso hardware
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);

    // Limpieza al desmontar
    return () => {
      console.log('PaymentScreen desmontado - limpiando estados');
      isMountedRef.current = false;
      
      // Limpiar todos los timeouts
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
        alertTimeoutRef.current = null;
      }
      
      if (serverCheckTimeoutRef.current) {
        clearTimeout(serverCheckTimeoutRef.current);
        serverCheckTimeoutRef.current = null;
      }
      
      // Remover listener de botón atrás
      backHandler.remove();
      
      // Resetear refs
      processingPaymentRef.current = false;
    };
  }, []); // Sin dependencias para evitar remontaje

  // Handler para el botón físico de retroceso
  const handleBackPress = () => {
    if (processingPaymentRef.current) {
      Alert.alert(
        'Pago en proceso',
        '¿Estás seguro de que deseas cancelar el pago?',
        [
          { text: 'Continuar con el pago', style: 'cancel', onPress: () => {} },
          { text: 'Cancelar pago', style: 'destructive', onPress: () => {
            processingPaymentRef.current = false;
            if (isMountedRef.current) {
              setProcessingPayment(false);
              navigation.goBack();
            }
          }}
        ]
      );
      return true;
    }
    return false;
  };

  // Handler para botón de retroceso en UI
  const handleBack = () => {
    if (processingPaymentRef.current) {
      Alert.alert(
        'Pago en proceso',
        '¿Estás seguro de que deseas cancelar el pago?',
        [
          { text: 'Continuar con el pago', style: 'cancel' },
          { text: 'Cancelar pago', style: 'destructive', onPress: () => {
            processingPaymentRef.current = false;
            if (isMountedRef.current) {
              setProcessingPayment(false);
              navigation.goBack();
            }
          }}
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  // Validación de datos iniciales
  const validateInitialData = () => {
    const params = routeParamsRef.current;
    
    // Validar que tengamos una cantidad válida
    if (params.isCartPayment && (isNaN(params.initialAmount) || params.initialAmount <= 0)) {
      Alert.alert(
        'Error en el monto',
        'El monto a pagar no es válido. Por favor, regresa al carrito.',
        [{ text: 'Regresar', onPress: () => navigation.goBack() }]
      );
      return false;
    }

    // Validar que tengamos items en el carrito para pagos de carrito
    if (params.isCartPayment && (!params.cartItems || params.cartItems.length === 0)) {
      Alert.alert(
        'Carrito vacío',
        'No hay productos en el carrito. Por favor, agrega productos antes de continuar.',
        [{ text: 'Regresar', onPress: () => navigation.goBack() }]
      );
      return false;
    }

    // Validar businessId
    if (!params.businessId) {
      Alert.alert(
        'Error de negocio',
        'No se pudo identificar el negocio. Por favor, intenta de nuevo.',
        [{ text: 'Regresar', onPress: () => navigation.goBack() }]
      );
      return false;
    }

    return true;
  };

  // Verificación del estado del servidor
  const checkServerStatus = async () => {
    if (!isMountedRef.current) return;
    
    try {
      if (isMountedRef.current) {
        setServerStatus('checking');
      }
      
      const controller = new AbortController();
      // Definir un timeout para la solicitud
      serverCheckTimeoutRef.current = setTimeout(() => controller.abort(), 60000);
      
      // Referencia para controlar la alerta
      let alertShown = false;
      alertTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        
        alertShown = true;
        Alert.alert(
          'Conectando con el servidor',
          'El servidor puede tardar hasta 30 segundos en responder si estaba inactivo. Por favor espera...',
          [{ text: 'Esperar', style: 'cancel' }],
          { cancelable: false }
        );
      }, 2000);
      
      const response = await fetch(`${API_URL}`, {
        signal: controller.signal
      });
      
      // Limpiar timeouts
      if (serverCheckTimeoutRef.current) {
        clearTimeout(serverCheckTimeoutRef.current);
        serverCheckTimeoutRef.current = null;
      }
      
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
        alertTimeoutRef.current = null;
      }
      
      if (!isMountedRef.current) return;
      
      if (response.ok) {
        console.log('Servidor en línea:', await response.text());
        if (isMountedRef.current) {
          setServerStatus('online');
        }
      } else {
        console.error('El servidor no está respondiendo correctamente');
        if (isMountedRef.current) {
          setServerStatus('offline');
          showServerErrorAlert();
        }
      }
    } catch (error) {
      console.error('Error conectando al servidor:', error);
      if (isMountedRef.current) {
        setServerStatus('offline');
        showServerErrorAlert();
      }
    }
  };

  // Alerta de error del servidor
  const showServerErrorAlert = () => {
    if (!isMountedRef.current) return;
    
    Alert.alert(
      'Error de conexión',
      'No se puede conectar al servidor de pagos. Verifica tu conexión a internet o intenta más tarde.',
      [
        { text: 'Reintentar', onPress: checkServerStatus },
        { text: 'Cancelar', onPress: () => navigation.goBack() }
      ]
    );
  };

  // Obtención de parámetros para la hoja de pago
  const fetchPaymentSheetParams = async () => {
    if (!isMountedRef.current) return null;
    
    try {
      const params = routeParamsRef.current;
      
      // Validar monto
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        Alert.alert('Error', 'Por favor ingresa un monto válido');
        return null;
      }

      // Validar que el servidor esté en línea
      if (serverStatus === 'offline') {
        showServerErrorAlert();
        return null;
      }

      const amountInCents = Math.round(parseFloat(amount) * 100);

      // Validar cartItems para pagos de carrito
      const payloadCartItems = params.isCartPayment ? params.cartItems.map((item: CartItemType) => ({
        id: item.id,
        name: item.name,
        price: Number(item.price),
        quantity: Number(item.quantity),
        businessId: item.businessId,
        options: item.options || []
      })) : undefined;

      console.log('Enviando solicitud al servidor:', `${API_URL}/create-payment-intent`);
      console.log('Con datos:', {
        amount: amountInCents,
        currency: 'usd',
        email: user?.email || '',
        businessId: params.businessId,
        cartItems: payloadCartItems,
      });

      // Crear un controlador para la petición con un timeout adecuado
      const controller = new AbortController();
      // Si el servidor ya está online, usar un timeout más corto
      const timeoutMs = serverStatus === 'online' ? 30000 : 60000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(`${API_URL}/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInCents,
          currency: 'usd',
          email: user?.email || '',
          businessId: params.businessId,
          cartItems: payloadCartItems,
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!isMountedRef.current) return null;

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error en el servidor:', errorText);
        Alert.alert('Error', `El servidor devolvió un error: ${response.status}. ${errorText}`);
        return null;
      }

      const data = await response.json();
      console.log('Respuesta del servidor:', data);

      if (!data.paymentIntent || !data.ephemeralKey || !data.customer) {
        console.error('Respuesta incompleta del servidor:', data);
        Alert.alert('Error', 'El servidor devolvió datos incompletos. Por favor, intenta de nuevo.');
        return null;
      }

      return {
        paymentIntent: data.paymentIntent,
        ephemeralKey: data.ephemeralKey,
        customer: data.customer,
      };
    } catch (error: any) {
      if (!isMountedRef.current) return null;
      
      const errorMessage = error.name === 'AbortError'
        ? 'La solicitud tardó demasiado tiempo. Verifica tu conexión a internet.'
        : 'No se pudo procesar el pago. Verifica tu conexión a internet.';
      
      console.error('Error al crear intent de pago:', error);
      Alert.alert('Error', errorMessage);
      return null;
    }
  };

  // Inicialización de la hoja de pago
  const initializePaymentSheet = async () => {
    if (!isMountedRef.current) return false;
    
    try {
      if (isMountedRef.current) {
        setLoading(true);
        setInitialized(false);
      }

      console.log('Obteniendo parámetros para la hoja de pago...');
      const params = await fetchPaymentSheetParams();

      if (!params || !isMountedRef.current) {
        console.log('No se pudieron obtener los parámetros necesarios');
        if (isMountedRef.current) {
          setLoading(false);
        }
        return false;
      }

      console.log('Inicializando payment sheet con los parámetros...');
      const { error } = await initPaymentSheet({
        paymentIntentClientSecret: params.paymentIntent,
        customerEphemeralKeySecret: params.ephemeralKey,
        customerId: params.customer,
        merchantDisplayName: routeParamsRef.current.businessName || 'Localfy',
        style: 'automatic',
      });

      if (!isMountedRef.current) return false;

      if (error) {
        console.error('Error al inicializar payment sheet:', error);
        Alert.alert('Error', error.message || 'No se pudo inicializar el pago');
        if (isMountedRef.current) {
          setLoading(false);
        }
        return false;
      }

      console.log('Payment sheet inicializado correctamente');
      if (isMountedRef.current) {
        setInitialized(true);
        setLoading(false);
      }
      return true;
    } catch (error) {
      console.error('Error en initializePaymentSheet:', error);
      if (isMountedRef.current) {
        setLoading(false);
      }
      Alert.alert('Error', 'Hubo un problema al inicializar el pago. Por favor, intenta de nuevo.');
      return false;
    }
  };

  // Apertura de la hoja de pago
  const openPaymentSheet = async () => {
    if (!isMountedRef.current) return;
    
    // Validar monto
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Por favor ingresa un monto válido');
      return;
    }

    try {
      // Prevenir múltiples inicios de pago simultáneos
      if (loading || processingPaymentRef.current) {
        console.log('Ya hay un pago en proceso, ignorando solicitud');
        return;
      }

      processingPaymentRef.current = true;
      if (isMountedRef.current) {
        setLoading(true);
        setProcessingPayment(true);
      }

      // Referencias a alertas para poder descartarlas si es necesario
      let serverWaitingAlert: any = null;

      // Solo mostrar alerta de espera si el servidor no está confirmado como online
      if (serverStatus !== 'online') {
        serverWaitingAlert = Alert.alert(
          'Conectando con el servidor de pagos',
          'El servidor puede tardar hasta 30 segundos en responder si estaba inactivo. Por favor espera mientras se prepara el pago...',
          [{ text: 'Esperar', style: 'cancel' }],
          { cancelable: false }
        );
      }

      const success = await initializePaymentSheet();

      if (!isMountedRef.current) return;

      if (!success) {
        processingPaymentRef.current = false;
        if (isMountedRef.current) {
          setLoading(false);
          setProcessingPayment(false);
        }
        return;
      }

      console.log('Presentando payment sheet...');
      const { error } = await presentPaymentSheet();

      if (!isMountedRef.current) return;

      if (error) {
        if (error.code === 'Canceled') {
          console.log('El usuario canceló el pago');
          processingPaymentRef.current = false;
          if (isMountedRef.current) {
            setLoading(false);
            setProcessingPayment(false);
          }
          return;
        }
        console.error('Error en presentPaymentSheet:', error);
        Alert.alert('Error de pago', error.message || 'Hubo un problema al procesar el pago');
        processingPaymentRef.current = false;
        if (isMountedRef.current) {
          setProcessingPayment(false);
          setLoading(false);
        }
      } else {
        try {
          // Obtener referencias inmutables
          const params = routeParamsRef.current;
          
          // Crear orden después de un pago exitoso
          const amountValue = parseFloat(amount);
          const subtotalValue = params.isCartPayment ? calculatedTotal : amountValue; // En pagos directos, subtotal = total
          
          // Verificar que el usuario esté autenticado
          if (!user || !user.uid || !user.email) {
            throw new Error('User information is missing - user must be logged in');
          }
          
          // Convertir el método de pago al formato esperado por el contexto de órdenes
          const orderPaymentMethod: PaymentMethod = 'card';
          
          // Validar que todos los campos necesarios estén definidos
          if (!params.businessId) {
            throw new Error('businessId is undefined');
          }
          
          if (!params.businessName) {
            throw new Error('businessName is undefined');
          }
          
          const cartToUse = params.isCartPayment ? params.cartItems : [{
            id: 'direct-payment',
            name: 'Pago directo',
            price: amountValue,
            quantity: 1,
            businessId: params.businessId
          }];
          
          if (!cartToUse || cartToUse.length === 0) {
            throw new Error('cartItems is empty or undefined');
          }
          
          // Validar cada item del carrito
          cartToUse.forEach((item: CartItemType, index: number) => {
            if (!item.id) {
              throw new Error(`Item at index ${index} has undefined id`);
            }
            if (!item.name) {
              throw new Error(`Item at index ${index} has undefined name`);
            }
            if (item.price === undefined || item.price === null) {
              throw new Error(`Item at index ${index} has undefined price`);
            }
            if (item.quantity === undefined || item.quantity === null) {
              throw new Error(`Item at index ${index} has undefined quantity`);
            }
            if (!item.businessId) {
              throw new Error(`Item at index ${index} has undefined businessId`);
            }
          });
          
          // Create a sanitized cart without undefined values that could cause Firestore errors
          const sanitizedCart = cartToUse.map((item: CartItemType) => {
            // Definir un tipo básico para el item limpio
            const cleanItem: {
              id: string;
              name: string;
              price: number;
              quantity: number;
              businessId: string;
              options?: Array<{
                name: string;
                choice: string;
                extraPrice: number;
              }>;
            } = {
              id: item.id || `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: item.name || 'Producto',
              price: Number(item.price) || 0,
              quantity: Number(item.quantity) || 1,
              businessId: item.businessId || params.businessId
            };
            
            // Solo incluir opciones si existen y no son undefined
            if (item.options && Array.isArray(item.options) && item.options.length > 0) {
              // Filtrar y limpiar las opciones también
              cleanItem.options = item.options
                .filter((option: any) => option !== undefined && option !== null)
                .map((option: any) => ({
                  name: option.name || '',
                  choice: option.choice || '',
                  extraPrice: option.extraPrice !== undefined ? Number(option.extraPrice) : 0
                }));
            }
            
            return cleanItem;
          });
          
          // Validar los valores numéricos
          if (isNaN(amountValue) || amountValue <= 0) {
            throw new Error('Invalid amount value');
          }
          
          if (isNaN(subtotalValue) || subtotalValue <= 0) {
            throw new Error('Invalid subtotal value');
          }
          
          console.log('Creating order with params:', {
            businessId: params.businessId,
            businessName: params.businessName,
            cartItemsCount: sanitizedCart.length,
            amountValue,
            subtotalValue,
            orderPaymentMethod,
            isDelivery: false
          });
          
          // Log the full sanitized cart for debugging
          console.log('Sanitized cart items:', JSON.stringify(sanitizedCart, null, 2));
          
          // Crear la orden en la base de datos
          try {
            const orderId = await createOrder(
              params.businessId,
              params.businessName,
              sanitizedCart,
              amountValue,
              subtotalValue,
              orderPaymentMethod,
              false // isDelivery: false por defecto para pagos directos
            );
            
            if (params.isCartPayment) {
              await clearCart();
            }
            
            // Aseguramos que processingPayment se desactiva antes de navegar
            processingPaymentRef.current = false;
            if (isMountedRef.current) {
              setLoading(false);
              setProcessingPayment(false);
            }
            
            // Pequeño retraso para permitir que las animaciones actuales se completen
            setTimeout(() => {
              if (!isMountedRef.current) return;
              
              // Navegamos a la pantalla de confirmación de pedido usando navigate en lugar de reset
              // para evitar problemas con animaciones pendientes
              navigation.navigate('OrderConfirmation', { 
                orderId,
                orderNumber: orderId
              });
            }, 300);
          } catch (orderError) {
            console.error('Error creating order with details:', orderError);
            processingPaymentRef.current = false;
            if (isMountedRef.current) {
              setLoading(false);
              setProcessingPayment(false);
            }
            throw orderError; // Re-throw to be caught by outer catch block
          }
        } catch (error) {
          console.error('Error al crear orden:', error);
          // Mostrar el error pero aún consideramos el pago exitoso
          Alert.alert(
            'Pago exitoso',
            'Tu pago se ha procesado correctamente, pero hubo un problema al registrar tu pedido. Por favor, contacta a soporte.',
            [
              {
                text: 'OK',
                onPress: () => {
                  // Limpiamos estados antes de navegar
                  processingPaymentRef.current = false;
                  if (isMountedRef.current) {
                    setLoading(false);
                    setProcessingPayment(false);
                  }
                  setTimeout(() => {
                    if (!isMountedRef.current) return;
                    navigation.navigate('MainTabs' as any);
                  }, 300);
                },
              },
            ]
          );
        }
      }

      processingPaymentRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
        setProcessingPayment(false);
      }
    } catch (error) {
      console.error('Error al abrir payment sheet:', error);
      processingPaymentRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
        setProcessingPayment(false);
      }
      Alert.alert('Error', 'Hubo un problema al procesar el pago. Por favor, intenta de nuevo.');
    }
  };

  // Calcular monto total de los productos (solo para verificación)
  const calculatedTotal = routeParamsRef.current.isCartPayment && routeParamsRef.current.cartItems.length > 0 
    ? routeParamsRef.current.cartItems.reduce((total: number, item: CartItemType) => {
        // Calcular precio base del producto
        let itemTotal = Number(item.price) * Number(item.quantity);
        
        // Sumar extras si existen
        if (item.options && item.options.length > 0) {
          const extraPrices = item.options.reduce((sum: number, option: { extraPrice?: number | string, name: string, choice: string }) => 
            sum + (option.extraPrice ? Number(option.extraPrice) * Number(item.quantity) : 0), 0);
          itemTotal += extraPrices;
        }
        
        return total + itemTotal;
      }, 0)
    : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.title}>Pago en línea a {routeParamsRef.current.businessName}</Text>
        {serverStatus === 'checking' && (
          <ActivityIndicator size="small" color="#007AFF" />
        )}
        {serverStatus === 'online' && (
          <MaterialIcons name="cloud-done" size={20} color="#34C759" />
        )}
        {serverStatus === 'offline' && (
          <MaterialIcons name="cloud-off" size={20} color="#FF3B30" />
        )}
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.formContainer}>
          {!routeParamsRef.current.isCartPayment && (
            <>
              <Text style={styles.label}>Monto a pagar (USD)</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                keyboardType="numeric"
              />
            </>
          )}

          {routeParamsRef.current.isCartPayment && (
            <View style={styles.orderSummary}>
              <Text style={styles.summaryTitle}>Resumen del pedido</Text>

              {routeParamsRef.current.cartItems && routeParamsRef.current.cartItems.length > 0 ? (
                routeParamsRef.current.cartItems.map((item: CartItemType, index: number) => (
                  <View key={item.id || `item-${index}`} style={styles.summaryItem}>
                    <View style={styles.summaryItemInfo}>
                      <Text style={styles.summaryItemName}>
                        {item.name} x{item.quantity}
                      </Text>
                      {item.options && item.options.length > 0 && (
                        <Text style={styles.summaryItemOptions}>
                          {item.options.map((o) => `${o.name}: ${o.choice}`).join(', ')}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.summaryItemPrice}>
                      ${(Number(item.price) * Number(item.quantity)).toFixed(2)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyCartText}>No hay productos en el carrito</Text>
              )}

              <View style={styles.summaryTotal}>
                <Text style={styles.summaryTotalLabel}>Total a pagar</Text>
                <Text style={styles.summaryTotalAmount}>${parseFloat(amount).toFixed(2)}</Text>
              </View>
            </View>
          )}

          <View style={styles.paymentSelector}>
            <Text style={styles.label}>Método de pago</Text>
            <View style={styles.paymentOptions}>
              <TouchableOpacity
                style={[styles.paymentOption, styles.selectedOption]}
                onPress={() => setPaymentMethod('card')}
              >
                <MaterialIcons name="credit-card" size={20} color="#007AFF" style={styles.paymentMethodIcon} />
                <Text style={styles.selectedPaymentText}>Tarjeta</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.payButton, (loading || serverStatus !== 'online') && styles.disabledButton]}
            onPress={openPaymentSheet}
            disabled={loading || serverStatus !== 'online'}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialIcons name="payment" size={20} color="#FFFFFF" style={styles.payButtonIcon} />
                <Text style={styles.payButtonText}>
                  {`Pagar $${parseFloat(amount).toFixed(2)}`}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              • Completa el pago con tarjeta para confirmar tu orden
            </Text>
            <Text style={styles.infoText}>• Para pruebas, usa la tarjeta 4242 4242 4242 4242</Text>
            <Text style={styles.infoText}>• Cualquier fecha futura y CVC</Text>
            <Text style={styles.infoText}>• Servidor: {serverStatus === 'online' ? 'Conectado' : serverStatus === 'checking' ? 'Verificando...' : 'No disponible'}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    justifyContent: 'space-between',
  },
  backButton: {
    marginRight: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  formContainer: {
    padding: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  paymentSelector: {
    marginBottom: 24,
  },
  paymentOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paymentOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
  },
  selectedOption: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  paymentText: {
    color: '#666',
  },
  selectedPaymentText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  paymentMethodIcon: {
    marginRight: 6,
  },
  payButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: '#B0C4DE',
  },
  payButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  payButtonIcon: {
    marginRight: 8,
  },
  infoContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  infoText: {
    fontSize: 14,
    color: '#495057',
    marginBottom: 8,
  },
  orderSummary: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#343A40',
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  summaryItemInfo: {
    flex: 1,
    paddingRight: 8,
  },
  summaryItemName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#495057',
  },
  summaryItemOptions: {
    fontSize: 13,
    color: '#6C757D',
    marginTop: 2,
  },
  summaryItemPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212529',
  },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 8,
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#343A40',
  },
  summaryTotalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  emptyCartText: {
    textAlign: 'center',
    color: '#6C757D',
    fontStyle: 'italic',
    padding: 16,
  },
});

export default PaymentScreen; 