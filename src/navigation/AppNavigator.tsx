import React, { useEffect, useState, useRef } from 'react';
import {
  NavigationContainer,
  useNavigationContainerRef
} from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { View, TouchableOpacity, ActivityIndicator, Text, StyleSheet, AppState, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useChat, ChatProvider } from '../context/ChatContext';
import * as Notifications from 'expo-notifications';
import OfflineBanner from '../components/common/OfflineBanner';
import { notificationService } from '../../services/NotificationService';
import { NotificationProvider } from '../context/NotificationContext';

// Screens
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import RegisterScreen from '../screens/RegisterScreen';
import BusinessDetailScreen from '../screens/BusinessDetailScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import MapScreen from '../screens/MapScreen';
import AddBusinessScreen from '../screens/AddBusinessScreen';

// New Screens for Business Detail Enhancements
import BusinessHoursScreen from '../screens/business/BusinessHoursScreen';
import PaymentMethodsScreen from '../screens/business/PaymentMethodsScreen';
import SocialLinksScreen from '../screens/business/SocialLinkScreen';
import MenuEditorScreen from '../screens/business/MenuEditorScreen';

// Importar la pantalla EditBusiness
import EditBusinessScreen from '../screens/business/EditBusinessScreen';
import MyBusinessesScreen from '../screens/business/MyBusinessesScreen';

// Importar nuevas pantallas
import PromotionsScreen from '../screens/business/PromotionsScreen';
import ReservationsScreen from '../screens/business/ReservationsScreen';
import MyReservationsScreen from '../screens/reservations/MyReservationsScreen';

// Importar pantallas de chat
import ConversationsScreen from '../screens/chat/ConversationsScreen';
import ChatScreen from '../screens/chat/ChatScreen';

// Importar pantalla de notificaciones
import NotificationsScreen from '../screens/NotificationsScreen';

// Importar pantallas del Centro de Ayuda
import FAQsScreen from '../screens/FAQsScreen';
import SupportScreen from '../screens/SupportScreen';
import TermsConditionsScreen from '../screens/TermsConditionsScreen';

// Importar pantalla de Payment
import PaymentScreen from '../screens/PaymentScreen';

// Importar pantalla de Cart
import { CartScreen } from '../screens/CartScreen';

// Importar pantalla de Puntos
import PointsScreen from '../screens/PointsScreen';

// Importar pantallas de órdenes
import OrderConfirmationScreen from '../screens/orders/OrderConfirmationScreen';
// @ts-ignore
import OrderDetailsScreen from '../screens/orders/OrderDetailsScreen';
// @ts-ignore
import OrdersListScreen from '../screens/orders/OrdersListScreen';
// @ts-ignore
import BusinessOrdersScreen from '../screens/orders/BusinessOrdersScreen';
// @ts-ignore
import BusinessSelectorScreen from '../screens/orders/BusinessSelectorScreen';

// Importar nueva pantalla de redes sociales
import SocialMediaScreen from '../screens/SocialMediaScreen';

// Import business onboarding screens
import BusinessOnboardingWelcomeScreen from '../screens/onboarding/BusinessOnboardingWelcomeScreen';
import BusinessOnboardingModeSelectionScreen from '../screens/onboarding/BusinessOnboardingModeSelectionScreen';
import BusinessOnboardingStepsScreen from '../screens/onboarding/BusinessOnboardingStepsScreen';

// Define the root stack parameter list with properly typed screen params
export type RootStackParamList = {
  Auth: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  MainTabs: { screen?: keyof MainTabParamList };  // Allow specifying which tab to navigate to
  BusinessDetail: { businessId: string; fromOnboarding?: boolean };
  // Business enhancement screens
  BusinessHours: { initialHours?: any; callbackId?: string };
  PaymentMethods: { initialMethods?: string[]; callbackId?: string };
  SocialLinks: { initialLinks?: any; callbackId?: string };
  MenuEditor: { businessId: string; initialMenu?: any[]; menuUrl?: string; callbackId?: string };
  // Individual screens that can be accessed directly
  Home: undefined;
  Map: {
    selectingDeliveryLocation?: boolean;
    currentAddress?: string;
  };
  Favorites: undefined;
  Profile: undefined;
  AddBusiness: undefined;
  // Agregar estas rutas faltantes
  EditBusiness: { businessId: string };
  MyBusinesses: undefined;
  // Añadir estas nuevas rutas
  Promotions: {
    businessId: string;
    businessName: string;
    isNewBusiness?: boolean;
  };
  Reservations: {
    businessId: string;
    businessName: string;
    isNewBusiness?: boolean;
  };
  // Nueva ruta para gestión de reservaciones
  MyReservations: {
    businessId?: string;
    isBusinessView?: boolean;
  };
  // Rutas para el chat
  Conversations: undefined;
  Chat: { conversationId: string };
  // Ruta para notificaciones
  Notifications: undefined;
  // Nuevas rutas para el Centro de Ayuda
  FAQs: undefined;
  Support: undefined;
  Tutorials: undefined;
  TermsConditions: undefined;
  // Nueva ruta para puntos
  Points: undefined;
  // Nueva ruta para pagos
  Payment: {
    businessId?: string;
    businessName?: string;
    amount?: number;
    cartItems?: any[]; // Añadir cartItems como parámetro opcional
    isCartPayment?: boolean; // Flag para indicar si el pago viene del carrito
    deliveryAddress?: string | null; // Dirección de entrega
    deliveryNotes?: string | null; // Notas para el repartidor
    appliedDiscountId?: string; // ID del descuento aplicado
    discountAmount?: number; // Cantidad del descuento aplicado
    shouldAwardPoints?: boolean; // Si se deben otorgar puntos por la compra
    pointsToAward?: number; // Cantidad de puntos a otorgar
  };
  // Nueva ruta para carrito
  Cart: {
    selectedLocation?: {
      latitude: number;
      longitude: number;
    };
    locationAddress?: string;
  };
  // Nuevas rutas para ordenes
  OrderConfirmation: { 
    orderId: string;
    orderNumber: string;
  };
  OrderDetails: { 
    orderId: string;
  };
  OrdersList: undefined;
  BusinessOrders: { 
    businessId: string;
    businessName: string;
  };
  // Nueva ruta para seleccionar negocio
  BusinessSelector: undefined;
  // Nueva ruta para redes sociales
  SocialMedia: undefined;
  // Business onboarding screens
  BusinessOnboardingWelcome: undefined;
  BusinessOnboardingModeSelection: undefined;
  BusinessOnboardingSteps: undefined;
};

// Define tab navigator parameter list
export type MainTabParamList = {
  Home: undefined;
  Conversations: undefined;
  AddBusiness: undefined;
  Profile: undefined;
  Cart: undefined;
  // Removed Favorites as a main tab
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Custom center button for adding a business
const CustomAddButton = ({onPress}: {onPress: () => void}) => (
  <TouchableOpacity
    style={{
      top: Platform.OS === 'ios' ? -30 : -25,
      justifyContent: 'center',
      alignItems: 'center',
    }}
    onPress={onPress}
  >
    <View style={{
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: '#007AFF',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#007AFF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    }}>
      <MaterialIcons name="add" size={30} color="white" />
    </View>
  </TouchableOpacity>
);

// Bottom Tab Navigator
function MainTabs() {
  // Usamos el hook de chat, pero nos aseguramos que sea seguro
  // Definimos un valor por defecto para evitar errores
  const chatContext = useChat();
  // Obtenemos el número de mensajes no leídos directamente del contexto
  const unreadTotal = chatContext?.unreadTotal || 0;
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          // Use explicit type assertion to fix the error
          if (route.name === 'Home') {
            return <MaterialIcons name={'home' as any} size={size} color={color} />;
          } else if (route.name === 'Conversations') {
            return (
              <View style={{ position: 'relative' }}>
                <MaterialIcons name="chat" size={size} color={color} />
                {unreadTotal > 0 && (
                  <View style={{
                    position: 'absolute',
                    right: -6,
                    top: -6,
                    backgroundColor: '#FF3B30',
                    borderRadius: 10,
                    minWidth: 16,
                    height: 16,
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingHorizontal: 4
                  }}>
                    <Text style={{
                      color: 'white',
                      fontSize: 10,
                      fontWeight: 'bold'
                    }}>
                      {unreadTotal > 99 ? '99+' : unreadTotal}
                    </Text>
                  </View>
                )}
              </View>
            );
          } else if (route.name === 'AddBusiness') {
            return null; // Custom button will handle this
          } else if (route.name === 'Profile') {
            return <MaterialIcons name={focused ? 'person' as any : 'person-outline' as any} size={size} color={color} />;
          } else if (route.name === 'Cart') {
            return <MaterialIcons name="shopping-cart" size={size} color={color} />;
          }
          // Default fallback
          return <MaterialIcons name={'circle' as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          elevation: 0,
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 85 : 70,
          paddingBottom: Platform.OS === 'ios' ? 25 : 10,
          paddingTop: 8,
          borderTopLeftRadius: 25,
          borderTopRightRadius: 25,
          backgroundColor: 'white',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          position: 'absolute',
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ tabBarLabel: 'Inicio' }} // Updated label to Spanish
      />
      <Tab.Screen 
        name="Conversations" 
        component={ConversationsScreen} 
        options={{ tabBarLabel: 'Mensajes' }} // Updated label to Spanish
      />
      <Tab.Screen 
        name="AddBusiness" 
        component={AddBusinessScreen} 
        options={{
          tabBarButton: (props) => (
            <CustomAddButton 
              onPress={() => {
                if (props.onPress) {
                  // Pass the event parameter even if we don't use it
                  props.onPress({} as any);
                }
              }} 
            />
          ),
          tabBarLabel: '' // Optionally hide label
        }}
      />
      <Tab.Screen 
        name="Cart" 
        component={CartScreen}
        options={{
          tabBarLabel: 'Carrito',
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ tabBarLabel: 'Perfil' }} // Updated label to Spanish
      />
    </Tab.Navigator>
  );
}

// Authentication Flow Navigator
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
  </Stack.Navigator>
);

// Main App Navigator
const AppNavigator = () => {
  const { user, isLoading } = useAuth();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const appState = useRef(AppState.currentState);

  // Configurar manejadores de notificaciones
  useEffect(() => {
    // Verificar que el servicio esté disponible
    if (!notificationService) {
      console.error('[AppNavigator] NotificationService not available.');
      return;
    }

    // Listener para notificaciones recibidas (app en primer plano)
    const notificationReceivedSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('[AppNavigator] Notification received in foreground:', notification?.request?.content?.title);
      // Opcional: Podrías usar el ChatContext para actualizar el badge count aquí si es necesario
      // o mostrar una alerta in-app personalizada.
    });

    // Listener para respuesta a notificaciones (tap)
    const notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[AppNavigator] User tapped on notification:');
      const data = response.notification.request.content.data;
      console.log('[AppNavigator] Notification data:', data);

      // Verificar si la referencia de navegación está lista
      if (navigationRef.isReady()) {
        // Navegar basado en el tipo de notificación
        if (data && data.type === 'chat' && data.conversationId) {
          console.log('[AppNavigator] Navigating to Chat screen:', data.conversationId);
          // Navegar a la conversación específica
          // Asegúrate que 'Chat' y 'conversationId' coincidan con tu RootStackParamList
          navigationRef.navigate('Chat', { conversationId: data.conversationId });
        } else if (data && data.type === 'chat') {
          // Si es de chat pero sin ID específico, ir a la lista
          console.log('[AppNavigator] Navigating to Conversations screen');
          navigationRef.navigate('MainTabs', { screen: 'Conversations' });
        } else {
          // Manejar otros tipos de notificaciones o simplemente ir a Home
          console.log('[AppNavigator] Notification type not handled or unknown, navigating to Home.');
          navigationRef.navigate('MainTabs', { screen: 'Home' });
        }
      }
    });

    // Listener para cambios de estado de la app (refrescar token)
    const appStateSubscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        user
      ) {
        console.log('[AppNavigator] App has come to the foreground, refreshing notification token');
        refreshNotificationToken();
      }
      appState.current = nextAppState;
    });

    // Comprobar si la app fue abierta por una notificación
    notificationService.getLastNotificationResponse().then(response => {
      if (response && navigationRef.isReady()) {
        console.log('[AppNavigator] App opened via notification tap (initial check):');
        const data = response.notification.request.content.data;
        console.log('[AppNavigator] Initial notification data:', data);
        // Lógica de navegación similar al listener
        if (data && data.type === 'chat' && data.conversationId) {
          navigationRef.navigate('Chat', { conversationId: data.conversationId });
        } else if (data && data.type === 'chat') {
          navigationRef.navigate('MainTabs', { screen: 'Conversations' });
        }
        // No navegar a Home aquí para evitar anular navegación inicial si no es de chat
      }
    });

    return () => {
      // Limpiar listeners al desmontar
      Notifications.removeNotificationSubscription(notificationReceivedSubscription);
      Notifications.removeNotificationSubscription(notificationResponseSubscription);
      appStateSubscription.remove();
    };
  }, [user, navigationRef]);

  // Función para refrescar token de notificaciones
  const refreshNotificationToken = async () => {
    if (!user) return;
    if (!notificationService) {
      console.log('[AppNavigator] Notification service not available for refresh.');
      return;
    }
    
    try {
      // Verificar permisos
      const permissionResult = await notificationService.requestNotificationPermissions();
      if (permissionResult.success && permissionResult.data?.granted) {
        // Registrar para notificaciones
        const tokenResult = await notificationService.registerForPushNotifications();
        if (tokenResult.success && tokenResult.data?.token) {
          // Actualizar token en Firestore
          await notificationService.saveTokenToFirestore(user.uid, tokenResult.data.token);
          console.log('[AppNavigator] Notification token refreshed successfully');
        }
      }
    } catch (error) {
      console.error('[AppNavigator] Error refreshing notification token:', error);
    }
  };
  
  // Componente interno para manejar el token de notificaciones
  const AppWithChat = () => {
    // Usar el hook de chat dentro del contexto
    const chatContext = useChat();
    
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="BusinessDetail" component={BusinessDetailScreen} />
            {/* Mantén solo esta definición de Payment */}
            <Stack.Screen 
              name="Payment" 
              component={PaymentScreen} 
              options={{
                headerShown: true,
                title: 'Realizar Pago',
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerTintColor: '#007AFF',
              }} 
            />
            
            {/* Agregar las nuevas pantallas */}
            <Stack.Screen name="EditBusiness" component={EditBusinessScreen} />
            <Stack.Screen name="MyBusinesses" component={MyBusinessesScreen} />
            <Stack.Screen name="Promotions" component={PromotionsScreen} />
            <Stack.Screen name="Reservations" component={ReservationsScreen} />
            <Stack.Screen 
              name="MyReservations" 
              component={MyReservationsScreen} 
              options={{ 
                title: 'Reservaciones', 
                headerShown: false 
              }} 
            />
            
            {/* New Business Detail Enhancement Screens */}
            <Stack.Screen 
              name="BusinessHours" 
              component={BusinessHoursScreen}
              options={{ 
                headerShown: true,
                title: 'Horarios de Atención',
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerTintColor: '#007AFF'
              }} 
            />
            <Stack.Screen 
              name="PaymentMethods" 
              component={PaymentMethodsScreen}
              options={{ 
                headerShown: true,
                title: 'Métodos de Pago',
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerTintColor: '#007AFF'
              }} 
            />
            <Stack.Screen 
              name="SocialLinks" 
              component={SocialLinksScreen}
              options={{ 
                headerShown: true,
                title: 'Redes Sociales',
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerTintColor: '#007AFF'
              }} 
            />
            <Stack.Screen 
              name="MenuEditor" 
              component={MenuEditorScreen}
              options={{ 
                headerShown: true,
                title: 'Editor de Menú',
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerTintColor: '#007AFF'
              }} 
            />
            
            {/* Añadir las pantallas del Centro de Ayuda */}
            <Stack.Screen name="FAQs" component={FAQsScreen} />
            <Stack.Screen name="Support" component={SupportScreen} />
            <Stack.Screen name="TermsConditions" component={TermsConditionsScreen} />
            
            {/* Add direct routes to these screens for when navigating from outside their tab navigator */}
            <Stack.Screen name="Map" component={MapScreen} />
            <Stack.Screen name="Favorites" component={FavoritesScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="AddBusiness" component={AddBusinessScreen} />
            
            {/* Chat screens */}
            <Stack.Screen name="Conversations" component={ConversationsScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            
            {/* Notifications screen */}
            <Stack.Screen name="Notifications" component={NotificationsScreen} />

            {/* Points screen */}
            <Stack.Screen 
              name="Points" 
              component={PointsScreen}
              options={{ 
                headerShown: false
              }} 
            />

            {/* Cart screen */}
            <Stack.Screen name="Cart" component={CartScreen} options={{ headerShown: false }} />
            
            {/* Order screens */}
            <Stack.Screen 
              name="OrderConfirmation" 
              component={OrderConfirmationScreen}
              options={{ 
                headerShown: false
              }} 
            />
            <Stack.Screen 
              name="OrderDetails" 
              component={OrderDetailsScreen}
              options={{ 
                headerShown: true,
                title: 'Detalles del Pedido',
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerTintColor: '#007AFF'
              }} 
            />
            <Stack.Screen 
              name="OrdersList" 
              component={OrdersListScreen}
              options={{ 
                headerShown: true,
                title: 'Mis Pedidos',
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerTintColor: '#007AFF'
              }} 
            />
            <Stack.Screen 
              name="BusinessOrders" 
              component={BusinessOrdersScreen}
              options={{ 
                headerShown: true,
                title: 'Pedidos del Negocio',
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerTintColor: '#007AFF'
              }} 
            />
            <Stack.Screen 
              name="BusinessSelector" 
              component={BusinessSelectorScreen}
              options={{ 
                headerShown: true,
                title: 'Seleccionar Negocio',
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerTintColor: '#007AFF'
              }} 
            />
            
            {/* Business Onboarding Flow */}
            <Stack.Screen 
              name="BusinessOnboardingWelcome" 
              component={BusinessOnboardingWelcomeScreen}
              options={{ headerShown: false }} 
            />
            <Stack.Screen 
              name="BusinessOnboardingModeSelection" 
              component={BusinessOnboardingModeSelectionScreen}
              options={{ headerShown: false }} 
            />
            <Stack.Screen 
              name="BusinessOnboardingSteps" 
              component={BusinessOnboardingStepsScreen}
              options={{ headerShown: false }} 
            />
            
            {/* Nueva ruta para redes sociales */}
            <Stack.Screen name="SocialMedia" component={SocialMediaScreen} />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthStack} />
        )}
      </Stack.Navigator>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando Localfy...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <OfflineBanner />
      <NotificationProvider>
        <ChatProvider>
          <AppWithChat />
        </ChatProvider>
      </NotificationProvider>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333333',
  },
});

export default AppNavigator;