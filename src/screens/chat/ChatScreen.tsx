import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../context/AuthContext';
import { chatService } from '../../../services/ChatService';
import ChatHeader from '../../components/chat/ChatHeader';
import ChatMessage from '../../components/chat/ChatMessage';
import ChatInput from '../../components/chat/ChatInput';
import { Message, Conversation } from '../../../models/chatTypes';

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;
type ChatScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ChatScreen: React.FC = () => {
  const route = useRoute<ChatScreenRouteProp>();
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const { user } = useAuth();
  const { conversationId } = route.params;

  // Estados centralizados
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Referencias
  const messagesListRef = useRef<FlatList>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Cargar conversación y mensajes
  const loadConversation = useCallback(async () => {
    if (!conversationId || !user) {
      setError('Datos insuficientes para cargar conversación');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Obtener datos de conversación
      const convResult = await chatService.getConversation(conversationId);
      if (!convResult.success || !convResult.data) {
        throw new Error(convResult.error?.message || 'No se pudo cargar la conversación');
      }
      setConversation(convResult.data);

      // Configurar listener de mensajes
      unsubscribeRef.current = chatService.listenToMessages(
        conversationId,
        (updatedMessages) => {
          // Ordenar mensajes por timestamp
          const sortedMessages = [...updatedMessages].sort((a, b) => {
            const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : 
                          typeof a.timestamp === 'string' ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : 
                          typeof b.timestamp === 'string' ? new Date(b.timestamp).getTime() : 0;
            return timeA - timeB;
          });

          setMessages(sortedMessages);
          // Desplazar al final si hay nuevos mensajes
          setTimeout(() => {
            messagesListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        },
        (err) => {
          console.error('Error en listener de mensajes:', err);
          setError('Error al recibir mensajes en tiempo real');
        },
        50 // Límite de mensajes
      );

      // Marcar como leído
      await chatService.markMessagesAsRead(conversationId, user.uid);
    } catch (err) {
      console.error('Error cargando conversación:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [conversationId, user]);

  // Efecto principal de carga
  useEffect(() => {
    loadConversation();

    // Limpiar listener al desmontar
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [loadConversation]);

  // Enviar mensaje
  const handleSendMessage = useCallback(async (text: string, imageUrl?: string) => {
    if (!user || !conversationId) {
      Alert.alert('Error', 'No se puede enviar el mensaje');
      return false;
    }

    try {
      const result = await chatService.sendMessage(
        conversationId,
        user.uid,
        { 
          text: text.trim(), 
          imageUrl,
          type: imageUrl ? 'image' : 'text'
        },
        user.displayName || 'Usuario',
        user.photoURL || undefined
      );

      return result.success;
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      Alert.alert('Error', 'No se pudo enviar el mensaje');
      return false;
    }
  }, [user, conversationId]);

  // Subir imagen
  const handleUploadImage = useCallback(async (uri: string) => {
    if (!user || !conversationId) {
      Alert.alert('Error', 'No se puede subir imagen');
      return null;
    }

    try {
      const result = await chatService.uploadMessageImage(uri, conversationId);
      return result.success ? result.data : null;
    } catch (error) {
      console.error('Error subiendo imagen:', error);
      Alert.alert('Error', 'No se pudo subir la imagen');
      return null;
    }
  }, [conversationId]);

  // Mostrar imagen a pantalla completa
  const handleImagePress = useCallback((imageUrl: string) => {
    setSelectedImage(imageUrl);
    setImageModalVisible(true);
  }, []);

  // Obtener ID del otro participante
  const otherParticipantId = useMemo(() => {
    return conversation?.participants.find(p => p !== user?.uid) || '';
  }, [conversation, user]);

  // Renderizado de estado vacío
  const EmptyStateComponent = useCallback(() => (
    <View style={styles.emptyStateContainer}>
      <LinearGradient
        colors={['#F4F6FF', '#E8EEFF']}
        style={styles.emptyStateGradient}
      >
        <MaterialIcons 
          name="chat-bubble-outline" 
          size={120} 
          color="#B9C5FF" 
          style={styles.emptyStateIcon}
        />
        <Text style={styles.emptyText}>No hay mensajes</Text>
        <Text style={styles.emptySubtext}>
          Sé el primero en enviar un mensaje
        </Text>
      </LinearGradient>
    </View>
  ), []);

  // Renderizado condicional
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando conversación...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="error-outline" size={64} color="#FF3B30" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={loadConversation}
        >
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {conversation && (
        <ChatHeader 
          conversation={conversation} 
          participantId={otherParticipantId}
        />
      )}
      
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={messagesListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatMessage 
              message={item} 
              isMine={item.senderId === user?.uid}
              onImagePress={handleImagePress}
            />
          )}
          contentContainerStyle={styles.messagesContainer}
          inverted={false}
          ListEmptyComponent={EmptyStateComponent}
          onContentSizeChange={() => {
            messagesListRef.current?.scrollToEnd({ animated: true });
          }}
        />
        
        <ChatInput 
          onSend={handleSendMessage}
          uploadImage={handleUploadImage}
        />
      </KeyboardAvoidingView>
      
      {/* Modal para imagen a pantalla completa */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        onRequestClose={() => setImageModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalContainer} 
          onPress={() => setImageModalVisible(false)}
          activeOpacity={1}
        >
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },
  keyboardContainer: {
    flex: 1,
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
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  messagesContainer: {
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '80%',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateGradient: {
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    width: '90%',
  },
  emptyStateIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 8,
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
});

export default ChatScreen;