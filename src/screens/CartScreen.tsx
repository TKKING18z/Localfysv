import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Dimensions,
  ScrollView,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute, useIsFocused } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCart, CartItem, PaymentMethodType } from '../context/CartContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { usePoints, ActiveRedemption } from '../context/PointsContext';

type CartNavigationProp = StackNavigationProp<RootStackParamList, 'Cart'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const CartScreen: React.FC = () => {
  const navigation = useNavigation<CartNavigationProp>();
  const route = useRoute();
  const isFocused = useIsFocused();
  const { cart, removeFromCart, updateQuantity, clearCart, totalPrice, setPaymentMethod, setDeliveryAddress, setDeliveryNotes } = useCart();
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CartItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  
  // Por defecto, asumimos que los negocios aceptan efectivo
  // Esto podría obtenerse de la API del negocio en una versión futura
  const [acceptsCashOnDelivery, setAcceptsCashOnDelivery] = useState(true);
  
  // Reference to track if we've already processed location params
  const processedLocationParams = useRef(false);

  const insets = useSafeAreaInsets();
  
  // Add auth and points context
  const { user } = useAuth();
  const { 
    awardPointsForPurchase, 
    totalPoints, 
    hasAvailableDiscount, 
    getAvailableDiscount, 
    markRedemptionAsUsed,
    getActiveRedemptions 
  } = usePoints();

  // Estado para manejar los descuentos
  const [activeDiscount, setActiveDiscount] = useState<ActiveRedemption | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [finalTotal, setFinalTotal] = useState(totalPrice);
  const [discountModalVisible, setDiscountModalVisible] = useState(false);

  // Cargar descuentos disponibles
  useEffect(() => {
    if (user && isFocused) {
      getActiveRedemptions().then(() => {
        if (hasAvailableDiscount()) {
          const discount = getAvailableDiscount();
          setActiveDiscount(discount);
          
          // Calcular el descuento
          if (discount) {
            calculateDiscount(discount);
          }
        } else {
          setActiveDiscount(null);
          setDiscountAmount(0);
        }
      });
    }
  }, [user, isFocused, totalPrice]);

  // Actualizar el precio final cuando cambia el precio total o el descuento
  useEffect(() => {
    // Asegurarse de que el descuento no supere el precio total
    const safeDiscountAmount = Math.min(discountAmount, totalPrice);
    setFinalTotal(Math.max(0, totalPrice - safeDiscountAmount));
  }, [totalPrice, discountAmount]);

  // Calcular el monto del descuento basado en el tipo de descuento
  const calculateDiscount = (discount: ActiveRedemption) => {
    if (!discount) return;

    if (discount.discountAmount !== undefined) {
      // Descuento de monto fijo
      setDiscountAmount(discount.discountAmount);
    } else if (discount.discountPercent !== undefined) {
      // Descuento porcentual
      const amount = (totalPrice * discount.discountPercent) / 100;
      setDiscountAmount(amount);
    } else {
      setDiscountAmount(0);
    }
  };

  // Función para remover un descuento activo
  const removeDiscount = () => {
    setActiveDiscount(null);
    setDiscountAmount(0);
  };

  // Función para mostrar el modal de confirmación de uso de descuento
  const showDiscountConfirmation = () => {
    if (!activeDiscount) return;
    
    let discountDescription = '';
    if (activeDiscount.discountAmount) {
      discountDescription = `$${activeDiscount.discountAmount.toFixed(2)}`;
    } else if (activeDiscount.discountPercent) {
      discountDescription = `${activeDiscount.discountPercent}%`;
    }
    
    Alert.alert(
      'Usar descuento',
      `¿Quieres aplicar tu descuento de ${discountDescription} a esta compra?`,
      [
        { text: 'No usar', style: 'cancel' },
        { 
          text: 'Aplicar descuento', 
          style: 'default',
          onPress: () => {
            // El descuento ya está aplicado en el cálculo, solo confirmar
            Alert.alert(
              'Descuento aplicado',
              `Tu descuento de ${discountDescription} ha sido aplicado al total de tu compra.`
            );
          }
        }
      ]
    );
  };

  // Comprobar si el negocio acepta efectivo
  useEffect(() => {
    // Aquí podrías hacer una llamada a la API para verificar si el negocio acepta pago contra entrega
    // Por ahora, asumimos que todos los negocios lo aceptan
    setAcceptsCashOnDelivery(true);
  }, [cart.businessId]);

  // Handle selected location from MapScreen
  useEffect(() => {
    if (isFocused && route.params && 'selectedLocation' in route.params && !processedLocationParams.current) {
      const { selectedLocation, locationAddress } = route.params as any;
      if (selectedLocation && locationAddress) {
        setDeliveryAddress(locationAddress);
        // Mark as processed to prevent infinite loop
        processedLocationParams.current = true;
        
        // Clear params after processing to allow reselecting the same location later
        setTimeout(() => {
          navigation.setParams({ selectedLocation: undefined, locationAddress: undefined });
        }, 100);
      }
    }
    
    // Reset the flag when screen loses focus
    if (!isFocused) {
      processedLocationParams.current = false;
    }
  }, [isFocused, route.params, setDeliveryAddress, navigation]);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleQuantityChange = (id: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveItem(id);
    } else {
      updateQuantity(id, newQuantity);
    }
  };

  const handleRemoveItem = (id: string) => {
    Alert.alert(
      "Eliminar item",
      "¿Estás seguro que deseas eliminar este item del carrito?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: () => removeFromCart(id) }
      ]
    );
  };

  const handleClearCart = () => {
    Alert.alert(
      "Vaciar carrito",
      "¿Estás seguro que deseas vaciar tu carrito?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Vaciar", style: "destructive", onPress: () => clearCart() }
      ]
    );
  };

  const handleConfirmOrder = () => {
    // Validación básica del carrito
    if (cart.items.length === 0) {
      Alert.alert("Carrito vacío", "Agrega productos antes de continuar.");
      return;
    }
    
    // Validación de los datos necesarios para el pago
    if (!cart.businessId) {
      Alert.alert("Error", "No se pudo identificar el negocio. Por favor, intenta de nuevo.");
      return;
    }

    // Validar que el precio total sea un número válido y mayor que cero
    if (isNaN(totalPrice) || totalPrice <= 0) {
      Alert.alert("Error de precio", "El total a pagar no es válido. Por favor, revisa tu carrito.");
      return;
    }
    
    // Validar dirección de entrega
    if (!cart.deliveryAddress) {
      Alert.alert("Dirección requerida", "Por favor, ingresa una dirección de entrega para continuar.");
      return;
    }

    // Asegurarse de que todos los items tengan la información necesaria
    const invalidItems = cart.items.filter(
      item => !item.id || isNaN(item.price) || item.price <= 0 || !item.quantity || item.quantity <= 0
    );
    if (invalidItems.length > 0) {
      Alert.alert(
        "Productos con error", 
        "Algunos productos no tienen información completa. Por favor, elimínalos e intenta de nuevo."
      );
      return;
    }

    // Preparar datos para la pantalla de pago
    const businessName = cart.businessName || (cart.items.length > 0 && cart.items[0].businessName) || 'Localfy';
    
    // Mostrar modal para seleccionar método de pago
    setPaymentModalVisible(true);
  };

  const handlePaymentMethodSelection = (method: PaymentMethodType) => {
    setPaymentMethod(method);
    setPaymentModalVisible(false);
    
    // Preparar datos para la pantalla de pago
    const businessName = cart.businessName || (cart.items.length > 0 && cart.items[0].businessName) || 'Localfy';
    
    // Si es pago contra entrega, mostramos confirmación diferente
    if (method === 'cash') {
      Alert.alert(
        "Confirmar pedido",
        `¿Confirmas tu pedido de $${finalTotal.toFixed(2)} a ${businessName}? Pagarás en efectivo al recibir tu pedido.`,
        [
          { 
            text: "Cancelar", 
            style: "cancel" 
          },
          {
            text: "Confirmar pedido",
            onPress: () => {
              setLoading(true);
              
              // Aquí procesaríamos el pedido para pago contra entrega
              // Crear una copia limpia de los items del carrito
              const sanitizedCartItems = cart.items.map(item => ({
                id: item.id,
                name: item.name,
                price: Number(item.price),
                quantity: Number(item.quantity),
                businessId: item.businessId,
                businessName: item.businessName || businessName,
                image: item.image,
                notes: item.notes,
                options: item.options ? item.options.map(opt => ({
                  name: opt.name,
                  choice: opt.choice,
                  extraPrice: opt.extraPrice ? Number(opt.extraPrice) : 0
                })) : []
              }));
              
              // Aquí deberías enviar el pedido a tu servidor con método de pago 'cash'
              // Por ahora, solo simulamos un procesamiento exitoso
              
              setTimeout(() => {
                // Generar un ID de pedido simulado para los puntos
                const simulatedOrderId = `order-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                
                // Marcar el descuento como usado si se aplicó
                if (activeDiscount && activeDiscount.id) {
                  markRedemptionAsUsed(activeDiscount.id)
                    .then(() => console.log('Descuento marcado como usado'))
                    .catch(err => console.error('Error al marcar descuento como usado:', err));
                }
                
                // Otorgar puntos por la compra si el usuario está autenticado
                if (user && cart.businessId) {
                  awardPointsForPurchase(
                    simulatedOrderId,
                    finalTotal, // Usamos el precio final después del descuento
                    cart.businessId,
                    businessName
                  ).catch(err => console.error('Error awarding points:', err));
                  
                  // Calcular los puntos ganados (2 puntos por cada dólar)
                  const pointsEarned = Math.floor(finalTotal * 2);
                  
                  // Construir mensaje para mostrar descuento aplicado si lo hay
                  let discountMessage = '';
                  if (activeDiscount) {
                    if (activeDiscount.discountAmount) {
                      discountMessage = `\n\nSe aplicó un descuento de $${activeDiscount.discountAmount.toFixed(2)}.`;
                    } else if (activeDiscount.discountPercent) {
                      discountMessage = `\n\nSe aplicó un descuento del ${activeDiscount.discountPercent}%.`;
                    }
                  }
                  
                  // Limpiar carrito y mostrar confirmación con puntos ganados
                  clearCart();
                  setLoading(false);
                  Alert.alert(
                    "Pedido confirmado",
                    `Tu pedido ha sido enviado. Pagarás en efectivo cuando recibas tu orden.${discountMessage}\n\n¡Has ganado ${pointsEarned} puntos! Tienes un total de ${totalPoints + pointsEarned} puntos.`,
                    [
                      {
                        text: "OK",
                        onPress: () => {
                          navigation.reset({
                            index: 0,
                            routes: [{ name: 'MainTabs' }],
                          });
                        }
                      }
                    ]
                  );
                } else {
                  // Si el usuario no está autenticado, mostrar mensaje estándar
                  clearCart();
                  setLoading(false);
                  Alert.alert(
                    "Pedido confirmado",
                    "Tu pedido ha sido enviado. Pagarás en efectivo cuando recibas tu orden.",
                    [
                      {
                        text: "OK",
                        onPress: () => {
                          navigation.reset({
                            index: 0,
                            routes: [{ name: 'MainTabs' }],
                          });
                        }
                      }
                    ]
                  );
                }
              }, 1500);
            }
          }
        ]
      );
    } else {
      // Para pago con tarjeta, seguimos el flujo normal a PaymentScreen
      Alert.alert(
        "Confirmar pedido",
        `¿Estás seguro de que deseas proceder al pago de $${finalTotal.toFixed(2)} a ${businessName}?`,
        [
          { 
            text: "Cancelar", 
            style: "cancel" 
          },
          {
            text: "Proceder al pago",
            onPress: () => {
              setLoading(true);
              // Crear una copia limpia de los items del carrito para pasar a PaymentScreen
              const sanitizedCartItems = cart.items.map(item => ({
                id: item.id,
                name: item.name,
                price: Number(item.price),
                quantity: Number(item.quantity),
                businessId: item.businessId,
                businessName: item.businessName || businessName,
                image: item.image,
                notes: item.notes,
                options: item.options ? item.options.map(opt => ({
                  name: opt.name,
                  choice: opt.choice,
                  extraPrice: opt.extraPrice ? Number(opt.extraPrice) : 0
                })) : []
              }));
              
              navigation.navigate('Payment', {
                businessId: cart.businessId || '',
                businessName: businessName,
                amount: finalTotal, // Pasar el precio final después del descuento
                cartItems: sanitizedCartItems,
                isCartPayment: true,
                deliveryAddress: cart.deliveryAddress,
                deliveryNotes: cart.deliveryNotes,
                // Añadir información para los puntos
                shouldAwardPoints: !!user,
                pointsToAward: Math.floor(finalTotal * 2),
                // Información sobre el descuento aplicado
                appliedDiscountId: activeDiscount?.id,
                discountAmount: discountAmount
              });
              
              // Usamos setTimeout para asegurarnos de que la navegación se complete antes de quitar el indicador de carga
              setTimeout(() => {
                setLoading(false);
              }, 500);
            }
          }
        ]
      );
    }
  };

  const openProductDetail = (item: CartItem) => {
    setSelectedItem(item);
    setModalVisible(true);
  };

  // Function to open map for location selection
  const openLocationMap = () => {
    navigation.navigate('Map', { 
      selectingDeliveryLocation: true,
      currentAddress: cart.deliveryAddress || ''
    });
  };

  const renderItem = ({ item }: { item: CartItem }) => {
    return (
      <View style={styles.cartItem}>
        <TouchableOpacity onPress={() => openProductDetail(item)}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.itemImage} contentFit="cover" />
          ) : (
            <View style={[styles.itemImage, styles.placeholderImage]}>
              <MaterialIcons name="restaurant" size={24} color="#BBBBBB" />
            </View>
          )}
        </TouchableOpacity>
        
        <View style={styles.itemDetails}>
          <TouchableOpacity onPress={() => openProductDetail(item)}>
            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
          </TouchableOpacity>
          
          {item.options && item.options.length > 0 && (
            <Text style={styles.itemOptions} numberOfLines={1}>
              {item.options.map(opt => `${opt.name}: ${opt.choice}`).join(', ')}
            </Text>
          )}
          
          {item.notes && (
            <Text style={styles.itemNotes} numberOfLines={1}>Nota: {item.notes}</Text>
          )}
          
          <Text style={styles.itemPrice}>
            ${item.price.toFixed(2)}
            {item.options?.some(o => o.extraPrice && o.extraPrice > 0) && ' + extras'}
          </Text>
        </View>
        
        <View style={styles.itemActions}>
          <View style={styles.quantityControls}>
            <TouchableOpacity 
              style={styles.quantityButton}
              onPress={() => handleQuantityChange(item.id, item.quantity - 1)}
            >
              <MaterialIcons name="remove" size={18} color="#007AFF" />
            </TouchableOpacity>
            
            <Text style={styles.quantityText}>{item.quantity}</Text>
            
            <TouchableOpacity 
              style={styles.quantityButton}
              onPress={() => handleQuantityChange(item.id, item.quantity + 1)}
            >
              <MaterialIcons name="add" size={18} color="#007AFF" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={styles.removeButton}
            onPress={() => handleRemoveItem(item.id)}
          >
            <MaterialIcons name="delete-outline" size={22} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="black" />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Tu Carrito</Text>
            <Text style={styles.businessNameHeader}>
              {cart.businessName || (cart.items.length > 0 && cart.items[0].businessName) || 'Localfy'}
            </Text>
          </View>
          {cart.items.length > 0 && (
            <TouchableOpacity onPress={handleClearCart} style={styles.clearButton}>
              <MaterialIcons name="delete-sweep" size={24} color="#FF3B30" />
            </TouchableOpacity>
          )}
        </View>

        {cart.items.length > 0 ? (
          <>
            <FlatList
              data={cart.items}
              renderItem={renderItem}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.listContent,
                { 
                  paddingBottom: 200 + (insets.bottom > 0 ? insets.bottom : 0),
                  flexGrow: cart.items.length < 3 ? 1 : undefined 
                }
              ]}
              ListHeaderComponent={() => (
                <View style={styles.businessInfo}>
                  <MaterialIcons name="storefront" size={24} color="#007AFF" />
                  <View style={styles.businessInfoTextContainer}>
                    <Text style={styles.businessInfoLabel}>Productos de:</Text>
                    <Text style={styles.businessName}>
                      {cart.businessName || (cart.items.length > 0 && cart.items[0].businessName) || 'Localfy'}
                    </Text>
                  </View>
                </View>
              )}
            />

            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
              style={[
                styles.summaryContainer,
                { paddingBottom: Math.max(insets.bottom, 16) }
              ]}
            >
              <View style={styles.summaryContent}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal</Text>
                  <Text style={styles.summaryValue}>${totalPrice.toFixed(2)}</Text>
                </View>
                
                {/* Mostrar descuento si está disponible */}
                {activeDiscount && discountAmount > 0 && (
                  <View style={styles.discountRow}>
                    <View style={styles.discountLabelContainer}>
                      <MaterialIcons name="local-offer" size={16} color="#4CAF50" />
                      <Text style={styles.discountLabel}>Descuento aplicado</Text>
                    </View>
                    <Text style={styles.discountValue}>-${discountAmount.toFixed(2)}</Text>
                  </View>
                )}
                
                <View style={styles.divider} />
                
                <View style={styles.summaryRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>${finalTotal.toFixed(2)}</Text>
                </View>
                
                {/* Botón para aplicar/ver descuentos disponibles */}
                {user && (
                  <TouchableOpacity 
                    style={styles.discountButton}
                    onPress={showDiscountConfirmation}
                    disabled={!activeDiscount}
                  >
                    <MaterialIcons 
                      name={activeDiscount ? "confirmation-number" : "confirmation-number"} 
                      size={18} 
                      color={activeDiscount ? "#4CAF50" : "#BBBBBB"} 
                    />
                    <Text 
                      style={[
                        styles.discountButtonText,
                        {color: activeDiscount ? "#4CAF50" : "#BBBBBB"}
                      ]}
                    >
                      {activeDiscount 
                        ? `Descuento aplicado: ${activeDiscount.name}` 
                        : "No tienes descuentos disponibles"}
                    </Text>
                  </TouchableOpacity>
                )}
                
                {/* Sección de Dirección de Entrega */}
                <View style={styles.deliverySection}>
                  <Text style={styles.deliverySectionTitle}>Dirección de Entrega</Text>
                  
                  <TouchableOpacity 
                    style={styles.addressSelector}
                    onPress={openLocationMap}
                  >
                    <View style={styles.addressInfo}>
                      <MaterialIcons name="location-on" size={20} color="#007AFF" />
                      <TextInput
                        style={styles.addressInput}
                        placeholder="Ingresa tu dirección de entrega"
                        multiline={true}
                        numberOfLines={2}
                        value={cart.deliveryAddress || ''}
                        onChangeText={(text) => {
                          setDeliveryAddress(text);
                        }}
                      />
                    </View>
                    <MaterialIcons name="map" size={20} color="#007AFF" />
                  </TouchableOpacity>
                  
                  {/* Notas de Entrega */}
                  <Text style={styles.deliverySectionTitle}>Notas para el repartidor</Text>
                  <TextInput
                    style={styles.notesInput}
                    placeholder="Ej: Tocar el timbre, dejar con el portero, etc."
                    multiline={true}
                    numberOfLines={3}
                    value={cart.deliveryNotes || ''}
                    onChangeText={(text) => {
                      setDeliveryNotes(text);
                    }}
                  />
                </View>
                
                <TouchableOpacity 
                  style={[
                    styles.checkoutButton,
                    { marginBottom: insets.bottom > 0 ? insets.bottom + 28 : 40 }
                  ]}
                  onPress={handleConfirmOrder}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#007AFF', '#00A2FF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.checkoutButtonGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <MaterialIcons name="shopping-bag" size={20} color="#FFFFFF" style={styles.checkoutIcon} />
                        <Text style={styles.checkoutButtonText}>Confirmar Pedido</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </>
        ) : (
          <View style={styles.emptyCart}>
            <MaterialIcons name="shopping-cart" size={80} color="#E5E5E5" />
            <Text style={styles.emptyCartTitle}>Tu carrito está vacío</Text>
            <TouchableOpacity 
              style={styles.browseButton}
              onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
            >
              <Text style={styles.browseButtonText}>Explorar negocios</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Modal de detalle del producto */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Detalle del Producto</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <MaterialIcons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              {selectedItem && (
                <ScrollView style={styles.modalBody}>
                  {selectedItem.image ? (
                    <Image 
                      source={{ uri: selectedItem.image }} 
                      style={styles.modalImage} 
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.modalImage, styles.modalPlaceholderImage]}>
                      <MaterialIcons name="restaurant" size={48} color="#BBBBBB" />
                    </View>
                  )}

                  <View style={styles.modalProductInfo}>
                    <Text style={styles.modalProductName}>{selectedItem.name}</Text>
                    <Text style={styles.modalProductPrice}>${selectedItem.price.toFixed(2)}</Text>

                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Cantidad</Text>
                      <Text style={styles.detailSectionValue}>{selectedItem.quantity}</Text>
                    </View>

                    {selectedItem.options && selectedItem.options.length > 0 && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>Opciones Seleccionadas</Text>
                        {selectedItem.options.map((option, index) => (
                          <View key={index} style={styles.optionItem}>
                            <Text style={styles.optionName}>{option.name}:</Text>
                            <Text style={styles.optionValue}>{option.choice}</Text>
                            {option.extraPrice && option.extraPrice > 0 ? (
                              <Text style={styles.optionPrice}>+${option.extraPrice.toFixed(2)}</Text>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    )}

                    {selectedItem.notes && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>Notas</Text>
                        <Text style={styles.notesText}>{selectedItem.notes}</Text>
                      </View>
                    )}

                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Negocio</Text>
                      <Text style={styles.businessNameText}>
                        {selectedItem.businessName || cart.businessName || 'Localfy'}
                      </Text>
                    </View>
                  </View>
                </ScrollView>
              )}

              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={styles.modalButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal de selección de método de pago */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={paymentModalVisible}
          onRequestClose={() => setPaymentModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: 500 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Método de Pago</Text>
                <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                  <MaterialIcons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              <View style={styles.paymentMethodsContainer}>
                <Text style={styles.paymentMethodsTitle}>
                  Selecciona tu método de pago preferido:
                </Text>

                <TouchableOpacity 
                  style={styles.paymentMethodItem}
                  onPress={() => handlePaymentMethodSelection('card')}
                >
                  <MaterialIcons name="credit-card" size={28} color="#007AFF" />
                  <View style={styles.paymentMethodInfo}>
                    <Text style={styles.paymentMethodName}>Tarjeta de crédito/débito</Text>
                    <Text style={styles.paymentMethodDescription}>
                      Paga con tu tarjeta a través de Stripe
                    </Text>
                  </View>
                  <MaterialIcons name="arrow-forward-ios" size={16} color="#999" />
                </TouchableOpacity>

                {acceptsCashOnDelivery && (
                  <TouchableOpacity 
                    style={styles.paymentMethodItem}
                    onPress={() => handlePaymentMethodSelection('cash')}
                  >
                    <MaterialIcons name="attach-money" size={28} color="#2E7D32" />
                    <View style={styles.paymentMethodInfo}>
                      <Text style={styles.paymentMethodName}>Efectivo</Text>
                      <Text style={styles.paymentMethodDescription}>
                        Paga en efectivo al recibir tu pedido
                      </Text>
                    </View>
                    <MaterialIcons name="arrow-forward-ios" size={16} color="#999" />
                  </TouchableOpacity>
                )}

              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={styles.modalButtonSecondary}
                  onPress={() => setPaymentModalVisible(false)}
                >
                  <Text style={styles.modalButtonSecondaryText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 8,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  businessNameHeader: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '600',
    marginTop: 2,
  },
  clearButton: {
    padding: 8,
  },
  listContent: {
    padding: 16,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  placeholderImage: {
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemOptions: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  itemNotes: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#007AFF',
  },
  itemActions: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    marginBottom: 8,
  },
  quantityButton: {
    padding: 4,
    width: 28,
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    width: 24,
    textAlign: 'center',
  },
  removeButton: {
    padding: 4,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D1E3FF',
  },
  businessInfoTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  businessInfoLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  businessName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
  },
  summaryContainer: {
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 4,
    zIndex: 10,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  summaryContent: {
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#EEE',
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  checkoutButton: {
    marginTop: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden',
  },
  checkoutButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  checkoutIcon: {
    marginRight: 8,
  },
  checkoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyCartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
  },
  emptyCartDescription: {
    fontSize: 16,
    color: '#666',
    marginVertical: 12,
  },
  browseButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20,
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Estilos para el Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: SCREEN_WIDTH * 0.9,
    maxHeight: SCREEN_HEIGHT * 0.8,
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  modalImage: {
    width: '100%',
    height: 200,
  },
  modalPlaceholderImage: {
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalProductInfo: {
    padding: 16,
  },
  modalProductName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modalProductPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 16,
  },
  detailSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  detailSectionValue: {
    fontSize: 16,
    color: '#333',
  },
  optionItem: {
    flexDirection: 'row',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  optionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginRight: 8,
  },
  optionValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  optionPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  notesText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  businessNameText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    padding: 16,
    alignItems: 'center',
  },
  modalButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 12,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalButtonSecondary: {
    borderWidth: 1,
    borderColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 12,
  },
  modalButtonSecondaryText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Estilos para el modal de métodos de pago
  paymentMethodsContainer: {
    padding: 16,
  },
  paymentMethodsTitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  paymentMethodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#FAFAFA',
  },
  paymentMethodInfo: {
    flex: 1,
    marginLeft: 16,
  },
  paymentMethodName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  paymentMethodDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  // Estilos para la sección de dirección de entrega
  deliverySection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  deliverySectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  addressSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
  },
  addressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  addressInput: {
    flex: 1,
    padding: 8,
  },
  notesInput: {
    padding: 12,
  },
  discountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
    alignItems: 'center',
  },
  discountLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  discountLabel: {
    fontSize: 16,
    color: '#4CAF50',
    marginLeft: 6,
  },
  discountValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4CAF50',
  },
  discountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  discountButtonText: {
    marginLeft: 8,
    fontSize: 14,
  },
});


