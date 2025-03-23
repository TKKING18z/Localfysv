import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Modal,
  TouchableOpacity,
  Text,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import ChatHeader from '../../components/chat/ChatHeader';
import ChatMessage from '../../components/chat/ChatMessage';
import ChatInput from '../../components/chat/ChatInput';
import { Message } from '../../../models/chatTypes';
import { useChat as useChatHook } from '../../hooks/useChat';
import firebase from 'firebase/compat/app';

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;
type ChatScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ChatScreen: React.FC = () => {
  const route = useRoute<ChatScreenRouteProp>();
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const { user } = useAuth();
  const { 
    activeConversation, 
    activeMessages,
    sendMessage: contextSendMessage,
    markConversationAsRead 
  } = useChat();
  
  const { conversationId } = route.params;
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  
  // States for improved loading handling
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Hook for real-time message handling
  const { 
    messages: hookMessages, 
    sendMessage: hookSendMessage, 
    uploadImage, 
    markAsRead 
  } = useChatHook({
    userId: user?.uid || '',
    conversationId
  });
  
  // Reference for scrolling to new messages
  const messagesListRef = useRef<FlatList>(null);
  
  // Determine which message set to use
  const messages = activeMessages.length > 0 ? activeMessages : hookMessages;
  
  // Timeout for detecting loading problems
  useEffect(() => {
    if (!conversationId) {
      console.error('ERROR: ID de conversación no proporcionado');
      Alert.alert('Error', 'No se pudo cargar la conversación', [
        { text: 'Volver', onPress: () => navigation.goBack() }
      ]);
      setLoadError('No se proporcionó ID de conversación');
      setLoading(false);
      return;
    }

    console.log(`Intentando cargar conversación con ID: ${conversationId}`);

    const timeout = setTimeout(() => {
      console.log('TIMEOUT: La carga de la conversación está tardando demasiado');
      if (activeMessages.length === 0 && !activeConversation) {
        setLoadingTimeout(true);
      }
    }, 15000);

    return () => clearTimeout(timeout);
  }, [conversationId, navigation, activeMessages.length, activeConversation]);

  // Update loading state when messages arrive
  useEffect(() => {
    if (messages.length > 0 || activeConversation) {
      setLoading(false);
    }
  }, [messages, activeConversation]);

  // Manual loading logic with a retry function
  const loadConversationManually = useCallback(async () => {
    if (!user || !conversationId) return;
    if (activeConversation) return;
    
    try {
      console.log('Cargando conversación manualmente desde ChatScreen');
      const convResult = await firebase.firestore()
        .collection('conversations')
        .doc(conversationId)
        .get();
      
      if (!convResult.exists) {
        console.error(`ERROR: La conversación ${conversationId} no existe en Firestore`);
        Alert.alert('Error', 'Esta conversación no existe o ha sido eliminada', [
          { text: 'Volver', onPress: () => navigation.goBack() }
        ]);
        return;
      }
      
      console.log('Datos de conversación recuperados manualmente:', convResult.data());
      
      // Try to load messages as well
      const messagesResult = await firebase.firestore()
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get();
      
      console.log(`Recuperados ${messagesResult.size} mensajes manualmente`);
      
      // Mark as read if loading manually
      try {
        await firebase.firestore()
          .collection('conversations')
          .doc(conversationId)
          .update({
            [`unreadCount.${user.uid}`]: 0
          });
        console.log('Marcado como leído manualmente');
      } catch (error) {
        console.error('Error al marcar como leído manualmente:', error);
      }
    } catch (error) {
      console.error('Error cargando conversación manualmente:', error);
      Alert.alert('Error de conexión', 'No se pudo acceder a los datos de la conversación');
    }
  }, [conversationId, user, activeConversation, navigation]);

  // Retry handler for timeout or errors
  const handleRetry = useCallback(() => {
    setLoading(true);
    setLoadingTimeout(false);
    setLoadError(null);
    loadConversationManually();
  }, [loadConversationManually]);

  // Try manual loading after a timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!activeConversation) {
        console.log('Timeout alcanzado, intentando carga manual');
        loadConversationManually();
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [conversationId, user, activeConversation, loadConversationManually]);
  
  // Mark as read when opening conversation
  useEffect(() => {
    console.log('ChatScreen montada con conversationId:', conversationId);
    
    if (!conversationId) {
      console.error('Error: No se proporcionó ID de conversación');
      setChatError('No se proporcionó ID de conversación');
      return;
    }
    
    if (!user) {
      console.error('Error: No hay usuario autenticado');
      setChatError('No hay usuario autenticado');
      return;
    }
    
    // Check if conversation loaded correctly
    if (activeConversation) {
      console.log('Conversación activa cargada:', activeConversation.id);
      console.log('Participantes:', activeConversation.participants);
    } else {
      console.log('No hay conversación activa cargada aún, intentando cargar...');
    }
    
    // Try to mark as read when opening
    try {
      if (activeConversation) {
        markConversationAsRead();
        console.log('Conversación marcada como leída (contexto)');
      } else {
        markAsRead();
        console.log('Conversación marcada como leída (hook)');
      }
    } catch (error) {
      console.error('Error al marcar conversación como leída:', error);
    }
  }, [conversationId, user, activeConversation, markConversationAsRead, markAsRead]);
  
  // Improved message sending function that handles missing activeConversation
  const handleSendMessage = async (text: string, imageUrl?: string): Promise<boolean> => {
    if (!user) {
      console.error('Cannot send message: No user logged in');
      return false;
    }
    
    if (!conversationId) {
      console.error('Cannot send message: No conversationId');
      return false;
    }
    
    try {
      console.log(`Attempting to send message: "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}"`);
      
      let success = false;
      
      // IMPORTANT: Always prefer hookSendMessage if activeConversation isn't available in context
      if (hookSendMessage) {
        console.log('Sending via hook');
        success = await hookSendMessage(text, imageUrl);
      } else if (contextSendMessage && activeConversation) {
        console.log('Sending via context');
        success = await contextSendMessage(text, imageUrl);
      } else {
        console.error('No message sending function available or no active conversation');
        return false;
      }
      
      console.log(`Message send ${success ? 'succeeded' : 'failed'}`);
      return success;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  };
  
  // Show full-size image
  const handleImagePress = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setImageModalVisible(true);
  };
  
  // Sort messages by date
  const sortedMessages = [...messages].sort((a, b) => {
    let dateA: Date;
    let dateB: Date;
    
    if (a.timestamp instanceof firebase.firestore.Timestamp) {
      dateA = a.timestamp.toDate();
    } else if (a.timestamp instanceof Date) {
      dateA = a.timestamp;
    } else {
      dateA = new Date(a.timestamp);
    }
    
    if (b.timestamp instanceof firebase.firestore.Timestamp) {
      dateB = b.timestamp.toDate();
    } else if (b.timestamp instanceof Date) {
      dateB = b.timestamp;
    } else {
      dateB = new Date(b.timestamp);
    }
    
    return dateA.getTime() - dateB.getTime();
  });
  
  // Get other participant ID
  const getOtherParticipantId = () => {
    if (!activeConversation || !user) return '';
    return activeConversation.participants.find(id => id !== user.uid) || '';
  };
  
  // Get other participant info for header
  const otherParticipantId = getOtherParticipantId();
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <ChatHeader 
        conversation={activeConversation} 
        participantId={otherParticipantId}
      />
      
      {/* Main content only if no error */}
      {!chatError && (
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {/* Improved loading component with error and timeout states */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Cargando conversación...</Text>
              {loadingTimeout && (
                <>
                  <Text style={styles.timeoutText}>
                    La carga está tardando más de lo esperado
                  </Text>
                  <TouchableOpacity 
                    style={styles.retryButton}
                    onPress={handleRetry}
                  >
                    <Text style={styles.retryButtonText}>Reintentar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.cancelButton}
                    onPress={() => navigation.goBack()}
                  >
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : loadError ? (
            <View style={styles.centerContainer}>
              <MaterialIcons name="error-outline" size={64} color="#FF3B30" />
              <Text style={styles.errorText}>{loadError}</Text>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={handleRetry}
              >
                <Text style={styles.retryButtonText}>Reintentar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.cancelButtonText}>Volver</Text>
              </TouchableOpacity>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.centerContainer}>
              <MaterialIcons name="chat" size={64} color="#E5E5EA" />
              <Text style={styles.emptyText}>No hay mensajes</Text>
              <Text style={styles.emptySubtext}>Sé el primero en enviar un mensaje</Text>
            </View>
          ) : (
            <FlatList
              ref={messagesListRef}
              data={sortedMessages}
              keyExtractor={(item: Message) => item.id}
              renderItem={({ item }: { item: Message }) => (
                <ChatMessage 
                  message={item} 
                  isMine={item.senderId === user?.uid}
                  onImagePress={handleImagePress}
                />
              )}
              contentContainerStyle={styles.messagesContainer}
              inverted={false}
              onContentSizeChange={() => {
                messagesListRef.current?.scrollToEnd({ animated: true });
              }}
              onLayout={() => {
                messagesListRef.current?.scrollToEnd({ animated: false });
              }}
            />
          )}
          
          {/* Input for new messages */}
          <ChatInput 
            onSend={handleSendMessage}
            uploadImage={uploadImage}
          />
        </KeyboardAvoidingView>
      )}
      
      {/* Show error if exists */}
      {chatError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {chatError}</Text>
          <TouchableOpacity 
            style={styles.errorButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.errorButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Modal for viewing images at full screen */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setImageModalVisible(false)}
          >
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
          
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullImage}
              resizeMode="contain"
              onLoadStart={() => {}}
              onLoadEnd={() => {}}
              onError={() => {
                console.error('Error loading image in modal');
                setImageModalVisible(false);
              }}
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  messagesContainer: {
    flexGrow: 1,
    paddingVertical: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  fullImage: {
    width: '100%',
    height: '80%',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333333',
  },
  timeoutText: {
    marginTop: 16,
    fontSize: 14,
    color: '#FF9500',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#8E8E93',
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#8E8E93',
    fontSize: 16,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8E8E93',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  errorButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  errorButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ChatScreen;