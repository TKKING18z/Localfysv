import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { collection, addDoc, updateDoc, getDoc, doc, getDocs, query, where, orderBy, Timestamp, onSnapshot } from 'firebase/firestore';
import firebase from '../../firebase.config';
import { CartItem } from './CartContext';

// Get Firestore instance from Firebase config
const db = firebase.firestore();

// Order status options
export type OrderStatus = 
  | 'created'      // Order has been created but not paid
  | 'paid'         // Payment has been processed
  | 'preparing'    // Business is preparing the order
  | 'in_transit'   // Order is on its way to the customer
  | 'delivered'    // Order has been delivered
  | 'canceled'     // Order has been canceled
  | 'refunded';    // Order has been refunded

export type PaymentMethod = 'card' | 'cash' | 'other';

export type OrderAddress = {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  notes?: string;
};

export type Order = {
  id: string;
  orderNumber: string;
  userId: string;
  userEmail: string;
  userName?: string;
  businessId: string;
  businessName: string;
  items: CartItem[];
  status: OrderStatus;
  total: number;
  subtotal: number;
  tax?: number;
  tip?: number;
  deliveryFee?: number;
  paymentMethod: PaymentMethod;
  paymentIntentId?: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  estimatedDeliveryTime?: Timestamp | Date;
  deliveredAt?: Timestamp | Date;
  address?: OrderAddress;
  notes?: string;
  isDelivery: boolean;
};

export type OrderSummary = {
  id: string;
  orderNumber: string;
  businessName: string;
  status: OrderStatus;
  total: number;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  itemCount: number;
};

interface OrderContextType {
  orders: Order[];
  userOrders: OrderSummary[];
  businessOrders: OrderSummary[];
  currentOrderId: string | null;
  isLoading: boolean;
  error: string | null;
  createOrder: (
    businessId: string,
    businessName: string,
    items: CartItem[],
    total: number,
    subtotal: number,
    paymentMethod: PaymentMethod,
    isDelivery: boolean,
    address?: OrderAddress,
    notes?: string,
    tax?: number,
    tip?: number,
    deliveryFee?: number
  ) => Promise<string>;
  getOrder: (orderId: string) => Promise<Order | null>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<boolean>;
  loadUserOrders: () => Promise<void>;
  loadBusinessOrders: (businessId: string) => Promise<void>;
  setCurrentOrderId: (orderId: string | null) => void;
  cancelOrder: (orderId: string) => Promise<boolean>;
  getLastUncompletedOrder: () => Promise<Order | null>;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export const OrderProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [userOrders, setUserOrders] = useState<OrderSummary[]>([]);
  const [businessOrders, setBusinessOrders] = useState<OrderSummary[]>([]);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load current order ID from AsyncStorage when component mounts
    const loadCurrentOrderId = async () => {
      try {
        const savedOrderId = await AsyncStorage.getItem('currentOrderId');
        if (savedOrderId) {
          setCurrentOrderId(savedOrderId);
        }
      } catch (error) {
        console.error('Error loading current order ID:', error);
      }
    };

    loadCurrentOrderId();
  }, []);

  useEffect(() => {
    // Save current order ID to AsyncStorage when it changes
    const saveCurrentOrderId = async () => {
      try {
        if (currentOrderId) {
          await AsyncStorage.setItem('currentOrderId', currentOrderId);
        } else {
          await AsyncStorage.removeItem('currentOrderId');
        }
      } catch (error) {
        console.error('Error saving current order ID:', error);
      }
    };

    saveCurrentOrderId();
  }, [currentOrderId]);

  // Generate a unique order number
  const generateOrderNumber = (): string => {
    const timestamp = new Date().getTime().toString().slice(-6);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ORD-${timestamp}${random}`;
  };

  // Create a new order
  const createOrder = async (
    businessId: string,
    businessName: string,
    items: CartItem[],
    total: number,
    subtotal: number,
    paymentMethod: PaymentMethod,
    isDelivery: boolean,
    address?: OrderAddress,
    notes?: string,
    tax?: number,
    tip?: number,
    deliveryFee?: number
  ): Promise<string> => {
    if (!user) {
      throw new Error('User must be logged in to create an order');
    }

    setIsLoading(true);
    setError(null);

    try {
      const now = Timestamp.now();
      const orderNumber = generateOrderNumber();
      
      const orderData = {
        orderNumber,
        userId: user.uid,
        userEmail: user.email || '',
        userName: user.displayName || '',
        businessId,
        businessName,
        items,
        status: 'created' as OrderStatus,
        total,
        subtotal,
        tax: tax || 0,
        tip: tip || 0,
        deliveryFee: deliveryFee || 0,
        paymentMethod,
        createdAt: now,
        updatedAt: now,
        isDelivery,
        ...(address && { address }),
        ...(notes && { notes })
      };

      const docRef = await addDoc(collection(db, 'orders'), orderData);
      const orderId = docRef.id;
      
      // Set the new order as the current order
      setCurrentOrderId(orderId);
      
      // Add the new order to the orders state
      const newOrder: Order = {
        id: orderId,
        ...orderData
      };
      
      setOrders(prevOrders => [...prevOrders, newOrder]);
      
      return orderId;
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to create order';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Get a specific order by ID
  const getOrder = async (orderId: string): Promise<Order | null> => {
    if (!orderId) return null;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const orderDoc = await getDoc(doc(db, 'orders', orderId));
      
      if (orderDoc.exists()) {
        const orderData = orderDoc.data();
        return {
          id: orderDoc.id,
          ...orderData
        } as Order;
      }
      
      return null;
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to get order';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Update an order's status
  const updateOrderStatus = async (orderId: string, status: OrderStatus): Promise<boolean> => {
    if (!orderId) return false;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status,
        updatedAt: Timestamp.now(),
        ...(status === 'delivered' ? { deliveredAt: Timestamp.now() } : {})
      });
      
      // Update orders in state
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId 
            ? { ...order, status, updatedAt: Timestamp.now() } 
            : order
        )
      );
      
      // Also update the order summary lists
      const updateOrderSummary = (list: OrderSummary[]) => 
        list.map(order => 
          order.id === orderId 
            ? { ...order, status, updatedAt: Timestamp.now() } 
            : order
        );
      
      setUserOrders(updateOrderSummary);
      setBusinessOrders(updateOrderSummary);
      
      return true;
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to update order status';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel an order
  const cancelOrder = async (orderId: string): Promise<boolean> => {
    return await updateOrderStatus(orderId, 'canceled');
  };

  // Load all orders for the current user
  const loadUserOrders = useCallback(async (): Promise<void> => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const q = query(
        collection(db, 'orders'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      // Execute query once to get initial data
      const querySnapshot = await getDocs(q);
      const ordersList: OrderSummary[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        ordersList.push({
          id: doc.id,
          orderNumber: data.orderNumber,
          businessName: data.businessName,
          status: data.status,
          total: data.total,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          itemCount: data.items?.length || 0
        });
      });
      
      setUserOrders(ordersList);
      
      // Setup real-time listener in a separate useEffect
      // This pattern avoids the return type issues
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to load user orders';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [user]);
  
  // Real-time listener for user orders
  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const ordersList: OrderSummary[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        ordersList.push({
          id: doc.id,
          orderNumber: data.orderNumber,
          businessName: data.businessName,
          status: data.status,
          total: data.total,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          itemCount: data.items?.length || 0
        });
      });
      
      setUserOrders(ordersList);
    }, (error) => {
      console.error("Error fetching orders: ", error);
      setError('Failed to load orders');
    });
    
    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [user]);

  // Load all orders for a specific business
  const loadBusinessOrders = useCallback(async (businessId: string): Promise<void> => {
    if (!businessId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const q = query(
        collection(db, 'orders'),
        where('businessId', '==', businessId),
        orderBy('createdAt', 'desc')
      );
      
      // Execute query once
      const querySnapshot = await getDocs(q);
      const ordersList: OrderSummary[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        ordersList.push({
          id: doc.id,
          orderNumber: data.orderNumber,
          businessName: data.businessName,
          status: data.status,
          total: data.total,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          itemCount: data.items?.length || 0
        });
      });
      
      setBusinessOrders(ordersList);
      
      // We set up the real-time listener separately in the component that needs it
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to load business orders';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get the last uncompleted order (for resuming checkout)
  const getLastUncompletedOrder = async (): Promise<Order | null> => {
    if (!user) return null;
    
    try {
      const q = query(
        collection(db, 'orders'),
        where('userId', '==', user.uid),
        where('status', '==', 'created'),
        orderBy('createdAt', 'desc'),
        // Limit to 1 to get only the most recent
        // limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const data = doc.data();
        
        return {
          id: doc.id,
          ...data
        } as Order;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting last uncompleted order:', error);
      return null;
    }
  };

  return (
    <OrderContext.Provider
      value={{
        orders,
        userOrders,
        businessOrders,
        currentOrderId,
        isLoading,
        error,
        createOrder,
        getOrder,
        updateOrderStatus,
        loadUserOrders,
        loadBusinessOrders,
        setCurrentOrderId,
        cancelOrder,
        getLastUncompletedOrder
      }}
    >
      {children}
    </OrderContext.Provider>
  );
};

// Custom hook to use the OrderContext
export const useOrders = () => {
  const context = useContext(OrderContext);
  if (context === undefined) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
}; 