import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { chatService } from '../../services/ChatService';
import { useAuth } from './AuthContext';
import { Conversation, Message } from '../../models/chatTypes';

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
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
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
  
  // Enviar un mensaje
  const sendMessage = async (text: string, imageUrl?: string): Promise<boolean> => {
    if (!user || !activeConversation) return false;
    
    try {
      const result = await chatService.sendMessage(
        activeConversation.id,
        user.uid,
        { 
          text, 
          imageUrl,
          type: imageUrl ? 'image' : 'text'
        },
        user.displayName || '',
        user.photoURL || ''
      );
      
      return result.success;
    } catch (error) {
      console.error('Error sending message:', error);
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
    setActiveConversationId,
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