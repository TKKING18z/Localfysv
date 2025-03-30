import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { chatService } from '../../services/ChatService';
import { firebaseService } from '../services/firebaseService';
import { useAuth } from './AuthContext';
import { Conversation, Message } from '../../models/chatTypes';
import firebase from 'firebase/compat/app';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Definición del tipo Result para evitar errores
interface Result<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

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
  // Rename the state setter to avoid recursion when we create our enhanced function
  const [activeConversationId, _setActiveConversationId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadTotal, setUnreadTotal] = useState<number>(0);
  
  // Efecto para limpiar automáticamente conversaciones duplicadas
  useEffect(() => {
    const cleanupDuplicateConversations = async () => {
      if (!user) return;
      
      try {
        // Verificar si ya se hizo limpieza recientemente (no hacerlo demasiado a menudo)
        const lastCleanupStr = await AsyncStorage.getItem('last_chat_cleanup');
        if (lastCleanupStr) {
          const lastCleanup = new Date(lastCleanupStr);
          const now = new Date();
          const hoursSinceLastCleanup = (now.getTime() - lastCleanup.getTime()) / (1000 * 60 * 60);
          
          // Si se hizo limpieza en las últimas 24 horas, no hacerla de nuevo
          if (hoursSinceLastCleanup < 24) {
            console.log('Skipping duplicate conversation cleanup (done recently)');
            return;
          }
        }
        
        console.log('Running automatic duplicate conversation cleanup');
        
        // Verificar la existencia del método de manera segura
        const chatCleanup = (firebaseService as any).chat?.chatCleanup;
        if (chatCleanup && typeof chatCleanup.detectAndMergeDuplicateConversations === 'function') {
          const result = await chatCleanup.detectAndMergeDuplicateConversations(user.uid);
          console.log('Cleanup result:', result);
          
          // Si hubo cambios, refrescar conversaciones
          if (result.success) {
            // Guardar timestamp de la última limpieza
            await AsyncStorage.setItem('last_chat_cleanup', new Date().toISOString());
            
            // Refrescar conversaciones después de un breve retraso
            setTimeout(() => {
              loadConversations();
            }, 1000);
          }
        } else {
          console.log('Cleanup method not available in firebaseService');
        }
      } catch (error) {
        console.error('Error during duplicate conversation cleanup:', error);
      }
    };
    
    // Ejecutar limpieza después de un retraso para no afectar el rendimiento inicial
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
  
  // Función para cargar todas las conversaciones del usuario
  const loadConversations = useCallback(async () => {
    if (!user) {
      console.error('Cannot load conversations: no user logged in');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching conversations from service');
      const result = await chatService.getUserConversations(user.uid);
      if (result.success && result.data) {
        console.log(`Loaded ${result.data.length} conversations`);
        
        // Filtrar aquí también en caso de que el servicio no lo haga correctamente
        const filteredConversations = result.data.filter((conv: Conversation) => 
          !(conv.deletedFor && conv.deletedFor[user.uid] === true)
        );
        
        console.log(`After additional filtering, ${filteredConversations.length} conversations remain`);
        setConversations(filteredConversations);
        
        // Calcular total de no leídos basado en las conversaciones filtradas
        const total = filteredConversations.reduce((sum: number, conv: Conversation) => {
          return sum + (conv.unreadCount?.[user.uid] || 0);
        }, 0);
        
        console.log(`Total unread messages: ${total}`);
        setUnreadTotal(total);
      } else {
        console.error('Failed to load conversations:', result.error);
        setError(result.error?.message || 'Error al cargar conversaciones');
      }
    } catch (error) {
      console.error('Unexpected error loading conversations:', error);
      setError('Error inesperado al cargar conversaciones');
    } finally {
      setLoading(false);
    }
  }, [user]);
  
  // Cargar conversaciones iniciales
  useEffect(() => {
    if (user) {
      console.log('Loading initial conversations for user:', user.uid);
      loadConversations();
    } else {
      console.log('No user logged in, resetting conversations');
      setConversations([]);
      setActiveConversation(null);
      setActiveMessages([]);
      setUnreadTotal(0);
    }
  }, [user, loadConversations]);
  
  // Cargar conversación activa cuando cambia el ID
  useEffect(() => {
    if (activeConversationId && user) {
      console.log(`Loading active conversation: ${activeConversationId}`);
      loadActiveConversation(activeConversationId);
    } else {
      setActiveConversation(null);
      setActiveMessages([]);
    }
  }, [activeConversationId, user]);

  // Función para actualizar el contador de mensajes no leídos
  const updateUnreadCount = useCallback(() => {
    if (!user || !conversations.length) return;
    
    // Calcular el total de mensajes no leídos
    const total = conversations.reduce((sum: number, conv: Conversation) => {
      return sum + (conv.unreadCount?.[user.uid] || 0);
    }, 0);
    
    setUnreadTotal(total);
    
    // Actualizar el badge en el tab navigator de manera opcional
    try {
      // Aquí podrías agregar integración con notificaciones nativas si lo deseas
    } catch (error) {
      console.error('Error al actualizar badge:', error);
    }
  }, [user, conversations]);

  // Agregar este efecto dentro del ChatProvider
  useEffect(() => {
    updateUnreadCount();
  }, [updateUnreadCount]);
  
  // Método mejorado para refrescar conversaciones
  const refreshConversations = useCallback(async () => {
    if (!user) {
      console.error('Cannot refresh conversations: no user logged in');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Refreshing conversations for user:', user.uid);
      
      // Implementar un timeout para evitar que la operación se quede colgada
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout fetching conversations')), 15000);
      });
      
      // Crear una promesa que se pueda cancelar con timeout
      const fetchPromise = chatService.getUserConversations(user.uid);
      
      // Usar Promise.race para manejar el caso de timeout
      const result = await Promise.race([fetchPromise, timeoutPromise]) as Result<Conversation[]>;
      
      if (result.success && result.data) {
        console.log(`Refreshed ${result.data.length} conversations`);
        
        // Filtrar conversaciones eliminadas
        const filteredConversations = result.data.filter((conv: Conversation) => 
          !(conv.deletedFor && conv.deletedFor[user.uid] === true)
        );
        
        console.log(`After filtering deleted, ${filteredConversations.length} conversations remain`);
        
        // Sanitizar datos para evitar problemas de renderizado
        const sanitizedConversations = filteredConversations.map((conv: Conversation) => {
          // Asegurar que unreadCount exista
          if (!conv.unreadCount) {
            conv.unreadCount = {};
            conv.participants.forEach((p: string) => {
              conv.unreadCount[p] = 0;
            });
          }
          
          // Asegurar que participantNames exista
          if (!conv.participantNames) {
            conv.participantNames = {};
            conv.participants.forEach((p: string) => {
              conv.participantNames[p] = 'Usuario';
            });
          }
          
          return conv;
        });
        
        setConversations(sanitizedConversations);
        
        // Calcular total de no leídos
        const unreadTotal = sanitizedConversations.reduce((sum: number, conv: Conversation) => {
          return sum + (conv.unreadCount[user.uid] || 0);
        }, 0);
        
        setUnreadTotal(unreadTotal);
      } else {
        console.error('Failed to refresh conversations:', result.error);
        setError(result.error?.message || 'Error al cargar conversaciones');
      }
    } catch (error) {
      console.error('Unexpected error refreshing conversations:', error);
      setError('Error inesperado al cargar conversaciones');
    } finally {
      setLoading(false);
    }
  }, [user]);
  
  // Cargar una conversación específica
  const loadActiveConversation = useCallback(async (conversationId: string) => {
    if (!user) {
      console.error('Cannot load active conversation: no user logged in');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Loading conversation data for ${conversationId}`);
      // Cargar datos de la conversación
      const convResult = await chatService.getConversation(conversationId);
      if (convResult.success && convResult.data) {
        // Verificar si está marcada como eliminada para este usuario
        if (convResult.data.deletedFor && convResult.data.deletedFor[user.uid]) {
          setError('Esta conversación ya no está disponible');
          setLoading(false);
          return;
        }
        
        setActiveConversation(convResult.data);
        
        // Configurar listener para mensajes
        const unsubscribe = chatService.listenToMessages(
          conversationId,
          (messages) => {
            console.log(`Received ${messages.length} messages update`);
            setActiveMessages(messages);
          },
          (error) => {
            console.error('Error en listener de mensajes:', error);
          },
          50 // Obtener más mensajes para historial
        );
        
        // Marcar mensajes como leídos
        await markConversationAsRead();
        
        // Devolver función para cancelar suscripción
        return unsubscribe;
      } else {
        console.error('Failed to load conversation:', convResult.error);
        setError(convResult.error?.message || 'Error al cargar conversación');
      }
    } catch (error) {
      console.error('Unexpected error loading conversation:', error);
      setError('Error inesperado al cargar conversación');
    } finally {
      setLoading(false);
    }
  }, [user]);
  
  // Función mejorada setActiveConversationId
  const setActiveConversationId = useCallback(async (id: string | null) => {
    if (!id) {
      console.log('Clearing active conversation');
      _setActiveConversationId(null);
      setActiveConversation(null);
      setActiveMessages([]);
      return;
    }
    
    try {
      console.log(`Setting active conversation to ${id}`);
      setLoading(true);
      
      // Comprobar que la conversación existe
      const snapshot = await firebase.firestore()
        .collection('conversations')
        .doc(id)
        .get();
      
      if (!snapshot.exists) {
        console.error(`Conversation with ID ${id} not found`);
        setError(`La conversación no existe o fue eliminada`);
        _setActiveConversationId(null);
        setLoading(false);
        return;
      }
      
      // Establecer el ID de conversación activa
      _setActiveConversationId(id);
      
      // Precargar los datos
      const conversationData = {
        id,
        ...snapshot.data()
      } as Conversation;
      setActiveConversation(conversationData);
      
      // Cargar mensajes iniciales
      const messagesSnapshot = await firebase.firestore()
        .collection('conversations')
        .doc(id)
        .collection('messages')
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get();
      
      if (!messagesSnapshot.empty) {
        const messages = messagesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Message[];
        
        setActiveMessages(messages);
      } else {
        setActiveMessages([]);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error setting active conversation:', error);
      setError('Error al cargar la conversación');
      _setActiveConversationId(null);
      setLoading(false);
    }
  }, []);
  
  // Función de envío de mensajes mejorada
  const sendMessage = useCallback(async (text: string, imageUrl?: string): Promise<boolean> => {
    if (!user) {
      console.error('Cannot send message: Missing user');
      return false;
    }
    
    if (!activeConversation && !activeConversationId) {
      console.error('Cannot send message: Missing active conversation and ID');
      return false;
    }
    
    try {
      // Obtener el ID de la conversación activa
      const conversationId = activeConversation?.id || activeConversationId;
      
      if (!conversationId) {
        console.error('Cannot determine conversation ID for sending message');
        return false;
      }
      
      console.log(`Sending message in conversation ${conversationId}`);
      
      // Verificar que la conversación existe
      const convDoc = await firebase.firestore()
        .collection('conversations')
        .doc(conversationId)
        .get();
      
      if (!convDoc.exists) {
        console.error(`Conversation ${conversationId} does not exist`);
        return false;
      }
      
      // Obtener datos de la conversación si no está disponible
      const conversationData = activeConversation || (convDoc.data() as Conversation);
      
      // Preparar datos del remitente
      const userName = user.displayName || 'Usuario';
      const userPhoto = user.photoURL || '';
      
      // Enviar el mensaje usando el servicio
      const result = await chatService.sendMessage(
        conversationId,
        user.uid,
        { 
          text: text.trim(), 
          imageUrl,
          type: imageUrl ? 'image' : 'text'
        },
        userName,
        userPhoto
      );
      
      if (!result.success) {
        console.error('Error sending message:', result.error);
        return false;
      }
      
      console.log('Message sent successfully');
      return true;
    } catch (error) {
      console.error('Unexpected error sending message:', error);
      return false;
    }
  }, [user, activeConversation, activeConversationId]);
  
  // Método mejorado para crear conversación
  const createConversation = useCallback(async (
    recipientId: string,
    recipientName: string,
    businessId?: string,
    businessName?: string,
    initialMessage?: string
  ): Promise<string | null> => {
    if (!user) {
      console.error('Cannot create conversation: no user logged in');
      return null;
    }
    
    try {
      console.log(`Creating conversation with ${recipientName} (${recipientId})`);
      
      // Implementar retrointento (hasta 3 veces)
      const MAX_RETRIES = 3;
      let lastError: any = null;
      
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          // Si es una conversación de negocio, usar el método específico
          if (businessId && businessName) {
            console.log(`Creating business conversation for business ${businessId}`);
            
            const result = await chatService.checkOrCreateBusinessConversation(
              user.uid,
              user.displayName || 'Usuario',
              recipientId,
              recipientName,
              businessId,
              businessName
            );
            
            if (result.success && result.data) {
              const conversationId = result.data.conversationId;
              console.log(`Business conversation created/found: ${conversationId}`);
              
              // Si hay un mensaje inicial, enviarlo
              if (initialMessage && initialMessage.trim()) {
                console.log('Sending initial message');
                await chatService.sendMessage(
                  conversationId, 
                  user.uid, 
                  { text: initialMessage.trim() },
                  user.displayName || 'Usuario',
                  user.photoURL || undefined
                );
              }
              
              // Refrescar conversaciones en segundo plano
              setTimeout(() => {
                refreshConversations().catch(err => {
                  console.error('Background refresh error:', err);
                });
              }, 500);
              
              return conversationId;
            }
            
            lastError = result.error || new Error('Error creating business conversation');
            console.error(`Attempt ${attempt} failed:`, lastError);
            
            // Si no es un error que se pueda resolver reintentando, salir del bucle
            if (result.error?.code === 'chat/same-user-conversation') {
              break;
            }
            
            // Esperar antes de reintentar (backoff exponencial)
            if (attempt < MAX_RETRIES) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
          } else {
            // Conversación normal entre usuarios
            console.log('Creating regular user conversation');
            
            // Resto del código actual para conversaciones normales
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
            
            const result = await chatService.createConversation(
              participants,
              participantNames,
              participantPhotos,
              undefined, // No businessId
              undefined, // No businessName
              initialMessage
            );
            
            if (result.success && result.data) {
              // Refrescar conversaciones en segundo plano
              setTimeout(() => {
                refreshConversations().catch(err => {
                  console.error('Background refresh error:', err);
                });
              }, 500);
              
              return result.data.conversationId;
            }
            
            lastError = result.error || new Error('Error creating conversation');
            console.error(`Attempt ${attempt} failed:`, lastError);
            
            // Esperar antes de reintentar
            if (attempt < MAX_RETRIES) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
          }
        } catch (retryError) {
          lastError = retryError;
          console.error(`Error in attempt ${attempt}:`, retryError);
          
          // Esperar antes de reintentar
          if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }
      
      // Si llegamos aquí, todos los intentos fallaron
      console.error('All attempts to create conversation failed');
      return null;
    } catch (error) {
      console.error('Unexpected error creating conversation:', error);
      return null;
    }
  }, [user, refreshConversations]);
  
  // Marcar conversación como leída
  const markConversationAsRead = useCallback(async () => {
    if (!user || !activeConversation) {
      console.log('Cannot mark as read: missing user or active conversation');
      return;
    }
    
    try {
      console.log(`Marking conversation ${activeConversation.id} as read`);
      await chatService.markMessagesAsRead(activeConversation.id, user.uid);
      
      // Actualizar total de no leídos
      const updatedUnreadTotal = unreadTotal - (activeConversation.unreadCount?.[user.uid] || 0);
      setUnreadTotal(Math.max(0, updatedUnreadTotal));
      
      // Actualizar localmente
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
      
      console.log('Successfully marked as read');
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  }, [user, activeConversation, unreadTotal]);

  // Eliminar conversación (soft delete)
  const deleteConversation = useCallback(async (conversationId: string): Promise<boolean> => {
    if (!user) {
      console.error('Cannot delete conversation: no user logged in');
      return false;
    }
    
    try {
      console.log(`Attempting to delete conversation: ${conversationId}`);
      
      // Guardar información de la conversación antes de marcarla como eliminada
      const deletedConversation = conversations.find(conv => conv.id === conversationId);
      if (!deletedConversation) {
        console.error(`Conversation ${conversationId} not found in local state`);
        return false;
      }
      
      const result = await chatService.deleteConversation(conversationId, user.uid);
      
      if (result.success) {
        console.log(`Successfully marked conversation ${conversationId} as deleted`);
        
        // Actualizar el estado local después de eliminar (soft delete)
        setConversations(prevConversations => 
          prevConversations.filter(conv => conv.id !== conversationId)
        );
        
        // Actualizar el contador de no leídos
        if (deletedConversation && deletedConversation.unreadCount?.[user.uid]) {
          setUnreadTotal(prev => Math.max(0, prev - deletedConversation.unreadCount![user.uid]));
        }
        
        // Si la conversación eliminada era la activa, limpiar el estado
        if (activeConversationId === conversationId) {
          _setActiveConversationId(null);
          setActiveConversation(null);
          setActiveMessages([]);
        }
        
        return true;
      } else {
        console.error('Failed to delete conversation:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      return false;
    }
  }, [user, conversations, activeConversationId]);
  
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

// Hook personalizado para usar el contexto de chat
export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat debe ser usado dentro de un ChatProvider');
  }
  return context;
};