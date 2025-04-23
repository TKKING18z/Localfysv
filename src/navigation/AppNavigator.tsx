import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { View, TouchableOpacity, ActivityIndicator, Text, StyleSheet, AppState, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useChat, ChatProvider } from '../context/ChatContext';
import { useOrders } from '../context/OrderContext';
import * as Notifications from 'expo-notifications';
import OrderStatusNotification from '../components/notifications/OrderStatusNotification';
import { useAppInitialization } from '../hooks/useAppInitialization';

// Añadir importaciones de NavigationService aquí para que estén disponibles globalmente
import NavigationService, { navigationRef } from './services/NavigationService';

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
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';

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

// Importar pantallas de órdenes
import OrderConfirmationScreen from '../screens/orders/OrderConfirmationScreen';
// @ts-ignore
import OrderDetailsScreen from '../screens/orders/OrderDetailsScreen';
// @ts-ignore
import OrdersListScreen from '../screens/orders/OrdersListScreen';
// @ts-ignore
import BusinessOrdersScreen from '../screens/orders/BusinessOrdersScreen';

// Importar pantalla de carga de pedidos
import OrderLoadingScreen from '../screens/orders/OrderLoadingScreen';

// Define the root stack parameter list with properly typed screen params
export type RootStackParamList = {
  Auth: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  MainTabs: { screen?: keyof MainTabParamList };  // Allow specifying which tab to navigate to
  BusinessDetail: { businessId: string };
  // Add Onboarding screen to the param list
  Onboarding: { 
    onboardingContext?: { 
      completeOnboarding: () => Promise<boolean> 
    } 
  };
  // Business enhancement screens
  BusinessHours: { initialHours?: any; callbackId?: string };
  PaymentMethods: { initialMethods?: string[]; callbackId?: string };
  SocialLinks: { initialLinks?: any; callbackId?: string };
  MenuEditor: { businessId: string; initialMenu?: any[]; menuUrl?: string; callbackId?: string };
  // Individual screens that can be accessed directly
  Home: undefined;
  Map: undefined;
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
  // Nueva ruta para pagos
  Payment: {
    businessId?: string;
    businessName?: string;
    amount?: number;
    cartItems?: any[]; // Añadir cartItems como parámetro opcional
    isCartPayment?: boolean; // Flag para indicar si el pago viene del carrito
  };
  // Nueva ruta para carrito
  Cart: undefined;
  // Nuevas rutas para ordenes
  OrderLoading: {
    orderId: string;
    orderNumber: string;
  };
  OrderConfirmation: { 
    orderId: string;
    orderNumber: string;
    preloadedOrder?: any; // Permitir pasar los datos precargados
  };
  OrderDetails: { 
    orderId: string;
  };
  OrdersList: undefined;
  BusinessOrders: { 
    businessId: string;
    businessName: string;
  };
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
      top: -25,
      justifyContent: 'center',
      alignItems: 'center',
    }}
    onPress={onPress}
  >
    <View style={{
      width: 55,
      height: 55,
      borderRadius: 28,
      backgroundColor: '#007AFF',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#007AFF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
      borderWidth: 3,
      borderColor: 'white',
    }}>
      <MaterialIcons name="add" size={28} color="white" />
    </View>
    <Text style={{
      color: '#8E8E93',
      fontSize: 11,
      fontWeight: '500',
      marginTop: 6,
    }}>Añadir</Text>
  </TouchableOpacity>
);

// Bottom Tab Navigator
function MainTabs() {
  // Reactivamos el contexto de chat
  const chatContext = useChat();
  const unreadTotal = chatContext?.unreadTotal || 0;
  // const unreadTotal = 0; // Temporary fix
  
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
          height: 70,  // Reducir altura
          paddingTop: 8, // Reducir padding superior
          paddingBottom: 10, // Reducir padding inferior
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          backgroundColor: 'white',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          position: 'absolute',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 3,
        },
        tabBarIconStyle: {
          marginTop: 3,
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
const AuthStack = () => {
  // Get the app initialization state to check if it's first launch
  const { isFirstLaunch, completeOnboarding } = useAppInitialization();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isFirstLaunch ? (
        <Stack.Screen 
          name="Onboarding" 
          component={OnboardingScreen} 
          initialParams={{ onboardingContext: { completeOnboarding } }}
        />
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

// Componente interno para manejar el token de notificaciones
const AppWithChat = () => (
  <Stack.Navigator initialRouteName="MainTabs">
    <Stack.Screen
      name="MainTabs"
      component={MainTabs}
      options={{ headerShown: false }}
    />
    
    <Stack.Screen 
      name="BusinessDetail" 
      component={BusinessDetailScreen} 
      options={{ 
        headerShown: true,
        title: 'Detalles del Negocio'
      }}
    />
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
    <Stack.Screen 
      name="EditBusiness" 
      component={EditBusinessScreen}
      options={{ 
        headerShown: true,
        title: 'Editar Negocio'
      }} 
    />
    <Stack.Screen 
      name="MyBusinesses" 
      component={MyBusinessesScreen}
      options={{ 
        headerShown: true,
        title: 'Mis Negocios'
      }} 
    />
    <Stack.Screen 
      name="Promotions" 
      component={PromotionsScreen}
      options={{ 
        headerShown: true,
        title: 'Promociones'
      }} 
    />
    <Stack.Screen 
      name="Reservations" 
      component={ReservationsScreen}
      options={{ 
        headerShown: true,
        title: 'Reservaciones'
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
    <Stack.Screen 
      name="FAQs" 
      component={FAQsScreen}
      options={{ 
        headerShown: true,
        title: 'Preguntas Frecuentes'
      }} 
    />
    <Stack.Screen 
      name="Support" 
      component={SupportScreen}
      options={{ 
        headerShown: true,
        title: 'Soporte'
      }} 
    />
    <Stack.Screen 
      name="TermsConditions" 
      component={TermsConditionsScreen}
      options={{ 
        headerShown: true,
        title: 'Términos y Condiciones'
      }} 
    />
    
    {/* Add direct routes to these screens for when navigating from outside their tab navigator */}
    <Stack.Screen 
      name="Map" 
      component={MapScreen}
      options={{ 
        headerShown: true,
        title: 'Mapa'
      }} 
    />
    <Stack.Screen 
      name="Favorites" 
      component={FavoritesScreen}
      options={{ 
        headerShown: true,
        title: 'Favoritos'
      }} 
    />
    <Stack.Screen 
      name="Profile" 
      component={ProfileScreen}
      options={{ 
        headerShown: true,
        title: 'Perfil'
      }} 
    />
    <Stack.Screen 
      name="AddBusiness" 
      component={AddBusinessScreen}
      options={{ 
        headerShown: true,
        title: 'Añadir Negocio'
      }} 
    />
    
    {/* Chat screens */}
    <Stack.Screen 
      name="Conversations" 
      component={ConversationsScreen}
      options={{ 
        headerShown: true,
        title: 'Conversaciones'
      }} 
    />
    <Stack.Screen 
      name="Chat" 
      component={ChatScreen}
      options={{ 
        headerShown: true,
        title: 'Chat'
      }} 
    />
    
    {/* Notifications screen */}
    <Stack.Screen 
      name="Notifications" 
      component={NotificationsScreen}
      options={{ 
        headerShown: true,
        title: 'Notificaciones'
      }} 
    />

    {/* Cart screen */}
    <Stack.Screen name="Cart" component={CartScreen} options={{ headerShown: false }} />
    
    {/* Order screens */}
    <Stack.Screen 
      name="OrderLoading" 
      component={OrderLoadingScreen}
      options={{ 
        headerShown: false,
        gestureEnabled: false // Desactivar gestos para evitar problemas de navegación
      }} 
    />
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
        headerShown: false // Changed to false to avoid duplicate headers 
      }} 
    />
  </Stack.Navigator>
);

// Main App Navigator
const AppNavigator = () => {
  // Usar el hook de autenticación
  const { user, isLoading } = useAuth();
  const { newStatusNotification, dismissNotification } = useOrders();
  const { appIsReady, onNavigationReady } = useAppInitialization();
  
  // Todas las referencias y estados deben declararse al principio, antes de cualquier lógica
  const isMounted = useRef<boolean>(true);
  const notificationServiceRef = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const notificationListener = useRef<any>(null);
  const appState = useRef<string>(AppState.currentState);
  const lastTokenRefresh = useRef<number>(0);
  
  // Estados
  const [updateNotificationToken, setUpdateNotificationToken] = useState<((token: string) => Promise<void>) | undefined>(undefined);
  
  // Usar el hook onReady de NavigationContainer 
  const handleNavigationReady = useCallback(() => {
    console.log("[AppNavigator] NavigationContainer is ready");
    NavigationService.setNavigationReady();
  }, []);
  
  // Función para refrescar token de notificaciones (versión dummy para evitar errores de tipo)
  const refreshNotificationToken = useCallback(() => {
    console.log("[AppNavigator] Token refresh requested but disabled");
  }, []);
  
  // Cargar el servicio de notificaciones (una vez)
  useEffect(() => {
    try {
      const { notificationService } = require('../../services/NotificationService');
      notificationServiceRef.current = notificationService;
    } catch (error) {
      console.error('[AppNavigator] Error loading notification service:', error);
    }
    
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Efecto para la navegación
  useEffect(() => {
    if (!isLoading && navigationRef.current) {
      NavigationService.setNavigationReady();
    }
  }, [isLoading]);
  
  // Efecto simplificado para manejar cambios de estado de la app
  useEffect(() => {
    // Solo ejecutar si hay un usuario
    if (!user) return;
    
    console.log("[AppNavigator] Setting up app state change listener");
    
    // Configurar el escucha básico
    const subscription = AppState.addEventListener('change', nextAppState => {
      console.log(`[AppNavigator] App state changed from ${appState.current} to ${nextAppState}`);
      appState.current = nextAppState;
    });
    
    // Limpieza
    return () => {
      console.log("[AppNavigator] Cleaning up app state listener");
      subscription.remove();
    };
  }, [user?.uid]);
  
  // Use both loading states to determine if the app is ready
  const isAppLoading = isLoading || !appIsReady;
  
  // Render: siempre la misma estructura
  if (isAppLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando Localfy...</Text>
      </View>
    );
  }
  
  return (
    <NavigationContainer 
      ref={navigationRef}
      onReady={() => {
        handleNavigationReady();
        onNavigationReady();
      }}
    >
      {user ? <AppWithChat /> : <AuthStack />}
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