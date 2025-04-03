import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { View, TouchableOpacity, ActivityIndicator, Text, StyleSheet, AppState, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useChat, ChatProvider } from '../context/ChatContext';
import * as Notifications from 'expo-notifications';

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

// Importar pantallas de chat
import ConversationsScreen from '../screens/chat/ConversationsScreen';
import ChatScreen from '../screens/chat/ChatScreen';

// Importar las pantallas del Centro de Ayuda
import FAQsScreen from '../screens/FAQsScreen';
import SupportScreen from '../screens/SupportScreen';
import TermsConditionsScreen from '../screens/TermsConditionsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

// Define the root stack parameter list with properly typed screen params
export type RootStackParamList = {
  Auth: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  MainTabs: { screen?: keyof MainTabParamList };  // Allow specifying which tab to navigate to
  BusinessDetail: { businessId: string };
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
};

// Define tab navigator parameter list
export type MainTabParamList = {
  Home: undefined;
  Conversations: undefined;
  AddBusiness: undefined;
  Favorites: undefined;
  Profile: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Custom center button for adding a business
const CustomAddButton = ({onPress}: {onPress: () => void}) => (
  <TouchableOpacity
    style={{
      top: -20,
      justifyContent: 'center',
      alignItems: 'center',
    }}
    onPress={onPress}
  >
    <View style={{
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: '#007AFF',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#007AFF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    }}>
      <MaterialIcons name="add" size={28} color="white" />
    </View>
  </TouchableOpacity>
);

// Hook useChat ya importado arriba

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
          } else if (route.name === 'Favorites') {
            // Use proper icon names
            return <MaterialIcons name={focused ? 'favorite' as any : 'favorite-border' as any} size={size} color={color} />;
          } else if (route.name === 'Profile') {
            return <MaterialIcons name={focused ? 'person' as any : 'person-outline' as any} size={size} color={color} />;
          }
          // Default fallback
          return <MaterialIcons name={'circle' as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          elevation: 0,
          borderTopWidth: 0,
          height: 60,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
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
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Conversations" component={ConversationsScreen} />
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
        }}
      />
      <Tab.Screen name="Favorites" component={FavoritesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
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
  // Usar el hook de autenticación
  const { user, isLoading } = useAuth();
  const responseListener = useRef<any>();
  const notificationListener = useRef<any>();
  const appState = useRef(AppState.currentState);
  // Estados para manejar funciones del contexto
  const [updateNotificationToken, setUpdateNotificationToken] = React.useState<((token: string) => Promise<void>) | undefined>(undefined);

  // Configurar manejadores de notificaciones
  useEffect(() => {
    // Configurar cómo se manejarán las notificaciones cuando se reciban
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      }),
    });
    
    // Escuchar cuando se reciben notificaciones mientras la app está abierta
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('[AppNavigator] Notification received in foreground:', notification);
      // Aquí podrías reproducir un sonido, mostrar una alerta, etc.
    });

    // Escuchar cuando el usuario interactúa con una notificación
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[AppNavigator] User tapped on notification:', response);
      
      // Obtener datos de la notificación
      const data = response.notification.request.content.data;
      console.log('[AppNavigator] Notification data:', data);
      
      // Navegar basado en el tipo de notificación
      if (data && data.type === 'chat') {
        // Navegar a la conversación específica
        if (data.conversationId) {
          // Aquí necesitaríamos tener acceso al objeto de navegación
          // Esto se implementaría con una función separada o usando un contexto de navegación
          console.log('[AppNavigator] Should navigate to conversation:', data.conversationId);
          // navigation.navigate('Chat', { conversationId: data.conversationId });
        } else {
          // Navegar a la lista de conversaciones
          console.log('[AppNavigator] Should navigate to conversations list');
          // navigation.navigate('Conversations');
        }
      }
    });
    
    // Configurar listener para cambios en el estado de la app
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) && 
        nextAppState === 'active' && 
        user
      ) {
        console.log('[AppNavigator] App has come to the foreground, refreshing notification token');
        // Volver a registrar el token cuando la app vuelve a primer plano
        refreshNotificationToken();
      }
      
      appState.current = nextAppState;
    });

    return () => {
      // Limpiar listeners al desmontar
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
      subscription.remove();
    };
  }, [user]);
  
  // Función para refrescar token de notificaciones
  const refreshNotificationToken = async () => {
    if (!user) return;
    
    try {
      // Cargar dinámicamente el servicio de notificaciones
      const notificationService = require('../../services/NotificationService').notificationService;
      if (!notificationService) {
        console.log('[AppNavigator] Notification service not available');
        return;
      }
      
      // Verificar permisos
      const permissionResult = await notificationService.requestNotificationPermissions();
      if (permissionResult.success && permissionResult.data?.granted) {
        // Registrar para notificaciones
        const tokenResult = await notificationService.registerForPushNotifications();
        if (tokenResult.success && tokenResult.data?.token) {
          // Actualizar token en Firestore
          await notificationService.saveTokenToFirestore(user.uid, tokenResult.data.token);
          if (updateNotificationToken) {
            updateNotificationToken(tokenResult.data.token);
          }
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
    
    // Actualizar el token cuando el contexto cambie
    useEffect(() => {
      if (chatContext && chatContext.updateNotificationToken) {
        setUpdateNotificationToken(() => chatContext.updateNotificationToken);
      }
    }, [chatContext]);
    
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="BusinessDetail" component={BusinessDetailScreen} />
            
            {/* Agregar las nuevas pantallas */}
            <Stack.Screen name="EditBusiness" component={EditBusinessScreen} />
            <Stack.Screen name="MyBusinesses" component={MyBusinessesScreen} />
            <Stack.Screen name="Promotions" component={PromotionsScreen} />
            <Stack.Screen name="Reservations" component={ReservationsScreen} />
            
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

  // ChatProvider ya está importado

  return (
    <NavigationContainer>
      <ChatProvider>
        <AppWithChat />
      </ChatProvider>
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