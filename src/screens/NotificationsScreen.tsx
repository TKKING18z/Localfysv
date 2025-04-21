import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useChat } from '../context/ChatContext';
import { useOrders } from '../context/OrderContext';
import { Conversation } from '../../models/chatTypes';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { useAuth } from '../context/AuthContext';
import { Order, OrderStatus } from '../context/OrderContext';

type NavigationProps = StackNavigationProp<RootStackParamList>;

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  type: 'chat' | 'system' | 'promo' | 'order_new' | 'order_status';
  data?: any;
}

const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const { conversations, unreadTotal, refreshConversations } = useChat();
  const { userOrders, businessOrders, loadUserOrders, loadBusinessOrders } = useOrders();
  const { user } = useAuth();
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [businessIds, setBusinessIds] = useState<string[]>([]);

  // Get user's businesses to check if they're owners
  useEffect(() => {
    const fetchUserBusinesses = async () => {
      if (!user) return;
      
      try {
        const db = firebase.firestore();
        
        // Check for businesses owned by user
        const ownedBusinessesQuery = await db
          .collection('businesses')
          .where('ownerId', '==', user.uid)
          .get();
          
        // Check for business permissions
        const permissionsQuery = await db
          .collection('business_permissions')
          .where('userId', '==', user.uid)
          .where('role', 'in', ['owner', 'admin', 'manager'])
          .get();
          
        const businessIdsSet = new Set<string>();
        
        // Add owned businesses
        ownedBusinessesQuery.forEach(doc => {
          businessIdsSet.add(doc.id);
        });
        
        // Add businesses with permissions
        permissionsQuery.forEach(doc => {
          const businessId = doc.data().businessId;
          if (businessId) businessIdsSet.add(businessId);
        });
        
        setBusinessIds(Array.from(businessIdsSet));
      } catch (error) {
        console.error('[NotificationsScreen] Error fetching user businesses:', error);
      }
    };
    
    fetchUserBusinesses();
  }, [user]);

  // Load business orders when businessIds change
  useEffect(() => {
    if (businessIds.length > 0) {
      businessIds.forEach(id => {
        loadBusinessOrders(id);
      });
    }
  }, [businessIds, loadBusinessOrders]);

  // Convert chat conversations with unread messages to notifications
  const generateNotificationsFromChats = useCallback((convs: Conversation[]) => {
    if (!convs || convs.length === 0) return [];
    
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) return [];
    
    const userId = currentUser.uid;
    
    return convs
      .filter(conv => (conv.unreadCount?.[userId] || 0) > 0)
      .map(conv => {
        const otherParticipantId = conv.participants.find(id => id !== userId) || '';
        const senderName = conv.participantNames?.[otherParticipantId] || 'Usuario';
        const unreadCount = conv.unreadCount?.[userId] || 0;
        
        // Format message based on unread count
        const message = unreadCount === 1
          ? `Tienes 1 mensaje nuevo${conv.lastMessage?.text ? `: "${truncateText(conv.lastMessage.text, 40)}"` : ''}`
          : `Tienes ${unreadCount} mensajes nuevos`;
        
        return {
          id: `chat_${conv.id}`,
          title: senderName,
          message,
          timestamp: convertTimestamp(conv.lastMessage?.timestamp),
          read: false,
          type: 'chat' as const,
          data: { conversationId: conv.id }
        };
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, []);

  // Generate notifications from orders
  const generateNotificationsFromOrders = useCallback(() => {
    if (!user) return [];
    
    const notifications: NotificationItem[] = [];
    
    // Add user's orders (as a customer)
    if (userOrders && userOrders.length > 0) {
      userOrders.forEach(order => {
        // Only show recent orders (last 7 days)
        const orderDate = convertTimestamp(order.createdAt);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 7) {
          let title = '';
          let message = '';
          
          switch (order.status) {
            case 'paid':
              title = 'Pago Confirmado';
              message = `Tu pago para el pedido #${order.orderNumber} ha sido confirmado.`;
              break;
            case 'preparing':
              title = 'Pedido en Preparación';
              message = `Tu pedido #${order.orderNumber} está siendo preparado.`;
              break;
            case 'in_transit':
              title = 'Pedido en Camino';
              message = `¡Tu pedido #${order.orderNumber} está en camino!`;
              break;
            case 'delivered':
              title = 'Pedido Entregado';
              message = `Tu pedido #${order.orderNumber} ha sido entregado.`;
              break;
            case 'canceled':
              title = 'Pedido Cancelado';
              message = `Tu pedido #${order.orderNumber} ha sido cancelado.`;
              break;
            case 'refunded':
              title = 'Pedido Reembolsado';
              message = `El reembolso de tu pedido #${order.orderNumber} ha sido procesado.`;
              break;
            default:
              title = 'Actualización de Pedido';
              message = `Tu pedido #${order.orderNumber} ha sido actualizado.`;
          }
          
          notifications.push({
            id: `order_status_${order.id}`,
            title,
            message,
            timestamp: convertTimestamp(order.updatedAt),
            read: false, // We could store read status in Firestore
            type: 'order_status',
            data: { 
              orderId: order.id,
              status: order.status,
              businessId: (order as any).businessId || '',
              orderNumber: order.orderNumber
            }
          });
        }
      });
    }
    
    // Add business orders (for business owners/managers)
    if (businessOrders && businessOrders.length > 0) {
      businessOrders.forEach(order => {
        // Only show recent orders (last 7 days)
        const orderDate = convertTimestamp(order.createdAt);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 7) {
          let title = '';
          let message = '';
          
          // For business owners, new orders and status changes are important
          if (order.status === 'paid' || order.status === 'created') {
            title = '¡Nuevo Pedido Recibido!';
            message = `Pedido #${order.orderNumber} - ${order.itemCount} producto(s) - Total: $${order.total.toFixed(2)}`;
          } else if (order.status === 'canceled' || order.status === 'refunded') {
            title = order.status === 'canceled' ? 'Pedido Cancelado' : 'Pedido Reembolsado';
            message = `El pedido #${order.orderNumber} ha sido ${order.status === 'canceled' ? 'cancelado' : 'reembolsado'}.`;
          } else {
            // For other statuses, skip (less relevant for business owners)
            return;
          }
          
          notifications.push({
            id: `order_business_${order.id}`,
            title,
            message,
            timestamp: convertTimestamp(order.updatedAt),
            read: false,
            type: 'order_new',
            data: { 
              orderId: order.id,
              status: order.status,
              businessId: (order as any).businessId || '',
              orderNumber: order.orderNumber
            }
          });
        }
      });
    }
    
    return notifications;
  }, [userOrders, businessOrders, user]);

  // Helper to truncate text
  const truncateText = (text: string, maxLength: number) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };
  
  // Helper to convert different timestamp formats
  const convertTimestamp = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    
    if (timestamp instanceof Date) {
      return timestamp;
    } else if (typeof timestamp === 'string') {
      return new Date(timestamp);
    } else if (timestamp.toDate) {
      // Firestore Timestamp
      return timestamp.toDate();
    } else if (typeof timestamp === 'number') {
      return new Date(timestamp);
    }
    
    return new Date();
  };
  
  // Load notifications when component mounts
  useEffect(() => {
    loadNotifications();
  }, [conversations, userOrders, businessOrders]);
  
  // Refresh data when screen gets focus
  useFocusEffect(
    useCallback(() => {
      refreshNotifications();
      return () => {};
    }, [])
  );

  // Load notifications
  const loadNotifications = () => {
    setLoading(true);
    
    try {
      // Convert chat conversations to notifications
      const chatNotifications = generateNotificationsFromChats(conversations);
      
      // Get order notifications
      const orderNotifications = generateNotificationsFromOrders();
      
      // Here you could add other types of notifications (system, promos, etc.)
      // const systemNotifications = [...];
      // const promoNotifications = [...];
      
      // Combine all notifications
      const allNotifications = [
        ...chatNotifications,
        ...orderNotifications,
        // ...systemNotifications,
        // ...promoNotifications
      ];
      
      // Sort notifications by timestamp (newest first)
      allNotifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      setNotifications(allNotifications);
    } catch (error) {
      console.error('[NotificationsScreen] Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Pull-to-refresh handler
  const refreshNotifications = async () => {
    setRefreshing(true);
    
    try {
      // Refresh conversations to get latest unread messages
      await refreshConversations();
      
      // Refresh orders
      await loadUserOrders();
      
      // Refresh business orders if user has businesses
      if (businessIds.length > 0) {
        for (const businessId of businessIds) {
          await loadBusinessOrders(businessId);
        }
      }
      
      // Refresh notifications
      loadNotifications();
    } catch (error) {
      console.error('[NotificationsScreen] Error refreshing notifications:', error);
    } finally {
      setRefreshing(false);
    }
  };
  
  // Handle notification press
  const handleNotificationPress = (notification: NotificationItem) => {
    // Navigate based on notification type
    switch (notification.type) {
      case 'chat':
        // Navigate to the specific chat
        if (notification.data?.conversationId) {
          navigation.navigate('Chat', { 
            conversationId: notification.data.conversationId 
          });
        }
        break;
        
      case 'order_new':
      case 'order_status':
        // Navigate to order details
        if (notification.data?.orderId) {
          navigation.navigate('OrderDetails', {
            orderId: notification.data.orderId
          });
        }
        break;
        
      case 'promo':
        // Navigate to promotion
        if (notification.data?.businessId) {
          navigation.navigate('BusinessDetail', { 
            businessId: notification.data.businessId 
          });
        }
        break;
        
      case 'system':
        // System notifications can navigate to different parts of the app
        if (notification.data?.screen) {
          navigation.navigate(notification.data.screen);
        }
        break;
    }
    
    // Here you could mark the notification as read in Firestore
  };
  
  // Format date for display
  const formatDate = (date: Date) => {
    // Format date differently depending on how recent it is
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      // Today - show time
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      // Yesterday
      return 'Ayer';
    } else if (diffDays < 7) {
      // This week - show day name
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      return days[date.getDay()];
    } else {
      // Older - show date
      return date.toLocaleDateString();
    }
  };
  
  // Get icon for notification type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'chat':
        return <MaterialIcons name="chat" size={24} color="#007AFF" />;
      case 'system':
        return <MaterialIcons name="info" size={24} color="#FF9500" />;
      case 'promo':
        return <MaterialIcons name="local-offer" size={24} color="#34C759" />;
      case 'order_new':
        return <FontAwesome5 name="shopping-bag" size={20} color="#FF2D55" />;
      case 'order_status':
        return <MaterialIcons name="delivery-dining" size={24} color="#5856D6" />;
      default:
        return <MaterialIcons name="notifications" size={24} color="#8E8E93" />;
    }
  };
  
  // Render notification item
  const renderNotificationItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        !item.read && styles.unreadNotification
      ]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={[
        styles.notificationIcon,
        item.type === 'order_new' && styles.orderNewIcon,
        item.type === 'order_status' && styles.orderStatusIcon
      ]}>
        {getNotificationIcon(item.type)}
      </View>
      
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text style={styles.notificationTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.notificationTime}>
            {formatDate(item.timestamp)}
          </Text>
        </View>
        
        <Text 
          style={[
            styles.notificationMessage,
            !item.read && styles.unreadNotificationText
          ]} 
          numberOfLines={2}
        >
          {item.message}
        </Text>
      </View>
    </TouchableOpacity>
  );
  
  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="notifications-none" size={64} color="#C7C7CC" />
      <Text style={styles.emptyTitle}>
        No tienes notificaciones
      </Text>
      <Text style={styles.emptySubtitle}>
        Las notificaciones y mensajes no leídos aparecerán aquí
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Notificaciones</Text>
        
        <View style={styles.headerRight}>
          {unreadTotal > 0 && (
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>{unreadTotal}</Text>
            </View>
          )}
        </View>
      </View>
      
      {/* Notifications List */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando notificaciones...</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotificationItem}
          contentContainerStyle={
            notifications.length === 0 ? { flex: 1 } : { paddingBottom: 20 }
          }
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshNotifications}
              colors={['#007AFF']}
              tintColor="#007AFF"
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  headerRight: {
    width: 32,
    alignItems: 'flex-end',
  },
  badgeContainer: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  unreadNotification: {
    backgroundColor: '#F0F7FF',
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  notificationIcon: {
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F7FF',
  },
  orderNewIcon: {
    backgroundColor: '#FFE8EC',
  },
  orderStatusIcon: {
    backgroundColor: '#EEEEFF',
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    flex: 1,
  },
  notificationTime: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  unreadNotificationText: {
    color: '#333333',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default NotificationsScreen;