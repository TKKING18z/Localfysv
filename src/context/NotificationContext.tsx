import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { useAuth } from './AuthContext';
import InAppNotification from '../components/InAppNotification';

// Define the shape of a notification
export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'chat' | 'order_new' | 'order_status' | 'system' | 'promo';
  data?: any;
  timestamp: Date;
}

// Define the context interface
interface NotificationContextType {
  showNotification: (notification: Omit<AppNotification, 'id' | 'timestamp'>) => void;
  dismissNotification: () => void;
  clearAllNotifications: () => void;
}

// Create the context
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Context Provider component
export const NotificationProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const { user } = useAuth();
  const [currentNotification, setCurrentNotification] = useState<AppNotification | null>(null);
  const [notificationQueue, setNotificationQueue] = useState<AppNotification[]>([]);
  const [isAppActive, setIsAppActive] = useState(true);
  
  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      setIsAppActive(nextAppState === 'active');
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, []);
  
  // Listen for real-time notifications from Firestore
  useEffect(() => {
    if (!user) return;
    
    // Create database references
    const db = firebase.firestore();
    const userNotificationsRef = db.collection('user_notifications')
      .where('userId', '==', user.uid)
      .where('read', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(5);
    
    // Subscribe to notifications
    const unsubscribe = userNotificationsRef.onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const notificationData = change.doc.data();
          
          // Only show in-app notification if app is active and notification is new
          if (isAppActive) {
            const newNotification: AppNotification = {
              id: change.doc.id,
              title: notificationData.title || 'Nueva notificación',
              message: notificationData.message || '',
              type: notificationData.type || 'system',
              data: notificationData.data || {},
              timestamp: notificationData.createdAt?.toDate() || new Date()
            };
            
            // Add to queue
            setNotificationQueue(prevQueue => [...prevQueue, newNotification]);
          }
        }
      });
    }, error => {
      console.error('[NotificationContext] Error listening to notifications:', error);
    });
    
    return () => unsubscribe();
  }, [user, isAppActive]);
  
  // Process notification queue
  useEffect(() => {
    if (notificationQueue.length > 0 && !currentNotification) {
      // Get the next notification from queue
      const nextNotification = notificationQueue[0];
      
      // Remove it from queue
      setNotificationQueue(prevQueue => prevQueue.slice(1));
      
      // Show it
      setCurrentNotification(nextNotification);
    }
  }, [notificationQueue, currentNotification]);
  
  // Show a notification programmatically
  const showNotification = (notification: Omit<AppNotification, 'id' | 'timestamp'>) => {
    const newNotification: AppNotification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date()
    };
    
    if (currentNotification) {
      // Add to queue if there's already a notification showing
      setNotificationQueue(prevQueue => [...prevQueue, newNotification]);
    } else {
      // Show immediately if no notification is currently displayed
      setCurrentNotification(newNotification);
    }
  };
  
  // Dismiss the current notification
  const dismissNotification = () => {
    setCurrentNotification(null);
  };
  
  // Clear all notifications
  const clearAllNotifications = () => {
    setCurrentNotification(null);
    setNotificationQueue([]);
  };
  
  return (
    <NotificationContext.Provider 
      value={{
        showNotification,
        dismissNotification,
        clearAllNotifications
      }}
    >
      {children}
      
      {/* Render the current notification if any */}
      {currentNotification && (
        <InAppNotification
          title={currentNotification.title}
          message={currentNotification.message}
          type={currentNotification.type}
          data={currentNotification.data}
          onDismiss={dismissNotification}
        />
      )}
    </NotificationContext.Provider>
  );
};

// Custom hook for using the notification context
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  
  return context;
};

export default NotificationContext; 