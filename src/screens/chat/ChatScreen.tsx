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
    markConversationAsRead,
    refreshConversations
  } = useChat();
  
  const { conversationId } = route.params;
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  
  // Estados para manejo de carga mejorado
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Hook para manejo de mensajes en tiempo real
  const { 
    messages: hookMessages, 
    sendMessage: hookSendMessage, 
    uploadImage, 
    markAsRead,
    conversation: hookConversation
  } = useChatHook({
    userId: user?.uid || '',
    conversationId
  });
  
  // Referencia para desplazamiento a nuevos mensajes
  const messagesListRef = useRef<FlatList>(null);
  
  // Determinar qué conjunto de mensajes usar
  const messages = activeMessages.length > 0 ? activeMessages : hookMessages;
  const currentConversation = activeConversation || hookConversation;
  
  // Temporizador para detectar problemas de carga
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
      if (activeMessages.length === 0 && !activeConversation && hookMessages.length === 0 && !hookConversation) {
        setLoadingTimeout(true);
      }
    }, 10000); // Reducido a 10 segundos

    return () => clearTimeout(timeout);
  }, [conversationId, navigation, activeMessages.length, activeConversation, hookMessages.length, hookConversation]);

  // Actualizar estado de carga cuando llegan mensajes
  useEffect(() => {
    if (messages.length > 0 || currentConversation) {
      setLoading(false);
    }
  }, [messages, currentConversation]);

  // Función manual de carga con opción de reintento
  const loadConversationManually = useCallback(async () => {
    if (!user || !conversationId) return;
    
    try {
      console.log('Cargando conversación manualmente desde ChatScreen');
      setLoading(true);
      
      const convResult = await firebase.firestore()
        .collection('conversations')
        .doc(conversationId)
        .get();
      
      if (!convResult.exists) {
        console.error(`ERROR: La conversación ${conversationId} no existe en Firestore`);
        Alert.alert('Error', 'Esta conversación no existe o ha sido eliminada', [
          { text: 'Volver', onPress: () => navigation.goBack() }
        ]);
        setLoading(false);
        return;
      }
      
      console.log('Datos de conversación recuperados manualmente');
      
      // Cargar mensajes manualmente
      const messagesResult = await firebase.firestore()
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get();
      
      console.log(`Recuperados ${messagesResult.size} mensajes manualmente`);
      
      // Marcar como leído manualmente
      if (user) {
        try {
          await firebase.firestore()
            .collection('conversations')
            .doc(conversationId)
            .update({
              [`unreadCount.${user.uid}`]: 0
            });
          console.log('Marcado como leído manualmente');
          
          // Refrescar lista de conversaciones para actualizar contador
          refreshConversations();
        } catch (error) {
          console.error('Error al marcar como leído manualmente:', error);
        }
      }
      
      setLoading(false);
      setLoadingTimeout(false);
      setLoadError(null);
    } catch (error) {
      console.error('Error cargando conversación manualmente:', error);
      Alert.alert('Error de conexión', 'No se pudo acceder a los datos de la conversación');
      setLoading(false);
    }
  }, [conversationId, user, refreshConversations]);

  // Manejador de reintento
  const handleRetry = useCallback(() => {
    setLoading(true);
    setLoadingTimeout(false);
    setLoadError(null);
    loadConversationManually();
  }, [loadConversationManually]);

  // Intentar carga manual después de un tiempo
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!currentConversation && messages.length === 0) {
        console.log('Timeout alcanzado, intentando carga manual');
        loadConversationManually();
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [conversationId, user, currentConversation, messages.length, loadConversationManually]);
  
  // Marcar como leído al abrir la conversación
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
    
    // Intentar marcar como leído
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
    
    // Al salir, refrescar conversaciones
    return () => {
      refreshConversations();
    };
  }, [conversationId, user, activeConversation, markConversationAsRead, markAsRead, refreshConversations]);
  
  // Función mejorada para envío de mensajes
  const handleSendMessage = useCallback(async (text: string, imageUrl?: string): Promise<boolean> => {
    if (!user) {
      console.error('Cannot send message: No user logged in');
      return false;
    }
    
    if (!conversationId) {
      console.error('Cannot send message: No conversationId');
      return false;
    }
    
    try {
      const trimmedText = text.trim();
      console.log(`Attempting to send message${imageUrl ? ' with image' : ''}`);
      
      let success = false;
      
      // Intentar primero con el hook, luego con el contexto
      if (hookSendMessage) {
        console.log('Sending via hook');
        success = await hookSendMessage(trimmedText, imageUrl);
      } else if (contextSendMessage) {
        console.log('Sending via context');
        success = await contextSendMessage(trimmedText, imageUrl);
      } else {
        console.error('No message sending function available');
        return false;
      }
      
      if (success) {
        // Scroll al final después de enviar
        setTimeout(() => {
          messagesListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } else {
        console.error('Message sending failed');
      }
      
      return success;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }, [user, conversationId, hookSendMessage, contextSendMessage]);
  
  // Mostrar imagen a tamaño completo
  const handleImagePress = useCallback((imageUrl: string) => {
    setSelectedImage(imageUrl);
    setImageModalVisible(true);
  }, []);
  
  // Ordenar mensajes por fecha
  const sortedMessages = React.useMemo(() => {
    return [...messages].sort((a, b) => {
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
  }, [messages]);
  
  // Obtener ID del otro participante
  const getOtherParticipantId = useCallback(() => {
    if (!currentConversation || !user) return '';
    
    return currentConversation.participants.find(id => id !== user.uid) || '';
  }, [currentConversation, user]);
  
  // Calcular ID del otro participante para el encabezado
  const otherParticipantId = getOtherParticipantId();
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <ChatHeader 
        conversation={currentConversation} 
        participantId={otherParticipantId}
      />
      
      {/* Contenido principal solo si no hay error */}
      {!chatError && (
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {/* Componente de carga mejorado */}
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
          ) : sortedMessages.length === 0 ? (
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
          
          {/* Entrada de nuevos mensajes */}
          <ChatInput 
            onSend={handleSendMessage}
            uploadImage={uploadImage}
          />
        </KeyboardAvoidingView>
      )}
      
      {/* Mostrar error si existe */}
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
      
      {/* Modal para ver imágenes a pantalla completa */}
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