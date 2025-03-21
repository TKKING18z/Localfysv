import { useEffect, useState } from 'react';
import { chatService } from '../../services/ChatService';
import { Message, Conversation } from '../../models/chatTypes';

interface UseChatProps {
  userId: string;
  conversationId?: string;
}

export function useChat({ userId, conversationId }: UseChatProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Cargar la conversación y configurar listeners
  useEffect(() => {
    if (!userId || !conversationId) {
      setConversation(null);
      setMessages([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    let unsubscribeConversation: (() => void) | null = null;
    let unsubscribeMessages: (() => void) | null = null;
    
    const loadChat = async () => {
      try {
        // Cargar datos de la conversación
        const convResult = await chatService.getConversation(conversationId);
        if (!convResult.success || !convResult.data) {
          setError(convResult.error?.message || 'Error al cargar la conversación');
          setLoading(false);
          return;
        }
        
        setConversation(convResult.data);
        
        // Marcar mensajes como leídos
        await chatService.markMessagesAsRead(conversationId, userId);
        
        // Escuchar cambios en la conversación
        unsubscribeConversation = chatService.listenToConversation(
          conversationId,
          (updatedConversation) => {
            setConversation(updatedConversation);
          },
          (error) => {
            console.error('Error en actualizaciones de conversación:', error);
          }
        );
        
        // Escuchar cambios en los mensajes
        unsubscribeMessages = chatService.listenToMessages(
          conversationId,
          (updatedMessages) => {
            setMessages(updatedMessages);
          },
          (error) => {
            console.error('Error en actualizaciones de mensajes:', error);
          }
        );
        
        setLoading(false);
      } catch (err) {
        console.error('Error loading chat:', err);
        setError('Error inesperado al cargar chat');
        setLoading(false);
      }
    };
    
    loadChat();
    
    // Limpiar suscripciones
    return () => {
      if (unsubscribeConversation) {
        unsubscribeConversation();
      }
      
      if (unsubscribeMessages) {
        unsubscribeMessages();
      }
    };
  }, [userId, conversationId]);
  
  // Función para enviar mensaje
  const sendMessage = async (text: string, imageUrl?: string) => {
    if (!userId || !conversationId || !conversation) {
      return false;
    }
    
    try {
      // Obtener información del usuario para el mensaje
      const userName = conversation.participantNames[userId] || 'Usuario';
      const userPhoto = conversation.participantPhotos?.[userId] || '';
      
      const result = await chatService.sendMessage(
        conversationId,
        userId,
        {
          text,
          imageUrl,
          type: imageUrl ? 'image' : 'text'
        },
        userName,
        userPhoto
      );
      
      return result.success;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  };
  
  // Función para marcar como leído
  const markAsRead = async () => {
    if (!userId || !conversationId) {
      return;
    }
    
    try {
      await chatService.markMessagesAsRead(conversationId, userId);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };
  
  // Función para subir imagen
  const uploadImage = async (uri: string) => {
    if (!conversationId) {
      return null;
    }
    
    try {
      const result = await chatService.uploadMessageImage(uri, conversationId);
      if (result.success && result.data) {
        return result.data;
      }
      return null;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };
  
  return { 
    conversation, 
    messages, 
    loading, 
    error, 
    sendMessage, 
    markAsRead,
    uploadImage
  };
}