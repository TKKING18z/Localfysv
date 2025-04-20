// React and React Native imports
import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect, memo } from 'react';
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
import FastImageView from '../../components/common/FastImageView';

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

// Importar useNetwork
import { useNetwork } from '../../context/NetworkContext';

// Detailed type definitions
type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;
type ChatScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Chat'>;

// Optimizar ChatMessage con memo para evitar re-renders innecesarios
const MemoizedChatMessage = memo(ChatMessage);

// Agregar esta constante para limitar mensajes en dispositivos de gama baja
const getMessageLimit = (isLowPerformanceDevice: boolean, isSlowConnection: boolean) => {
  if (isLowPerformanceDevice && isSlowConnection) {
    return 20; // Muy limitado para condiciones extremas
  } else if (isLowPerformanceDevice) {
    return 30; // Limitado para dispositivos de gama baja
  } else if (isSlowConnection) {
    return 35; // Limitado para conexiones lentas
  }
  return 50; // Valor por defecto
};

// Sistema de logging controlado para evitar logs excesivos en producción
const DEBUG = __DEV__ && false; // Cambiar a true solo durante desarrollo activo
const log = (message: string, ...args: any[]) => {
  if (DEBUG) {
    console.log(message, ...args);
  }
};

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
    loading: contextLoading, 
    error: contextError, 
    sendMessage, 
    markConversationAsRead,
    uploadImage,
    resendFailedMessage,
    refreshConversations,
    isOffline,
    setActiveConversationId
  } = useChat();
  
  // Agregar useNetwork para detectar condiciones de red y rendimiento
  const { isSlowConnection, isLowPerformanceDevice, connectionQuality } = useNetwork();
  
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

  // Refs - Todas las referencias deben estar definidas al principio del componente
  const messagesListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<ChatInputRef>(null);
  // Referencia para evitar llamadas repetidas de markAsRead
  const markAsReadExecuted = useRef(false);
  // Referencia para evitar suscripciones duplicadas
  const subscribedRef = useRef(false);
  
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
  
  // Inicializar conversación cuando la pantalla se monta - con protección mejorada
  useLayoutEffect(() => {
    // Variable para controlar si el componente está montado
    let isMounted = true;
    let hasInitialized = false; // Evitar inicializaciones repetidas
    
    log(`[ChatScreen] Setting active conversation on mount: ${conversationId}`);
    
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
      
      log('[ChatScreen] Unmounting');
    };
  }, [conversationId]); // Solo depender del conversationId, no de la función
  
  // Animate in the chat screen
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true
    }).start();
  }, [fadeAnim]);
  
  // Mark messages as read when the conversation becomes active
  useEffect(() => {
    // Si no hay conversación activa o no hay usuario, no hacer nada
    if (!activeConversation || !user) return;
    
    // Evitar ejecuciones redundantes con una referencia
    if (markAsReadExecuted.current) return;
    
    // Marcar como ejecutado para evitar llamadas duplicadas
    markAsReadExecuted.current = true;
    
    // Crear función asíncrona separada para mejor control
    const executeMarkAsRead = async () => {
      try {
        log(`[ChatScreen] Marking conversation ${activeConversation.id} as read.`);
        await markConversationAsRead();
        
        // Resetear badge después de marcar como leído (solo una vez)
        try {
          const notificationServiceModule = require('../../../services/NotificationService');
          if (notificationServiceModule.notificationService) {
            await notificationServiceModule.notificationService.resetBadgeCount();
            log('[ChatScreen] Badge count reset successfully');
          }
        } catch (notifError) {
          console.error('[ChatScreen] Error calling resetBadgeCount:', notifError);
        }
      } catch (error) {
        console.error('[ChatScreen] Error marking conversation as read:', error);
      }
    };
    
    // Ejecutar función asíncrona
    executeMarkAsRead();
    
    // Función de limpieza - resetear el flag solo cuando se desmonta el componente
    // o cambia la conversación activa
    return () => {
      markAsReadExecuted.current = false;
    };
  }, [activeConversation?.id, user]); // Eliminar markConversationAsRead de las dependencias
  
  // Enhanced conversation loading - evitando reintentos excesivos y listeners duplicados
  useEffect(() => {
    // Verificar los requisitos básicos - agregar una condición de salida temprana
    if (!conversationId || !user) {
      return; // Salida temprana si no hay ID de conversación o usuario
    }
    
    // Si ya tenemos la conversación activa correcta, no hacer nada
    if (activeConversation?.id === conversationId) {
      setIsLoadingData(false);
      return;
    }
    
    // Evitar suscripciones duplicadas para el mismo ID
    if (subscribedRef.current) {
      return;
    }
    
    log(`[ChatScreen] Loading messages for conversation: ${conversationId}`);
    
    // Variables para control y limpieza
    let isMounted = true;
    let messageListener: (() => void) | null = null;
    subscribedRef.current = true;
    
    // Configurar suscripción a los mensajes
    const subscribeToMessages = () => {
      if (!isMounted || !conversationId) return null;
      
      try {
        log(`[ChatService] Setting up message listener for conversation: ${conversationId}`);
        
        // Usar el límite de mensajes adaptativo según el dispositivo y la conexión
        const messageLimit = getMessageLimit(isLowPerformanceDevice, isSlowConnection);
        log(`[ChatScreen] Using message limit: ${messageLimit} based on device performance and connection`);
        
        const messagesRef = firebase.firestore()
          .collection('conversations')
          .doc(conversationId)
          .collection('messages')
          .orderBy('timestamp', 'desc')
          .limit(messageLimit);
          
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
            
            // Optimización importante: solo actualizar el estado cuando haya cambios significativos
            // Evita actualizaciones de estado innecesarias que causarían re-renders
            const hasNewMessages = 
              localMessages.length !== sortedMessages.length || 
              (sortedMessages.length > 0 && localMessages.length > 0 && 
               sortedMessages[sortedMessages.length - 1].id !== localMessages[localMessages.length - 1].id);
               
            if (hasNewMessages) {
              log(`[ChatScreen] New/updated messages in conversation: ${conversationId}`);
              setLocalMessages(sortedMessages);
            }
            
            // Establecer el estado de carga solo una vez
            if (isLoadingData) {
              setIsLoadingData(false);
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
      subscribedRef.current = false;
      
      if (messageListener) {
        log(`[ChatScreen] Cleaning up message listener for: ${conversationId}`);
        messageListener();
      }
    };
  }, [conversationId, user, activeConversation?.id, isLowPerformanceDevice, isSlowConnection]);
  
  // Determine which error to display (context or local)
  const displayError = contextError || localError;
  
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
  
  // Memoizar la lista de mensajes para evitar recálculos innecesarios
  const optimizedMessageRender = useCallback(({ item, index }: { item: Message; index: number }) => (
    <MemoizedChatMessage 
      message={item} 
      isMine={item.senderId === user?.uid}
      onImagePress={handleImagePress}
      onRetry={handleRetryMessage}
      onReply={handleReplyMessage}
      previousMessage={index > 0 ? displayMessages[index - 1] : null}
    />
  ), [user?.uid, handleImagePress, handleRetryMessage, handleReplyMessage, displayMessages]);
  
  // Optimización para mejorar el rendimiento de scroll
  const keyExtractor = useCallback((item: Message, index: number) => `${item.id}-${index}`, []);
  
  // Optimización para mejorar la experiencia en redes lentas
  const renderLoadingPlaceholder = useCallback(() => {
    if (contextLoading || isLoadingData) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>
            {isSlowConnection ? 'Cargando mensajes (conexión lenta)...' : 'Cargando mensajes...'}
          </Text>
        </View>
      );
    }
    return null;
  }, [contextLoading, isLoadingData, isSlowConnection]);

  // Loading state with retry information
  if ((contextLoading && !activeConversation) || isLoadingData) {
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
              keyExtractor={keyExtractor}
              renderItem={optimizedMessageRender}
              contentContainerStyle={styles.messagesContainer}
              inverted={false}
              ListEmptyComponent={EmptyStateComponent}
              ListHeaderComponent={renderLoadingPlaceholder}
              onScroll={handleScroll}
              scrollEventThrottle={100} // Reducir de 16 a 100 para mejor rendimiento
              onContentSizeChange={() => {
                if (scrollToBottom) {
                  scrollToBottomIfNeeded();
                }
              }}
              showsVerticalScrollIndicator={true}
              windowSize={isLowPerformanceDevice ? 5 : 10} // Optimizar ventana de renderizado
              removeClippedSubviews={isLowPerformanceDevice} // Optimización para dispositivos de gama baja
              maxToRenderPerBatch={isLowPerformanceDevice ? 5 : 10} // Renderizar menos elementos por lote
              initialNumToRender={isLowPerformanceDevice ? 10 : 15} // Reducir renderización inicial
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
            disabled={contextLoading || isOffline}
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
            <FastImageView
              source={{ uri: selectedImage }}
              style={styles.fullScreenImage}
              resizeMode="contain"
              showLoadingIndicator={true}
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
    bottom: 80,
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
  },
  loadingContainer: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
});

export default ChatScreen;