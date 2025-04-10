import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { chatService } from '../../services/ChatService';
import { firebaseService } from '../services/firebaseService';
import { useAuth } from './AuthContext';
import { Conversation, Message, ChatResult, MessageStatus, MessageType, ReplyInfo, NewMessageData } from '../../models/chatTypes';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { AppState } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';


interface ChatContextType {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  activeMessages: Message[];
  localMessages: Message[];
  loading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  refreshConversations: () => Promise<void>;
  setActiveConversationId: (id: string | null) => Promise<void>;
  sendMessage: (text: string, imageUrl?: string, replyTo?: ReplyInfo) => Promise<boolean>;
  addLocalMessage: (message: Message) => void;
  removeLocalMessage: (id: string) => void;
  markMessageAsRead: (messageId: string) => void;
  markConversationAsRead: () => Promise<void>;
  isLoadingMoreMessages: boolean;
  loadMoreMessages: () => Promise<void>;
  hasMoreMessages: boolean;
  replyingTo: ReplyInfo | null;
  setReplyingTo: (data: ReplyInfo | null) => void;
  unreadTotal: number;
  isOffline: boolean;
  uploadImage: (uri: string) => Promise<string | null>;
  resendFailedMessage: (messageId: string) => Promise<boolean>;
  deleteConversation: (conversationId: string) => Promise<boolean>;
  updateNotificationToken: (token: string) => Promise<void>;
  createConversation: (
    recipientId: string,
    recipientName: string,
    businessId?: string,
    businessName?: string,
    initialMessage?: string
  ) => Promise<string | null>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [activeConversationId, _setActiveConversationId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadTotal, setUnreadTotal] = useState<number>(0);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  
  // Referencia para almacenar IDs de mensajes que ya se notificaron
  // Usamos useRef para mantener este valor sin causar re-renders
  const notifiedMessageIds = useRef<Set<string>>(new Set());
  
  // Initialize network connectivity listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });
    
    // Check initial connection state
    NetInfo.fetch().then(state => {
      setIsOffline(!state.isConnected);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);

  // Define markConversationAsRead early to avoid circular dependency
  const markConversationAsRead = useCallback(async () => {
    if (!user || !activeConversation) {
      console.log('[ChatContext] Cannot mark as read: missing user or active conversation');
      return;
    }
    
    if (isOffline) {
      console.log('[ChatContext] Cannot mark as read: Device is offline');
      return;
    }
    
    try {
      console.log(`[ChatContext] Marking conversation ${activeConversation.id} as read`);
      await chatService.markMessagesAsRead(activeConversation.id, user.uid);
      
      // Update total unread
      const updatedUnreadTotal = unreadTotal - (activeConversation.unreadCount?.[user.uid] || 0);
      setUnreadTotal(Math.max(0, updatedUnreadTotal));
      
      // Update locally
      setConversations(prevConversations => 
        prevConversations.map((conv: Conversation) => 
          conv.id === activeConversation.id 
            ? { 
                ...conv, 
                unreadCount: { 
                  ...conv.unreadCount, 
                  [user.uid]: 0 
                } 
              }
            : conv
        )
      );
      
      // Update active messages to show as read
      setActiveMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.senderId !== user.uid && !msg.read
            ? { ...msg, read: true, status: MessageStatus.READ }
            : msg
        )
      );
      
      // Limpiar el registro de mensajes ya notificados para esta conversación
      // porque ya han sido leídos
      notifiedConversations.current.set(activeConversation.id, 0);
      
      // Marcar todos los mensajes como notificados para evitar nuevas notificaciones
      activeMessages.forEach(msg => {
        notifiedMessageIds.current.add(msg.id);
      });
      
      console.log('[ChatContext] Successfully marked as read');
    } catch (error) {
      console.error('[ChatContext] Error marking conversation as read:', error);
    }
  }, [user, activeConversation, unreadTotal, isOffline, activeMessages]);
  
  // Effect to automatically clean up duplicate conversations
  useEffect(() => {
    const cleanupDuplicateConversations = async () => {
      if (!user) return;
      
      try {
        // Check if cleanup was done recently (don't do it too often)
        const lastCleanupStr = await AsyncStorage.getItem('last_chat_cleanup');
        if (lastCleanupStr) {
          const lastCleanup = new Date(lastCleanupStr);
          const now = new Date();
          const hoursSinceLastCleanup = (now.getTime() - lastCleanup.getTime()) / (1000 * 60 * 60);
          
          // If done in the last 24 hours, don't do it again
          if (hoursSinceLastCleanup < 24) {
            console.log('[ChatContext] Skipping duplicate conversation cleanup (done recently)');
            return;
          }
        }
        
        console.log('[ChatContext] Running automatic duplicate conversation cleanup');
        
        // Safely check for method existence using type assertion
        const chatService = (firebaseService as any).chat;
        if (chatService?.chatCleanup && 
            typeof chatService.chatCleanup.detectAndMergeDuplicateConversations === 'function') {
          const result = await chatService.chatCleanup.detectAndMergeDuplicateConversations(user.uid);
          console.log('[ChatContext] Cleanup result:', result);
          
          // If there were changes, refresh conversations
          if (result.success) {
            // Save last cleanup timestamp
            await AsyncStorage.setItem('last_chat_cleanup', new Date().toISOString());
            
            // Refresh conversations after a short delay
            setTimeout(() => {
              loadConversations();
            }, 1000);
          }
        } else {
          console.log('[ChatContext] Cleanup method not available in firebaseService');
        }
      } catch (error) {
        console.error('[ChatContext] Error during duplicate conversation cleanup:', error);
      }
    };
    
    // Run cleanup after a delay to not affect initial performance
    let cleanupTimeout: NodeJS.Timeout | null = null;
    if (user) {
      cleanupTimeout = setTimeout(cleanupDuplicateConversations, 5000);
    }
    
    return () => {
      if (cleanupTimeout) {
        clearTimeout(cleanupTimeout);
      }
    };
  }, [user]);
  
  // Function to load all user conversations
  const loadConversations = useCallback(async () => {
    if (!user) {
      console.error('[ChatContext] Cannot load conversations: no user logged in');
      return;
    }
    
    if (isOffline) {
      console.log('[ChatContext] Device is offline, loading from cache if available');
      // Could implement offline mode with cached data here
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('[ChatContext] Fetching conversations from service');
      const result = await chatService.getUserConversations(user.uid);
      if (result.success && result.data) {
        console.log(`[ChatContext] Loaded ${result.data.length} conversations`);
        
        // Filter out deleted conversations in case the service didn't do it correctly
        const filteredConversations = result.data.filter((conv: Conversation) => 
          !(conv.deletedFor && conv.deletedFor[user.uid] === true)
        );
        
        console.log(`[ChatContext] After additional filtering, ${filteredConversations.length} conversations remain`);
        setConversations(filteredConversations);
        
        // Calculate total unread based on filtered conversations
        const total = filteredConversations.reduce((sum: number, conv: Conversation) => {
          return sum + (conv.unreadCount?.[user.uid] || 0);
        }, 0);
        
        console.log(`[ChatContext] Total unread messages: ${total}`);
        setUnreadTotal(total);
        
        // Store conversations in AsyncStorage for offline access
        try {
          await AsyncStorage.setItem(
            `user_conversations_${user.uid}`, 
            JSON.stringify({
              conversations: filteredConversations,
              timestamp: new Date().toISOString()
            })
          );
        } catch (cacheError) {
          console.warn('[ChatContext] Failed to cache conversations:', cacheError);
        }
      } else {
        console.error('[ChatContext] Failed to load conversations:', result.error);
        setError(result.error?.message || 'Error al cargar conversaciones');
        
        // Try to load from cache as fallback
        await loadConversationsFromCache();
      }
    } catch (error) {
      console.error('[ChatContext] Unexpected error loading conversations:', error);
      setError('Error inesperado al cargar conversaciones');
      
      // Try to load from cache as fallback
      await loadConversationsFromCache();
    } finally {
      setLoading(false);
    }
  }, [user, isOffline]);
  
  // Load conversations from cache (for offline mode)
  const loadConversationsFromCache = async () => {
    if (!user) return;
    
    try {
      const cachedData = await AsyncStorage.getItem(`user_conversations_${user.uid}`);
      if (cachedData) {
        const { conversations: cachedConversations, timestamp } = JSON.parse(cachedData);
        
        // Check if cache is not too old (e.g., less than 24 hours)
        const cacheTime = new Date(timestamp).getTime();
        const now = new Date().getTime();
        const cacheAgeHours = (now - cacheTime) / (1000 * 60 * 60);
        
        if (cacheAgeHours < 24 && cachedConversations?.length > 0) {
          console.log(`[ChatContext] Using cached conversations (${cachedConversations.length} items, ${cacheAgeHours.toFixed(1)} hours old)`);
          setConversations(cachedConversations);
          
          // Calculate unread from cache
          const cachedUnreadTotal = cachedConversations.reduce((sum: number, conv: Conversation) => {
            return sum + (conv.unreadCount?.[user.uid] || 0);
          }, 0);
          setUnreadTotal(cachedUnreadTotal);
        } else {
          console.log('[ChatContext] Cached conversations too old or empty');
        }
      } else {
        console.log('[ChatContext] No cached conversations found');
      }
    } catch (error) {
      console.error('[ChatContext] Error loading cached conversations:', error);
    }
  };
  
  // Load initial conversations
  useEffect(() => {
    if (user) {
      console.log('[ChatContext] Loading initial conversations for user:', user.uid);
      loadConversations();
    } else {
      console.log('[ChatContext] No user logged in, resetting conversations');
      setConversations([]);
      setActiveConversation(null);
      setActiveMessages([]);
      setUnreadTotal(0);
    }
  }, [user, loadConversations]);
  
  // Load active conversation when ID changes
  useEffect(() => {
    if (activeConversationId && user) {
      console.log(`[ChatContext] Loading active conversation: ${activeConversationId}`);
      loadActiveConversation(activeConversationId);
    } else {
      setActiveConversation(null);
      setActiveMessages([]);
    }
  }, [activeConversationId, user]);

  // Function to update unread count
  const updateUnreadCount = useCallback(() => {
    if (!user || !conversations.length) return;
    
    // Calculate total unread messages
    const total = conversations.reduce((sum: number, conv: Conversation) => {
      return sum + (conv.unreadCount?.[user.uid] || 0);
    }, 0);
    
    setUnreadTotal(total);
    
    // Update badge in tab navigator (optional)
    try {
      // Could add native notification badge integration here
    } catch (error) {
      console.error('[ChatContext] Error updating badge:', error);
    }
  }, [user, conversations]);

  // Referencia para almacenar las conversaciones que ya se han notificado
  const notifiedConversations = useRef<Map<string, number>>(new Map());
  
  // Effect to ensure unread count is updated when conversations change
  useEffect(() => {
    updateUnreadCount();
    
    // Detectar si hay conversaciones con mensajes nuevos para mostrar notificaciones
    if (user && conversations.length > 0) {
      // Solo notificar si hay conversaciones con mensajes no leídos
      const conversationsWithUnread = conversations.filter(conv => 
        (conv.unreadCount?.[user.uid] || 0) > 0);
      
      if (conversationsWithUnread.length > 0) {
        try {
          // Si hay una conversación activa, no notificar por mensajes en esa conversación
          const convsToNotify = activeConversationId 
            ? conversationsWithUnread.filter(conv => conv.id !== activeConversationId)
            : conversationsWithUnread;
          
          // Filtrar para incluir sólo conversaciones con nuevos mensajes no leídos
          // o que no hayan sido notificadas previamente
          const conversationsToNotify = convsToNotify.filter(conv => {
            const currentUnreadCount = conv.unreadCount?.[user.uid] || 0;
            const previousUnreadCount = notifiedConversations.current.get(conv.id) || 0;
            
            // Si hay más mensajes no leídos que antes, o no se ha notificado previamente
            return currentUnreadCount > previousUnreadCount;
          });
          
          // Si hay conversaciones para notificar, mostrar notificaciones
          if (conversationsToNotify.length > 0) {
            // Importar el servicio de notificaciones
            const notificationService = require('../../services/NotificationService').notificationService;
            
            // Mostrar notificación por la primera conversación con mensajes no leídos
            const firstUnreadConv = conversationsToNotify[0];
            const senderName = firstUnreadConv.participantNames?.[
              firstUnreadConv.participants.find(p => p !== user.uid) || ''
            ] || 'Nuevo mensaje';
            
            console.log(`[ChatContext] Showing notification for conversation ${firstUnreadConv.id} with ${firstUnreadConv.unreadCount?.[user.uid]} unread messages`);
            
            notificationService.sendLocalNotification(
              senderName,
              firstUnreadConv.lastMessage?.text || 'Tienes mensajes nuevos',
              {
                type: 'chat',
                conversationId: firstUnreadConv.id
              }
            ).catch((err: Error) => {
              console.error('[ChatContext] Error sending notification for unread messages:', err);
            });
            
            // Actualizar el contador de notificaciones en el ícono de la app
            notificationService.setBadgeCount(unreadTotal).catch((err: Error) => {
              console.error('[ChatContext] Error setting badge count:', err);
            });
            
            // Actualizar los contadores de mensajes no leídos notificados
            conversationsToNotify.forEach(conv => {
              notifiedConversations.current.set(conv.id, conv.unreadCount?.[user.uid] || 0);
            });
          }
        } catch (error: unknown) {
          console.error('[ChatContext] Error showing notifications for unread messages:', error);
        }
      }
    }
  }, [updateUnreadCount, conversations, user, activeConversationId, unreadTotal]);
  
  // Enhanced method to refresh conversations
  const refreshConversations = useCallback(async () => {
    if (!user) {
      console.error('[ChatContext] Cannot refresh conversations: no user logged in');
      return;
    }
    
    if (isOffline) {
      setError('No hay conexión a internet. Inténtalo de nuevo cuando estés conectado.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('[ChatContext] Refreshing conversations for user:', user.uid);
      
      // Implement a timeout to prevent the operation from hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout fetching conversations')), 15000);
      });
      
      // Create a promise that can be canceled with timeout
      const fetchPromise = chatService.getUserConversations(user.uid);
      
      // Use Promise.race to handle timeout case
      const result = await Promise.race([fetchPromise, timeoutPromise]) as ChatResult<Conversation[]>;
      
      if (result.success && result.data) {
        console.log(`[ChatContext] Refreshed ${result.data.length} conversations`);
        
        // Filter deleted conversations
        const filteredConversations = result.data.filter((conv: Conversation) => 
          !(conv.deletedFor && conv.deletedFor[user.uid] === true)
        );
        
        console.log(`[ChatContext] After filtering deleted, ${filteredConversations.length} conversations remain`);
        
        // Sanitize data to avoid rendering problems
        const sanitizedConversations = filteredConversations.map((conv: Conversation) => {
          // Ensure unreadCount exists
          if (!conv.unreadCount) {
            conv.unreadCount = {};
            conv.participants.forEach((p: string) => {
              conv.unreadCount[p] = 0;
            });
          }
          
          // Ensure participantNames exists
          if (!conv.participantNames) {
            conv.participantNames = {};
            conv.participants.forEach((p: string) => {
              conv.participantNames[p] = 'Usuario';
            });
          }
          
          return conv;
        });
        
        setConversations(sanitizedConversations);
        
        // Calculate total unread
        const unreadTotal = sanitizedConversations.reduce((sum: number, conv: Conversation) => {
          return sum + (conv.unreadCount[user.uid] || 0);
        }, 0);
        
        setUnreadTotal(unreadTotal);
        
        // Update cache for offline mode
        try {
          await AsyncStorage.setItem(
            `user_conversations_${user.uid}`, 
            JSON.stringify({
              conversations: sanitizedConversations,
              timestamp: new Date().toISOString()
            })
          );
        } catch (cacheError) {
          console.warn('[ChatContext] Failed to update conversation cache:', cacheError);
        }
      } else {
        console.error('[ChatContext] Failed to refresh conversations:', result.error);
        setError(result.error?.message || 'Error al cargar conversaciones');
      }
    } catch (error) {
      console.error('[ChatContext] Unexpected error refreshing conversations:', error);
      setError('Error inesperado al cargar conversaciones. Revisa tu conexión.');
    } finally {
      setLoading(false);
    }
  }, [user, isOffline]);
  
  // Load a specific conversation - optimizado para mejor rendimiento
  const loadActiveConversation = useCallback(async (conversationId: string) => {
    if (!user) {
      console.error('[ChatContext] Cannot load active conversation: no user logged in');
      return;
    }
    
    // Una verificación adicional para evitar cargas innecesarias
    if (activeConversation?.id === conversationId) {
      console.log(`[ChatContext] Conversation ${conversationId} already loaded, skipping`);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`[ChatContext] Loading conversation data for ${conversationId}`);
      
      // Cargar datos de conversación
      const convResult = await chatService.getConversation(conversationId);
      
      // Comprobar si el ID activo ha cambiado durante la carga
      if (activeConversationId !== conversationId) {
        console.log(`[ChatContext] Active conversation changed during loading, aborting load for ${conversationId}`);
        return;
      }
      
      if (convResult.success && convResult.data) {
        // Verificar si está marcada como eliminada para este usuario
        if (convResult.data.deletedFor && convResult.data.deletedFor[user.uid]) {
          setError('Esta conversación ya no está disponible');
          setLoading(false);
          return;
        }
        
        // Establecer la conversación activa
        setActiveConversation(convResult.data);
        
        // Configurar oyente de mensajes - con protección para evitar carreras
        const messageListener = chatService.listenToMessages(
          conversationId,
          (messages) => {
            // Solo actualizar mensajes si esta sigue siendo la conversación activa
            if (activeConversationId === conversationId) {
              console.log(`[ChatContext] Received ${messages.length} messages update`);
              
              // Verificar si hay mensajes nuevos para notificar
              const lastLocalMessageTime = activeMessages.length > 0 
                ? getTimestampMillis(activeMessages[activeMessages.length - 1].timestamp)
                : 0;
              
              // Función para convertir diferentes tipos de timestamp a milisegundos
              function getTimestampMillis(timestamp: any): number {
                if (!timestamp) return 0;
                
                if (timestamp instanceof Date) {
                  return timestamp.getTime();
                } else if (typeof timestamp === 'string') {
                  return new Date(timestamp).getTime();
                } else if (timestamp && typeof timestamp.toDate === 'function') {
                  // Para timestamps de Firestore
                  return timestamp.toDate().getTime();
                } else if (typeof timestamp === 'number') {
                  return timestamp;
                } else {
                  return 0;
                }
              }
              
              // Buscar mensajes nuevos que no sean del usuario actual y que no hayan sido notificados previamente
              const newMessages = messages.filter(msg => {
                // Convertir timestamp a formato comparable
                const msgTime = getTimestampMillis(msg.timestamp);
                
                // Verificar si es un mensaje nuevo que:
                // 1. No es del usuario actual
                // 2. Tiene una marca de tiempo posterior al último mensaje local
                // 3. No ha sido marcado como leído
                // 4. No ha sido notificado previamente (comprobamos el ID)
                return msgTime > lastLocalMessageTime && 
                       msg.senderId !== user?.uid && 
                       msg.read !== true && 
                       !notifiedMessageIds.current.has(msg.id);
              });
              
              // Mostrar notificación para mensajes nuevos cuando la app está abierta pero no en la conversación
              if (newMessages.length > 0) {
                try {
                  // Importar el servicio de notificaciones
                  const notificationService = require('../../services/NotificationService').notificationService;
                  
                  // Para cada mensaje nuevo, generar una notificación
                  newMessages.forEach(msg => {
                    // Primero, marcar este mensaje como notificado
                    notifiedMessageIds.current.add(msg.id);
                    
                    console.log(`[ChatContext] Sending notification for message ${msg.id}`);
                    
                    notificationService.sendLocalNotification(
                      msg.senderName || 'Nuevo mensaje',
                      msg.text || (msg.imageUrl ? 'Te envió una imagen' : 'Nuevo mensaje'),
                      {
                        type: 'chat',
                        conversationId,
                        messageId: msg.id
                      }
                    ).catch((err: Error) => {
                      console.error('[ChatContext] Error sending notification:', err);
                    });
                  });
                } catch (error: unknown) {
                  console.error('[ChatContext] Error showing notification:', error);
                }
              }
              
              setActiveMessages(messages);
            }
          },
          (error) => {
            console.error('[ChatContext] Error in message listener:', error);
          },
          50 // Obtener más mensajes para historial
        );
        
        // Marcar mensajes como leídos
        try {
          await markConversationAsRead();
        } catch (markError) {
          console.error('[ChatContext] Error marking conversation as read:', markError);
        }
        
        // Devolver función para cancelar suscripción
        return messageListener;
      } else {
        console.error('[ChatContext] Failed to load conversation:', convResult.error);
        setError(convResult.error?.message || 'Error al cargar conversación');
      }
    } catch (error) {
      console.error('[ChatContext] Unexpected error loading conversation:', error);
      
      // Solo establecer error si esta sigue siendo la conversación activa
      if (activeConversationId === conversationId) {
        setError('Error inesperado al cargar conversación');
      }
    } finally {
      // Solo actualizar estado de carga si esta sigue siendo la conversación activa
      if (activeConversationId === conversationId) {
        setLoading(false);
      }
    }
  }, [user, markConversationAsRead, activeConversationId, activeConversation]);
  
  // Establecer conversación activa por ID
  const setActiveConversationId = useCallback(async (id: string | null) => {
    console.log(`[ChatContext] Setting active conversation ID: ${id}`);
    
    // Si ya es la conversación activa, no hacer nada
    if (activeConversationId === id) {
      console.log(`[ChatContext] Conversation ${id} is already active, skipping`);
      return;
    }
    
    // Si se solicita limpiar la conversación activa
    if (id === null) {
      _setActiveConversationId(null);
      setActiveConversation(null);
      setActiveMessages([]);
      return;
    }
    
    try {
      setLoading(true);
      
      // Buscar primero en las conversaciones ya cargadas
      const existingConv = conversations.find(conv => conv.id === id);
      
      if (existingConv) {
        setActiveConversation(existingConv);
        _setActiveConversationId(id);
        
        // Cargar mensajes
        try {
          const messagesResult = await chatService.getMessages(id, 50);
          
          if (messagesResult.success && messagesResult.data) {
            setActiveMessages(messagesResult.data);
          } else {
            console.error('[ChatContext] Error loading messages:', messagesResult.error);
            setActiveMessages([]);
          }
        } catch (error) {
          console.error('[ChatContext] Error fetching messages:', error);
          setActiveMessages([]);
        }
      } else {
        console.log(`[ChatContext] Conversation ${id} not found in loaded conversations, fetching...`);
        // Cargar la conversación desde Firestore
        try {
          const convResult = await chatService.getConversation(id);
          
          if (convResult.success && convResult.data) {
            setActiveConversation(convResult.data);
            _setActiveConversationId(id);
            
            // Cargar mensajes
            const messagesResult = await chatService.getMessages(id, 50);
            
            if (messagesResult.success && messagesResult.data) {
              setActiveMessages(messagesResult.data);
            } else {
              console.error('[ChatContext] Error loading messages:', messagesResult.error);
              setActiveMessages([]);
            }
          } else {
            console.error('[ChatContext] Conversation not found:', convResult.error);
            setError(`No se pudo cargar la conversación: ${convResult.error?.message || 'Error desconocido'}`);
            setActiveConversation(null);
            setActiveMessages([]);
          }
        } catch (error) {
          console.error('[ChatContext] Error fetching conversation:', error);
          setError('Error cargando la conversación. Intente más tarde.');
          setActiveConversation(null);
          setActiveMessages([]);
        }
      }
    } catch (error) {
      console.error('[ChatContext] Error setting active conversation:', error);
      setError('Error activando la conversación. Intente más tarde.');
    } finally {
      setLoading(false);
    }
  }, [conversations, activeConversationId]);
  
  // Enhanced send message function
  const sendMessage = useCallback(async (text: string, imageUrl?: string, replyTo?: ReplyInfo): Promise<boolean> => {
    if (!user) {
      console.error('[ChatContext] Cannot send message: Missing user');
      return false;
    }

    if (!activeConversation) {
      console.error('[ChatContext] Cannot send message: No active conversation');
      return false;
    }

    try {
      setLoading(true);

      const messageData: NewMessageData = {
        text,
        type: MessageType.TEXT
      };

      if (imageUrl) {
        messageData.imageUrl = imageUrl;
        messageData.type = MessageType.IMAGE;
      }

      const result = await chatService.sendMessage(
        activeConversation.id,
        user.uid,
        messageData,
        user.displayName || undefined,
        user.photoURL || undefined,
        replyTo // Pasar la información de respuesta
      );

      if (result.success && result.data) {
        // Add message to UI
        const newMessage = result.data as Message;
        setActiveMessages(prev => [...prev, newMessage]);
        return true;
      } else {
        console.error('[ChatContext] Failed to send message:', result.error);
        return false;
      }
    } catch (error) {
      console.error('[ChatContext] Error sending message:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, activeConversation, setLoading]);
  
  // Method to resend a failed message
  const resendFailedMessage = useCallback(async (messageId: string): Promise<boolean> => {
    if (!user || !activeConversationId) {
      return false;
    }
    
    if (isOffline) {
      return false;
    }
    
    // Find the failed message
    const failedMessage = activeMessages.find(msg => msg.id === messageId);
    if (!failedMessage || failedMessage.status !== MessageStatus.ERROR) {
      return false;
    }
    
    try {
      // Remove the failed message from UI
      setActiveMessages(prev => prev.filter(msg => msg.id !== messageId));
      
      // Resend it
      return await sendMessage(failedMessage.text, failedMessage.imageUrl);
    } catch (error) {
      console.error('[ChatContext] Error resending message:', error);
      return false;
    }
  }, [user, activeConversationId, activeMessages, sendMessage, isOffline]);
  
  // Method to upload image for messages
  const uploadImage = useCallback(async (uri: string): Promise<string | null> => {
    if (!user || !activeConversationId) {
      console.error('[ChatContext] Cannot upload image: Missing user or conversation');
      return null;
    }
    
    if (isOffline) {
      console.error('[ChatContext] Cannot upload image: Device is offline');
      return null;
    }
    
    try {
      const result = await chatService.uploadMessageImage(uri, activeConversationId);
      if (!result.success) {
        console.error('[ChatContext] Error uploading image:', result.error);
        return null;
      }
      
      return result.data || null;
    } catch (error) {
      console.error('[ChatContext] Unexpected error uploading image:', error);
      return null;
    }
  }, [user, activeConversationId, isOffline]);
  
  // Method to create conversation
  const createConversation = useCallback(async (
    recipientId: string,
    recipientName: string,
    businessId?: string,
    businessName?: string,
    initialMessage?: string
  ): Promise<string | null> => {
    if (!user) {
      console.error('[ChatContext] Cannot create conversation: no user logged in');
      return null;
    }
    
    if (isOffline) {
      console.error('[ChatContext] Cannot create conversation: Device is offline');
      return null;
    }
    
    try {
      console.log(`[ChatContext] Creating conversation with ${recipientName} (${recipientId})`);
      console.log(`[ChatContext] Business details: ID=${businessId}, Name=${businessName}`);
      console.log(`[ChatContext] Current user: ID=${user.uid}, Name=${user.displayName || 'Sin nombre'}`);
      
      // Implement retry (up to 3 times)
      const MAX_RETRIES = 3;
      let lastError: any = null;
      
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`[ChatContext] Attempt ${attempt} to create conversation`);
          
          // If it's a business conversation, use the specific method
          if (businessId && businessName) {
            console.log(`[ChatContext] Creating business conversation for business ${businessId}`);
            
            // Make sure all parameters are valid
            if (!recipientId.trim()) {
              throw new Error('Invalid recipient ID');
            }
            
            const result = await chatService.checkOrCreateBusinessConversation(
              user.uid,
              user.displayName || 'Usuario',
              recipientId,
              recipientName,
              businessId,
              businessName
            );
            
            // Log the result for debugging
            console.log(`[ChatContext] Service result:`, 
                       result.success ? 'Success' : 'Failure', 
                       result.data?.conversationId || 'No ID',
                       result.error?.message || 'No error message');
            
            if (result.success && result.data && result.data.conversationId) {
              const conversationId = result.data.conversationId;
              console.log(`[ChatContext] Business conversation created/found: ${conversationId}`);
              
              // If there's an initial message, send it
              if (initialMessage && initialMessage.trim()) {
                console.log('[ChatContext] Sending initial message');
                try {
                  await chatService.sendMessage(
                    conversationId, 
                    user.uid, 
                    { text: initialMessage.trim() },
                    user.displayName || 'Usuario',
                    user.photoURL || undefined
                  );
                } catch (msgError) {
                  console.error('[ChatContext] Error sending initial message:', msgError);
                  // Don't fail the entire operation if just the initial message fails
                }
              }
              
              // Refresh conversations immediately in the background
              setTimeout(() => {
                refreshConversations().catch(err => {
                  console.error('[ChatContext] Background refresh error:', err);
                });
              }, 200);
              
              return conversationId;
            }
            
            lastError = result.error || new Error('Error creating business conversation');
            console.error(`[ChatContext] Attempt ${attempt} failed:`, 
                         lastError.message, 
                         lastError.code || 'No code');
            
            // If it's an error that can't be resolved by retrying, exit loop
            if (result.error?.code === 'chat/same-user-conversation') {
              console.log('[ChatContext] Non-retryable error, breaking retry loop');
              break;
            }
            
            // Wait before retrying (exponential backoff)
            if (attempt < MAX_RETRIES) {
              const delay = 1000 * attempt;
              console.log(`[ChatContext] Waiting ${delay}ms before retry`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          } else {
            // Regular conversation between users
            console.log('[ChatContext] Creating regular user conversation');
            
            const participants = [user.uid, recipientId];
            const participantNames: Record<string, string> = {
              [user.uid]: user.displayName || 'Usuario',
              [recipientId]: recipientName
            };
            
            // Prepare profile photos
            const participantPhotos: Record<string, string> = {};
            if (user.photoURL) {
              participantPhotos[user.uid] = user.photoURL;
            }
            
            // If this is a conversation with a business owner, try to fetch business image
            if (recipientId.startsWith('business_owner_')) {
              try {
                // Extract business ID from owner ID if possible (assuming format: business_owner_[businessId])
                const ownerBusinessId = recipientId.replace('business_owner_', '');
                
                if (ownerBusinessId) {
                  console.log(`[ChatContext] Fetching business image for owner of business: ${ownerBusinessId}`);
                  
                  const businessDoc = await firebase.firestore()
                    .collection('businesses')
                    .doc(ownerBusinessId)
                    .get();
                  
                  if (businessDoc.exists) {
                    const businessData = businessDoc.data();
                    if (businessData?.images && Array.isArray(businessData.images) && businessData.images.length > 0) {
                      // First look for the main image
                      const mainImage = businessData.images.find((img: any) => img && img.isMain);
                      if (mainImage && mainImage.url) {
                        participantPhotos[recipientId] = mainImage.url;
                        console.log(`[ChatContext] Using business main image for owner's avatar: ${mainImage.url}`);
                      } else if (businessData.images[0].url) {
                        // If no main image is marked, use the first one
                        participantPhotos[recipientId] = businessData.images[0].url;
                        console.log(`[ChatContext] Using first business image for owner's avatar: ${businessData.images[0].url}`);
                      }
                    }
                  }
                }
              } catch (imageError) {
                console.error('[ChatContext] Error fetching business image for owner:', imageError);
                // Continue without image if there's an error
              }
            }
            
            console.log('[ChatContext] Calling chatService.createConversation with photos:', Object.keys(participantPhotos).length);
            const result = await chatService.createConversation(
              participants,
              participantNames,
              participantPhotos,
              undefined, // No businessId
              undefined, // No businessName
              initialMessage
            );
            
            console.log('[ChatContext] Result from createConversation:', 
                       result.success ? 'Success' : 'Failure',
                       result.data?.conversationId || 'No conversation ID');
            
            if (result.success && result.data) {
              return result.data.conversationId;
            }
            
            lastError = result.error || new Error('Error creating conversation');
            console.error(`[ChatContext] Attempt ${attempt} failed:`, lastError);
            
            // Wait before retrying
            if (attempt < MAX_RETRIES) {
              const delay = 1000 * attempt;
              console.log(`[ChatContext] Waiting ${delay}ms before retry`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        } catch (retryError) {
          lastError = retryError;
          console.error(`[ChatContext] Error in attempt ${attempt}:`, retryError);
          
          // Get detailed error info
          if (retryError instanceof Error) {
            console.error('Error message:', retryError.message);
            console.error('Error stack:', retryError.stack);
          }
          
          // Wait before retrying
          if (attempt < MAX_RETRIES) {
            const delay = 1000 * attempt;
            console.log(`[ChatContext] Waiting ${delay}ms before retry`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      // If we get here, all attempts failed
      console.error('[ChatContext] All attempts to create conversation failed');
      throw lastError || new Error('Failed to create conversation after multiple attempts');
    } catch (error) {
      console.error('[ChatContext] Final error creating conversation:', error);
      
      // Get more detailed error info
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      
      return null;
    }
  }, [user, refreshConversations, isOffline, chatService]);

  // Delete conversation (soft delete)
  const deleteConversation = useCallback(async (conversationId: string): Promise<boolean> => {
    if (!user) {
      console.error('[ChatContext] Cannot delete conversation: no user logged in');
      return false;
    }
    
    if (isOffline) {
      console.error('[ChatContext] Cannot delete conversation: Device is offline');
      return false;
    }
    
    try {
      console.log(`[ChatContext] Attempting to delete conversation: ${conversationId}`);
      
      // Save conversation info before marking as deleted
      const deletedConversation = conversations.find(conv => conv.id === conversationId);
      if (!deletedConversation) {
        console.error(`[ChatContext] Conversation ${conversationId} not found in local state`);
        return false;
      }
      
      const result = await chatService.deleteConversation(conversationId, user.uid);
      
      if (result.success) {
        console.log(`[ChatContext] Successfully marked conversation ${conversationId} as deleted`);
        
        // Update local state after deletion (soft delete)
        setConversations(prevConversations => 
          prevConversations.filter(conv => conv.id !== conversationId)
        );
        
        // Update unread counter
        if (deletedConversation && deletedConversation.unreadCount?.[user.uid]) {
          setUnreadTotal(prev => Math.max(0, prev - deletedConversation.unreadCount![user.uid]));
        }
        
        // If deleted conversation was active, clear state
        if (activeConversationId === conversationId) {
          _setActiveConversationId(null);
          setActiveConversation(null);
          setActiveMessages([]);
        }
        
        return true;
      } else {
        console.error('[ChatContext] Failed to delete conversation:', result.error);
        return false;
      }
    } catch (error) {
      console.error('[ChatContext] Error deleting conversation:', error);
      return false;
    }
  }, [user, conversations, activeConversationId, isOffline]);
  
  // Función para actualizar el token de notificación del usuario
  const updateNotificationToken = useCallback(async (token: string) => {
    if (!user || !token) return;

    try {
      // Comprobar si el token ya está registrado para este usuario
      const userRef = firebase.firestore().collection('users').doc(user.uid);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        console.warn('[ChatContext] User document not found for updating notification token');
        return;
      }

      const userData = userDoc.data();
      const currentToken = userData?.notificationToken;

      // Sólo actualizar si el token ha cambiado
      if (currentToken !== token) {
        console.log('[ChatContext] Updating notification token for user', user.uid);
        
        await userRef.update({
          notificationToken: token,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('[ChatContext] Notification token updated successfully');
      }
    } catch (error) {
      console.error('[ChatContext] Error updating notification token:', error);
    }
  }, [user]);

  // Función para registrar la eliminación del token al cerrar sesión
  const clearNotificationToken = useCallback(async () => {
    if (!user) return;

    try {
      console.log('[ChatContext] Clearing notification token for user', user.uid);
      
      await firebase.firestore()
        .collection('users')
        .doc(user.uid)
        .update({
          notificationToken: null,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
      console.log('[ChatContext] Notification token cleared successfully');
    } catch (error) {
      console.error('[ChatContext] Error clearing notification token:', error);
    }
  }, [user]);

  // Use useMemo for context value to prevent unnecessary renders
  const contextValue = useMemo(() => ({
    conversations,
    activeConversation,
    activeMessages,
    localMessages,
    loading,
    error,
    setError,
    refreshConversations,
    setActiveConversationId,
    sendMessage,
    addLocalMessage: (message: Message) => setActiveMessages(prev => [...prev, message]),
    removeLocalMessage: (id: string) => setActiveMessages(prev => prev.filter(msg => msg.id !== id)),
    markMessageAsRead: (messageId: string) => setActiveMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, read: true } : msg)),
    markConversationAsRead,
    isLoadingMoreMessages: false,
    loadMoreMessages: async () => {},
    hasMoreMessages: false,
    replyingTo: null,
    setReplyingTo: (data: ReplyInfo | null) => {},
    unreadTotal,
    isOffline,
    uploadImage,
    resendFailedMessage,
    deleteConversation,
    updateNotificationToken,
    createConversation
  }), [
    conversations,
    activeConversation,
    activeMessages,
    localMessages,
    loading,
    error,
    setError,
    refreshConversations,
    setActiveConversationId,
    sendMessage,
    markConversationAsRead,
    unreadTotal,
    isOffline,
    uploadImage,
    resendFailedMessage,
    deleteConversation,
    updateNotificationToken,
    createConversation
  ]);
  
  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};

// Custom hook to use chat context con protección contra ciclos de renderizado
export const useChat = () => {
  const context = useContext(ChatContext);
  
  // Si el contexto no está definido, devolvemos un contexto falso
  // pero evitamos alertas en la consola que pueden causar ciclos de renderizado
  if (context === undefined) {
    // Solo mostramos el aviso en desarrollo, no en producción
    if (process.env.NODE_ENV === 'development') {
      console.warn('useChat debe ser usado dentro de un ChatProvider');
    }
    
    // Devolvemos un contexto stub para evitar errores
    return {
      conversations: [],
      activeConversation: null,
      activeMessages: [],
      localMessages: [],
      loading: false,
      error: null,
      setError: () => {},
      refreshConversations: async () => {},
      setActiveConversationId: async () => {},
      sendMessage: async () => false,
      addLocalMessage: (message: Message) => {},
      removeLocalMessage: (id: string) => {},
      markMessageAsRead: (messageId: string) => {},
      markConversationAsRead: async () => {},
      isLoadingMoreMessages: false,
      loadMoreMessages: async () => {},
      hasMoreMessages: false,
      replyingTo: null,
      setReplyingTo: (data: ReplyInfo | null) => {},
      unreadTotal: 0,
      isOffline: false,
      uploadImage: async () => null,
      resendFailedMessage: async () => false,
      deleteConversation: async () => false,
      updateNotificationToken: async () => {},
      createConversation: async () => null
    } as ChatContextType;
  }
  
  return context;
};