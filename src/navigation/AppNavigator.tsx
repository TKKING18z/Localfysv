// src/navigation/AppNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { View, TouchableOpacity } from 'react-native';

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

// Contexts
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';

// Define the root stack parameter list
export type RootStackParamList = {
  Auth: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  MainApp: undefined;
  BusinessDetail: { businessId: string }; 
  Map: undefined;
  MainTab: undefined;
  Home: undefined;
  Profile: undefined;
};

// Define tab navigator parameter list
export type MainTabParamList = {
  Home: undefined;
  Explore: undefined;
  Add: undefined;
  Favorites: undefined;
  Profile: undefined;
}

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Custom center button for adding a business
const CustomAddButton = ({onPress}: {onPress: (e: any) => void}) => (
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
          let iconName: string = '';
          
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Explore') {
            iconName = focused ? 'explore' : 'explore-outline';
          } else if (route.name === 'Add') {
            return null; // Custom button will handle this
          } else if (route.name === 'Favorites') {
            iconName = focused ? 'favorite' : 'favorite-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }
          
          return <MaterialIcons name={iconName as any} size={size} color={color} />;
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
      <Tab.Screen name="Explore" component={MapScreen} />
      <Tab.Screen 
        name="Add" 
        component={AddBusinessScreen} 
        options={{
          tabBarButton: (props) => (
            <CustomAddButton onPress={(e) => props.onPress?.(e)} />
          )
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

// Main Navigator with Authentication Check
const RootNavigator = () => {
  const { user } = useAuth(); // Use useAuth hook instead of AuthContext
  const isAuthenticated = !!user; // Derive isAuthenticated from user

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthStack} />
      ) : (
        <>
          <Stack.Screen name="MainApp" component={MainTabs} />
          <Stack.Screen 
            name="BusinessDetail" 
            component={BusinessDetailScreen} 
            options={{ 
              headerShown: false,
              presentation: 'card',
              // Remove animationEnabled as it's not supported
            }}
          />
          <Stack.Screen 
            name="Map" 
            component={MapScreen} 
            options={{ 
              headerShown: true,
              title: 'Mapa',
              headerBackTitle: 'Atrás'
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

// Main App Navigator
const AppNavigator = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default AppNavigator;