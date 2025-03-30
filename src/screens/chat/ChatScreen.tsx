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
import firebase from 'firebase/compat/app';

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

  // Mejora en el loadConversation
  const loadConversation = useCallback(async () => {
    if (!conversationId || !user) {
      setError('Datos insuficientes para cargar conversación');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Implementar un timeout para evitar que la operación quede colgada
      let timeoutId: NodeJS.Timeout | null = null;
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Tiempo de espera agotado al cargar la conversación'));
        }, 15000); // 15 segundos de timeout
      });
      
      // Limpiar unsubscribe anterior si existe
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      
      // Función para cargar los datos
      const fetchDataPromise = async () => {
        // Obtener datos de conversación
        const convResult = await chatService.getConversation(conversationId);
        if (!convResult.success || !convResult.data) {
          throw new Error(convResult.error?.message || 'No se pudo cargar la conversación');
        }
        
        // Verificar si la conversación ha sido eliminada por el usuario
        if (convResult.data.deletedFor && convResult.data.deletedFor[user.uid] === true) {
          throw new Error('Esta conversación ya no está disponible');
        }
        
        setConversation(convResult.data);
        
        // Cargar mensajes iniciales para mostrar algo rápido
        const messagesResult = await chatService.getMessages(conversationId, 30);
        if (messagesResult.success && messagesResult.data) {
          // Ordenar mensajes por timestamp
          const sortedMessages = [...messagesResult.data].sort((a, b) => {
            const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : 
                        typeof a.timestamp === 'string' ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : 
                        typeof b.timestamp === 'string' ? new Date(b.timestamp).getTime() : 0;
            return timeA - timeB;
          });
          
          setMessages(sortedMessages);
        }
        
        // Configurar listener para actualizaciones en tiempo real
        const unsubscribe = chatService.listenToMessages(
          conversationId,
          (updatedMessages) => {
            // Ordenar por timestamp
            const sortedMessages = [...updatedMessages].sort((a, b) => {
              let timeA: number;
              let timeB: number;
              
              if (a.timestamp instanceof firebase.firestore.Timestamp) {
                timeA = a.timestamp.toMillis();
              } else if (a.timestamp instanceof Date) {
                timeA = a.timestamp.getTime();
              } else if (typeof a.timestamp === 'string') {
                timeA = new Date(a.timestamp).getTime();
              } else {
                timeA = 0;
              }
              
              if (b.timestamp instanceof firebase.firestore.Timestamp) {
                timeB = b.timestamp.toMillis();
              } else if (b.timestamp instanceof Date) {
                timeB = b.timestamp.getTime();
              } else if (typeof b.timestamp === 'string') {
                timeB = new Date(b.timestamp).getTime();
              } else {
                timeB = 0;
              }
              
              return timeA - timeB;
            });
            
            setMessages(sortedMessages);
            
            // Desplazar al final con un pequeño retraso para asegurar que la UI se actualice
            setTimeout(() => {
              if (messagesListRef.current) {
                messagesListRef.current.scrollToEnd({ animated: false });
              }
            }, 100);
          },
          (error) => {
            console.error('Error en listener de mensajes:', error);
            if (messagesListRef.current) {
              setError('Error al recibir mensajes en tiempo real. Intenta recargar la conversación.');
            }
          },
          50 // Límite de mensajes
        );
        
        // Guardar referencia para limpieza
        unsubscribeRef.current = unsubscribe;
        
        // Marcar como leído
        try {
          await chatService.markMessagesAsRead(conversationId, user.uid);
        } catch (markError) {
          console.error('Error marcando mensajes como leídos:', markError);
          // No interrumpir el flujo por este error
        }
        
        return true;
      };
      
      // Ejecutar con timeout
      await Promise.race([fetchDataPromise(), timeoutPromise]);
      
      // Limpiar timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      console.error('Error cargando conversación:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      
      // Implementar reintento automático solo para errores de red
      if (err instanceof Error && 
          (err.message.includes('network') || 
          err.message.includes('timeout') || 
          err.message.includes('connection'))) {
        // Reintentar después de un tiempo
        setTimeout(() => {
          if (messagesListRef.current) { // Verificar que la pantalla sigue montada
            loadConversation();
          }
        }, 5000);
      }
    } finally {
      setLoading(false);
    }
  }, [conversationId, user]);

  // Función mejorada para enviar mensajes
  const handleSendMessage = useCallback(async (text: string, imageUrl?: string): Promise<boolean> => {
    if (!user || !conversationId) {
      Alert.alert('Error', 'No se puede enviar el mensaje');
      return false;
    }

    // Si no hay texto y no hay imagen, no enviar
    if (!text.trim() && !imageUrl) {
      return false;
    }

    try {
      // Mostrar optimistamente el mensaje
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        text: text.trim(),
        senderId: user.uid,
        senderName: user.displayName || 'Usuario',
        senderPhoto: user.photoURL || '',
        timestamp: new Date(),
        read: false,
        type: imageUrl ? 'image' : 'text',
        imageUrl
      };

      // Actualizar UI inmediatamente
      setMessages(prevMessages => [...prevMessages, optimisticMessage]);
      
      // Enviar mensaje real en segundo plano
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

      if (!result.success) {
        console.error('Error sending message:', result.error);
        
        // Quitar mensaje optimista
        setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
        
        // Mostrar error
        Alert.alert('Error', 'No se pudo enviar el mensaje. Intente nuevamente.');
        return false;
      }

      // Desplazar al final con un pequeño retraso
      setTimeout(() => {
        messagesListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      return true;
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      Alert.alert('Error', 'No se pudo enviar el mensaje');
      return false;
    }
  }, [user, conversationId]);

  // Subir una imagen
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

  // Efecto para cargar la conversación
  useEffect(() => {
    loadConversation();

    // Limpiar al desmontar el componente
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [loadConversation]);

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

  // Manejar volver atrás
  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Renderizado condicional
  if (loading && !conversation) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando conversación...</Text>
      </View>
    );
  }

  if (error && !conversation) {
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
          onBackPress={handleGoBack}
        />
      )}
      
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
            <TouchableOpacity onPress={loadConversation}>
              <Text style={styles.errorBannerRetry}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}

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
            messagesListRef.current?.scrollToEnd({ animated: false });
          }}
        />
        
        <ChatInput 
          onSend={handleSendMessage}
          uploadImage={handleUploadImage}
          disabled={loading}
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
          <TouchableOpacity 
            style={styles.closeModalButton}
            onPress={() => setImageModalVisible(false)}
          >
            <MaterialIcons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
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
    flexGrow: 1,
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
  closeModalButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 300,
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
  errorBanner: {
    backgroundColor: '#FFEBE9',
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#FF3B30',
  },
  errorBannerText: {
    color: '#FF3B30',
    fontSize: 14,
    flex: 1,
  },
  errorBannerRetry: {
    color: '#007AFF',
    fontWeight: 'bold',
    marginLeft: 10,
  }
});

export default ChatScreen;