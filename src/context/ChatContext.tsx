// src/context/ChatContext.tsx
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { chatService } from '../../services/ChatService';
import { useAuth } from './AuthContext';
import { Conversation, Message } from '../../models/chatTypes';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

interface ChatContextType {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  activeMessages: Message[];
  loading: boolean;
  error: string | null;
  unreadTotal: number;
  setActiveConversationId: (id: string | null) => void;
  sendMessage: (text: string, imageUrl?: string) => Promise<boolean>;
  createConversation: (userId: string, userName: string, businessId?: string, businessName?: string, initialMessage?: string) => Promise<string | null>;
  markConversationAsRead: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<boolean>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [activeConversationId, _setActiveConversationId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadTotal, setUnreadTotal] = useState<number>(0);
  
  // Referencias para cancelar suscripciones
  const conversationsUnsubscribeRef = useRef<(() => void) | null>(null);
  const messagesUnsubscribeRef = useRef<(() => void) | null>(null);
  
  // Clave para caché de conversaciones
  const getCacheKey = useCallback(() => {
    return user ? `conversations_${user.uid}` : null;
  }, [user]);
  
  // Inicializar Firebase Firestore
  const db = firebase.firestore();
  
  // Cargar conversaciones desde caché
  const loadConversationsFromCache = useCallback(async () => {
    try {
      const cacheKey = getCacheKey();
      if (!cacheKey) return false;
      
      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        if (parsedData && parsedData.conversations && Array.isArray(parsedData.conversations)) {
          console.log(`[ChatContext] Loaded ${parsedData.conversations.length} conversations from cache`);
          setConversations(parsedData.conversations);
          setUnreadTotal(parsedData.unreadTotal || 0);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('[ChatContext] Error loading from cache:', error);
      return false;
    }
  }, [getCacheKey]);
  
  // Guardar conversaciones en caché
  const saveConversationsToCache = useCallback(async (conversationsData: Conversation[], unread: number) => {
    try {
      const cacheKey = getCacheKey();
      if (!cacheKey) return;
      
      const dataToCache = {
        timestamp: Date.now(),
        conversations: conversationsData,
        unreadTotal: unread
      };
      
      await AsyncStorage.setItem(cacheKey, JSON.stringify(dataToCache));
      console.log(`[ChatContext] Saved ${conversationsData.length} conversations to cache`);
    } catch (error) {
      console.error('[ChatContext] Error saving to cache:', error);
    }
  }, [getCacheKey]);
  
  // Configurar listener de tiempo real para conversaciones
  const setupConversationsListener = useCallback(() => {
    if (!user) return null;
    
    try {
      console.log('[ChatContext] Setting up real-time listener for conversations');
      
      // Cancelar listener anterior si existe
      if (conversationsUnsubscribeRef.current) {
        conversationsUnsubscribeRef.current();
        conversationsUnsubscribeRef.current = null;
      }
      
      const unsubscribe = db.collection('conversations')
        .where('participants', 'array-contains', user.uid)
        .orderBy('updatedAt', 'desc')
        .onSnapshot(
          (snapshot) => {
            try {
              if (snapshot.empty) {
                console.log('[ChatContext] No conversations found in real-time update');
                setConversations([]);
                setUnreadTotal(0);
                saveConversationsToCache([], 0);
                return;
              }
              
              // Filtrar conversaciones eliminadas
              const conversationsData = snapshot.docs
                .filter(doc => {
                  const data = doc.data();
                  return !(data.deletedFor && data.deletedFor[user.uid] === true);
                })
                .map(doc => ({
                  id: doc.id,
                  ...doc.data()
                })) as Conversation[];
              
              // Calcular total de no leídos
              const totalUnread = conversationsData.reduce((sum, conv) => {
                return sum + (conv.unreadCount?.[user.uid] || 0);
              }, 0);
              
              console.log(`[ChatContext] Real-time update: ${conversationsData.length} conversations, ${totalUnread} unread`);
              
              setConversations(conversationsData);
              setUnreadTotal(totalUnread);
              
              // Guardar en caché para acceso rápido
              saveConversationsToCache(conversationsData, totalUnread);
            } catch (error) {
              console.error('[ChatContext] Error processing conversations snapshot:', error);
            }
          },
          (error) => {
            console.error('[ChatContext] Error in conversations listener:', error);
            setError('Error al escuchar actualizaciones de conversaciones');
          }
        );
      
      conversationsUnsubscribeRef.current = unsubscribe;
      return unsubscribe;
    } catch (error) {
      console.error('[ChatContext] Error setting up conversations listener:', error);
      return null;
    }
  }, [user, db, saveConversationsToCache]);
  
  // Función de actualización manual forzada
  const refreshConversations = useCallback(async () => {
    if (!user) {
      console.error('[ChatContext] Cannot refresh conversations: no user logged in');
      return;
    }
    
    console.log('[ChatContext] Manually refreshing conversations');
    setLoading(true);
    
    try {
      // Obtener datos actualizados directamente de Firestore
      const snapshot = await db.collection('conversations')
        .where('participants', 'array-contains', user.uid)
        .orderBy('updatedAt', 'desc')
        .get();
      
      if (snapshot.empty) {
        console.log('[ChatContext] No conversations found');
        setConversations([]);
        setUnreadTotal(0);
        saveConversationsToCache([], 0);
      } else {
        // Filtrar conversaciones eliminadas
        const conversationsData = snapshot.docs
          .filter(doc => {
            const data = doc.data();
            return !(data.deletedFor && data.deletedFor[user.uid] === true);
          })
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Conversation[];
        
        // Calcular total de no leídos
        const totalUnread = conversationsData.reduce((sum, conv) => {
          return sum + (conv.unreadCount?.[user.uid] || 0);
        }, 0);
        
        console.log(`[ChatContext] Loaded ${conversationsData.length} conversations, ${totalUnread} unread`);
        
        setConversations(conversationsData);
        setUnreadTotal(totalUnread);
        
        // Guardar en caché
        saveConversationsToCache(conversationsData, totalUnread);
      }
    } catch (error) {
      console.error('[ChatContext] Error refreshing conversations:', error);
      setError('Error al actualizar conversaciones');
    } finally {
      setLoading(false);
    }
  }, [user, db, saveConversationsToCache]);
  
  // Inicializar data cuando cambia el usuario
  useEffect(() => {
    if (user) {
      console.log('[ChatContext] User logged in, initializing chat data');
      setLoading(true);
      
      const initializeData = async () => {
        const loadedFromCache = await loadConversationsFromCache();
        
        // Configurar listener para actualizaciones en tiempo real
        setupConversationsListener();
        
        // Si no se cargó de caché, o para actualizaciones, cargar de Firebase
        if (!loadedFromCache) {
          refreshConversations();
        } else {
          setLoading(false);
        }
      };
      
      initializeData();
    } else {
      // Limpiar estado cuando el usuario cierra sesión
      console.log('[ChatContext] User logged out, clearing chat data');
      setConversations([]);
      setActiveConversation(null);
      setActiveMessages([]);
      setActiveConversationId(null);
      setUnreadTotal(0);
      
      // Cancelar suscripciones
      if (conversationsUnsubscribeRef.current) {
        conversationsUnsubscribeRef.current();
        conversationsUnsubscribeRef.current = null;
      }
      
      if (messagesUnsubscribeRef.current) {
        messagesUnsubscribeRef.current();
        messagesUnsubscribeRef.current = null;
      }
    }
    
    // Limpiar al desmontar
    return () => {
      if (conversationsUnsubscribeRef.current) {
        conversationsUnsubscribeRef.current();
      }
      
      if (messagesUnsubscribeRef.current) {
        messagesUnsubscribeRef.current();
      }
    };
  }, [user, loadConversationsFromCache, setupConversationsListener, refreshConversations]);
  
  // Configurar listener para mensajes de conversación activa
  const setupMessagesListener = useCallback((conversationId: string) => {
    if (!user || !conversationId) return null;
    
    try {
      console.log(`[ChatContext] Setting up messages listener for conversation ${conversationId}`);
      
      // Cancelar listener anterior si existe
      if (messagesUnsubscribeRef.current) {
        messagesUnsubscribeRef.current();
        messagesUnsubscribeRef.current = null;
      }
      
      const unsubscribe = db.collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .limit(100)
        .onSnapshot(
          (snapshot) => {
            try {
              if (snapshot.empty) {
                console.log('[ChatContext] No messages found');
                setActiveMessages([]);
                return;
              }
              
              const messagesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              })) as Message[];
              
              console.log(`[ChatContext] Loaded ${messagesData.length} messages`);
              setActiveMessages(messagesData);
            } catch (error) {
              console.error('[ChatContext] Error processing messages snapshot:', error);
            }
          },
          (error) => {
            console.error('[ChatContext] Error in messages listener:', error);
          }
        );
      
      messagesUnsubscribeRef.current = unsubscribe;
      return unsubscribe;
    } catch (error) {
      console.error('[ChatContext] Error setting up messages listener:', error);
      return null;
    }
  }, [user, db]);
  
  // Función mejorada para establecer conversación activa
  const setActiveConversationId = useCallback(async (id: string | null) => {
    if (activeConversationId === id) return; // Evitar recarga innecesaria
    
    // Limpiar estado anterior
    if (!id) {
      _setActiveConversationId(null);
      setActiveConversation(null);
      setActiveMessages([]);
      
      // Cancelar listener de mensajes
      if (messagesUnsubscribeRef.current) {
        messagesUnsubscribeRef.current();
        messagesUnsubscribeRef.current = null;
      }
      
      return;
    }
    
    console.log(`[ChatContext] Setting active conversation to ${id}`);
    setLoading(true);
    
    try {
      // Obtener datos de la conversación
      const docSnapshot = await db.collection('conversations').doc(id).get();
      
      if (!docSnapshot.exists) {
        console.error(`[ChatContext] Conversation ${id} not found`);
        setError('La conversación no existe o fue eliminada');
        _setActiveConversationId(null);
        setActiveConversation(null);
        setLoading(false);
        return;
      }
      
      // Actualizar ID y datos
      _setActiveConversationId(id);
      
      const conversationData = {
        id,
        ...docSnapshot.data()
      } as Conversation;
      
      setActiveConversation(conversationData);
      
      // Configurar listener para mensajes
      setupMessagesListener(id);
      
      // Marcar como leído
      await markMessagesAsRead(id);
    } catch (error) {
      console.error('[ChatContext] Error setting active conversation:', error);
      setError('Error al cargar la conversación');
    } finally {
      setLoading(false);
    }
  }, [activeConversationId, db, setupMessagesListener]);
  
  // Marcar mensajes como leídos
  const markMessagesAsRead = useCallback(async (conversationId?: string) => {
    const idToUse = conversationId || activeConversationId;
    
    if (!user || !idToUse) {
      console.log('[ChatContext] Cannot mark as read: missing user or conversation ID');
      return;
    }
    
    try {
      console.log(`[ChatContext] Marking conversation ${idToUse} as read`);
      await chatService.markMessagesAsRead(idToUse, user.uid);
      
      // Actualizar conteo de no leídos localmente sin esperar a la actualización en tiempo real
      setConversations(prev => 
        prev.map(conv => 
          conv.id === idToUse 
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
      
      // Recalcular total
      setUnreadTotal(prev => {
        const conversation = conversations.find(c => c.id === idToUse);
        const count = conversation?.unreadCount?.[user.uid] || 0;
        return Math.max(0, prev - count);
      });
      
      console.log('[ChatContext] Successfully marked as read');
    } catch (error) {
      console.error('[ChatContext] Error marking conversation as read:', error);
    }
  }, [user, activeConversationId, conversations]);
  
  // Función para marcar la conversación activa como leída
  const markConversationAsRead = useCallback(async () => {
    await markMessagesAsRead();
  }, [markMessagesAsRead]);
  
  // Función mejorada para enviar mensajes
  const sendMessage = useCallback(async (text: string, imageUrl?: string): Promise<boolean> => {
    if (!user) {
      console.error('[ChatContext] Cannot send message: No user logged in');
      return false;
    }
    
    if (!activeConversationId) {
      console.error('[ChatContext] Cannot send message: No active conversation');
      return false;
    }
    
    try {
      const trimmedText = text.trim();
      
      if (!trimmedText && !imageUrl) {
        console.error('[ChatContext] Cannot send empty message');
        return false;
      }
      
      console.log(`[ChatContext] Sending message in conversation ${activeConversationId}`);
      
      const result = await chatService.sendMessage(
        activeConversationId,
        user.uid,
        { 
          text: trimmedText, 
          imageUrl,
          type: imageUrl ? 'image' : 'text'
        },
        user.displayName || 'Usuario',
        user.photoURL || ''
      );
      
      if (!result.success) {
        console.error('[ChatContext] Error sending message:', result.error);
        return false;
      }
      
      console.log('[ChatContext] Message sent successfully');
      return true;
    } catch (error) {
      console.error('[ChatContext] Error sending message:', error);
      return false;
    }
  }, [user, activeConversationId]);
  
  // Función para crear una nueva conversación
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
    
    try {
      console.log(`[ChatContext] Creating conversation with ${recipientName} (${recipientId})`);
      
      // Preparar participantes
      const participants = [user.uid, recipientId];
      const participantNames: Record<string, string> = {
        [user.uid]: user.displayName || 'Usuario',
        [recipientId]: recipientName
      };
      
      // Preparar fotos de perfil
      const participantPhotos: Record<string, string> = {};
      if (user.photoURL) {
        participantPhotos[user.uid] = user.photoURL;
      }
      
      // Crear la conversación
      const result = await chatService.createConversation(
        participants,
        participantNames,
        participantPhotos,
        businessId,
        businessName,
        initialMessage
      );
      
      if (result.success && result.data) {
        console.log(`[ChatContext] Conversation created with ID: ${result.data.conversationId}`);
        
        // IMPORTANTE: Forzar actualización inmediata de la lista de conversaciones
        await refreshConversations();
        
        return result.data.conversationId;
      } else {
        console.error('[ChatContext] Failed to create conversation:', result.error);
        return null;
      }
    } catch (error) {
      console.error('[ChatContext] Error creating conversation:', error);
      return null;
    }
  }, [user, refreshConversations]);
  
  // Función para eliminar una conversación
  const deleteConversation = useCallback(async (conversationId: string): Promise<boolean> => {
    if (!user) {
      console.error('[ChatContext] Cannot delete conversation: no user logged in');
      return false;
    }
    
    try {
      console.log(`[ChatContext] Deleting conversation ${conversationId}`);
      
      const result = await chatService.deleteConversation(conversationId, user.uid);
      
      if (result.success) {
        console.log(`[ChatContext] Successfully deleted conversation ${conversationId}`);
        
        // Actualizar estado local inmediatamente
        setConversations(prev => prev.filter(conv => conv.id !== conversationId));
        
        // Actualizar total de no leídos
        const deletedConversation = conversations.find(c => c.id === conversationId);
        if (deletedConversation?.unreadCount?.[user.uid]) {
          const count = deletedConversation.unreadCount[user.uid];
          setUnreadTotal(prev => Math.max(0, prev - count));
        }
        
        // Si era la conversación activa, limpiar estado
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
  }, [user, conversations, activeConversationId]);
  
  // Valor del contexto
  const contextValue: ChatContextType = {
    conversations,
    activeConversation,
    activeMessages,
    loading,
    error,
    unreadTotal,
    setActiveConversationId,
    sendMessage,
    createConversation,
    markConversationAsRead,
    refreshConversations,
    deleteConversation
  };
  
  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};

// Hook personalizado
export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat debe ser usado dentro de un ChatProvider');
  }
  return context;
};