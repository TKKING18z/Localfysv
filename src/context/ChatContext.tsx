import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { chatService } from '../../services/ChatService';
import { useAuth } from './AuthContext';
import { Conversation, Message } from '../../models/chatTypes';
import firebase from 'firebase/compat/app'; // Add this import

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
  
  // Cargar conversaciones iniciales
  useEffect(() => {
    if (user) {
      loadConversations();
    } else {
      setConversations([]);
      setActiveConversation(null);
      setActiveMessages([]);
      setUnreadTotal(0);
    }
  }, [user]);
  
  // Cargar conversación activa cuando cambia el ID
  useEffect(() => {
    if (activeConversationId && user) {
      loadActiveConversation(activeConversationId);
    } else {
      setActiveConversation(null);
      setActiveMessages([]);
    }
  }, [activeConversationId, user]);
  
  // Función para cargar todas las conversaciones del usuario
  const loadConversations = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await chatService.getUserConversations(user.uid);
      if (result.success && result.data) {
        setConversations(result.data);
        
        // Calcular total de no leídos
        const total = result.data.reduce((sum, conv) => {
          return sum + (conv.unreadCount?.[user.uid] || 0);
        }, 0);
        
        setUnreadTotal(total);
      } else {
        setError(result.error?.message || 'Error al cargar conversaciones');
      }
    } catch (error) {
      setError('Error inesperado al cargar conversaciones');
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Refrescar conversaciones
  const refreshConversations = async () => {
    await loadConversations();
  };
  
  // Cargar una conversación específica
  const loadActiveConversation = async (conversationId: string) => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Cargar datos de la conversación
      const convResult = await chatService.getConversation(conversationId);
      if (convResult.success && convResult.data) {
        setActiveConversation(convResult.data);
        
        // Escuchar cambios en los mensajes
        const unsubscribe = chatService.listenToMessages(
          conversationId,
          (messages) => {
            setActiveMessages(messages);
          },
          (error) => {
            console.error('Error en tiempo real de mensajes:', error);
          },
          50
        );
        
        // Marcar mensajes como leídos
        await chatService.markMessagesAsRead(conversationId, user.uid);
        
        // Cancelar suscripción al desmontar
        return () => {
          unsubscribe();
        };
      } else {
        setError(convResult.error?.message || 'Error al cargar conversación');
      }
    } catch (error) {
      setError('Error inesperado al cargar conversación');
      console.error('Error loading active conversation:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Mejorar la función setActiveConversationId
  const setActiveConversationId = useCallback(async (id: string | null) => {
    if (id) {
      try {
        setLoading(true);
        
        // Verificar que la conversación existe
        const snapshot = await firebase.firestore()
          .collection('conversations')
          .doc(id)
          .get();
        
        if (!snapshot.exists) {
          console.error(`Conversación con ID ${id} no encontrada`);
          setError(`La conversación no existe o fue eliminada`);
          _setActiveConversationId(null);
          setLoading(false);
          return;
        }
        
        // Establecer el ID de conversación activa
        _setActiveConversationId(id);
        
        // Precargar la conversación
        const conversationData = {
          id,
          ...snapshot.data()
        } as Conversation;
        setActiveConversation(conversationData);
        
        // Cargar mensajes
        const messagesSnapshot = await firebase.firestore()
          .collection('conversations')
          .doc(id)
          .collection('messages')
          .orderBy('timestamp', 'desc')
          .limit(20)
          .get();
        
        const messages = messagesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setActiveMessages(messages as Message[]);
        setLoading(false);
      } catch (error) {
        console.error('Error al establecer conversación activa:', error);
        setError('Error al cargar la conversación');
        setLoading(false);
      }
    } else {
      _setActiveConversationId(null);
      setActiveConversation(null);
      setActiveMessages([]);
    }
  }, []);
  
  // Improved sendMessage function that works even without activeConversation
  const sendMessage = async (text: string, imageUrl?: string): Promise<boolean> => {
    if (!user) {
      console.error('Cannot send message: Missing user');
      return false;
    }
    
    if (!activeConversation && !activeConversationId) {
      console.error('Cannot send message: Missing active conversation and ID');
      return false;
    }
    
    try {
      // Get the conversation ID (either from activeConversation or activeConversationId)
      const conversationId = activeConversation?.id || activeConversationId;
      
      if (!conversationId) {
        console.error('Cannot send message: Failed to determine conversationId');
        return false;
      }
      
      console.log(`Sending message in conversation ${conversationId}`);
      console.log(`From user: ${user.uid}`);
      console.log(`Message: "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}"`);
      
      // Verify conversation exists before sending
      const convDoc = await firebase.firestore()
        .collection('conversations')
        .doc(conversationId)
        .get();
      
      if (!convDoc.exists) {
        console.error(`Conversation ${conversationId} does not exist in Firestore`);
        return false;
      }
      
      // Get the conversation data if activeConversation is not available
      const conversationData = activeConversation || (convDoc.data() as Conversation);
      
      const userName = user.displayName || 'Usuario';
      const userPhoto = user.photoURL || '';
      
      const result = await chatService.sendMessage(
        conversationId,
        user.uid,
        { 
          text, 
          imageUrl,
          type: imageUrl ? 'image' : 'text'
        },
        userName,
        userPhoto
      );
      
      console.log('Send result:', result.success);
      
      if (!result.success) {
        console.error('Error details:', result.error);
      }
      
      return result.success;
    } catch (error) {
      console.error('Error in context sendMessage:', error);
      return false;
    }
  };
  
  // Crear una nueva conversación
  const createConversation = async (
    recipientId: string,
    recipientName: string,
    businessId?: string,
    businessName?: string,
    initialMessage?: string
  ): Promise<string | null> => {
    if (!user) return null;
    
    try {
      // Preparar participantes
      const participants = [user.uid, recipientId];
      const participantNames: Record<string, string> = {
        [user.uid]: user.displayName || 'Usuario',
        [recipientId]: recipientName
      };
      
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
        // Refrescar las conversaciones
        await loadConversations();
        return result.data.conversationId;
      }
      
      return null;
    } catch (error) {
      console.error('Error creating conversation:', error);
      return null;
    }
  };
  
  // Marcar conversación como leída
  const markConversationAsRead = async () => {
    if (!user || !activeConversation) return;
    
    try {
      await chatService.markMessagesAsRead(activeConversation.id, user.uid);
      
      // Actualizar total de no leídos
      const updatedUnreadTotal = unreadTotal - (activeConversation.unreadCount?.[user.uid] || 0);
      setUnreadTotal(Math.max(0, updatedUnreadTotal));
      
      // Actualizar localmente
      setConversations(prevConversations => 
        prevConversations.map(conv => 
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
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  };
  
  const contextValue: ChatContextType = {
    conversations,
    activeConversation,
    activeMessages,
    loading,
    error,
    unreadTotal,
    setActiveConversationId, // This is now our enhanced function
    sendMessage,
    createConversation,
    markConversationAsRead,
    refreshConversations
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