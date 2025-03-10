// src/navigation/AppNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import RegisterScreen from '../screens/RegisterScreen';
import BusinessDetailScreen from '../screens/BusinessDetailScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { AuthProvider } from '../context/AuthContext'; // Asegúrate de que la ruta es correcta
import { ThemeProvider } from '../context/ThemeContext'; // Asegúrate de que la ruta es correcta

// Define the root stack parameter list
export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  ForgotPassword: undefined;
  Register: undefined;
  BusinessDetail: { businessId: string }; 
  Favorites: undefined;
  Profile: undefined;
  // Add other screens as needed
};

const Stack = createStackNavigator<RootStackParamList>();

const StackNavigator = () => (
  <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false, cardStyle: { backgroundColor: '#F5F7FF' }}}>
    <Stack.Screen name="Login" component={LoginScreen}/>
    <Stack.Screen name="Home" component={HomeScreen}/>
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen}/>
    <Stack.Screen name="Register" component={RegisterScreen}/>
    <Stack.Screen name="BusinessDetail" component={BusinessDetailScreen} options={{headerShown:false}}/>
    <Stack.Screen name="Favorites" component={FavoritesScreen} />
    <Stack.Screen name="Profile" component={ProfileScreen} />
  </Stack.Navigator>
);

const AppNavigator = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <NavigationContainer>
          <StackNavigator />
        </NavigationContainer>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default AppNavigator;