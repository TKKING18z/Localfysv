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
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useChat } from '../context/ChatContext';
import { Conversation } from '../../models/chatTypes';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

type NavigationProps = StackNavigationProp<RootStackParamList>;

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  type: 'chat' | 'system' | 'promo';
  data?: any;
}

const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const { conversations, unreadTotal, refreshConversations } = useChat();
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
  }, [conversations]);
  
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
      
      // Here you could add other types of notifications (system, promos, etc.)
      // const systemNotifications = [...];
      // const promoNotifications = [...];
      
      // Combine all notifications
      const allNotifications = [
        ...chatNotifications,
        // ...systemNotifications,
        // ...promoNotifications
      ];
      
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
  
  // Render notification item
  const renderNotificationItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        !item.read && styles.unreadNotification
      ]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.notificationIcon}>
        {item.type === 'chat' && (
          <MaterialIcons name="chat" size={24} color="#007AFF" />
        )}
        {item.type === 'system' && (
          <MaterialIcons name="info" size={24} color="#FF9500" />
        )}
        {item.type === 'promo' && (
          <MaterialIcons name="local-offer" size={24} color="#34C759" />
        )}
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