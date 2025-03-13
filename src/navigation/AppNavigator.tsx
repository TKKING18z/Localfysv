import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { View, TouchableOpacity, ActivityIndicator, Text, StyleSheet } from 'react-native';
import firebase from 'firebase/compat/app';

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

// Define the root stack parameter list with properly typed screen params
export type RootStackParamList = {
  Auth: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  MainTabs: undefined;  // No params needed for tab navigator
  BusinessDetail: { businessId: string };
  // Business enhancement screens
  BusinessHours: { initialHours?: any; onSave: (hours: any) => void };
  PaymentMethods: { initialMethods?: string[]; onSave: (methods: string[]) => void };
  SocialLinks: { initialLinks?: any; onSave: (links: any) => void };
  MenuEditor: { businessId: string; initialMenu?: any[]; menuUrl?: string; onSave: (menu: any[], menuUrl: string) => void };
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
};

// Define tab navigator parameter list
export type MainTabParamList = {
  Home: undefined;
  Map: undefined;
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
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          // Use explicit type assertion to fix the error
          if (route.name === 'Home') {
            return <MaterialIcons name={'home' as any} size={size} color={color} />;
          } else if (route.name === 'Map') {
            return <MaterialIcons name={'explore' as any} size={size} color={color} />;
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
      <Tab.Screen name="Map" component={MapScreen} />
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
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<firebase.User | null>(null);

  // Handle auth state changes
  const onAuthStateChanged = (firebaseUser: firebase.User | null) => {
    setUser(firebaseUser);
    if (initializing) setInitializing(false);
  };

  useEffect(() => {
    const subscriber = firebase.auth().onAuthStateChanged(onAuthStateChanged);
    return subscriber; // unsubscribe on unmount
  }, []);

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando Localfy...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="BusinessDetail" component={BusinessDetailScreen} />
            
            {/* Agregar las nuevas pantallas */}
            <Stack.Screen name="EditBusiness" component={EditBusinessScreen} />
            <Stack.Screen name="MyBusinesses" component={MyBusinessesScreen} />
            
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
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthStack} />
        )}
      </Stack.Navigator>
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