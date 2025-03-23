import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import ConversationItem from '../../components/chat/ConversationItem';
import { RootStackParamList } from '../../navigation/AppNavigator';

type NavigationProp = StackNavigationProp<RootStackParamList, 'Conversations'>;

const ConversationsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { 
    conversations, 
    loading, 
    error, 
    refreshConversations, 
    setActiveConversationId,
    unreadTotal
  } = useChat();
  
  // Actualizar al montar y cuando vuelve a enfocarse
  useEffect(() => {
    console.log('ConversationsScreen mounted');
    refreshConversations();
    
    const unsubscribeFocus = navigation.addListener('focus', () => {
      console.log('ConversationsScreen focused - refreshing conversations');
      refreshConversations();
    });
    
    return () => {
      console.log('ConversationsScreen unmounting');
      unsubscribeFocus();
    };
  }, [refreshConversations, navigation]);
  
  // Navegar a una conversación específica
  const handleConversationPress = useCallback((conversationId: string) => {
    console.log(`Navigating to conversation: ${conversationId}`);
    setActiveConversationId(conversationId);
    navigation.navigate('Chat', { conversationId });
  }, [setActiveConversationId, navigation]);
  
  // Volver a la pantalla anterior
  const handleBackPress = useCallback(() => {
    navigation.navigate('Home');
  }, [navigation]);
  
  if (!user) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorText}>Debe iniciar sesión para ver los mensajes</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.retryButtonText}>Volver al inicio</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackPress}
        >
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Mensajes
          {unreadTotal > 0 && <Text style={styles.unreadBadgeText}> ({unreadTotal})</Text>}
        </Text>
        <View style={styles.placeholder} />
      </View>
      
      {/* Contenido principal */}
      {loading && conversations.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando conversaciones...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <MaterialIcons name="error-outline" size={48} color="#FF3B30" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={refreshConversations}
          >
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.centerContainer}>
          <MaterialIcons name="chat-bubble-outline" size={64} color="#E5E5EA" />
          <Text style={styles.emptyText}>No tienes conversaciones</Text>
          <Text style={styles.emptySubtext}>
            Tus mensajes con negocios y otros usuarios aparecerán aquí
          </Text>
          <Text style={styles.emptySubtext}>
            Para iniciar una conversación, visita un negocio y pulsa el botón "Chatear"
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationItem 
              conversation={item} 
              userId={user.uid}
              onPress={handleConversationPress}
            />
          )}
          refreshControl={
            <RefreshControl 
              refreshing={loading} 
              onRefresh={refreshConversations}
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
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  unreadBadgeText: {
    color: '#FF3B30',
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#333333',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    maxWidth: '80%',
  },
});

export default ConversationsScreen;