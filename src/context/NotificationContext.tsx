import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { useAuth } from './AuthContext';
import InAppNotification from '../components/InAppNotification';
import notificationService, { NotificationData } from '../../services/NotificationService';
import { useNavigation, NavigationState } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define the shape of a notification
interface AppNotification extends NotificationData {
  id: string;
  timestamp: Date;
}

// Define the context interface
interface NotificationContextType {
  showNotification: (notification: NotificationData) => void;
  dismissNotification: () => void;
  clearAllNotifications: () => void;
  markAllAsViewed: () => void;
  isNotificationScreenActive: boolean;
  setNotificationScreenActive: (active: boolean) => void;
}

// Create the context
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Key for AsyncStorage
const VIEWED_NOTIFICATIONS_KEY = 'localfy_viewed_notifications';

// Context Provider component
export const NotificationProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const { user } = useAuth();
  const [currentNotification, setCurrentNotification] = useState<NotificationData | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationQueue, setNotificationQueue] = useState<AppNotification[]>([]);
  const [isAppActive, setIsAppActive] = useState(true);
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const [viewedNotifications, setViewedNotifications] = useState<string[]>([]);
  const [isNotificationScreenActive, setNotificationScreenActive] = useState(false);
  const [isInitialCooldown, setIsInitialCooldown] = useState(true);
  
  // Initial cooldown to prevent notifications from showing immediately on app start
  useEffect(() => {
    // Wait 3 seconds after app starts before showing any notifications
    const cooldownTimer = setTimeout(() => {
      setIsInitialCooldown(false);
    }, 3000);
    
    return () => clearTimeout(cooldownTimer);
  }, []);
  
  // Load viewed notifications from storage on initial load
  useEffect(() => {
    const loadViewedNotifications = async () => {
      try {
        const stored = await AsyncStorage.getItem(VIEWED_NOTIFICATIONS_KEY);
        if (stored) {
          setViewedNotifications(JSON.parse(stored));
        }
      } catch (error) {
        console.error('[NotificationContext] Error loading viewed notifications:', error);
      }
    };
    
    loadViewedNotifications();
  }, [user?.uid]);
  
  // Save viewed notifications when they change
  useEffect(() => {
    const saveViewedNotifications = async () => {
      try {
        await AsyncStorage.setItem(VIEWED_NOTIFICATIONS_KEY, JSON.stringify(viewedNotifications));
      } catch (error) {
        console.error('[NotificationContext] Error saving viewed notifications:', error);
      }
    };
    
    if (viewedNotifications.length > 0) {
      saveViewedNotifications();
    }
  }, [viewedNotifications]);
  
  // Check if navigation is available in this context - might not be during initial render
  useEffect(() => {
    // Wait until after component is mounted to set navigation ready
    // This ensures NavigationContainer has a chance to initialize first
    const checkNavigationReady = setTimeout(() => {
      setIsNavigationReady(true);
    }, 1000);
    
    return () => clearTimeout(checkNavigationReady);
  }, []);
  
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
          const notificationId = change.doc.id;
          
          // Only show in-app notification if:
          // 1. App is active
          // 2. Notification is new
          // 3. User isn't currently on the notifications screen
          // 4. Notification hasn't been viewed before
          if (isAppActive && 
              !isNotificationScreenActive && 
              !viewedNotifications.includes(notificationId)) {
            
            const newNotification: AppNotification = {
              id: notificationId,
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
  }, [user, isAppActive, isNotificationScreenActive, viewedNotifications]);
  
  // Process notification queue - update to include the initial cooldown check
  useEffect(() => {
    if (notificationQueue.length > 0 && !currentNotification && 
        !isNotificationScreenActive && !isInitialCooldown) {
      // Get the next notification from queue
      const nextNotification = notificationQueue[0];
      
      // Remove it from queue
      setNotificationQueue(prevQueue => prevQueue.slice(1));
      
      // Show it
      setCurrentNotification(nextNotification);
      setShowNotification(true);
    }
  }, [notificationQueue, currentNotification, isNotificationScreenActive, isInitialCooldown]);
  
  // Listen for notifications from the service
  useEffect(() => {
    // Direct function to handle notifications from the service
    const handleServiceNotification = (notification: NotificationData) => {
      // Only show if not on notification screen and the notification has a unique ID
      if (!isNotificationScreenActive && notification.id && !viewedNotifications.includes(notification.id)) {
        setCurrentNotification(notification);
        setShowNotification(true);
      }
    };

    // Register the handler with the service
    const removeListener = notificationService.onShowNotification(handleServiceNotification);

    return () => {
      removeListener();
    };
  }, [isNotificationScreenActive, viewedNotifications]);
  
  // Handle notification dismiss
  const handleDismiss = () => {
    if (currentNotification?.id) {
      // Mark as viewed when dismissed
      markAsViewed(currentNotification.id);
    }
    setShowNotification(false);
    setCurrentNotification(null);
  };
  
  // Method to show a notification
  const showNotificationMethod = (notification: NotificationData) => {
    if (!notification.id || !viewedNotifications.includes(notification.id)) {
      notificationService.showNotification(notification);
    }
  };
  
  // Dismiss the current notification
  const dismissNotification = () => {
    if (currentNotification?.id) {
      markAsViewed(currentNotification.id);
    }
    setCurrentNotification(null);
    setShowNotification(false);
  };
  
  // Clear all notifications
  const clearAllNotifications = () => {
    // Mark all notifications in queue as viewed
    notificationQueue.forEach(notification => {
      if (notification.id) {
        markAsViewed(notification.id);
      }
    });
    
    if (currentNotification?.id) {
      markAsViewed(currentNotification.id);
    }
    
    setCurrentNotification(null);
    setNotificationQueue([]);
    setShowNotification(false);
  };
  
  // Mark a notification as viewed
  const markAsViewed = (notificationId: string) => {
    if (!viewedNotifications.includes(notificationId)) {
      setViewedNotifications(prev => [...prev, notificationId]);
    }
  };
  
  // Mark all unread notifications as viewed
  const markAllAsViewed = async () => {
    if (!user) return;
    
    try {
      const db = firebase.firestore();
      const batch = db.batch();
      
      // Get all unread notifications
      const unreadQuery = await db.collection('user_notifications')
        .where('userId', '==', user.uid)
        .where('read', '==', false)
        .get();
      
      // Mark all as read in Firestore
      unreadQuery.docs.forEach(doc => {
        batch.update(doc.ref, { read: true });
        markAsViewed(doc.id);
      });
      
      await batch.commit();
      
      // Clear current notifications
      clearAllNotifications();
    } catch (error) {
      console.error('[NotificationContext] Error marking all as viewed:', error);
    }
  };
  
  return (
    <NotificationContext.Provider 
      value={{
        showNotification: showNotificationMethod,
        dismissNotification,
        clearAllNotifications,
        markAllAsViewed,
        isNotificationScreenActive,
        setNotificationScreenActive
      }}
    >
      {children}
      
      {/* Only render notification when navigation is ready, there's a notification to show,
          and the user is not on the notifications screen */}
      {isNavigationReady && currentNotification && showNotification && !isNotificationScreenActive && (
        <InAppNotification
          title={currentNotification.title}
          message={currentNotification.message}
          type={currentNotification.type}
          data={currentNotification.data}
          onDismiss={handleDismiss}
          autoDismiss={currentNotification.autoDismiss ?? true}
          duration={currentNotification.duration ?? 5000}
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