// React and React Native imports
import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
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
  Alert,
  Animated,
  BackHandler,
  Keyboard
} from 'react-native';

// Navigation imports
import { useRoute, RouteProp, useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/AppNavigator';

// Third party libraries
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

// Context and utilities
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

// Components
import ChatHeader from '../../components/chat/ChatHeader';
import ChatMessage from '../../components/chat/ChatMessage';
import ChatInput, { ChatInputRef } from '../../components/chat/ChatInput';
import ReplyPreview from '../../../src/components/chat/ReplyPreview';

// Hooks
import useKeyboard from '../../hooks/useKeyboard';

// Types
import { Message, MessageType, MessageStatus, ReplyInfo } from '../../../models/chatTypes';

// Detailed type definitions
type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;
type ChatScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Chat'>;

const ChatScreen: React.FC = () => {
  // Navigation and route params
  const route = useRoute<ChatScreenRouteProp>();
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const { conversationId } = route.params;
  
  // Contexts
  const { user } = useAuth();
  const { 
    activeConversation, 
    activeMessages, 
    loading, 
    error, 
    sendMessage, 
    markConversationAsRead,
    uploadImage,
    resendFailedMessage,
    refreshConversations,
    isOffline,
    setActiveConversationId
  } = useChat();
  
  // Inicializar conversación cuando la pantalla se monta - con protección mejorada
  useLayoutEffect(() => {
    // Variable para controlar si el componente está montado
    let isMounted = true;
    let hasInitialized = false; // Evitar inicializaciones repetidas
    
    console.log(`[ChatScreen] Setting active conversation on mount: ${conversationId}`);
    
    // Para evitar race conditions, envolvemos la inicialización en un timeout
    const initTimer = setTimeout(() => {
      if (isMounted && conversationId && !hasInitialized) {
        hasInitialized = true;
        setActiveConversationId(conversationId);
      }
    }, 50); // Pequeño delay para asegurar estabilidad en la navegación
    
    return () => {
      // Limpiar timeout y marcar como desmontado
      isMounted = false;
      clearTimeout(initTimer);
      
      console.log('[ChatScreen] Unmounting');
    };
  }, [conversationId]); // Removiendo setActiveConversationId para evitar loops
  
  // Local state
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [scrollToBottom, setScrollToBottom] = useState(true);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [loadRetries, setLoadRetries] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  // Estado para el mensaje al que se está respondiendo
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  
  const maxRetries = 5;

  // Refs
  const messagesListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<ChatInputRef>(null);

  // Usar el hook personalizado para detectar el teclado
  const { 
    keyboardHeight, 
    keyboardVisible: keyboardVisibleHook, 
    safeBottomPadding,
    isModernIphone 
  } = useKeyboard();
  
  // Calculate bottom padding based on keyboard visibility and platform
  const bottomPadding = useMemo(() => {
    if (!keyboardVisibleHook) return 0;
    // Enhanced padding for iPhone 15 Pro and similar devices
    if (Platform.OS === 'ios') {
      return safeBottomPadding;
    }
    // Android padding
    return 10;
  }, [keyboardVisibleHook, safeBottomPadding]);

  // Handle back button press
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        // Si hay una respuesta activa, cancelarla en lugar de regresar
        if (replyToMessage) {
          setReplyToMessage(null);
          return true;
        }
        
        handleGoBack();
        return true;
      };
      
      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [replyToMessage])
  );
  
  // Listen for keyboard events
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        scrollToBottomIfNeeded();
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);
  
  // Animate in the chat screen
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true
    }).start();
  }, [fadeAnim]);
  
  // Enhanced conversation loading - evitando reintentos excesivos y listeners duplicados
  useEffect(() => {
    // Verificar los requisitos básicos
    if (!conversationId || !user || activeConversation?.id === conversationId) {
      if (activeConversation?.id === conversationId) {
        // Si ya tenemos la conversación activa correcta, solo actualizar el estado de carga
        setIsLoadingData(false);
      }
      return;
    }
    
    console.log(`[ChatScreen] Loading messages for conversation: ${conversationId}`);
    
    // Variables para control y limpieza
    let isMounted = true;
    let messageListener: (() => void) | null = null;
    
    // Configurar suscripción a los mensajes
    const subscribeToMessages = () => {
      if (!isMounted || !conversationId) return null;
      
      try {
        console.log(`[ChatService] Setting up message listener for conversation: ${conversationId}`);
        
        const messagesRef = firebase.firestore()
          .collection('conversations')
          .doc(conversationId)
          .collection('messages')
          .orderBy('timestamp', 'desc')
          .limit(50);
          
        return messagesRef.onSnapshot(snapshot => {
          if (!isMounted) return;
          
          if (!snapshot.metadata.hasPendingWrites) {
            const messages = snapshot.docs.map(doc => {
              const msgData = doc.data();
              return {
                id: doc.id,
                text: msgData.text || '',
                senderId: msgData.senderId || user.uid,
                senderName: msgData.senderName || '',
                senderPhoto: msgData.senderPhoto || '',
                timestamp: msgData.timestamp?.toDate ? msgData.timestamp.toDate() : new Date(),
                status: msgData.status || MessageStatus.SENT,
                read: msgData.read === true,
                type: msgData.type || MessageType.TEXT,
                imageUrl: msgData.imageUrl,
                replyTo: msgData.replyTo,
                metadata: msgData.metadata
              } as Message;
            });
            
            // Ordenar por timestamp
            const sortedMessages = messages.sort((a, b) => {
              const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
              const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
              return aTime - bTime;
            });
            
            console.log(`[ChatScreen] Successfully loaded conversation: ${conversationId}`);
            setLocalMessages(sortedMessages);
            setIsLoadingData(false);
            
            // Marcar mensajes como leídos una vez que estén cargados
            if (sortedMessages.length > 0) {
              markConversationAsRead().catch(err => {
                console.error('[ChatScreen] Error marking as read:', err);
              });
            }
          }
        }, error => {
          if (!isMounted) return;
          console.error('[ChatScreen] Error in messages listener:', error);
          setLocalError('Error al cargar mensajes. Intente más tarde.');
          setIsLoadingData(false);
        });
      } catch (error) {
        console.error('[ChatScreen] Error setting up message listener:', error);
        return null;
      }
    };
    
    // Iniciar suscripción
    setIsLoadingData(true);
    messageListener = subscribeToMessages();
    
    return () => {
      // Limpieza al desmontar o cambiar de conversación
      isMounted = false;
      
      if (messageListener) {
        console.log(`[ChatScreen] Cleaning up message listener for: ${conversationId}`);
        messageListener();
      }
    };
  }, [conversationId, user, activeConversation, markConversationAsRead]);
  
  // Mark messages as read when the conversation becomes active
  useEffect(() => {
    let isMounted = true;
    
    const markAsRead = async () => {
      if (!activeConversation || !user || !isMounted) return;
      
      try {
        await markConversationAsRead();
        
        // Resetear badge de notificaciones cuando la conversación está activa
        try {
          if (isMounted) {
            const { notificationService } = require('../../../services/NotificationService');
            await notificationService.resetBadgeCount(user.uid);
          }
        } catch (notifError) {
          console.error('[ChatScreen] Error resetting badge count:', notifError);
        }
      } catch (error) {
        console.error('Error marking conversation as read:', error);
      }
    };
    
    markAsRead();
    
    return () => {
      isMounted = false;
    };
  }, [activeConversation?.id]); // Cambiando a solo depender del ID, no de toda la función
  
  // Determine which error to display (context or local)
  const displayError = error || localError;
  
  // Determine which messages to display (context or local)
  const displayMessages = useMemo(() => {
    let messages = activeMessages.length > 0 ? activeMessages : localMessages;
    
    // Eliminar mensajes duplicados usando un Set para rastrear IDs ya vistos
    const messageIds = new Set();
    const uniqueMessages = messages.filter(msg => {
      // Si ya hemos visto este ID, es un duplicado
      if (messageIds.has(msg.id)) {
        return false;
      }
      // Si no, añadir a los IDs ya vistos y mantener el mensaje
      messageIds.add(msg.id);
      return true;
    });
    
    return uniqueMessages;
  }, [activeMessages, localMessages]);
  
  // Scroll to bottom when new messages are added
  useEffect(() => {
    if (scrollToBottom && displayMessages.length > 0) {
      scrollToBottomIfNeeded();
    }
  }, [displayMessages, scrollToBottom]);
  
  // Scroll to bottom if needed
  const scrollToBottomIfNeeded = useCallback(() => {
    setTimeout(() => {
      if (messagesListRef.current) {
        messagesListRef.current.scrollToEnd({ animated: true });
      }
    }, 100);
  }, []);
  
  // Get the other participant's ID from the active conversation
  const otherParticipantId = useMemo(() => {
    if (!activeConversation || !user) return '';
    return activeConversation.participants.find(id => id !== user.uid) || '';
  }, [activeConversation, user]);
  
  // Handle sending a message with reply support
  const handleSendMessage = useCallback(async (text: string, imageUrl?: string): Promise<boolean> => {
    if (!user) {
      Alert.alert('Error', 'No se puede enviar el mensaje, usuario no autenticado');
      return false;
    }

    if (isOffline) {
      Alert.alert('Sin conexión', 'No puedes enviar mensajes sin conexión a internet');
      return false;
    }

    try {
      // Crear el objeto de respuesta si hay un mensaje al que responder
      let replyData: ReplyInfo | undefined;
      
      if (replyToMessage) {
        replyData = {
          messageId: replyToMessage.id,
          text: replyToMessage.text || '',
          senderId: replyToMessage.senderId,
          senderName: replyToMessage.senderName || '',
          type: replyToMessage.type
        };
        
        // Solo añadir imageUrl si existe
        if (replyToMessage.imageUrl) {
          replyData.imageUrl = replyToMessage.imageUrl;
        }
      }
      
      // Enviar el mensaje con la información de respuesta
      const success = await sendMessage(text, imageUrl, replyData);
      
      // Limpiar el estado de respuesta
      setReplyToMessage(null);
      
      if (success) {
        scrollToBottomIfNeeded();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }, [user, sendMessage, scrollToBottomIfNeeded, isOffline, replyToMessage]);
  
  // Handle showing an image in fullscreen mode
  const handleImagePress = useCallback((imageUrl: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedImage(imageUrl);
    setImageModalVisible(true);
  }, []);
  
  // Handle replying to a message
  const handleReplyMessage = useCallback((message: Message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setReplyToMessage(message);
    // Mostrar el teclado para responder inmediatamente
    setTimeout(() => {
      Keyboard.dismiss();
      // En lugar de Keyboard.show() que no existe, vamos a usar setTimeout para dar tiempo
      // a que el teclado se cierre y luego enfocar el input
      setTimeout(() => {
        if (inputRef && inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    }, 300);
  }, []);
  
  // Handle canceling a reply
  const handleCancelReply = useCallback(() => {
    setReplyToMessage(null);
  }, []);
  
  // Handle retrying a failed message
  const handleRetryMessage = useCallback(async (messageId: string) => {
    if (isOffline) {
      Alert.alert('Sin conexión', 'No puedes reenviar mensajes sin conexión a internet');
      return;
    }
    
    try {
      const success = await resendFailedMessage(messageId);
      if (success) {
        scrollToBottomIfNeeded();
      }
    } catch (error) {
      console.error('Error retrying message:', error);
    }
  }, [resendFailedMessage, scrollToBottomIfNeeded, isOffline]);
  
  // Handle going back
  const handleGoBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Update conversations list when going back
    setTimeout(() => {
      refreshConversations().catch(err => {
        console.error('Error refreshing conversations on back:', err);
      });
    }, 300);
    
    navigation.goBack();
  }, [navigation, refreshConversations]);
  
  // Handle scroll events to determine if we should auto-scroll
  const handleScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    
    // Calculate if we're close to the bottom (within 200px)
    const closeToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 200;
    
    // Only auto-scroll when user is near the bottom
    setScrollToBottom(closeToBottom);
  }, []);
  
  // Empty state component
  const EmptyStateComponent = useCallback(() => (
    <View style={styles.emptyStateContainer}>
      <LinearGradient
        colors={['#F0F9FF', '#DBEAFE']}
        style={styles.emptyStateGradient}
      >
        <View style={styles.emptyIconContainer}>
          <LinearGradient
            colors={['#0A84FF', '#2ECDF1']}
            style={styles.emptyIconGradient}
          >
            <MaterialIcons 
              name="chat-bubble-outline" 
              size={80} 
              color="#FFFFFF" 
              style={styles.emptyStateIcon}
            />
          </LinearGradient>
        </View>
        <Text style={styles.emptyText}>No hay mensajes todavía</Text>
        <Text style={styles.emptySubtext}>
          Sé el primero en enviar un mensaje para iniciar la conversación
        </Text>
        <View style={styles.emptyArrow}>
          <MaterialIcons name="arrow-downward" size={36} color="#0A84FF" />
        </View>
      </LinearGradient>
    </View>
  ), []);
  
  // Loading state with retry information
  if ((loading && !activeConversation) || isLoadingData) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>
          {loadRetries > 0 
            ? `Cargando conversación (intento ${loadRetries}/${maxRetries})...` 
            : 'Cargando conversación...'}
        </Text>
        {loadRetries >= 2 && (
          <Text style={styles.retryText}>
            Puede tomar un momento para nuevas conversaciones
          </Text>
        )}
      </View>
    );
  }

  // Error state
  if (displayError && !activeConversation) {
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="error-outline" size={64} color="#FF3B30" />
        <Text style={styles.errorText}>{displayError}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={handleGoBack}
        >
          <Text style={styles.retryButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <ChatHeader 
        conversation={activeConversation} 
        participantId={otherParticipantId}
        isTyping={isTyping}
        businessMode={!!activeConversation?.businessId}
        onBackPress={handleGoBack}
      />
      
      {/* Offline indicator */}
      {isOffline && (
        <View style={styles.offlineBar}>
          <MaterialIcons name="wifi-off" size={18} color="#E53935" />
          <Text style={styles.offlineText}>Sin conexión a internet</Text>
        </View>
      )}
      
      {/* Main content */}
      <Animated.View style={[styles.contentContainer, { opacity: fadeAnim }]}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? (isModernIphone ? 120 : 90) : 0}
          enabled={true}
        >
          <View style={styles.messagesWrapper}>
            {/* Error banner */}
            {displayError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{displayError}</Text>
                <TouchableOpacity onPress={() => refreshConversations()}>
                  <Text style={styles.errorBannerRetry}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Messages list */}
            <FlatList
              ref={messagesListRef}
              data={displayMessages} 
              keyExtractor={(item, index) => `${item.id}-${index}`}
              renderItem={({ item, index }) => (
                <ChatMessage 
                  message={item} 
                  isMine={item.senderId === user?.uid}
                  onImagePress={handleImagePress}
                  onRetry={handleRetryMessage}
                  onReply={handleReplyMessage}
                  previousMessage={index > 0 ? displayMessages[index - 1] : null}
                />
              )}
              contentContainerStyle={styles.messagesContainer}
              inverted={false}
              ListEmptyComponent={EmptyStateComponent}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              onContentSizeChange={() => {
                if (scrollToBottom) {
                  scrollToBottomIfNeeded();
                }
              }}
              showsVerticalScrollIndicator={true}
            />
          </View>
          
          {/* Reply Preview */}
          {replyToMessage && (
            <View style={{
              position: 'absolute', 
              bottom: inputRef.current ? 60 : 80, 
              left: 0,
              right: 0,
              zIndex: 1000,
            }}>
              <ReplyPreview 
                message={replyToMessage}
                onCancel={handleCancelReply}
                isMine={replyToMessage.senderId === user?.uid}
              />
            </View>
          )}
          
          {/* Input component */}
          <ChatInput 
            onSend={handleSendMessage}
            uploadImage={uploadImage}
            disabled={loading || isOffline}
            keyboardVisible={keyboardVisibleHook}
            isModernIphone={isModernIphone}
            replyActive={!!replyToMessage}
            ref={inputRef}
          />
        </KeyboardAvoidingView>
      </Animated.View>
      
      {/* Fullscreen image modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        onRequestClose={() => setImageModalVisible(false)}
        animationType="fade"
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
              onLoadStart={() => {}}
              onLoadEnd={() => {}}
              fadeDuration={300}
            />
          )}
          <TouchableOpacity 
            style={styles.closeModalButton}
            onPress={() => setImageModalVisible(false)}
          >
            <LinearGradient
              colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.6)']}
              style={styles.closeGradient}
            >
              <MaterialIcons name="close" size={24} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      
      {/* Scroll to bottom button */}
      {!scrollToBottom && displayMessages.length > 10 && (
        <TouchableOpacity
          style={styles.scrollToBottomButton}
          onPress={scrollToBottomIfNeeded}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['#0A84FF', '#2ECDF1']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.scrollToBottomGradient}
          >
            <MaterialIcons name="arrow-downward" size={28} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EFF6FF',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#EFF6FF',
  },
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#EFF6FF',
  },
  messagesWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#EFF6FF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#0A84FF',
    fontWeight: '600',
    textAlign: 'center',
  },
  retryText: {
    marginTop: 12,
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: '80%',
    lineHeight: 22,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    fontWeight: '600',
    maxWidth: '90%',
  },
  retryButton: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 28,
    backgroundColor: '#0A84FF',
    borderRadius: 16,
    minWidth: 140,
    alignItems: 'center',
    shadowColor: '#0A84FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
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
    borderRadius: 20,
    overflow: 'hidden',
  },
  closeGradient: {
    padding: 10,
    borderRadius: 20,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 400,
  },
  emptyStateGradient: {
    padding: 40,
    borderRadius: 24,
    alignItems: 'center',
    width: '96%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  emptyIconContainer: {
    marginBottom: 24,
    borderRadius: 40,
    padding: 10,
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
  },
  emptyIconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0A84FF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
  },
  emptyStateIcon: {
    marginBottom: 0,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0A1629',
    marginTop: 10,
    letterSpacing: 0.3,
  },
  emptySubtext: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: '90%',
  },
  emptyArrow: {
    marginTop: 30,
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
    borderRadius: 30,
    padding: 8,
  },
  errorBanner: {
    backgroundColor: '#FFF1F0',
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#FFCDD2',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  errorBannerText: {
    color: '#E53935',
    fontSize: 15,
    flex: 1,
    fontWeight: '500',
  },
  errorBannerRetry: {
    color: '#0A84FF',
    fontWeight: 'bold',
    marginLeft: 14,
    fontSize: 15,
    padding: 6,
  },
  scrollToBottomButton: {
    position: 'absolute',
    right: 20,
    bottom: 90,
    borderRadius: 28,
    shadowColor: '#0A84FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  scrollToBottomGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineBar: {
    backgroundColor: '#FFF5F5',
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#FFCDD2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  offlineText: {
    color: '#E53935',
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 15,
  }
});

export default ChatScreen;