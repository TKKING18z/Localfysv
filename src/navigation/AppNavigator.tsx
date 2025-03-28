import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { View, TouchableOpacity, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext'; // Añadir esta importación

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
import VideoManagerScreen from '../screens/business/VideoManagerScreen';

// Importar la pantalla EditBusiness
import EditBusinessScreen from '../screens/business/EditBusinessScreen';
import MyBusinessesScreen from '../screens/business/MyBusinessesScreen';

// Importar nuevas pantallas
import PromotionsScreen from '../screens/business/PromotionsScreen';
import ReservationsScreen from '../screens/business/ReservationsScreen';

// Importar pantallas de chat
import ConversationsScreen from '../screens/chat/ConversationsScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import { ChatProvider } from '../context/ChatContext';

// Define the root stack parameter list with properly typed screen params
export type RootStackParamList = {
  Auth: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  MainTabs: undefined;  // No params needed for tab navigator
  BusinessDetail: { businessId: string };
  // Business enhancement screens
  BusinessHours: { initialHours?: any; callbackId?: string };
  PaymentMethods: { initialMethods?: string[]; callbackId?: string };
  SocialLinks: { initialLinks?: any; callbackId?: string };
  MenuEditor: { businessId: string; initialMenu?: any[]; menuUrl?: string; callbackId?: string };
  VideoManager: { businessId: string; initialVideos?: any[]; onSave: (videos: any[]) => void };
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

// Bottom Tab Navigator
function MainTabs() {
  // Add a try-catch to safely handle the useChat hook
  let unreadTotal = 0;
  try {
    const chatContext = useChat();
    unreadTotal = chatContext?.unreadTotal || 0;
  } catch (error) {
    console.log('Chat context not available:', error);
  }
  
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
  // Usar el hook de autenticación en lugar de manejar el estado directamente
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando Localfy...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <ChatProvider>
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
              <Stack.Screen 
                name="VideoManager" 
                component={VideoManagerScreen}
                options={{ 
                  headerShown: true,
                  title: 'Gestionar Videos',
                  headerStyle: { backgroundColor: '#FFFFFF' },
                  headerTintColor: '#007AFF'
                }} 
              />
              
              {/* Add direct routes to these screens for when navigating from outside their tab navigator */}
              <Stack.Screen name="Map" component={MapScreen} />
              <Stack.Screen name="Favorites" component={FavoritesScreen} />
              <Stack.Screen name="Profile" component={ProfileScreen} />
              <Stack.Screen name="AddBusiness" component={AddBusinessScreen} />
              
              {/* Chat screens */}
              <Stack.Screen name="Conversations" component={ConversationsScreen} />
              <Stack.Screen name="Chat" component={ChatScreen} />
            </>
          ) : (
            <Stack.Screen name="Auth" component={AuthStack} />
          )}
        </Stack.Navigator>
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