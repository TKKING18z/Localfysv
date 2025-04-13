import React, { createContext, useContext, useState, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Definir los tipos
export type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  businessId: string;
  businessName?: string;
  image?: string;
  notes?: string;
  options?: {
    name: string;
    choice: string;
    extraPrice?: number;
  }[];
};

// Definir tipos de métodos de pago
export type PaymentMethodType = 'card' | 'cash';

type CartState = {
  items: CartItem[];
  businessId: string | null;
  businessName: string | null;
  paymentMethod: PaymentMethodType;
  acceptsCashOnDelivery: boolean; // Si el negocio acepta pago contra entrega
  deliveryAddress: string | null; // Dirección de entrega
  deliveryNotes: string | null; // Notas para el repartidor
};

type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: { id: string } }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'CLEAR' }
  | { type: 'SET_CART'; payload: CartState }
  | { type: 'SET_PAYMENT_METHOD'; payload: PaymentMethodType }
  | { type: 'SET_ACCEPTS_CASH_ON_DELIVERY'; payload: boolean }
  | { type: 'SET_DELIVERY_ADDRESS'; payload: string }
  | { type: 'SET_DELIVERY_NOTES'; payload: string };

type CartContextType = {
  cart: CartState;
  addToCart: (item: CartItem) => Promise<void>;
  removeFromCart: (id: string) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  setPaymentMethod: (method: PaymentMethodType) => Promise<void>;
  setAcceptsCashOnDelivery: (accepts: boolean) => Promise<void>;
  setDeliveryAddress: (address: string) => Promise<void>;
  setDeliveryNotes: (notes: string) => Promise<void>;
  totalItems: number;
  totalPrice: number;
};

// Crear contexto
const CartContext = createContext<CartContextType | undefined>(undefined);

// Crear reducer para manejar operaciones del carrito
const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_ITEM':
      // Si ya tenemos un item de otro negocio, preguntar si quiere reemplazar
      if (state.businessId && state.businessId !== action.payload.businessId && state.items.length > 0) {
        return state;
      }
      
      // Verificar si el item ya existe en el carrito
      const existingItemIndex = state.items.findIndex(item => item.id === action.payload.id);
      
      if (existingItemIndex !== -1) {
        // Si existe, actualizar cantidad
        const updatedItems = [...state.items];
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: updatedItems[existingItemIndex].quantity + action.payload.quantity
        };
        
        return {
          ...state,
          items: updatedItems
        };
      }
      
      // Asegurarse de que el item tenga un businessName
      const itemToAdd = {
        ...action.payload,
        businessName: action.payload.businessName || 'Localfy'
      };
      
      // Si no existe, agregar nuevo
      return {
        ...state,
        items: [...state.items, itemToAdd],
        businessId: itemToAdd.businessId,
        businessName: itemToAdd.businessName
      };
    
    case 'REMOVE_ITEM':
      const filteredItems = state.items.filter(item => item.id !== action.payload.id);
      
      // Si no quedan items, resetear businessId
      if (filteredItems.length === 0) {
        return {
          ...state,
          items: [],
          businessId: null,
          businessName: null
        };
      }
      
      return {
        ...state,
        items: filteredItems
      };
    
    case 'UPDATE_QUANTITY':
      const updatedItems = state.items.map(item => {
        if (item.id === action.payload.id) {
          return {
            ...item,
            quantity: action.payload.quantity
          };
        }
        return item;
      });
      
      return {
        ...state,
        items: updatedItems
      };
    
    case 'CLEAR':
      return {
        items: [],
        businessId: null,
        businessName: null,
        paymentMethod: 'card',
        acceptsCashOnDelivery: false,
        deliveryAddress: null,
        deliveryNotes: null
      };
    
    case 'SET_CART':
      return action.payload;
    
    case 'SET_PAYMENT_METHOD':
      return {
        ...state,
        paymentMethod: action.payload
      };
    
    case 'SET_ACCEPTS_CASH_ON_DELIVERY':
      return {
        ...state,
        acceptsCashOnDelivery: action.payload
      };
    
    case 'SET_DELIVERY_ADDRESS':
      return {
        ...state,
        deliveryAddress: action.payload
      };
    
    case 'SET_DELIVERY_NOTES':
      return {
        ...state,
        deliveryNotes: action.payload
      };
    
    default:
      return state;
  }
};

// Proveedor del contexto
export const CartProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const initialState: CartState = {
    items: [],
    businessId: null,
    businessName: null,
    paymentMethod: 'card',
    acceptsCashOnDelivery: false,
    deliveryAddress: null,
    deliveryNotes: null
  };
  
  const [cart, dispatch] = useReducer(cartReducer, initialState);
  
  // Cargar carrito de AsyncStorage al iniciar
  useEffect(() => {
    const loadCart = async () => {
      try {
        const savedCart = await AsyncStorage.getItem('cart');
        if (savedCart) {
          // Asegurar compatibilidad con versiones anteriores (sin paymentMethod)
          const parsedCart = JSON.parse(savedCart);
          dispatch({ 
            type: 'SET_CART', 
            payload: {
              ...parsedCart,
              paymentMethod: parsedCart.paymentMethod || 'card',
              acceptsCashOnDelivery: parsedCart.acceptsCashOnDelivery || false
            } 
          });
        }
      } catch (error) {
        console.error('Error loading cart from AsyncStorage:', error);
      }
    };
    
    loadCart();
  }, []);
  
  // Guardar carrito en AsyncStorage cuando cambie
  useEffect(() => {
    const saveCart = async () => {
      try {
        await AsyncStorage.setItem('cart', JSON.stringify(cart));
      } catch (error) {
        console.error('Error saving cart to AsyncStorage:', error);
      }
    };
    
    saveCart();
  }, [cart]);
  
  // Calcular totales
  const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  
  const totalPrice = cart.items.reduce((sum, item) => {
    let itemTotal = item.price * item.quantity;
    
    // Agregar precio de opciones adicionales
    if (item.options) {
      itemTotal += item.options.reduce((optionsSum, option) => 
        optionsSum + (option.extraPrice || 0) * item.quantity, 0);
    }
    
    return sum + itemTotal;
  }, 0);
  
  // Funciones para manipular el carrito
  const addToCart = async (item: CartItem) => {
    dispatch({ type: 'ADD_ITEM', payload: item });
  };
  
  const removeFromCart = async (id: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { id } });
  };
  
  const updateQuantity = async (id: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
  };
  
  const clearCart = async () => {
    dispatch({ type: 'CLEAR' });
  };
  
  const setPaymentMethod = async (method: PaymentMethodType) => {
    dispatch({ type: 'SET_PAYMENT_METHOD', payload: method });
  };
  
  const setAcceptsCashOnDelivery = async (accepts: boolean) => {
    dispatch({ type: 'SET_ACCEPTS_CASH_ON_DELIVERY', payload: accepts });
  };
  
  const setDeliveryAddress = async (address: string) => {
    dispatch({ type: 'SET_DELIVERY_ADDRESS', payload: address });
  };
  
  const setDeliveryNotes = async (notes: string) => {
    dispatch({ type: 'SET_DELIVERY_NOTES', payload: notes });
  };
  
  return (
    <CartContext.Provider value={{
      cart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      setPaymentMethod,
      setAcceptsCashOnDelivery,
      setDeliveryAddress,
      setDeliveryNotes,
      totalItems,
      totalPrice
    }}>
      {children}
    </CartContext.Provider>
  );
};

// Hook personalizado para usar el contexto
export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
