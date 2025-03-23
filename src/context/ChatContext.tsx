import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { chatService } from '../../services/ChatService';
import { useAuth } from './AuthContext';
import { Conversation, Message } from '../../models/chatTypes';
import firebase from 'firebase/compat/app';

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
      console.log('Loading initial conversations for user:', user.uid);
      loadConversations();
    } else {
      console.log('No user logged in, resetting conversations');
      setConversations([]);
      setActiveConversation(null);
      setActiveMessages([]);
      setUnreadTotal(0);
    }
  }, [user]);
  
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
        setConversations(result.data);
        
        // Calcular total de no leídos
        const total = result.data.reduce((sum, conv) => {
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
  
  // Refrescar conversaciones
  const refreshConversations = useCallback(async () => {
    console.log('Refreshing conversations');
    await loadConversations();
  }, [loadConversations]);
  
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
  
  // Crear una nueva conversación
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
      
      // Crear la conversación usando el servicio
      const result = await chatService.createConversation(
        participants,
        participantNames,
        participantPhotos,
        businessId,
        businessName,
        initialMessage
      );
      
      if (result.success && result.data) {
        console.log(`Conversation created with ID: ${result.data.conversationId}`);
        
        // Refrescar la lista de conversaciones
        await refreshConversations();
        
        return result.data.conversationId;
      } else {
        console.error('Failed to create conversation:', result.error);
        return null;
      }
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
      
      console.log('Successfully marked as read');
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  }, [user, activeConversation, unreadTotal]);
  
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