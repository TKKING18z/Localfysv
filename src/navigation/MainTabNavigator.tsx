// Ejemplo para agregar notificación de items en carrito en tu Tab Navigator

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useCart } from '../context/CartContext';
import { CartScreen } from '../screens/CartScreen'; // Changed to named import

// Define the type for the tab navigator parameters
export type MainTabParamList = {
  Home: undefined;
  Conversations: undefined;
  AddBusiness: undefined;
  Favorites: undefined;
  Profile: undefined;
  Cart: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

// Dentro del componente de tu navegador
const MainTabNavigator = () => {
  const { totalItems } = useCart();
  
  return (
    <Tab.Navigator>
      {/* Tus tabs existentes */}
      
      {/* Nueva tab de carrito con badge */}
      <Tab.Screen 
        name="Cart" 
        component={CartScreen}
        options={{
          tabBarLabel: 'Carrito',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialIcons name="shopping-cart" color={color} size={size} />
          ),
          tabBarBadge: totalItems > 0 ? totalItems : undefined
        }}
      />
      
      {/* Más tabs */}
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
